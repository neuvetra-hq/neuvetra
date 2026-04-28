import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { CalDAVConnectDialog } from "./CalDAVConnectDialog"

const API_URL = import.meta.env.VITE_API_URL as string

interface CalendarConnection {
  provider: "google" | "outlook" | "caldav"
  providerEmail: string | null
  isActive: boolean
}

const PROVIDER_LABELS: Record<CalendarConnection["provider"], string> = {
  google:  "Google Calendar",
  outlook: "Outlook Calendar",
  caldav:  "Apple / CalDAV Calendar",
}

function CalendarProviderIcon({ provider, size = 20 }: { provider: CalendarConnection["provider"]; size?: number }) {
  const s = size
  if (provider === "outlook") {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="4" fill="#0078D4"/>
        <path d="M13 6h6.5A1.5 1.5 0 0 1 21 7.5v9a1.5 1.5 0 0 1-1.5 1.5H13V6z" fill="#fff" fillOpacity=".3"/>
        <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h8A1.5 1.5 0 0 1 14 8.5v7A1.5 1.5 0 0 1 12.5 17h-8A1.5 1.5 0 0 1 3 15.5v-7z" fill="#fff"/>
        <path d="M8.5 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" fill="#0078D4"/>
      </svg>
    )
  }
  if (provider === "caldav") {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="4" fill="#f5f5f7"/>
        <path d="M17 3h-1V1h-2v2H10V1H8v2H7C5.9 3 5 3.9 5 5v14c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H7V9h10v10z" fill="#555"/>
        <circle cx="15" cy="13" r="1.5" fill="#555"/>
        <circle cx="11.5" cy="13" r="1.5" fill="#555"/>
        <circle cx="8" cy="13" r="1.5" fill="#555"/>
      </svg>
    )
  }
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="4" fill="#fff"/>
      <path d="M17 3h-1V1h-2v2H10V1H8v2H7C5.9 3 5 3.9 5 5v14c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H7V9h10v10z" fill="#4285F4"/>
    </svg>
  )
}

function ProviderRow({
  icon, name, description, onConnect, loading, border,
}: {
  icon:        React.ReactNode
  name:        string
  description: string
  onConnect:   () => void
  loading:     boolean
  border?:     boolean
}) {
  return (
    <div className={`flex items-center gap-4 px-5 py-4 ${border ? "border-b border-border" : ""}`}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{name}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Button variant="outline" size="sm" onClick={onConnect} disabled={loading} className="shrink-0">
        Connect
      </Button>
    </div>
  )
}

interface Props {
  onConnectionChange?: (connected: boolean) => void
}

export function CalendarTab({ onConnectionChange }: Props) {
  const { business, session } = useAuth()
  const [calendarConn, setCalendarConn] = useState<CalendarConnection | null>(null)
  const [loading, setLoading]           = useState(true)
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [caldavOpen, setCaldavOpen]     = useState(false)

  useEffect(() => {
    if (!business?.id) return
    fetch(`${API_URL}/calendar/connection/${business.id}`, {
      headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
    })
      .then((r) => r.json())
      .then((data: { connection?: CalendarConnection }) => {
        if (data.connection?.isActive) setCalendarConn(data.connection)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [business?.id])

  const handleConnect = async (provider: "google" | "outlook") => {
    if (!business?.id) return
    setCalendarLoading(true)
    try {
      const endpoint = provider === "outlook"
        ? `${API_URL}/calendar/microsoft/auth-url?businessId=${business.id}`
        : `${API_URL}/calendar/auth-url?businessId=${business.id}`
      const res  = await fetch(endpoint, { headers: { Authorization: `Bearer ${session?.access_token ?? ""}` } })
      const data = await res.json() as { url?: string; error?: string }
      if (data.error) throw new Error(data.error)
      if (data.url) window.location.href = data.url
    } catch (err) {
      toast.error((err as Error).message ?? "Failed to start calendar connection")
    } finally {
      setCalendarLoading(false)
    }
  }

  const handleDisconnect = async () => {
    if (!business?.id) return
    setCalendarLoading(true)
    try {
      const res  = await fetch(`${API_URL}/calendar/${business.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
      })
      const data = await res.json() as { disconnected?: boolean; error?: string }
      if (data.error) throw new Error(data.error)
      setCalendarConn(null)
      onConnectionChange?.(false)
      toast.success("Calendar disconnected")
    } catch (err) {
      toast.error((err as Error).message ?? "Failed to disconnect calendar")
    } finally {
      setCalendarLoading(false)
    }
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Calendar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect your calendar so your AI can check availability and book appointments in real time.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-base font-semibold text-foreground">Connection</h2>

        {loading ? (
          <div className="h-20 animate-pulse rounded-xl bg-muted" />
        ) : calendarConn ? (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <CalendarProviderIcon provider={calendarConn.provider} size={20} />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {PROVIDER_LABELS[calendarConn.provider]}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="size-1.5 rounded-full bg-emerald-500" />
                    <p className="text-xs text-muted-foreground">
                      Connected{calendarConn.providerEmail ? ` as ${calendarConn.providerEmail}` : ""}
                    </p>
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={handleDisconnect}
                disabled={calendarLoading}
                className="shrink-0 text-red-600 border-red-200 hover:bg-red-50"
              >
                {calendarLoading ? "Disconnecting…" : "Disconnect"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <ProviderRow
              icon={<CalendarProviderIcon provider="google" />}
              name="Google Calendar"
              description="Connect via Google OAuth — Gmail, Google Workspace"
              onConnect={() => handleConnect("google")}
              loading={calendarLoading}
              border
            />
            <ProviderRow
              icon={<CalendarProviderIcon provider="outlook" />}
              name="Outlook Calendar"
              description="Microsoft 365, Outlook.com, Exchange"
              onConnect={() => handleConnect("outlook")}
              loading={calendarLoading}
              border
            />
            <ProviderRow
              icon={<CalendarProviderIcon provider="caldav" />}
              name="Apple / CalDAV"
              description="iCloud, Fastmail, Nextcloud, and any CalDAV server"
              onConnect={() => setCaldavOpen(true)}
              loading={calendarLoading}
            />
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-muted/40 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">What your AI can do once connected</h3>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li className="flex items-center gap-2">
            <span className="text-emerald-500 font-bold">✓</span>
            Check your real-time availability before offering time slots
          </li>
          <li className="flex items-center gap-2">
            <span className="text-emerald-500 font-bold">✓</span>
            Book, reschedule, and cancel appointments automatically
          </li>
          <li className="flex items-center gap-2">
            <span className="text-emerald-500 font-bold">✓</span>
            Send you an SMS notification for every new booking
          </li>
        </ul>
      </section>

      <CalDAVConnectDialog
        open={caldavOpen}
        onOpenChange={setCaldavOpen}
        onConnected={(email) => {
          setCalendarConn({ provider: "caldav", providerEmail: email, isActive: true })
          onConnectionChange?.(true)
        }}
      />
    </div>
  )
}
