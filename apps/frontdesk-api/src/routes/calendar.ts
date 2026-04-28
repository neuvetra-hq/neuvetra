import { Elysia, t } from "elysia"
import { createClient } from "@supabase/supabase-js"
import { db, calendarConnections, businesses, businessMembers } from "@frontdesk/database"
import { eq, and } from "drizzle-orm"
import { discoverCaldavCalendar } from "../services/calendar/caldav"

const GOOGLE_AUTH_URL     = "https://accounts.google.com/o/oauth2/v2/auth"
const GOOGLE_TOKEN_URL    = "https://oauth2.googleapis.com/token"
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

const MS_AUTH_URL    = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
const MS_TOKEN_URL   = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
const MS_GRAPH_ME    = "https://graph.microsoft.com/v1.0/me"

const WEB_URL = Bun.env.WEB_URL ?? "https://neuvetra.com"

const supabase = createClient(
  Bun.env.SUPABASE_URL!,
  Bun.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// ---------------------------------------------------------------------------
// Auth helper — validates Bearer JWT, returns user id or null
// ---------------------------------------------------------------------------

async function getUserId(headers: Record<string, string | undefined>): Promise<string | null> {
  const token = headers["authorization"]?.slice(7)
  if (!token) return null
  const { data } = await supabase.auth.getUser(token)
  return data.user?.id ?? null
}

// ---------------------------------------------------------------------------
// Google OAuth helpers
// ---------------------------------------------------------------------------

function buildGoogleAuthUrl(businessId: string): string {
  const state  = Buffer.from(businessId).toString("base64url")
  const params = new URLSearchParams({
    client_id:     Bun.env.GOOGLE_CLIENT_ID!,
    redirect_uri:  Bun.env.GOOGLE_REDIRECT_URI!,
    response_type: "code",
    scope:         "https://www.googleapis.com/auth/calendar email",
    access_type:   "offline",
    prompt:        "consent", // force refresh_token every time
    state,
  })
  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

async function exchangeCodeForTokens(code: string): Promise<{
  accessToken:  string
  refreshToken: string
  expiresAt:    Date
}> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     Bun.env.GOOGLE_CLIENT_ID!,
      client_secret: Bun.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri:  Bun.env.GOOGLE_REDIRECT_URI!,
      grant_type:    "authorization_code",
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Google token exchange failed: ${err}`)
  }
  const data = await res.json() as {
    access_token: string
    refresh_token: string
    expires_in: number
  }
  return {
    accessToken:  data.access_token,
    refreshToken: data.refresh_token,
    expiresAt:    new Date(Date.now() + data.expires_in * 1000),
  }
}

async function getGoogleUserInfo(accessToken: string): Promise<{ id: string; email: string }> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error("Failed to fetch Google user info")
  return res.json() as Promise<{ id: string; email: string }>
}

async function assertMember(businessId: string, userId: string): Promise<boolean> {
  const [member] = await db
    .select()
    .from(businessMembers)
    .where(and(eq(businessMembers.businessId, businessId), eq(businessMembers.userId, userId)))
    .limit(1)
  return !!member
}

// ---------------------------------------------------------------------------
// Microsoft OAuth helpers
// ---------------------------------------------------------------------------

function buildMicrosoftAuthUrl(businessId: string): string {
  const state  = Buffer.from(businessId).toString("base64url")
  const params = new URLSearchParams({
    client_id:     Bun.env.MICROSOFT_CLIENT_ID!,
    redirect_uri:  Bun.env.MICROSOFT_REDIRECT_URI!,
    response_type: "code",
    scope:         "Calendars.ReadWrite offline_access User.Read",
    response_mode: "query",
    state,
  })
  return `${MS_AUTH_URL}?${params.toString()}`
}

async function exchangeMicrosoftCode(code: string): Promise<{
  accessToken:  string
  refreshToken: string
  expiresAt:    Date
}> {
  const res = await fetch(MS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     Bun.env.MICROSOFT_CLIENT_ID!,
      client_secret: Bun.env.MICROSOFT_CLIENT_SECRET!,
      redirect_uri:  Bun.env.MICROSOFT_REDIRECT_URI!,
      grant_type:    "authorization_code",
      scope:         "Calendars.ReadWrite offline_access User.Read",
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Microsoft token exchange failed: ${err}`)
  }
  const data = await res.json() as {
    access_token: string
    refresh_token: string
    expires_in: number
  }
  return {
    accessToken:  data.access_token,
    refreshToken: data.refresh_token,
    expiresAt:    new Date(Date.now() + data.expires_in * 1000),
  }
}

async function getMicrosoftUserInfo(accessToken: string): Promise<{ id: string; email: string }> {
  const res = await fetch(`${MS_GRAPH_ME}?$select=id,mail,userPrincipalName`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error("Failed to fetch Microsoft user info")
  const data = await res.json() as { id: string; mail?: string; userPrincipalName?: string }
  return { id: data.id, email: data.mail ?? data.userPrincipalName ?? "" }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export const calendarRoutes = new Elysia({ prefix: "/calendar" })

  // GET /calendar/connection/:businessId — current connection status (authenticated)
  .get(
    "/connection/:businessId",
    async ({ params, headers, set }) => {
      const userId = await getUserId(headers)
      if (!userId) { set.status = 401; return { error: "Unauthorized" } }
      if (!(await assertMember(params.businessId, userId))) { set.status = 403; return { error: "Forbidden" } }

      const [conn] = await db
        .select({
          providerEmail: calendarConnections.providerEmail,
          provider:      calendarConnections.provider,
          isActive:      calendarConnections.isActive,
        })
        .from(calendarConnections)
        .where(and(eq(calendarConnections.businessId, params.businessId), eq(calendarConnections.isActive, true)))
        .limit(1)

      return { connection: conn ?? null }
    },
    { params: t.Object({ businessId: t.String() }) },
  )

  // GET /calendar/auth-url?businessId=xxx — returns Google consent URL (authenticated)
  .get(
    "/auth-url",
    async ({ query, headers, set }) => {
      const businessId = (query as Record<string, string>).businessId
      if (!businessId) { set.status = 400; return { error: "businessId is required" } }

      const userId = await getUserId(headers)
      if (!userId) { set.status = 401; return { error: "Unauthorized" } }
      if (!(await assertMember(businessId, userId))) { set.status = 403; return { error: "Forbidden" } }

      return { url: buildGoogleAuthUrl(businessId) }
    },
  )

  // GET /calendar/callback?code=xxx&state=base64(businessId)
  // Google redirects here — no auth header, state carries businessId.
  .get(
    "/callback",
    async ({ query }) => {
      const redirect = (path: string) =>
        new Response(null, { status: 302, headers: { Location: `${WEB_URL}${path}` } })

      const p        = query as Record<string, string>
      const code     = p.code
      const stateB64 = p.state
      const error    = p.error

      if (error || !code || !stateB64) return redirect("/dashboard?calendar=error")

      let businessId: string
      try {
        businessId = Buffer.from(stateB64, "base64url").toString("utf8")
      } catch {
        return redirect("/dashboard?calendar=error")
      }

      const [business] = await db
        .select()
        .from(businesses)
        .where(eq(businesses.id, businessId))
        .limit(1)

      if (!business) return redirect("/dashboard?calendar=error")

      try {
        const { accessToken, refreshToken, expiresAt } = await exchangeCodeForTokens(code)
        const { id: providerAccountId, email: providerEmail } = await getGoogleUserInfo(accessToken)

        await db
          .insert(calendarConnections)
          .values({
            businessId,
            provider:          "google",
            providerAccountId,
            providerEmail,
            accessToken,
            refreshToken,
            tokenExpiry: expiresAt,
            isActive:    true,
            updatedAt:   new Date(),
          })
          .onConflictDoUpdate({
            target: [calendarConnections.businessId, calendarConnections.provider],
            set: {
              providerAccountId,
              providerEmail,
              accessToken,
              refreshToken,
              tokenExpiry: expiresAt,
              isActive:    true,
              updatedAt:   new Date(),
            },
          })

        return redirect("/dashboard?calendar=connected")
      } catch (err) {
        console.error("Calendar OAuth callback error:", err)
        return redirect("/dashboard?calendar=error")
      }
    },
  )

  // DELETE /calendar/:businessId — disconnect active calendar (provider-agnostic)
  .delete(
    "/:businessId",
    async ({ params, headers, set }) => {
      const userId = await getUserId(headers)
      if (!userId) { set.status = 401; return { error: "Unauthorized" } }
      if (!(await assertMember(params.businessId, userId))) { set.status = 403; return { error: "Forbidden" } }

      await db
        .update(calendarConnections)
        .set({ isActive: false, accessToken: null, refreshToken: null, updatedAt: new Date() })
        .where(and(
          eq(calendarConnections.businessId, params.businessId),
          eq(calendarConnections.isActive, true),
        ))

      return { disconnected: true }
    },
    { params: t.Object({ businessId: t.String() }) },
  )

  // GET /calendar/microsoft/auth-url?businessId=xxx
  .get(
    "/microsoft/auth-url",
    async ({ query, headers, set }) => {
      const businessId = (query as Record<string, string>).businessId
      if (!businessId) { set.status = 400; return { error: "businessId is required" } }

      const userId = await getUserId(headers)
      if (!userId) { set.status = 401; return { error: "Unauthorized" } }
      if (!(await assertMember(businessId, userId))) { set.status = 403; return { error: "Forbidden" } }

      return { url: buildMicrosoftAuthUrl(businessId) }
    },
  )

  // POST /calendar/caldav/connect — validate CalDAV credentials + store connection
  .post(
    "/caldav/connect",
    async ({ body, headers, set }) => {
      const { businessId, serverUrl, username, password } = body as {
        businessId: string
        serverUrl:  string
        username:   string
        password:   string
      }

      const userId = await getUserId(headers)
      if (!userId) { set.status = 401; return { error: "Unauthorized" } }
      if (!(await assertMember(businessId, userId))) { set.status = 403; return { error: "Forbidden" } }

      const [business] = await db
        .select()
        .from(businesses)
        .where(eq(businesses.id, businessId))
        .limit(1)
      if (!business) { set.status = 404; return { error: "Business not found" } }

      let calendarUrl: string
      try {
        const discovered = await discoverCaldavCalendar(serverUrl, username, password)
        calendarUrl = discovered.calendarUrl
      } catch (err: unknown) {
        console.error("CalDAV connect error:", err)
        set.status = 422
        return { error: (err instanceof Error ? err.message : "Failed to connect to CalDAV server") }
      }

      // Deactivate any existing active connection
      await db
        .update(calendarConnections)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(
          eq(calendarConnections.businessId, businessId),
          eq(calendarConnections.isActive, true),
        ))

      await db
        .insert(calendarConnections)
        .values({
          businessId,
          provider:          "caldav",
          providerAccountId: calendarUrl,
          providerEmail:     username,
          accessToken:       password,
          refreshToken:      serverUrl,
          tokenExpiry:       null,
          isActive:          true,
          updatedAt:         new Date(),
        })
        .onConflictDoUpdate({
          target: [calendarConnections.businessId, calendarConnections.provider],
          set: {
            providerAccountId: calendarUrl,
            providerEmail:     username,
            accessToken:       password,
            refreshToken:      serverUrl,
            tokenExpiry:       null,
            isActive:          true,
            updatedAt:         new Date(),
          },
        })

      return { connected: true, providerEmail: username }
    },
    {
      body: t.Object({
        businessId: t.String(),
        serverUrl:  t.String(),
        username:   t.String(),
        password:   t.String(),
      }),
    },
  )

  // GET /calendar/microsoft/callback?code=xxx&state=base64(businessId)
  // Microsoft redirects here — no auth header, state carries businessId.
  .get(
    "/microsoft/callback",
    async ({ query }) => {
      const redirect = (path: string) =>
        new Response(null, { status: 302, headers: { Location: `${WEB_URL}${path}` } })

      const p        = query as Record<string, string>
      const code     = p.code
      const stateB64 = p.state
      const error    = p.error

      if (error || !code || !stateB64) return redirect("/dashboard?calendar=error")

      let businessId: string
      try {
        businessId = Buffer.from(stateB64, "base64url").toString("utf8")
      } catch {
        return redirect("/dashboard?calendar=error")
      }

      const [business] = await db
        .select()
        .from(businesses)
        .where(eq(businesses.id, businessId))
        .limit(1)

      if (!business) return redirect("/dashboard?calendar=error")

      try {
        const { accessToken, refreshToken, expiresAt } = await exchangeMicrosoftCode(code)
        const { id: providerAccountId, email: providerEmail } = await getMicrosoftUserInfo(accessToken)

        // Deactivate any existing active connection before inserting the new one
        await db
          .update(calendarConnections)
          .set({ isActive: false, updatedAt: new Date() })
          .where(and(
            eq(calendarConnections.businessId, businessId),
            eq(calendarConnections.isActive, true),
          ))

        await db
          .insert(calendarConnections)
          .values({
            businessId,
            provider:          "outlook",
            providerAccountId,
            providerEmail,
            accessToken,
            refreshToken,
            tokenExpiry: expiresAt,
            isActive:    true,
            updatedAt:   new Date(),
          })
          .onConflictDoUpdate({
            target: [calendarConnections.businessId, calendarConnections.provider],
            set: {
              providerAccountId,
              providerEmail,
              accessToken,
              refreshToken,
              tokenExpiry: expiresAt,
              isActive:    true,
              updatedAt:   new Date(),
            },
          })

        return redirect("/dashboard?calendar=connected")
      } catch (err) {
        console.error("Microsoft calendar OAuth callback error:", err)
        return redirect("/dashboard?calendar=error")
      }
    },
  )
