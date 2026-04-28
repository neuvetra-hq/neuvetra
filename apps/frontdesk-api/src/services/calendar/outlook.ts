import { db, calendarConnections } from "@frontdesk/database"
import { eq } from "drizzle-orm"
import type {
  CalendarAdapter,
  CalendarConnection,
  CheckAvailabilityParams,
  BookAppointmentParams,
  BookingResult,
  TimeSlot,
  AppointmentRecord,
  UpdateEventParams,
} from "./types"

const MS_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
const MS_GRAPH_URL = "https://graph.microsoft.com/v1.0"

// Open extension name for Front Desk metadata on every booked event.
// Stored as a Graph open extension — invisible in Outlook UI but queryable via API.
const EXT_NAME = "com.frontdesk.booking"

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------

async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string
  expiresAt: Date
}> {
  const res = await fetch(MS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     Bun.env.MICROSOFT_CLIENT_ID!,
      client_secret: Bun.env.MICROSOFT_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type:    "refresh_token",
      scope:         "Calendars.ReadWrite offline_access User.Read",
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Microsoft token refresh failed: ${err}`)
  }

  const data = await res.json() as { access_token: string; expires_in: number }
  return {
    accessToken: data.access_token,
    expiresAt:   new Date(Date.now() + data.expires_in * 1000),
  }
}

// ---------------------------------------------------------------------------
// Free-slot computation (same algorithm as Google adapter)
// ---------------------------------------------------------------------------

function buildOpenSlots(
  busyBlocks: Array<{ start: string; end: string }>,
  from: Date,
  to: Date,
  durationMs: number,
): TimeSlot[] {
  const sorted = [...busyBlocks].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  )

  const slots: TimeSlot[] = []
  let cursor = from.getTime()

  for (const block of sorted) {
    const blockStart = new Date(block.start).getTime()
    while (cursor + durationMs <= blockStart) {
      slots.push({
        start: new Date(cursor).toISOString(),
        end:   new Date(cursor + durationMs).toISOString(),
      })
      cursor += durationMs
    }
    const blockEnd = new Date(block.end).getTime()
    if (blockEnd > cursor) cursor = blockEnd
  }

  while (cursor + durationMs <= to.getTime()) {
    slots.push({
      start: new Date(cursor).toISOString(),
      end:   new Date(cursor + durationMs).toISOString(),
    })
    cursor += durationMs
  }

  return slots.slice(0, 6)
}

// ---------------------------------------------------------------------------
// Graph response types
// ---------------------------------------------------------------------------

interface GraphEvent {
  id: string
  subject: string
  start: { dateTime: string; timeZone: string }
  end:   { dateTime: string; timeZone: string }
  extensions?: Array<{
    id: string
    frontdesk_customer_phone?:   string
    frontdesk_customer_email?:   string
    frontdesk_customer_name?:    string
    frontdesk_reason?:           string
    frontdesk_created?:          string
    frontdesk_customer_address?: string
  }>
}

function toISO(dateTime: string, timeZone: string): string {
  // Graph returns naive local times with a separate timezone field.
  // We normalise to UTC ISO string for consistency with the rest of the system.
  const d = new Date(`${dateTime}Z`) // treat as UTC first
  const offset = new Intl.DateTimeFormat("en", {
    timeZone,
    timeZoneName: "shortOffset",
  })
    .formatToParts(d)
    .find((p) => p.type === "timeZoneName")?.value ?? "UTC+0"

  const match = offset.match(/UTC([+-]\d+(?::\d+)?)/)
  if (!match) return d.toISOString()

  const [hours, minutes = "0"] = match[1].replace("+", "").split(":")
  const offsetMs = (parseInt(hours) * 60 + parseInt(minutes)) * 60 * 1000 * (match[1].startsWith("-") ? -1 : 1)
  return new Date(d.getTime() - offsetMs).toISOString()
}

function graphEventToRecord(event: GraphEvent): AppointmentRecord | null {
  const ext = event.extensions?.find((e) => e.id.includes(EXT_NAME))
  if (!ext?.frontdesk_created) return null

  return {
    eventId:         event.id,
    summary:         event.subject,
    startTime:       toISO(event.start.dateTime, event.start.timeZone),
    endTime:         toISO(event.end.dateTime, event.end.timeZone),
    customerPhone:   ext.frontdesk_customer_phone   ?? "",
    customerEmail:   ext.frontdesk_customer_email   || undefined,
    customerName:    ext.frontdesk_customer_name    ?? "",
    reason:          ext.frontdesk_reason           ?? "",
    customerAddress: ext.frontdesk_customer_address || undefined,
  }
}

// ---------------------------------------------------------------------------
// OutlookCalendarAdapter
// ---------------------------------------------------------------------------

export const OutlookCalendarAdapter: CalendarAdapter = {

  async refreshIfNeeded(connection: CalendarConnection): Promise<CalendarConnection> {
    if (!connection.refreshToken) throw new Error("No refresh token for Microsoft connection")

    const needsRefresh =
      !connection.tokenExpiry ||
      connection.tokenExpiry.getTime() - Date.now() < 5 * 60 * 1000

    if (!needsRefresh) return connection

    const { accessToken, expiresAt } = await refreshAccessToken(connection.refreshToken)

    await db
      .update(calendarConnections)
      .set({ accessToken, tokenExpiry: expiresAt, updatedAt: new Date() })
      .where(eq(calendarConnections.id, connection.id))

    return { ...connection, accessToken, tokenExpiry: expiresAt }
  },

  async checkAvailability(params: CheckAvailabilityParams): Promise<TimeSlot[]> {
    const conn = await this.refreshIfNeeded(params.connection)

    // Fetch all events in the window — each event counts as a busy block.
    const qs = new URLSearchParams({
      startDateTime: params.from,
      endDateTime:   params.to,
      $select:       "start,end",
      $top:          "100",
    })

    const res = await fetch(`${MS_GRAPH_URL}/me/calendarView?${qs}`, {
      headers: {
        Authorization: `Bearer ${conn.accessToken}`,
        Prefer:        'outlook.timezone="UTC"',
      },
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Microsoft calendarView (availability) failed: ${err}`)
    }

    const data = await res.json() as { value: Array<{ start: { dateTime: string }; end: { dateTime: string } }> }
    const busyBlocks = (data.value ?? []).map((e) => ({
      start: e.start.dateTime.endsWith("Z") ? e.start.dateTime : `${e.start.dateTime}Z`,
      end:   e.end.dateTime.endsWith("Z")   ? e.end.dateTime   : `${e.end.dateTime}Z`,
    }))

    return buildOpenSlots(
      busyBlocks,
      new Date(params.from),
      new Date(params.to),
      params.durationMinutes * 60 * 1000,
    )
  },

  async bookAppointment(params: BookAppointmentParams): Promise<BookingResult> {
    const conn = await this.refreshIfNeeded(params.connection)

    const startTime = new Date(params.startTime)
    const endTime   = new Date(startTime.getTime() + params.durationMinutes * 60 * 1000)

    const res = await fetch(`${MS_GRAPH_URL}/me/events`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${conn.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subject: `${params.reason} — ${params.customerName}`,
        body: {
          contentType: "text",
          content: `Booked by AI Front Desk\nCustomer: ${params.customerName}\nPhone: ${params.customerPhone}\nReason: ${params.reason}${params.customerAddress ? `\nAddress: ${params.customerAddress}` : ""}`,
        },
        ...(params.customerAddress ? { location: { displayName: params.customerAddress } } : {}),
        start: { dateTime: startTime.toISOString(), timeZone: "UTC" },
        end:   { dateTime: endTime.toISOString(),   timeZone: "UTC" },
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Microsoft events.create failed: ${err}`)
    }

    const created = await res.json() as GraphEvent

    // Attach open extension with Front Desk ownership metadata
    const extRes = await fetch(`${MS_GRAPH_URL}/me/events/${created.id}/extensions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${conn.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        "@odata.type":                "microsoft.graph.openTypeExtension",
        extensionName:                EXT_NAME,
        frontdesk_created:            "true",
        frontdesk_customer_phone:     params.customerPhone,
        frontdesk_customer_email:     params.customerEmail ?? "",
        frontdesk_customer_name:      params.customerName,
        frontdesk_reason:             params.reason,
        frontdesk_customer_address:   params.customerAddress ?? "",
      }),
    })

    if (!extRes.ok) {
      // Extension failed — not fatal, event was still created
      console.warn("Microsoft: failed to attach open extension to event", created.id, await extRes.text())
    }

    return {
      eventId:   created.id,
      startTime: startTime.toISOString(),
      endTime:   endTime.toISOString(),
      summary:   created.subject,
    }
  },

  async findByCustomerPhone(
    connection: CalendarConnection,
    phone: string,
  ): Promise<AppointmentRecord[]> {
    const conn = await this.refreshIfNeeded(connection)

    // Fetch upcoming events with open extensions expanded, then filter client-side.
    // Graph's $filter on open extension properties requires complex OData syntax;
    // client-side filtering is simpler and reliable for the typical event volume.
    const qs = new URLSearchParams({
      startDateTime: new Date().toISOString(),
      endDateTime:   new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(), // 6 months
      $expand:       "extensions($filter=id eq 'Microsoft.OutlookServices.OpenTypeExtension." + EXT_NAME + "')",
      $select:       "id,subject,start,end,extensions",
      $top:          "100",
    })

    const res = await fetch(`${MS_GRAPH_URL}/me/calendarView?${qs}`, {
      headers: {
        Authorization: `Bearer ${conn.accessToken}`,
        Prefer:        'outlook.timezone="UTC"',
      },
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Microsoft calendarView (by phone) failed: ${err}`)
    }

    const data = await res.json() as { value: GraphEvent[] }

    return (data.value ?? [])
      .map(graphEventToRecord)
      .filter((r): r is AppointmentRecord => r !== null && r.customerPhone === phone)
  },

  async cancelEvent(connection: CalendarConnection, eventId: string): Promise<void> {
    const conn = await this.refreshIfNeeded(connection)

    const res = await fetch(`${MS_GRAPH_URL}/me/events/${eventId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${conn.accessToken}` },
    })

    // 404 = already gone — treat as success
    if (!res.ok && res.status !== 404) {
      const err = await res.text()
      throw new Error(`Microsoft events.delete failed: ${err}`)
    }
  },

  async updateEvent(
    connection: CalendarConnection,
    eventId: string,
    params: UpdateEventParams,
  ): Promise<void> {
    const conn  = await this.refreshIfNeeded(connection)
    const start = new Date(params.startTime)
    const end   = new Date(start.getTime() + params.durationMinutes * 60 * 1000)

    const res = await fetch(`${MS_GRAPH_URL}/me/events/${eventId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${conn.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        start: { dateTime: start.toISOString(), timeZone: "UTC" },
        end:   { dateTime: end.toISOString(),   timeZone: "UTC" },
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Microsoft events.update failed: ${err}`)
    }
  },

  async getUpcomingEvents(
    connection: CalendarConnection,
    from: string,
    to: string,
  ): Promise<AppointmentRecord[]> {
    const conn = await this.refreshIfNeeded(connection)

    const qs = new URLSearchParams({
      startDateTime: from,
      endDateTime:   to,
      $expand:       "extensions($filter=id eq 'Microsoft.OutlookServices.OpenTypeExtension." + EXT_NAME + "')",
      $select:       "id,subject,start,end,extensions",
      $top:          "100",
      $orderby:      "start/dateTime asc",
    })

    const res = await fetch(`${MS_GRAPH_URL}/me/calendarView?${qs}`, {
      headers: {
        Authorization: `Bearer ${conn.accessToken}`,
        Prefer:        'outlook.timezone="UTC"',
      },
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Microsoft calendarView (upcoming) failed: ${err}`)
    }

    const data = await res.json() as { value: GraphEvent[] }

    return (data.value ?? []).map((event) => {
      const ext = event.extensions?.find((e) => e.id.includes(EXT_NAME))
      return {
        eventId:         event.id,
        summary:         event.subject,
        startTime:       toISO(event.start.dateTime, event.start.timeZone),
        endTime:         toISO(event.end.dateTime,   event.end.timeZone),
        customerPhone:   ext?.frontdesk_customer_phone   ?? "",
        customerEmail:   ext?.frontdesk_customer_email   || undefined,
        customerName:    ext?.frontdesk_customer_name    ?? "",
        reason:          ext?.frontdesk_reason           ?? "",
        customerAddress: ext?.frontdesk_customer_address || undefined,
      }
    })
  },
}
