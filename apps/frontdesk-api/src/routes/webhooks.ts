import { Elysia } from "elysia"
import { db, businesses, calls, callbackRequests, knowledgeBase } from "@frontdesk/database"
import { eq } from "drizzle-orm"
import { retell } from "../services/retell"
import * as CalendarService from "../services/calendar/index"
import { notifyOwnerAppointment } from "../services/notify"

const twiml = (xml: string) =>
  new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${xml}</Response>`, {
    headers: { "Content-Type": "text/xml" },
  })

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format an ISO datetime string for human speech — full date + time. */
function formatForSpeech(iso: string, tz?: string): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday:      "long",
    month:        "long",
    day:          "numeric",
    hour:         "numeric",
    minute:       "2-digit",
    timeZoneName: "short",
    ...(tz ? { timeZone: tz } : {}),
  })
}

/** Format just the time portion of an ISO string (e.g. "1:30 PM PDT"). */
function formatTimeOnly(iso: string, tz?: string): string {
  return new Date(iso).toLocaleString("en-US", {
    hour:         "numeric",
    minute:       "2-digit",
    timeZoneName: "short",
    ...(tz ? { timeZone: tz } : {}),
  })
}

/**
 * Business hours shape stored in aiConfig.businessHours.
 * Same structure as SettingsTab.tsx DEFAULT_HOURS.
 */
interface DayHours { open: boolean; from: string; to: string }
type BusinessHours = Record<string, DayHours>

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

/**
 * Given a Date and a { from: "09:00", to: "17:00" } record,
 * return Date objects for that day's open/close.
 */
function buildDayWindow(date: Date, hours: DayHours): { start: Date; end: Date } {
  const [fh, fm] = hours.from.split(":").map(Number)
  const [th, tm] = hours.to.split(":").map(Number)
  return {
    start: new Date(date.getFullYear(), date.getMonth(), date.getDate(), fh, fm, 0),
    end:   new Date(date.getFullYear(), date.getMonth(), date.getDate(), th, tm, 0),
  }
}

/**
 * Sort time slots by proximity to a target time and return the closest N.
 */
function closestSlots(
  slots: Array<{ start: string; end: string }>,
  target: Date,
  count = 5,
): Array<{ start: string; end: string }> {
  return [...slots]
    .sort((a, b) => {
      const distA = Math.abs(new Date(a.start).getTime() - target.getTime())
      const distB = Math.abs(new Date(b.start).getTime() - target.getTime())
      return distA - distB
    })
    .slice(0, count)
}

/**
 * Convert a naive local datetime string (e.g. "2026-04-17T09:00:00", no timezone suffix)
 * interpreted in the given IANA timezone, to a proper UTC Date.
 *
 * Example: naiveLocalToDate("2026-04-17T09:00:00", "America/Los_Angeles")
 *          → Date for 2026-04-17T16:00:00Z  (9 AM PDT = 4 PM UTC)
 */
function naiveLocalToDate(localDateStr: string, tz: string): Date {
  if (!localDateStr) throw new Error("naiveLocalToDate: empty datetime string")
  // Strip any timezone suffix the LLM may have added (Z or ±HH:MM / ±HHMM)
  // e.g. "2026-04-17T09:00:00-07:00" → "2026-04-17T09:00:00"
  // e.g. "2026-04-17T09:00:00Z"      → "2026-04-17T09:00:00"
  const stripped = localDateStr.replace(/Z$|[+-]\d{2}:?\d{2}$/, "").trim()
  if (!stripped) throw new Error(`naiveLocalToDate: could not parse "${localDateStr}"`)
  const guess   = new Date(stripped + "Z")
  const dtf     = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  })
  const parts   = Object.fromEntries(dtf.formatToParts(guess).map(p => [p.type, p.value]))
  const asLocal = new Date(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`)
  return new Date(guess.getTime() + (guess.getTime() - asLocal.getTime()))
}

/**
 * Build a day's business hours window as UTC Dates, using the business timezone.
 * Correctly handles DST — e.g. "09:00–17:00 America/Los_Angeles" becomes 16:00–00:00 UTC in PDT.
 */
function buildDayWindowTz(dateUtc: Date, hours: DayHours, tz: string): { start: Date; end: Date } {
  const dtf   = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
  })
  const parts = Object.fromEntries(dtf.formatToParts(dateUtc).map(p => [p.type, p.value]))
  const d     = `${parts.year}-${parts.month}-${parts.day}`
  return {
    start: naiveLocalToDate(`${d}T${hours.from}:00`, tz),
    end:   naiveLocalToDate(`${d}T${hours.to}:00`, tz),
  }
}

/**
 * When a requested time is outside business hours, build a human-readable
 * response that includes the reason AND the closest free alternatives within
 * that day's open window — so the AI can offer them in the same turn without
 * a second function call.
 */
async function outsideHoursResponse(
  businessId: string,
  requestedTimeUtc: string,
  durationMinutes: number,
  hoursMap: BusinessHours | undefined,
  tz: string,
): Promise<string> {
  const requested = new Date(requestedTimeUtc)
  const dayName   = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long" }).format(requested)
  const dayHours  = hoursMap?.[dayName]

  // Day is closed entirely
  if (hoursMap && (!dayHours?.open)) {
    return `We're closed on ${dayName}. Which day would work better for you?`
  }

  // Day is open but time is outside the window — find in-hours alternatives
  const reason = `${formatForSpeech(requestedTimeUtc, tz)} is outside our business hours` +
    (dayHours ? ` (${dayHours.from}–${dayHours.to} on ${dayName})` : "") + "."

  if (!dayHours?.open) {
    return `${reason} Could you choose a different time?`
  }

  try {
    const { start: dayOpen, end: dayClose } = buildDayWindowTz(requested, dayHours, tz)
    const allSlots = await CalendarService.checkAvailability(businessId, {
      from:            dayOpen.toISOString(),
      to:              dayClose.toISOString(),
      durationMinutes,
    })

    if (allSlots.length === 0) {
      return `${reason} There are no other openings that day — could you try a different day?`
    }

    const alternatives = closestSlots(allSlots, requested)
    const formatted    = alternatives.map((s) => formatTimeOnly(s.start, tz)).join(", ")
    return `${reason} I have openings at ${formatted}. Which of those works for you?`
  } catch {
    return `${reason} Could you choose a different time?`
  }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export const webhooks = new Elysia({ prefix: "/webhooks" })

  // Called by Twilio on every inbound call
  .post("/voice", async ({ body }) => {
    const called = (body as Record<string, string>).To
    console.log(`/voice incoming: To=${called} From=${(body as Record<string, string>).From}`)

    try {
      if (!called) return twiml("<Hangup/>")

      const [business] = await db
        .select()
        .from(businesses)
        .where(eq(businesses.twilioNumber, called))
        .limit(1)

      // Neuvetra's own demo number — use dedicated agent, no DB lookup needed
      if (called === Bun.env.TWILIO_PHONE_NUMBER && Bun.env.NEUVETRA_AGENT_ID) {
        console.log(`/voice: Neuvetra demo line, agentId=${Bun.env.NEUVETRA_AGENT_ID}`)
        const phoneCall = await retell.call.registerPhoneCall({
          agent_id:    Bun.env.NEUVETRA_AGENT_ID,
          from_number: (body as Record<string, string>).From,
          to_number:   called,
          direction:   "inbound",
        })
        return twiml(`<Dial><Sip>sip:${phoneCall.call_id}@sip.retellai.com</Sip></Dial>`)
      }

      if (!business) {
        console.error(`/voice: no business found for number ${called}`)
        return twiml("<Say>Sorry, this number is not configured. Goodbye.</Say><Hangup/>")
      }

      const agentId = Bun.env.RETELL_AGENT_ID ?? ""
      console.log(`/voice: business=${business.id} agentId=${agentId}`)

      // Fetch knowledge base entries for this business
      const kbRows = await db
        .select({ question: knowledgeBase.question, answer: knowledgeBase.answer })
        .from(knowledgeBase)
        .where(eq(knowledgeBase.businessId, business.id))

      const knowledgeBaseText = kbRows.length > 0
        ? kbRows.map((r) => `Q: ${r.question}\nA: ${r.answer}`).join("\n\n")
        : "No specific knowledge base configured for this business."

      const aiConfig = (business.aiConfig as Record<string, unknown>) ?? {}

      const phoneCall = await retell.call.registerPhoneCall({
        agent_id: agentId,
        from_number: (body as Record<string, string>).From,
        to_number: called,
        direction: "inbound",
        retell_llm_dynamic_variables: {
          business_name:    (aiConfig.businessName as string | undefined) ?? business.name,
          business_type:    business.businessType ?? "service",
          agent_name:       (aiConfig.agentName as string | undefined) ?? "your virtual receptionist",
          owner_phone:      (aiConfig.ownerPhone as string | undefined) ?? "+16507434932",
          knowledge_base:   knowledgeBaseText,
          collect_address:  (aiConfig.collectAddress as boolean | undefined) ? "true" : "false",
        },
      })

      console.log(`/voice: registered call ${phoneCall.call_id}`)

      // Record the call so it appears in the dashboard immediately
      try {
        await db.insert(calls).values({
          businessId:   business.id,
          callerNumber: (body as Record<string, string>).From ?? "",
          retellCallId: phoneCall.call_id,
          status:       "in_progress",
          startedAt:    new Date(),
        })
      } catch (insertErr) {
        // Don't fail the call if the insert fails — log and continue
        console.error("/voice: failed to insert call record:", insertErr)
      }

      return twiml(
        `<Dial><Sip>sip:${phoneCall.call_id}@sip.retellai.com</Sip></Dial>`
      )
    } catch (err) {
      console.error("/voice: unhandled error:", err)
      return twiml("<Say>We're sorry, we couldn't connect your call right now. Please try again shortly.</Say><Hangup/>")
    }
  })

  // Called by Retell AI — handles function calls mid-call and end-of-call events
  .post("/retell", async ({ body }) => {
    const event = body as Record<string, unknown>
    console.log("Retell webhook received:", JSON.stringify(event).slice(0, 300))

    try {

    // ------------------------------------------------------------------
    // Function calls — two formats:
    //   Old LLM webhook:          { event: "function_call", name, call, arguments }
    //   New conversation flow:    { name, call, args }  (no event field)
    // ------------------------------------------------------------------
    const isFunctionCall = event.event === "function_call" ||
      (typeof event.name === "string" && event.event === undefined && event.call !== undefined)

    if (isFunctionCall) {
      const call      = event.call as Record<string, unknown>
      const funcName  = event.name as string
      const funcArgs  = ((event.args ?? event.arguments) ?? {}) as Record<string, unknown>

      const toNumber   = call.to_number as string | undefined
      const fromNumber = call.from_number as string | undefined

      if (!toNumber) return { error: "Missing to_number on call" }

      const [business] = await db
        .select()
        .from(businesses)
        .where(eq(businesses.twilioNumber, toNumber))
        .limit(1)

      if (!business) return { error: "Business not found" }

      // ----------------------------------------------------------------
      // Calendar connection guard — checked once, before any scheduling function.
      //
      // If the business has no active calendar, every scheduling function would
      // silently fail with a generic error. Instead we return a specific, honest
      // message the AI can deliver to the caller, with a real next step.
      // ----------------------------------------------------------------
      const CALENDAR_FUNCTIONS = new Set([
        "check_availability",
        "book_appointment",
        "find_appointment",
        "cancel_appointment",
        "reschedule_appointment",
      ])

      if (CALENDAR_FUNCTIONS.has(funcName)) {
        const connection = await CalendarService.getActiveConnection(business.id)
        if (!connection) {
          return {
            result: "Our scheduling system is temporarily unavailable. I'd be happy to take your name and number so someone from our team can call you back to get you booked in — would that work for you?",
          }
        }
      }

      // ----------------------------------------------------------------
      // check_availability
      //
      // Two modes:
      //   Smart mode  — caller requests a specific time (requested_time param)
      //                 Check that exact slot; if busy, return closest free
      //                 alternatives within business hours for that day.
      //   Window mode — (legacy) from + to window; return up to 6 free slots.
      // ----------------------------------------------------------------
      if (funcName === "check_availability") {
        try {
          const duration      = (funcArgs.duration_minutes as number | undefined) ?? 60
          const requestedTime = funcArgs.requested_time as string | undefined

          if (requestedTime) {
            // --- Smart mode ---
            // Order of checks matters — give the AI a specific reason, not just "unavailable".
            //   1. Is the day open?
            //   2. Is the time within open hours?
            //   3. Is the slot free (freebusy)?

            const aiConfig  = business.aiConfig as { businessHours?: BusinessHours; timezone?: string } | null
            const tz        = aiConfig?.timezone ?? "America/Los_Angeles"

            // Convert naive local time ("2026-04-17T09:00:00") to proper UTC using business timezone
            const requested = naiveLocalToDate(requestedTime, tz)
            const reqEnd    = new Date(requested.getTime() + duration * 60 * 1000)

            // Get day name in business timezone (not UTC — they can differ near midnight)
            const dayName   = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long" }).format(requested)
            const dayHours  = aiConfig?.businessHours?.[dayName]

            // 1. Day closed entirely
            if (dayHours && !dayHours.open) {
              return {
                result: `We're closed on ${dayName}. Which day would work better for you?`,
              }
            }

            // 2. Day is open — check if the requested time falls within hours
            if (dayHours?.open) {
              const { start: dayOpen, end: dayClose } = buildDayWindowTz(requested, dayHours, tz)

              if (requested < dayOpen || reqEnd > dayClose) {
                // Outside hours — scan the open window for alternatives
                const allSlots = await CalendarService.checkAvailability(business.id, {
                  from:            dayOpen.toISOString(),
                  to:              dayClose.toISOString(),
                  durationMinutes: duration,
                })

                if (allSlots.length === 0) {
                  return {
                    result: `That time is outside our business hours of ${dayHours.from}–${dayHours.to}. We don't have any other openings that day — could you try a different day?`,
                  }
                }

                const alternatives = closestSlots(allSlots, requested)
                const formatted    = alternatives.map((s) => formatTimeOnly(s.start, tz)).join(", ")
                return {
                  result: `That time is outside our business hours (${dayHours.from}–${dayHours.to}). I have openings at ${formatted}. Which of those works for you?`,
                }
              }
            }

            // 3. Within hours (or no hours configured) — check freebusy
            const exactSlots = await CalendarService.checkAvailability(business.id, {
              from:            requested.toISOString(),
              to:              reqEnd.toISOString(),
              durationMinutes: duration,
            })

            if (exactSlots.length > 0) {
              return { result: `${formatForSpeech(requested.toISOString(), tz)} is available. Shall I go ahead and book that?` }
            }

            // Slot is taken — find closest alternatives within business hours
            const fallbackHours = dayHours?.open ? dayHours : null
            if (!fallbackHours) {
              return { result: `${formatForSpeech(requested.toISOString(), tz)} is already taken. Could you suggest a different time?` }
            }

            const { start: dayStart, end: dayEnd } = buildDayWindowTz(requested, fallbackHours, tz)
            const allSlots = await CalendarService.checkAvailability(business.id, {
              from:            dayStart.toISOString(),
              to:              dayEnd.toISOString(),
              durationMinutes: duration,
            })

            if (allSlots.length === 0) {
              return { result: `${formatForSpeech(requested.toISOString(), tz)} is taken and there are no other openings that day. Could you try a different day?` }
            }

            const alternatives = closestSlots(allSlots, requested)
            const formatted    = alternatives.map((s) => formatTimeOnly(s.start, tz)).join(", ")
            return {
              result: `${formatForSpeech(requested.toISOString(), tz)} is already taken. The closest available times are: ${formatted}. Which works best?`,
            }
          }

          // --- Window mode (backward-compatible) ---
          const now  = new Date()
          const from = (funcArgs.from as string | undefined) ?? now.toISOString()
          const to   = (funcArgs.to   as string | undefined) ?? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()

          const slots = await CalendarService.checkAvailability(business.id, {
            from,
            to,
            durationMinutes: duration,
          })

          if (slots.length === 0) {
            return { result: "I don't see any availability in that window. Could you try different dates?" }
          }

          const formatted = slots.map((s) => formatForSpeech(s.start)).join(", ")
          return { result: `I have the following times available: ${formatted}. Which works for you?` }

        } catch (err) {
          console.error("check_availability error:", err)
          return { result: "I'm having trouble checking availability right now. Please try again in a moment." }
        }
      }

      // ----------------------------------------------------------------
      // book_appointment
      // ----------------------------------------------------------------
      if (funcName === "book_appointment") {
        const duration = (funcArgs.duration_minutes as number | undefined) ?? 60
        const aiConfig = business.aiConfig as { businessHours?: BusinessHours; timezone?: string } | null
        const tz       = aiConfig?.timezone ?? "America/Los_Angeles"
        try {
          const rawStartTime = funcArgs.start_time as string | undefined
          if (!rawStartTime) {
            return { result: "I'm missing the appointment time — could you confirm what time you'd like?" }
          }
          const startTimeUtc = naiveLocalToDate(rawStartTime, tz).toISOString()
          const customerName = funcArgs.customer_name as string
          const booking  = await CalendarService.bookAppointment(business.id, {
            startTime:       startTimeUtc,
            durationMinutes: duration,
            customerName,
            customerPhone:    funcArgs.customer_phone as string ?? fromNumber ?? "",
            customerEmail:    funcArgs.customer_email as string | undefined,
            reason:           funcArgs.reason as string,
            customerAddress:  funcArgs.customer_address as string | undefined,
          })

          const endTime = new Date(new Date(booking.startTime).getTime() + duration * 60 * 1000)
          const confirmText = `Your appointment is confirmed for ${formatForSpeech(booking.startTime, tz)} to ${formatTimeOnly(endTime.toISOString(), tz)} for ${customerName}.`

          // Fire-and-forget — never awaited so it can't delay or break the response
          notifyOwnerAppointment(business.id, "booked", {
            customerName,
            customerPhone: funcArgs.customer_phone as string ?? fromNumber ?? "",
            when:          `${formatForSpeech(booking.startTime, tz)} – ${formatTimeOnly(endTime.toISOString(), tz)}`,
            reason:        funcArgs.reason as string | undefined,
          })

          return { result: confirmText }
        } catch (err) {
          const msg = (err as Error).message ?? ""
          console.error("book_appointment error:", err)
          if (msg.includes("outside business hours") || msg.includes("closed on")) {
            // startTimeUtc may not be defined if naiveLocalToDate threw — fall back to generic message
            const startForFallback = (funcArgs.start_time as string | undefined) ?? new Date().toISOString()
            try {
              const utcFallback = naiveLocalToDate(startForFallback, aiConfig?.timezone ?? "America/Los_Angeles").toISOString()
              const response = await outsideHoursResponse(business.id, utcFallback, duration, aiConfig?.businessHours, aiConfig?.timezone ?? "America/Los_Angeles")
              return { result: response }
            } catch {
              // ignore
            }
          }
          return { result: "I wasn't able to complete the booking just now. Please try again or call back and we'll get that sorted." }
        }
      }

      // ----------------------------------------------------------------
      // find_appointment
      // Uses the caller's Twilio from_number as the ownership key.
      // The AI never needs to ask the caller for an ID.
      // ----------------------------------------------------------------
      if (funcName === "find_appointment") {
        try {
          if (!fromNumber) {
            return { result: "I wasn't able to identify your phone number, so I can't look up appointments." }
          }

          const appointments = await CalendarService.findAppointmentsByPhone(business.id, fromNumber)

          if (appointments.length === 0) {
            return { result: "I don't see any upcoming appointments linked to your number." }
          }

          const n    = appointments.length
          const list = appointments
            .map((a, i) => `${i + 1}. ${a.reason} on ${formatForSpeech(a.startTime)}`)
            .join("; ")

          return {
            result: `I found ${n} upcoming appointment${n > 1 ? "s" : ""} for you: ${list}. Would you like to cancel or reschedule one?`,
            // Pass structured data so the AI can reference event IDs internally
            appointments: appointments.map((a) => ({ eventId: a.eventId, summary: a.summary, startTime: a.startTime })),
          }
        } catch (err) {
          console.error("find_appointment error:", err)
          return { result: "I'm having trouble looking up appointments right now. Please try again in a moment." }
        }
      }

      // ----------------------------------------------------------------
      // cancel_appointment
      // event_id comes from a prior find_appointment result held in the
      // AI's context — the caller never speaks it aloud.
      // Ownership is re-verified server-side via the caller's phone.
      // ----------------------------------------------------------------
      if (funcName === "cancel_appointment") {
        try {
          if (!fromNumber) {
            return { result: "I wasn't able to verify your phone number, so I can't cancel the appointment." }
          }

          const eventId = funcArgs.event_id as string
          if (!eventId) {
            return { result: "I'm not sure which appointment to cancel — could you clarify which one?" }
          }

          const cancelled = await CalendarService.cancelAppointment(business.id, fromNumber, eventId)
          const aiConfig  = business.aiConfig as { timezone?: string } | null
          const tz        = aiConfig?.timezone ?? "America/Los_Angeles"

          notifyOwnerAppointment(business.id, "cancelled", {
            customerName:  "",
            customerPhone: fromNumber,
            when:          formatForSpeech(cancelled.startTime, tz),
          })

          return { result: "Done, that appointment has been cancelled." }
        } catch (err) {
          const msg = (err as Error).message ?? ""
          console.error("cancel_appointment error:", err)
          if (msg.includes("No appointment found")) {
            return { result: "I couldn't find that appointment linked to your number, so no changes were made." }
          }
          return { result: "I wasn't able to cancel the appointment just now. Please try again in a moment." }
        }
      }

      // ----------------------------------------------------------------
      // reschedule_appointment
      // event_id from prior find_appointment; new_start_time from caller.
      // Ownership re-verified; new slot availability checked before patching.
      // ----------------------------------------------------------------
      if (funcName === "reschedule_appointment") {
        const aiConfig = business.aiConfig as { businessHours?: BusinessHours; timezone?: string } | null
        const tz       = aiConfig?.timezone ?? "America/Los_Angeles"
        const duration = (funcArgs.duration_minutes as number | undefined) ?? 60
        try {
          const rawNewStart = funcArgs.new_start_time as string | undefined
          if (!rawNewStart) {
            return { result: "I'm missing the new appointment time — could you confirm when you'd like to reschedule to?" }
          }
          const newStartTimeUtc = naiveLocalToDate(rawNewStart, tz).toISOString()
          if (!fromNumber) {
            return { result: "I wasn't able to verify your phone number, so I can't reschedule the appointment." }
          }

          const eventId = funcArgs.event_id as string
          if (!eventId || !newStartTimeUtc) {
            return { result: "I need both the appointment and the new time to reschedule — could you confirm those details?" }
          }

          const updated = await CalendarService.rescheduleAppointment(
            business.id,
            fromNumber,
            eventId,
            newStartTimeUtc,
            duration,
          )

          notifyOwnerAppointment(business.id, "rescheduled", {
            customerName:  "",
            customerPhone: fromNumber,
            when:          formatForSpeech(updated.startTime, tz),
          })

          return {
            result: `Done! Your appointment has been rescheduled to ${formatForSpeech(updated.startTime, tz)}.`,
          }
        } catch (err) {
          const msg = (err as Error).message ?? ""
          console.error("reschedule_appointment error:", err)
          if (msg.includes("No appointment found")) {
            return { result: "I couldn't find that appointment linked to your number, so no changes were made." }
          }
          if (msg.includes("outside business hours") || msg.includes("closed on")) {
            try {
              const rawFallback = funcArgs.new_start_time as string | undefined
              if (rawFallback) {
                const utcFallback = naiveLocalToDate(rawFallback, tz).toISOString()
                const response = await outsideHoursResponse(business.id, utcFallback, duration, aiConfig?.businessHours, tz)
                return { result: response }
              }
            } catch { /* ignore */ }
          }
          if (msg.includes("not available")) {
            return { result: "That time slot is already taken — could you choose a different time?" }
          }
          return { result: "I wasn't able to reschedule just now. Please try again in a moment." }
        }
      }

      // ----------------------------------------------------------------
      // take_message
      // Works without a calendar — saves caller name, phone, and reason
      // so the business owner can follow up. Used when scheduling is
      // unavailable OR for businesses that prefer a callback model.
      // ----------------------------------------------------------------
      if (funcName === "take_message") {
        try {
          const callerName  = funcArgs.caller_name  as string | undefined
          const callerPhone = (funcArgs.caller_phone as string | undefined) ?? fromNumber ?? ""
          const message     = funcArgs.message       as string | undefined

          await db.insert(callbackRequests).values({
            businessId:  business.id,
            callerPhone,
            callerName:  callerName ?? null,
            message:     message   ?? null,
            status:      "pending",
          })

          const nameClause = callerName ? `, ${callerName},` : ""
          return {
            result: `Done! I've noted that down. Someone will call${nameClause} back at ${callerPhone} shortly.`,
          }
        } catch (err) {
          console.error("take_message error:", err)
          return { result: "I wasn't able to save that just now. Please try calling back in a moment." }
        }
      }

      return { result: "Unknown function" }
    }

    // ------------------------------------------------------------------
    // call_ended — mark call completed + save transcript/duration.
    // NOTE: call_analysis is NOT available at call_ended time — Retell
    // sends it separately via call_analyzed (handled below).
    // ------------------------------------------------------------------
    if (event.event === "call_ended") {
      const call = event.call as Record<string, unknown> | undefined
      if (call?.call_id) {
        await db
          .update(calls)
          .set({
            status:          "completed",
            transcript:      call.transcript as string | undefined ?? null,
            durationSeconds: call.duration_ms ? Math.round((call.duration_ms as number) / 1000) : null,
            endedAt:         new Date(),
          })
          .where(eq(calls.retellCallId, call.call_id as string))
      }
    }

    // ------------------------------------------------------------------
    // call_analyzed — Retell fires this ~30s after call_ended once the
    // post-call AI analysis is complete. This is the only reliable place
    // to read call_summary.
    // ------------------------------------------------------------------
    if (event.event === "call_analyzed") {
      const call = event.call as Record<string, unknown> | undefined
      if (call?.call_id) {
        const summary = (call.call_analysis as Record<string, unknown> | undefined)?.call_summary as string | undefined ?? null
        await db
          .update(calls)
          .set({ summary })
          .where(eq(calls.retellCallId, call.call_id as string))
      }
    }

    return { received: true }

    } catch (err) {
      console.error("Retell webhook unhandled error:", err)
      console.error("Event body was:", JSON.stringify(event))
      // Return 200 so Retell doesn't retry — log the error for investigation
      return { received: true, error: (err as Error).message }
    }
  })
