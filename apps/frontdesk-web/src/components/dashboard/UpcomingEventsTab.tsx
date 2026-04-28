import { useEffect, useState } from "react"
import { useNavigate } from "react-router"
import { useAuth } from "@/contexts/AuthContext"
import { CalendarDays, Clock, MapPin, Phone, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

const API_URL = import.meta.env.VITE_API_URL as string

interface UpcomingEvent {
  eventId: string
  summary: string
  startTime: string
  endTime: string
  customerName: string
  customerPhone: string
  reason: string
  customerAddress?: string
}

interface DayGroup {
  label: string       // "Today", "Tomorrow", "Monday, Apr 21"
  dateKey: string     // "2026-04-21" — for keying
  events: UpcomingEvent[]
}

function formatTime(iso: string, tz?: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  })
}

function formatDuration(startIso: string, endIso: string): string {
  const mins = Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000)
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function getDayLabel(dateStr: string): string {
  const today    = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  const todayKey    = today.toLocaleDateString("en-CA")
  const tomorrowKey = tomorrow.toLocaleDateString("en-CA")

  if (dateStr === todayKey)    return "Today"
  if (dateStr === tomorrowKey) return "Tomorrow"

  // "Monday, Apr 21"
  const d = new Date(dateStr + "T12:00:00") // noon avoids DST edge
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
}

function groupByDay(events: UpcomingEvent[], tz?: string): DayGroup[] {
  const groups = new Map<string, UpcomingEvent[]>()

  for (const event of events) {
    const dateKey = new Date(event.startTime).toLocaleDateString("en-CA", { timeZone: tz })
    if (!groups.has(dateKey)) groups.set(dateKey, [])
    groups.get(dateKey)!.push(event)
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, evts]) => ({
      label: getDayLabel(dateKey),
      dateKey,
      events: evts.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
    }))
}

export function UpcomingEventsTab() {
  const { business, session } = useAuth()
  const navigate = useNavigate()
  const [events, setEvents]         = useState<UpcomingEvent[]>([])
  const [loading, setLoading]       = useState(true)
  const [noCalendar, setNoCalendar] = useState(false)

  const tz = (business?.aiConfig as Record<string, unknown> | null)?.timezone as string | undefined

  useEffect(() => {
    if (!business?.id) return
    fetch(`${API_URL}/businesses/${business.id}/upcoming-events?days=7`, {
      headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
    })
      .then((r) => r.json())
      .then((data: { events?: UpcomingEvent[]; noCalendar?: boolean }) => {
        if (data.noCalendar) { setNoCalendar(true); return }
        setEvents(data.events ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [business?.id, session?.access_token])

  if (loading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <Skeleton className="h-6 w-48" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    )
  }

  if (noCalendar) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center max-w-sm mx-auto">
        <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <CalendarDays size={20} className="text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">No calendar connected</h2>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          Connect your Google Calendar to see upcoming appointments here.
        </p>
        <Button variant="outline" size="sm" onClick={() => navigate("/dashboard/settings")}>
          Connect calendar
        </Button>
      </div>
    )
  }

  const groups = groupByDay(events, tz)

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center max-w-sm mx-auto">
        <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <CalendarDays size={20} className="text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">No upcoming appointments</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Appointments booked by your AI receptionist will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Upcoming Events</h2>
        <span className="text-sm text-muted-foreground">
          {events.length} event{events.length !== 1 ? "s" : ""} · next 7 days
        </span>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing all events from your connected Google Calendar. For full calendar management,{" "}
        <a href="https://calendar.google.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
          open Google Calendar
        </a>.
      </p>

      {groups.map((group) => (
        <div key={group.dateKey} className="space-y-2">
          {/* Day header */}
          <div className="flex items-center gap-3">
            <span className={`text-sm font-semibold ${
              group.label === "Today" ? "text-indigo-600" : "text-foreground"
            }`}>
              {group.label}
            </span>
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">{group.events.length} appt{group.events.length !== 1 ? "s" : ""}</span>
          </div>

          {/* Event cards */}
          {group.events.map((event) => (
            <EventCard key={event.eventId} event={event} tz={tz} />
          ))}
        </div>
      ))}
    </div>
  )
}

function EventCard({ event, tz }: { event: UpcomingEvent; tz?: string }) {
  const startTime = formatTime(event.startTime, tz)
  const endTime   = formatTime(event.endTime, tz)
  const duration  = formatDuration(event.startTime, event.endTime)

  return (
    <div className="flex gap-4 rounded-xl border border-border bg-card p-4 hover:bg-muted/30 transition-colors">
      {/* Time column */}
      <div className="flex flex-col items-center gap-1 min-w-[72px]">
        <span className="text-sm font-semibold text-foreground tabular-nums">{startTime}</span>
        <div className="w-px flex-1 bg-border min-h-[16px]" />
        <span className="text-xs text-muted-foreground tabular-nums">{endTime}</span>
      </div>

      {/* Accent bar */}
      <div className="w-1 rounded-full bg-indigo-500 shrink-0" />

      {/* Details */}
      <div className="flex-1 space-y-1.5 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{event.reason || event.summary}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {event.customerName && (
            <span className="flex items-center gap-1">
              <User size={11} />
              {event.customerName}
            </span>
          )}
          {event.customerPhone && (
            <span className="flex items-center gap-1 font-mono">
              <Phone size={11} />
              {event.customerPhone}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock size={11} />
            {duration}
          </span>
        </div>
        {event.customerAddress && (
          <div
            className="flex items-center gap-1 text-xs text-muted-foreground"
            data-testid="event-address"
          >
            <MapPin size={11} />
            {event.customerAddress}
          </div>
        )}
      </div>
    </div>
  )
}
