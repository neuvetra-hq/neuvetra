import { Elysia, t } from "elysia"
import { createClient } from "@supabase/supabase-js"
import { db, businesses, businessMembers, users, calls, knowledgeBase } from "@frontdesk/database"
import { eq, and, gte, lte, sql } from "drizzle-orm"
import { stripe, PLANS, type PlanId } from "../services/stripe"
import { provisionNumber, releaseNumber } from "../services/twilio"

function getSupabaseAdmin() {
  return createClient(Bun.env.SUPABASE_URL!, Bun.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function getUserFromHeader(authHeader: string | undefined): Promise<{ id: string } | null> {
  const token = authHeader?.slice(7)
  if (!token) return null
  const { data } = await getSupabaseAdmin().auth.getUser(token)
  return data.user ?? null
}

export const billingRoutes = new Elysia({ prefix: "/billing" })

  /**
   * POST /billing/setup-intent
   *
   * Called when the user reaches the payment step. Creates (or retrieves) a
   * Stripe Customer for this user and returns a SetupIntent client_secret so
   * the frontend can render the Stripe PaymentElement without any card data
   * ever touching our server.
   */
  .post("/setup-intent", async ({ body }) => {
    const { userId, email, name } = body

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
    if (!user) return { error: "User not found" }

    // Reuse existing Stripe customer if we already created one
    // (edge case: user refreshes the payment step)
    const existingBusiness = await db
      .select()
      .from(businessMembers)
      .innerJoin(businesses, eq(businessMembers.businessId, businesses.id))
      .where(eq(businessMembers.userId, userId))
      .limit(1)

    const existingCustomerId = existingBusiness[0]?.businesses?.stripeCustomerId

    let customerId = existingCustomerId

    if (!customerId) {
      const customer = await stripe.customers.create({
        name,
        phone: user.phone ?? undefined,
        email: email ?? undefined,
        metadata: { userId },
      })
      customerId = customer.id
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      usage: "off_session", // allows future charges without user present
      payment_method_types: ["card"],
    })

    return {
      clientSecret: setupIntent.client_secret,
      customerId,
    }
  }, {
    body: t.Object({
      userId: t.String(),
      name: t.String(),
      email: t.Optional(t.String()),
    }),
  })

  /**
   * POST /billing/activate
   *
   * The single activation call at the end of signup. Atomically:
   *   1. Creates the business record in the DB
   *   2. Creates a Stripe Subscription (flat fee + metered) with 7-day trial
   *   3. Provisions the Twilio phone number
   *   4. Updates the business with all IDs and sets status = active
   *
   * If Stripe or Twilio fail, the business is left in inactive state and no
   * money is charged / no number is purchased.
   */
  .post("/activate", async ({ body }) => {
    const {
      userId, businessName, businessType, phoneNumber, planId,
      paymentMethodId, stripeCustomerId,
      aiName, aiPersonality, aiVoiceGender, aiKbSeed,
    } = body

    const plan = PLANS[planId as PlanId]
    if (!plan) return { error: "Invalid plan" }

    // 1. Create the business in DB (inactive until everything succeeds)
    const slug = `${businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`

    const [business] = await db
      .insert(businesses)
      .values({
        name: businessName,
        slug,
        businessType: businessType as typeof businesses.$inferInsert["businessType"],
        status: "inactive",
        stripeCustomerId,
      })
      .returning()

    await db.insert(businessMembers).values({
      businessId: business.id,
      userId,
      role: "owner",
    })

    try {
      // 2. Ensure payment method is attached and set as default
      // Ignore "already attached" errors — both outcomes are fine
      try {
        await stripe.paymentMethods.attach(paymentMethodId, { customer: stripeCustomerId })
      } catch {
        // already attached — that's fine
      }
      await stripe.customers.update(stripeCustomerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      })

      // 3. Create subscription: flat fee + metered usage, 7-day trial
      const subscription = await stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: [
          { price: plan.flatPriceId },
          { price: plan.meteredPriceId },
        ],
        trial_period_days: 7,
        metadata: { businessId: business.id, planId },
      })

      // 4. Provision Twilio number — may fail if number was taken by someone else
      let purchased: Awaited<ReturnType<typeof provisionNumber>>
      try {
        purchased = await provisionNumber(phoneNumber)
      } catch {
        // Cancel the subscription so the customer isn't charged
        await stripe.subscriptions.cancel(subscription.id)
        return {
          error: "That number was just taken by someone else. Please go back and pick a different one.",
          code: "number_unavailable",
        }
      }

      // 5. Mark business as active with all IDs
      const aiConfigData = (aiName || aiPersonality || aiVoiceGender)
        ? { name: aiName ?? null, personality: aiPersonality ?? null, voiceGender: aiVoiceGender ?? null }
        : null

      await db
        .update(businesses)
        .set({
          status: "active",
          twilioNumber: purchased.phoneNumber,
          twilioNumberSid: purchased.sid,
          stripeSubscriptionId: subscription.id,
          stripePlanId: plan.flatPriceId,
          ...(aiConfigData ? { aiConfig: aiConfigData } : {}),
          updatedAt: new Date(),
        })
        .where(eq(businesses.id, business.id))

      if (aiKbSeed?.trim()) {
        await db.insert(knowledgeBase).values({
          businessId: business.id,
          question: "About my business",
          answer: aiKbSeed.trim(),
          category: "General",
          sortOrder: 0,
        })
      }

      console.log(`✅ Activated business ${business.id} — Twilio: ${purchased.phoneNumber}, Stripe: ${subscription.id}`)

      return {
        businessId: business.id,
        phoneNumber: purchased.phoneNumber,
        plan: planId,
      }
    } catch (err) {
      // Leave business inactive — user can retry. Don't delete it so we keep
      // the customer link for retry attempts.
      console.error("Activation failed:", err)
      return { error: (err as Error).message ?? "Activation failed" }
    }
  }, {
    body: t.Object({
      userId: t.String(),
      businessName: t.String(),
      businessType: t.Union([
        t.Literal("medical"), t.Literal("dental"), t.Literal("spa"),
        t.Literal("salon"), t.Literal("plumbing"), t.Literal("legal"),
        t.Literal("real_estate"), t.Literal("other"),
      ]),
      phoneNumber: t.String(),
      planId: t.Union([t.Literal("starter"), t.Literal("growth"), t.Literal("pro")]),
      paymentMethodId: t.String(),
      stripeCustomerId: t.String(),
      aiName: t.Optional(t.String()),
      aiPersonality: t.Optional(t.String()),
      aiVoiceGender: t.Optional(t.String()),
      aiKbSeed: t.Optional(t.String()),
    }),
  })

  /**
   * POST /billing/report-usage
   *
   * Called from the Retell webhook when a call ends. Reports call duration
   * in minutes to Stripe via the Billing Meters API so overage charges are
   * calculated automatically at the end of each billing period.
   */
  .post("/report-usage", async ({ body }) => {
    const { businessId, durationSeconds } = body

    const [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1)

    if (!business?.stripeCustomerId) {
      return { reported: false, reason: "No Stripe customer found" }
    }

    // Round up to nearest whole minute (billing standard)
    const minutes = Math.ceil(durationSeconds / 60)

    // Stripe Billing Meters API (stripe-node v16+)
    await stripe.billing.meterEvents.create({
      event_name: Bun.env.STRIPE_METER_EVENT_NAME ?? "front_desk_minutes",
      payload: {
        stripe_customer_id: business.stripeCustomerId,
        value: String(minutes),
      },
    })

    return { reported: true, minutes }
  }, {
    body: t.Object({
      businessId: t.String(),
      durationSeconds: t.Number(),
    }),
  })

  /**
   * GET /billing/subscription
   *
   * Returns the current plan and subscription status for the authenticated user.
   */
  .get("/subscription", async ({ headers, set }) => {
    const user = await getUserFromHeader(headers["authorization"])
    if (!user) { set.status = 401; return "Unauthorized" }

    const [row] = await db
      .select({
        stripeSubscriptionId: businesses.stripeSubscriptionId,
        stripePlanId:         businesses.stripePlanId,
      })
      .from(businessMembers)
      .innerJoin(businesses, eq(businessMembers.businessId, businesses.id))
      .where(eq(businessMembers.userId, user.id))
      .limit(1)

    if (!row?.stripeSubscriptionId) return { planId: null, status: "none" }

    const planEntry = Object.entries(PLANS).find(([, p]) => p.flatPriceId === row.stripePlanId)
    const planId = planEntry?.[0] as PlanId | undefined

    const sub = await stripe.subscriptions.retrieve(row.stripeSubscriptionId)

    return {
      planId:           planId ?? null,
      status:           sub.status,
      currentPeriodEnd: sub.items.data[0]?.current_period_end ?? null,
    }
  })

  /**
   * POST /billing/change-plan
   *
   * Swaps both the flat + metered subscription items to the new plan atomically.
   * Creates prorations so the customer is charged or credited the difference.
   */
  .post("/change-plan", async ({ headers, body, set }) => {
    const user = await getUserFromHeader(headers["authorization"])
    if (!user) { set.status = 401; return "Unauthorized" }

    const newPlan = PLANS[body.planId as PlanId]
    if (!newPlan) { set.status = 400; return { error: "Invalid plan" } }

    const [row] = await db
      .select({
        businessId:           businesses.id,
        stripeSubscriptionId: businesses.stripeSubscriptionId,
      })
      .from(businessMembers)
      .innerJoin(businesses, eq(businessMembers.businessId, businesses.id))
      .where(eq(businessMembers.userId, user.id))
      .limit(1)

    if (!row?.stripeSubscriptionId) {
      set.status = 400
      return { error: "No active subscription found" }
    }

    const sub = await stripe.subscriptions.retrieve(row.stripeSubscriptionId)

    // Identify items by usage_type: licensed = flat fee, metered = usage
    const flatItem    = sub.items.data.find(i => i.price.recurring?.usage_type !== "metered")
    const meteredItem = sub.items.data.find(i => i.price.recurring?.usage_type === "metered")

    if (!flatItem || !meteredItem) {
      set.status = 500
      return { error: "Could not identify subscription items" }
    }

    await stripe.subscriptions.update(row.stripeSubscriptionId, {
      items: [
        { id: flatItem.id,    price: newPlan.flatPriceId },
        { id: meteredItem.id, price: newPlan.meteredPriceId },
      ],
      proration_behavior: "create_prorations",
    })

    await db
      .update(businesses)
      .set({ stripePlanId: newPlan.flatPriceId, updatedAt: new Date() })
      .where(eq(businesses.id, row.businessId))

    console.log(`📋 Plan changed → ${body.planId} for business ${row.businessId}`)
    return { success: true, planId: body.planId, planName: newPlan.name }
  }, {
    body: t.Object({
      planId: t.Union([t.Literal("starter"), t.Literal("growth"), t.Literal("pro")]),
    }),
  })

  /**
   * GET /billing/usage
   *
   * Returns minutes used in the current billing period (from our calls table)
   * alongside included minutes and overage for the active plan.
   */
  .get("/usage", async ({ headers, set }) => {
    const user = await getUserFromHeader(headers["authorization"])
    if (!user) { set.status = 401; return "Unauthorized" }

    const empty = { minutesUsed: 0, minutesIncluded: 0, overageMinutes: 0, overageCost: 0, periodStart: null, periodEnd: null, planId: null }

    try {

    const [row] = await db
      .select({
        businessId:           businesses.id,
        stripeSubscriptionId: businesses.stripeSubscriptionId,
        stripePlanId:         businesses.stripePlanId,
      })
      .from(businessMembers)
      .innerJoin(businesses, eq(businessMembers.businessId, businesses.id))
      .where(eq(businessMembers.userId, user.id))
      .limit(1)

    if (!row?.stripeSubscriptionId) return empty

    let sub: Awaited<ReturnType<typeof stripe.subscriptions.retrieve>>
    try {
      sub = await stripe.subscriptions.retrieve(row.stripeSubscriptionId)
    } catch (err) {
      console.error("Stripe subscription retrieve failed:", err)
      return empty
    }

    const item = sub.items.data[0]
    if (!item) {
      console.error("Stripe subscription has no items:", sub.id)
      return empty
    }
    const periodStart = new Date(item.current_period_start * 1000)
    const periodEnd   = new Date(item.current_period_end   * 1000)

    const [usageRow] = await db
      .select({ totalSeconds: sql<number>`COALESCE(SUM(duration_seconds), 0)` })
      .from(calls)
      .where(
        and(
          eq(calls.businessId, row.businessId),
          gte(calls.startedAt, periodStart),
          lte(calls.startedAt, periodEnd),
        )
      )

    const minutesUsed = Math.ceil((usageRow?.totalSeconds ?? 0) / 60)

    const planEntry = Object.entries(PLANS).find(([, p]) => p.flatPriceId === row.stripePlanId)
    const planId    = planEntry?.[0] as PlanId | undefined
    const plan      = planId ? PLANS[planId] : null

    const minutesIncluded = plan?.includedMinutes ?? 0
    const overageMinutes  = Math.max(0, minutesUsed - minutesIncluded)
    const overageCost     = parseFloat((overageMinutes * (plan?.overageRate ?? 0)).toFixed(2))

    return {
      minutesUsed,
      minutesIncluded,
      overageMinutes,
      overageCost,
      periodStart: item.current_period_start,
      periodEnd:   item.current_period_end,
      planId:      planId ?? null,
    }

    } catch (err) {
      console.error("GET /billing/usage error:", err)
      return { minutesUsed: 0, minutesIncluded: 0, overageMinutes: 0, overageCost: 0, periodStart: null, periodEnd: null, planId: null }
    }
  })

  /**
   * GET /billing/invoices
   *
   * Returns the last 24 Stripe invoices for the authenticated user's business.
   */
  .get("/invoices", async ({ headers, set }) => {
    const user = await getUserFromHeader(headers["authorization"])
    if (!user) { set.status = 401; return "Unauthorized" }

    try {
      const [row] = await db
        .select({ stripeCustomerId: businesses.stripeCustomerId })
        .from(businessMembers)
        .innerJoin(businesses, eq(businessMembers.businessId, businesses.id))
        .where(eq(businessMembers.userId, user.id))
        .limit(1)

      if (!row?.stripeCustomerId) return { invoices: [] }

      let result: Awaited<ReturnType<typeof stripe.invoices.list>>
      try {
        result = await stripe.invoices.list({ customer: row.stripeCustomerId, limit: 24 })
      } catch (err) {
        console.error("Stripe invoices list failed:", err)
        return { invoices: [] }
      }

      return {
        invoices: result.data.map((inv) => ({
          id:         inv.id,
          number:     inv.number,
          date:       inv.created,
          amount:     inv.amount_paid,
          currency:   inv.currency,
          status:     inv.status,
          pdfUrl:     inv.invoice_pdf,
          hostedUrl:  inv.hosted_invoice_url,
        })),
      }
    } catch (err) {
      console.error("GET /billing/invoices error:", err)
      return { invoices: [] }
    }
  })

  /**
   * POST /billing/portal
   *
   * Creates a Stripe Customer Portal session for the authenticated user.
   * The portal lets them upgrade, downgrade, update payment method, and view invoices.
   */
  .post("/portal", async ({ headers, set }) => {
    const user = await getUserFromHeader(headers["authorization"])
    if (!user) { set.status = 401; return "Unauthorized" }

    const [row] = await db
      .select({ stripeCustomerId: businesses.stripeCustomerId })
      .from(businessMembers)
      .innerJoin(businesses, eq(businessMembers.businessId, businesses.id))
      .where(eq(businessMembers.userId, user.id))
      .limit(1)

    if (!row?.stripeCustomerId) {
      set.status = 400
      return { error: "No subscription found" }
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: row.stripeCustomerId,
      return_url: `${Bun.env.APP_URL ?? "https://neuvetra.com"}/dashboard/settings`,
    })

    return { url: session.url }
  })

  /**
   * DELETE /billing/account
   *
   * Full account deletion:
   *   1. Cancel Stripe subscription
   *   2. Release Twilio number
   *   3. Delete business + all child rows (cascade)
   *   4. Delete public.users row
   *   5. Delete Supabase auth user
   */
  .delete("/account", async ({ headers, set }) => {
    const user = await getUserFromHeader(headers["authorization"])
    if (!user) { set.status = 401; return "Unauthorized" }

    const [row] = await db
      .select({
        businessId:          businesses.id,
        stripeSubscriptionId: businesses.stripeSubscriptionId,
        twilioNumberSid:     businesses.twilioNumberSid,
      })
      .from(businessMembers)
      .innerJoin(businesses, eq(businessMembers.businessId, businesses.id))
      .where(eq(businessMembers.userId, user.id))
      .limit(1)

    if (row) {
      if (row.stripeSubscriptionId) {
        try { await stripe.subscriptions.cancel(row.stripeSubscriptionId) } catch (e) {
          console.error("Stripe cancel failed:", e)
        }
      }
      if (row.twilioNumberSid) {
        try { await releaseNumber(row.twilioNumberSid) } catch (e) {
          console.error("Twilio release failed:", e)
        }
      }
      // Cascade deletes: calls, knowledgeBase, calendarConnections, callbackRequests, businessMembers
      await db.delete(businesses).where(eq(businesses.id, row.businessId))
    }

    await db.delete(users).where(eq(users.id, user.id))
    await getSupabaseAdmin().auth.admin.deleteUser(user.id)

    console.log(`🗑️ Account deleted: user ${user.id}`)
    return { success: true }
  })
