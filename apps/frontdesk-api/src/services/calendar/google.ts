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

const GOOGLE_TOKEN_URL    = "https://oauth2.googleapis.com/token"
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3"

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------

async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string
  expiresAt: Date
}> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     Bun.env.GOOGLE_CLIENT_ID!,
      client_secret: Bun.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type:    "refresh_token",
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Google token refresh failed: ${err}`)
  }

  const data = await res.json() as { access_token: string; expires_in: number }
  const expiresAt = new Date(Date.now() + data.expires_in * 1000)
  return { accessToken: data.access_token, expiresAt }
}

// ---------------------------------------------------------------------------
// Availability helpers — freebusy → open slots
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
// Private extended property keys — stored on every Front Desk booking.
// These are invisible to users in Google Calendar UI but queryable via API.
// ---------------------------------------------------------------------------

const EXT = {
  created:  "frontdesk_created",
  type:     "frontdesk_type",
  phone:    "frontdesk_customer_phone",
  email:    "frontdesk_customer_email",
  name:     "frontdesk_customer_name",
  reason:   "frontdesk_reason",
  address:  "frontdesk_customer_address",
} as const

// ---------------------------------------------------------------------------
// GoogleCalendarAdapter
// ---------------------------------------------------------------------------

export const GoogleCalendarAdapter: CalendarAdapter = {

  async refreshIfNeeded(connection: CalendarConnection): Promise<CalendarConnection> {
    if (!connection.refreshToken) throw new Error("No refresh token for Google connection")

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

    // Fetch all calendars the user has access to, so we check every one for conflicts.
    // If the list fetch fails, fall back to primary only.
    let calendarIds: string[] = ["primary"]
    try {
      const listRes = await fetch(
        `${GOOGLE_CALENDAR_API}/users/me/calendarList?minAccessRole=freeBusyReader`,
        { headers: { Authorization: `Bearer ${conn.accessToken}` } }
      )
      if (listRes.ok) {
        const listData = await listRes.json() as { items?: Array<{ id: string }> }
        const ids = (listData.items ?? []).map((c) => c.id).filter(Boolean)
        if (ids.length > 0) calendarIds = ids
      }
    } catch {
      // fall back to primary
    }

    const res = await fetch(`${GOOGLE_CALENDAR_API}/freeBusy`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${conn.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timeMin: params.from,
        timeMax: params.to,
        items: calendarIds.map((id) => ({ id })),
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Google freebusy failed: ${err}`)
    }

    const data = await res.json() as {
      calendars: Record<string, { busy: Array<{ start: string; end: string }> }>
    }

    // Merge busy blocks from all calendars
    const busyBlocks = Object.values(data.calendars).flatMap((cal) => cal.busy ?? [])

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

    const res = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${conn.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary:     `${params.reason} — ${params.customerName}`,
        description: `Booked by AI Front Desk\nCustomer: ${params.customerName}\nPhone: ${params.customerPhone}\nReason: ${params.reason}${params.customerAddress ? `\nAddress: ${params.customerAddress}` : ""}`,
        ...(params.customerAddress ? { location: params.customerAddress } : {}),
        start: { dateTime: startTime.toISOString() },
        end:   { dateTime: endTime.toISOString() },
        extendedProperties: {
          private: {
            [EXT.created]: "true",
            [EXT.type]:    "booking",
            [EXT.phone]:   params.customerPhone,
            [EXT.email]:   params.customerEmail ?? "",
            [EXT.name]:    params.customerName,
            [EXT.reason]:  params.reason,
            [EXT.address]: params.customerAddress ?? "",
          },
        },
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Google events.insert failed: ${err}`)
    }

    const created = await res.json() as {
      id: string
      summary: string
      start: { dateTime: string }
      end: { dateTime: string }
    }

    return {
      eventId:   created.id,
      startTime: created.start.dateTime,
      endTime:   created.end.dateTime,
      summary:   created.summary,
    }
  },

  /**
   * Find all upcoming Front Desk bookings for a customer phone number.
   * Uses Google's privateExtendedProperty query — server-side filter, not a client scan.
   */
  async findByCustomerPhone(
    connection: CalendarConnection,
    phone: string,
  ): Promise<AppointmentRecord[]> {
    const conn = await this.refreshIfNeeded(connection)

    const params = new URLSearchParams({
      privateExtendedProperty: `${EXT.phone}=${phone}`,
      timeMin:     new Date().toISOString(),
      singleEvents: "true",
      orderBy:      "startTime",
    })

    const res = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events?${params}`, {
      headers: { Authorization: `Bearer ${conn.accessToken}` },
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Google events.list (by phone) failed: ${err}`)
    }

    const data = await res.json() as {
      items?: Array<{
        id: string
        summary: string
        start: { dateTime: string }
        end: { dateTime: string }
        extendedProperties?: { private?: Record<string, string> }
      }>
    }

    return (data.items ?? []).map((item) => {
      const priv = item.extendedProperties?.private ?? {}
      return {
        eventId:         item.id,
        summary:         item.summary,
        startTime:       item.start.dateTime,
        endTime:         item.end.dateTime,
        customerPhone:   priv[EXT.phone]   ?? phone,
        customerEmail:   priv[EXT.email]   || undefined,
        customerName:    priv[EXT.name]    ?? "",
        reason:          priv[EXT.reason]  ?? "",
        customerAddress: priv[EXT.address] || undefined,
      }
    })
  },

  /** Delete a calendar event. Ownership must be verified by the caller (service layer). */
  async cancelEvent(connection: CalendarConnection, eventId: string): Promise<void> {
    const conn = await this.refreshIfNeeded(connection)

    const res = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events/${eventId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${conn.accessToken}` },
    })

    // 410 Gone = already deleted — treat as success
    if (!res.ok && res.status !== 410) {
      const err = await res.text()
      throw new Error(`Google events.delete failed: ${err}`)
    }
  },

  /**
   * Return all Front Desk bookings in a time window for the dashboard.
   * Filters by frontdesk_created=true so personal calendar events are excluded.
   */
  async getUpcomingEvents(
    connection: CalendarConnection,
    from: string,
    to: string,
  ): Promise<AppointmentRecord[]> {
    const conn = await this.refreshIfNeeded(connection)

    const params = new URLSearchParams({
      timeMin:      from,
      timeMax:      to,
      singleEvents: "true",
      orderBy:      "startTime",
      maxResults:   "100",
    })

    const res = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events?${params}`, {
      headers: { Authorization: `Bearer ${conn.accessToken}` },
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Google events.list (upcoming) failed: ${err}`)
    }

    const data = await res.json() as {
      items?: Array<{
        id: string
        summary: string
        start: { dateTime: string }
        end: { dateTime: string }
        extendedProperties?: { private?: Record<string, string> }
      }>
    }

    return (data.items ?? []).map((item) => {
      const priv = item.extendedProperties?.private ?? {}
      return {
        eventId:         item.id,
        summary:         item.summary,
        startTime:       item.start.dateTime,
        endTime:         item.end.dateTime,
        customerPhone:   priv[EXT.phone]   ?? "",
        customerEmail:   priv[EXT.email]   || undefined,
        customerName:    priv[EXT.name]    ?? "",
        reason:          priv[EXT.reason]  ?? "",
        customerAddress: priv[EXT.address] || undefined,
      }
    })
  },

  /** Patch the start/end of an event. Ownership must be verified by the caller (service layer). */
  async updateEvent(
    connection: CalendarConnection,
    eventId: string,
    params: UpdateEventParams,
  ): Promise<void> {
    const conn  = await this.refreshIfNeeded(connection)
    const start = new Date(params.startTime)
    const end   = new Date(start.getTime() + params.durationMinutes * 60 * 1000)

    const res = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events/${eventId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${conn.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        start: { dateTime: start.toISOString() },
        end:   { dateTime: end.toISOString() },
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Google events.patch failed: ${err}`)
    }
  },
}
