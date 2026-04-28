import { DAVClient } from "tsdav"
import nodeFetch from "node-fetch"
import { db, calendarConnections } from "@frontdesk/database"
import { eq } from "drizzle-orm"
import { randomUUID } from "crypto"
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

// ---------------------------------------------------------------------------
// Column mapping for CalDAV connections
//
// accessToken      → password (or app-specific password)
// refreshToken     → server base URL (e.g. https://caldav.icloud.com)
// providerAccountId → discovered calendar URL (the specific calendar)
// providerEmail    → username / Apple ID / email
// tokenExpiry      → null (CalDAV uses Basic Auth — no token expiry)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// iCal helpers
// ---------------------------------------------------------------------------

const PRODID = "-//Front Desk//neuvetra.com//EN"

function formatICalDate(iso: string): string {
  // iCal UTC format: 20260421T110000Z
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "")
}

function buildICalEvent(params: {
  uid:             string
  summary:         string
  description:     string
  startTime:       string
  endTime:         string
  customerPhone:   string
  customerEmail:   string
  customerName:    string
  reason:          string
  customerAddress: string
}): string {
  const now = formatICalDate(new Date().toISOString())
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${params.uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${formatICalDate(params.startTime)}`,
    `DTEND:${formatICalDate(params.endTime)}`,
    `SUMMARY:${params.summary}`,
    `DESCRIPTION:${params.description.replace(/\n/g, "\\n")}`,
    "X-FRONTDESK-CREATED:true",
    `X-FRONTDESK-PHONE:${params.customerPhone}`,
    `X-FRONTDESK-EMAIL:${params.customerEmail}`,
    `X-FRONTDESK-NAME:${params.customerName}`,
    `X-FRONTDESK-REASON:${params.reason}`,
  ]
  if (params.customerAddress) {
    lines.push(`LOCATION:${params.customerAddress}`)
    lines.push(`X-FRONTDESK-ADDRESS:${params.customerAddress}`)
  }
  lines.push("END:VEVENT", "END:VCALENDAR")
  return lines.join("\r\n")
}

function parseICalProp(ical: string, prop: string): string {
  const match = ical.match(new RegExp(`^${prop}[;:](.+)$`, "m"))
  return match ? match[1].trim().replace(/\\n/g, "\n") : ""
}

function parseICalDate(value: string): string {
  // Handles: 20260421T110000Z or 20260421T110000 (local) or VALUE=DATE:20260421
  const raw = value.includes(":") ? value.split(":").pop()! : value
  const clean = raw.replace(/[Z]$/, "")
  if (clean.length === 8) {
    // DATE only
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}T00:00:00Z`
  }
  const dt = `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}T${clean.slice(9, 11)}:${clean.slice(11, 13)}:${clean.slice(13, 15)}`
  return value.endsWith("Z") ? `${dt}Z` : `${dt}Z`
}

function icalToRecord(icalStr: string, eventUrl: string): AppointmentRecord | null {
  const created = parseICalProp(icalStr, "X-FRONTDESK-CREATED")
  if (created !== "true") return null

  const uid     = parseICalProp(icalStr, "UID") || eventUrl
  const summary = parseICalProp(icalStr, "SUMMARY")
  const dtstart = parseICalProp(icalStr, "DTSTART")
  const dtend   = parseICalProp(icalStr, "DTEND")
  const phone   = parseICalProp(icalStr, "X-FRONTDESK-PHONE")
  const email   = parseICalProp(icalStr, "X-FRONTDESK-EMAIL")
  const name    = parseICalProp(icalStr, "X-FRONTDESK-NAME")
  const reason  = parseICalProp(icalStr, "X-FRONTDESK-REASON")
  const address = parseICalProp(icalStr, "X-FRONTDESK-ADDRESS")

  return {
    eventId:         uid,
    summary,
    startTime:       parseICalDate(dtstart),
    endTime:         parseICalDate(dtend),
    customerPhone:   phone,
    customerEmail:   email || undefined,
    customerName:    name,
    reason,
    customerAddress: address || undefined,
  }
}

function icalToFullEvent(icalStr: string, eventUrl: string): AppointmentRecord {
  const uid     = parseICalProp(icalStr, "UID") || eventUrl
  const summary = parseICalProp(icalStr, "SUMMARY")
  const dtstart = parseICalProp(icalStr, "DTSTART")
  const dtend   = parseICalProp(icalStr, "DTEND")
  const phone   = parseICalProp(icalStr, "X-FRONTDESK-PHONE")
  const email   = parseICalProp(icalStr, "X-FRONTDESK-EMAIL")
  const name    = parseICalProp(icalStr, "X-FRONTDESK-NAME")
  const reason  = parseICalProp(icalStr, "X-FRONTDESK-REASON")
  const address = parseICalProp(icalStr, "X-FRONTDESK-ADDRESS")

  return {
    eventId:         uid,
    summary,
    startTime:       parseICalDate(dtstart),
    endTime:         parseICalDate(dtend),
    customerPhone:   phone,
    customerEmail:   email || undefined,
    customerName:    name,
    reason,
    customerAddress: address || undefined,
  }
}

// ---------------------------------------------------------------------------
// Free-slot computation (shared algorithm across all adapters)
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
      slots.push({ start: new Date(cursor).toISOString(), end: new Date(cursor + durationMs).toISOString() })
      cursor += durationMs
    }
    const blockEnd = new Date(block.end).getTime()
    if (blockEnd > cursor) cursor = blockEnd
  }

  while (cursor + durationMs <= to.getTime()) {
    slots.push({ start: new Date(cursor).toISOString(), end: new Date(cursor + durationMs).toISOString() })
    cursor += durationMs
  }

  return slots.slice(0, 6)
}

// ---------------------------------------------------------------------------
// DAV client factory — reads credentials from connection columns
// ---------------------------------------------------------------------------

async function makeClient(connection: CalendarConnection) {
  const serverUrl = connection.refreshToken  // server base URL stored in refreshToken
  const username  = connection.providerEmail ?? ""
  const password  = connection.accessToken   ?? ""

  if (!serverUrl || !password) throw new Error("CalDAV connection is missing credentials")

  const client = new DAVClient({
    serverUrl,
    credentials: { username, password },
    authMethod: "Basic",
    defaultAccountType: "caldav",
    fetch: nodeFetch as unknown as typeof fetch,
  })
  await client.login()
  return client
}

// ---------------------------------------------------------------------------
// Discovery helper — used during connect flow (not part of adapter interface)
// ---------------------------------------------------------------------------

function caldavDisplayName(raw: string | Record<string, unknown> | undefined, fallback: string): string {
  if (typeof raw === "string") return raw
  return fallback
}

export async function discoverCaldavCalendar(
  serverUrl: string,
  username: string,
  password: string,
): Promise<{ calendarUrl: string; displayName: string }> {
  const client = new DAVClient({
    serverUrl,
    credentials: { username, password },
    authMethod: "Basic",
    defaultAccountType: "caldav",
    fetch: nodeFetch as unknown as typeof fetch,
  })
  await client.login()

  // Try fetchCalendars first; fall back to homeUrl from the discovered account.
  // Apple iCloud sometimes drops the connection between login and the calendar
  // listing PROPFIND (ECONNRESET), but login already gives us the homeUrl.
  let calendarUrl: string
  let displayName = username

  try {
    const calendars = await client.fetchCalendars()
    if (!calendars.length) throw new Error("No calendars found on this account")
    const primary = calendars.find((c) => {
      const name = caldavDisplayName(c.displayName, "").toLowerCase()
      return name.includes("calendar") || name.includes("home")
    }) ?? calendars[0]
    calendarUrl = primary.url
    displayName = caldavDisplayName(primary.displayName, username)
  } catch {
    // Fall back to the homeUrl discovered during login
    const homeUrl = (client as unknown as { account?: { homeUrl?: string } }).account?.homeUrl
    if (!homeUrl) throw new Error("Could not discover calendar URL — check your credentials")
    calendarUrl = homeUrl
  }

  return { calendarUrl, displayName }
}

// ---------------------------------------------------------------------------
// CaldavCalendarAdapter
// ---------------------------------------------------------------------------

export const CaldavCalendarAdapter: CalendarAdapter = {

  // CalDAV uses Basic Auth — no token rotation needed.
  async refreshIfNeeded(connection: CalendarConnection): Promise<CalendarConnection> {
    return connection
  },

  async checkAvailability(params: CheckAvailabilityParams): Promise<TimeSlot[]> {
    const client      = await makeClient(params.connection)
    const calendarUrl = params.connection.providerAccountId ?? ""


    const objects = await client.fetchCalendarObjects({
      calendar: { url: calendarUrl },
      timeRange: { start: params.from, end: params.to },
    })

    const busyBlocks = objects
      .map((obj) => {
        const dtstart = parseICalProp(obj.data as string, "DTSTART")
        const dtend   = parseICalProp(obj.data as string, "DTEND")
        if (!dtstart || !dtend) return null
        return { start: parseICalDate(dtstart), end: parseICalDate(dtend) }
      })
      .filter((b): b is { start: string; end: string } => b !== null)

    return buildOpenSlots(
      busyBlocks,
      new Date(params.from),
      new Date(params.to),
      params.durationMinutes * 60 * 1000,
    )
  },

  async bookAppointment(params: BookAppointmentParams): Promise<BookingResult> {
    const client      = await makeClient(params.connection)
    const calendarUrl = params.connection.providerAccountId ?? ""



    const uid      = `frontdesk-${randomUUID()}@neuvetra.com`
    const startTime = new Date(params.startTime)
    const endTime   = new Date(startTime.getTime() + params.durationMinutes * 60 * 1000)
    const summary   = `${params.reason} — ${params.customerName}`

    const icalString = buildICalEvent({
      uid,
      summary,
      description: `Booked by AI Front Desk\nPhone: ${params.customerPhone}\nReason: ${params.reason}${params.customerAddress ? `\nAddress: ${params.customerAddress}` : ""}`,
      startTime:       startTime.toISOString(),
      endTime:         endTime.toISOString(),
      customerPhone:   params.customerPhone,
      customerEmail:   params.customerEmail ?? "",
      customerName:    params.customerName,
      reason:          params.reason,
      customerAddress: params.customerAddress ?? "",
    })

    await client.createCalendarObject({
      calendar:    { url: calendarUrl },
      filename:    `${uid}.ics`,
      iCalString:  icalString,
    })

    return {
      eventId:   uid,
      startTime: startTime.toISOString(),
      endTime:   endTime.toISOString(),
      summary,
    }
  },

  async findByCustomerPhone(
    connection: CalendarConnection,
    phone: string,
  ): Promise<AppointmentRecord[]> {
    const client      = await makeClient(connection)
    const calendarUrl = connection.providerAccountId ?? ""



    const now     = new Date().toISOString()
    const sixMo   = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString()

    const objects = await client.fetchCalendarObjects({
      calendar:  { url: calendarUrl },
      timeRange: { start: now, end: sixMo },
    })

    return objects
      .map((obj) => icalToRecord(obj.data as string, obj.url))
      .filter((r): r is AppointmentRecord => r !== null && r.customerPhone === phone)
  },

  async cancelEvent(connection: CalendarConnection, eventId: string): Promise<void> {
    const client      = await makeClient(connection)
    const calendarUrl = connection.providerAccountId ?? ""



    // eventId is the UID; the object URL is {calendarUrl}{uid}.ics
    const objectUrl = eventId.startsWith("http")
      ? eventId
      : `${calendarUrl}${eventId}.ics`

    await client.deleteCalendarObject({
      calendarObject: { url: objectUrl, etag: "" },
    })
  },

  async updateEvent(
    connection: CalendarConnection,
    eventId: string,
    params: UpdateEventParams,
  ): Promise<void> {
    const client      = await makeClient(connection)
    const calendarUrl = connection.providerAccountId ?? ""



    const objectUrl = eventId.startsWith("http")
      ? eventId
      : `${calendarUrl}${eventId}.ics`

    // Fetch existing event to preserve metadata
    const objects = await client.fetchCalendarObjects({
      calendar:      { url: calendarUrl },
      objectUrls:    [objectUrl],
    })

    const existing = objects[0]
    if (!existing) throw new Error("CalDAV event not found for update")

    const start = new Date(params.startTime)
    const end   = new Date(start.getTime() + params.durationMinutes * 60 * 1000)

    // Patch DTSTART and DTEND in the existing iCal string
    const updated = (existing.data as string)
      .replace(/^DTSTART.*/m, `DTSTART:${formatICalDate(start.toISOString())}`)
      .replace(/^DTEND.*/m,   `DTEND:${formatICalDate(end.toISOString())}`)

    await client.updateCalendarObject({
      calendarObject: { url: objectUrl, data: updated, etag: existing.etag ?? "" },
    })
  },

  async getUpcomingEvents(
    connection: CalendarConnection,
    from: string,
    to: string,
  ): Promise<AppointmentRecord[]> {
    const client      = await makeClient(connection)
    const calendarUrl = connection.providerAccountId ?? ""



    const objects = await client.fetchCalendarObjects({
      calendar:  { url: calendarUrl },
      timeRange: { start: from, end: to },
    })

    return objects.map((obj) => icalToFullEvent(obj.data as string, obj.url))
  },
}
