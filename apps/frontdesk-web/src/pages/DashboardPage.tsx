import { useState, useEffect, useCallback, useRef } from "react"
import { useParams, useNavigate, Navigate, useSearchParams } from "react-router"
import { useAuth } from "@/contexts/AuthContext"
import { Phone, AlertTriangle, Sun, Moon, Search } from "lucide-react"
import { useTheme } from "@/contexts/ThemeContext"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "sonner"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { AppSidebar, NAV_ITEMS, type Tab } from "@/components/dashboard/AppSidebar"
import { CallLogsTab } from "@/components/dashboard/CallLogsTab"
import { CalendarTab } from "@/components/dashboard/CalendarTab"
import { SettingsTab } from "@/components/dashboard/SettingsTab"
import { UpcomingEventsTab } from "@/components/dashboard/UpcomingEventsTab"
import { BillingTab } from "@/components/dashboard/BillingTab"
import { HelpTab } from "@/components/dashboard/HelpTab"

const API_URL = import.meta.env.VITE_API_URL as string

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="size-8 text-muted-foreground hover:text-foreground shrink-0"
      aria-label="Toggle theme"
    >
      {theme === "dark" ? <Sun /> : <Moon />}
    </Button>
  )
}

export function DashboardPage() {
  const { business, session } = useAuth()
  const { tab: rawTab } = useParams<{ tab: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const validTabs = NAV_ITEMS.map((t) => t.id)
  const tab: Tab = (validTabs.includes(rawTab as Tab) ? rawTab : "overview") as Tab
  const [calendarConnected, setCalendarConnected] = useState<boolean | null>(null)

  useEffect(() => {
    if (!business?.id) return
    fetch(`${API_URL}/calendar/connection/${business.id}`, {
      headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
    })
      .then((r) => r.json())
      .then((data: { connection?: { isActive: boolean } }) => {
        setCalendarConnected(data.connection?.isActive === true)
      })
      .catch(() => setCalendarConnected(false))
  }, [business?.id, session?.access_token])

  // Handle OAuth calendar return regardless of which tab the backend redirected to
  useEffect(() => {
    const status = searchParams.get("calendar")
    if (!status) return
    if (status === "connected") {
      setCalendarConnected(true)
      toast.success("Calendar connected!")
    } else if (status === "error") {
      toast.error("Calendar connection failed. Please try again.")
    }
    setSearchParams({}, { replace: true })
    navigate("/dashboard/calendar", { replace: true })
  }, [searchParams])

  if (rawTab && !validTabs.includes(rawTab as Tab)) {
    return <Navigate to="/dashboard/overview" replace />
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {/* Top header */}
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="flex flex-1 items-center gap-3 overflow-hidden">
            {business?.twilioNumber && (
              <div className="flex items-center gap-2 overflow-hidden">
                <Phone size={14} className="shrink-0 text-muted-foreground" />
                <span className="font-mono text-sm font-semibold text-foreground truncate">
                  {business.twilioNumber}
                </span>
              </div>
            )}
          </div>
          <ThemeToggle />
        </header>

        {/* No-calendar warning */}
        {calendarConnected === false && (
          <Alert className="rounded-none border-x-0 border-t-0 border-amber-200 bg-amber-50 px-4 py-2.5 text-amber-800">
            <AlertTriangle className="size-4 text-amber-600" />
            <AlertDescription className="flex items-center justify-between gap-3 text-amber-800">
              <span><strong>No calendar connected</strong> — your AI cannot book appointments.</span>
              <Button
                variant="link"
                className="shrink-0 h-auto p-0 text-sm text-amber-700 hover:text-amber-900"
                onClick={() => navigate("/dashboard/settings")}
              >
                Connect →
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Page content */}
        <main className="flex-1 p-6">
          {tab === "overview"  && <OverviewTab calendarConnected={calendarConnected} />}
          {tab === "calls"     && <CallLogsTab />}
          {tab === "messages"  && <MessagesTab />}
          {tab === "upcoming"  && <UpcomingEventsTab />}
          {tab === "calendar"  && <CalendarTab onConnectionChange={setCalendarConnected} />}
          {tab === "billing"   && <BillingTab />}
          {tab === "settings"  && <SettingsTab />}
          {tab === "help"      && <HelpTab />}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

function OverviewTab({ calendarConnected }: { calendarConnected: boolean | null }) {
  const { business, profile } = useAuth()
  const navigate = useNavigate()
  const [totalCalls, setTotalCalls] = useState<number | null>(null)

  useEffect(() => {
    if (!business?.id) return
    fetch(`${API_URL}/businesses/${business.id}/usage`)
      .then((r) => r.json())
      .then((d: { totalCalls?: number }) => setTotalCalls(d.totalCalls ?? 0))
      .catch(() => {})
  }, [business?.id])

  const calendarLabel =
    calendarConnected === null  ? "Checking…" :
    calendarConnected           ? "Connected" :
                                  "Not connected"
  const calendarClass =
    calendarConnected === true  ? "text-green-600" :
    calendarConnected === false ? "text-amber-600" :
                                  "text-muted-foreground"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Welcome back, {profile?.firstName} 👋
        </h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Your AI receptionist is {business?.status === "active" ? "live and answering calls." : "not yet active."}
        </p>
      </div>

      {/* Summary cards — 2×2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SummaryCard
          label="AI Phone Number"
          value={business?.twilioNumber ?? "—"}
          mono
          hint="Forward missed calls from your existing number to this one"
        />
        <SummaryCard
          label="Status"
          value={business?.status === "active" ? "Live" : "Inactive"}
          valueClass={business?.status === "active" ? "text-green-600" : "text-muted-foreground"}
          hint={business?.status === "active" ? "Your AI is answering calls" : "Complete setup to go live"}
        />
        <SummaryCard
          label="Calls this period"
          value={totalCalls === null ? "—" : totalCalls.toLocaleString()}
          hint="Total calls handled by your AI in the current billing period"
        />
        <SummaryCard
          label="Calendar"
          value={calendarLabel}
          valueClass={calendarClass}
          hint={
            calendarConnected
              ? "Your AI can check availability and book appointments"
              : "Connect your calendar so your AI can book appointments"
          }
          action={
            calendarConnected === false
              ? { label: "Connect →", onClick: () => navigate("/dashboard/calendar") }
              : undefined
          }
        />
      </div>

    </div>
  )
}

// ---------------------------------------------------------------------------
// Messages tab — callback requests left by callers when scheduling was down
// ---------------------------------------------------------------------------

interface CallbackRequest {
  id: string
  callerPhone: string
  callerName: string | null
  message: string | null
  status: string
  createdAt: string
}

const MSG_PAGE_SIZE = 20

function MessagesTab() {
  const { business, session } = useAuth()
  const [messages, setMessages]       = useState<CallbackRequest[]>([])
  const [total, setTotal]             = useState(0)
  const [hasMore, setHasMore]         = useState(false)
  const [loading, setLoading]         = useState(true)
  const [searching, setSearching]     = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [search, setSearch]           = useState("")
  const offsetRef   = useRef(0)
  const searchRef   = useRef("")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchMessages = useCallback(async (opts: { search: string; offset: number; append: boolean }) => {
    if (!business?.id) return
    const params = new URLSearchParams({
      limit:  String(MSG_PAGE_SIZE),
      offset: String(opts.offset),
      ...(opts.search ? { search: opts.search } : {}),
    })
    const res  = await fetch(`${API_URL}/businesses/${business.id}/messages?${params}`, {
      headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
    })
    const data = await res.json() as { messages?: CallbackRequest[]; total?: number; hasMore?: boolean }
    setTotal(data.total ?? 0)
    setHasMore(data.hasMore ?? false)
    setMessages((prev) => opts.append ? [...prev, ...(data.messages ?? [])] : (data.messages ?? []))
  }, [business?.id, session?.access_token])

  useEffect(() => {
    if (!business?.id) return
    setLoading(true)
    fetchMessages({ search: "", offset: 0, append: false }).finally(() => setLoading(false))
  }, [business?.id, fetchMessages])

  const handleSearch = (value: string) => {
    setSearch(value)
    searchRef.current = value
    offsetRef.current = 0
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearching(true)
      fetchMessages({ search: value, offset: 0, append: false }).finally(() => setSearching(false))
    }, 400)
  }

  const handleLoadMore = async () => {
    const nextOffset = offsetRef.current + MSG_PAGE_SIZE
    offsetRef.current = nextOffset
    setLoadingMore(true)
    await fetchMessages({ search: searchRef.current, offset: nextOffset, append: true })
    setLoadingMore(false)
  }

  const markHandled = async (messageId: string) => {
    await fetch(`${API_URL}/businesses/${business!.id}/messages/${messageId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
    })
    setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, status: "handled" } : m))
  }

  if (loading) {
    return (
      <div className="space-y-3 max-w-2xl">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-3/4" />
      </div>
    )
  }

  const pending = messages.filter((m) => m.status === "pending")
  const handled = messages.filter((m) => m.status === "handled")

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Callback Requests</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Callers who asked to be called back when scheduling was unavailable.
          </p>
        </div>
        <div className="relative">
          {searching
            ? <div className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-border border-t-indigo-600" />
            : <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          }
          <Input
            placeholder="Search by phone or name…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-8 w-56 h-8 text-sm"
          />
        </div>
      </div>

      <div className={`space-y-6 transition-opacity ${searching ? "opacity-50 pointer-events-none" : "opacity-100"}`}>
      {messages.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {search ? "No callback requests match your search." : "No callback requests yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {pending.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Pending ({pending.length})
              </p>
              {pending.map((m) => (
                <MessageCard key={m.id} message={m} onMarkHandled={markHandled} />
              ))}
            </div>
          )}

          {handled.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Handled ({handled.length})
              </p>
              {handled.map((m) => (
                <MessageCard key={m.id} message={m} />
              ))}
            </div>
          )}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="w-40"
          >
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}

      {!search && (
        <p className="text-xs text-muted-foreground text-center">
          Showing {messages.length} of {total}
        </p>
      )}
      </div>
    </div>
  )
}

function MessageCard({ message, onMarkHandled }: { message: CallbackRequest; onMarkHandled?: (id: string) => void }) {
  const date = new Date(message.createdAt).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  })

  return (
    <div className={`rounded-xl border bg-card p-4 flex items-start gap-4 ${
      message.status === "pending" ? "border-amber-200" : "border-border opacity-60"
    }`}>
      <div className="flex-1 space-y-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground">
            {message.callerName ?? "Unknown caller"}
          </span>
          <span className="font-mono text-xs text-muted-foreground">{message.callerPhone}</span>
          {message.status === "pending" && (
            <Badge className="bg-amber-100 text-amber-700 border-amber-200">
              Needs callback
            </Badge>
          )}
        </div>
        {message.message && (
          <p className="text-sm text-muted-foreground truncate">{message.message}</p>
        )}
        <p className="text-xs text-muted-foreground/60">{date}</p>
      </div>
      {onMarkHandled && message.status === "pending" && (
        <Button
          variant="outline"
          className="shrink-0 text-xs h-8 px-3"
          onClick={() => onMarkHandled(message.id)}
        >
          Mark handled
        </Button>
      )}
    </div>
  )
}

function SummaryCard({
  label, value, mono, hint, valueClass, action,
}: {
  label: string
  value: string
  mono?: boolean
  hint?: string
  valueClass?: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`text-lg font-semibold text-foreground ${mono ? "font-mono" : ""} ${valueClass ?? ""}`}>
        {value}
      </p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="text-xs font-medium text-primary hover:underline mt-0.5"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
