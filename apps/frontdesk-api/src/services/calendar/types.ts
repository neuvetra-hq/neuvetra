// ---------------------------------------------------------------------------
// Provider-agnostic calendar types
// New providers (Outlook, Apple) implement CalendarAdapter — zero other changes.
// ---------------------------------------------------------------------------

export type CalendarProvider = "google" | "outlook" | "apple" | "caldav"

export interface CalendarConnection {
  id: string
  businessId: string
  provider: CalendarProvider
  providerAccountId: string | null
  providerEmail: string | null
  accessToken: string | null
  refreshToken: string | null
  tokenExpiry: Date | null
  isActive: boolean
}

export interface TimeSlot {
  start: string   // ISO 8601
  end: string     // ISO 8601
}

/** A calendar event that was booked through Front Desk */
export interface AppointmentRecord {
  eventId: string
  summary: string
  startTime: string   // ISO 8601
  endTime: string     // ISO 8601
  customerPhone: string
  customerEmail?: string
  customerName: string
  reason: string
  customerAddress?: string
}

export interface CheckAvailabilityParams {
  connection: CalendarConnection
  /** ISO 8601 — search window start */
  from: string
  /** ISO 8601 — search window end */
  to: string
  /** Duration in minutes */
  durationMinutes: number
}

export interface BookAppointmentParams {
  connection: CalendarConnection
  /** ISO 8601 datetime string */
  startTime: string
  /** Duration in minutes */
  durationMinutes: number
  customerName: string
  customerPhone: string
  customerEmail?: string
  reason: string
  customerAddress?: string
}

export interface UpdateEventParams {
  /** ISO 8601 datetime for new start */
  startTime: string
  /** Duration in minutes */
  durationMinutes: number
}

export interface BookingResult {
  eventId: string
  startTime: string
  endTime: string
  summary: string
}

// Every provider adapter must implement this interface.
// Calendar is the single source of truth — no mirroring to a DB table.
// Each adapter stores ownership metadata in provider-native format and
// queries it via provider-native APIs (extendedProperties, open extensions, etc.)
export interface CalendarAdapter {
  /** Refresh the access token if expired. Returns updated connection. */
  refreshIfNeeded(connection: CalendarConnection): Promise<CalendarConnection>

  /** Return free slots of durationMinutes within the from–to window. */
  checkAvailability(params: CheckAvailabilityParams): Promise<TimeSlot[]>

  /** Create a calendar event and embed ownership metadata (phone/email). */
  bookAppointment(params: BookAppointmentParams): Promise<BookingResult>

  /**
   * Find upcoming confirmed appointments for a customer by phone number.
   * Each provider stores the phone in its native metadata format and queries it natively.
   */
  findByCustomerPhone(connection: CalendarConnection, phone: string): Promise<AppointmentRecord[]>

  /**
   * Delete a calendar event.
   * The service layer verifies ownership before calling this — adapters must not re-check.
   */
  cancelEvent(connection: CalendarConnection, eventId: string): Promise<void>

  /**
   * Patch the start/end time of an existing event.
   * Ownership verification is done in the service layer before calling this.
   */
  updateEvent(
    connection: CalendarConnection,
    eventId: string,
    params: UpdateEventParams,
  ): Promise<void>

  /**
   * Return all Front Desk bookings within a time window, regardless of customer.
   * Used to render the Upcoming Events dashboard tab.
   */
  getUpcomingEvents(
    connection: CalendarConnection,
    from: string,
    to: string,
  ): Promise<AppointmentRecord[]>
}
