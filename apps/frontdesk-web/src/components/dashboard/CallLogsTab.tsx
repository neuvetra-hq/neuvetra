import { useEffect, useState, useCallback, useRef } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { PhoneIncoming, PhoneMissed, PhoneCall, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

const API_URL = import.meta.env.VITE_API_URL as string
const PAGE_SIZE = 20

interface CallLog {
  id: string
  callerNumber: string
  status: "in_progress" | "completed" | "missed" | "transferred"
  durationSeconds: number | null
  summary: string | null
  startedAt: string
  endedAt: string | null
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—"
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " · " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

const STATUS_CONFIG = {
  completed:   { label: "Answered",    icon: <PhoneIncoming size={14} />, class: "text-green-600 bg-green-50" },
  missed:      { label: "Missed",      icon: <PhoneMissed size={14} />,   class: "text-red-500 bg-red-50" },
  transferred: { label: "Transferred", icon: <PhoneCall size={14} />,     class: "text-blue-600 bg-blue-50" },
  in_progress: { label: "Live",        icon: <PhoneCall size={14} />,     class: "text-amber-600 bg-amber-50" },
}

export function CallLogsTab() {
  const { business, session } = useAuth()
  const [callLogs, setCallLogs]         = useState<CallLog[]>([])
  const [total, setTotal]               = useState(0)
  const [hasMore, setHasMore]           = useState(false)
  const [loading, setLoading]           = useState(true)
  const [searching, setSearching]       = useState(false)
  const [loadingMore, setLoadingMore]   = useState(false)
  const [search, setSearch]             = useState("")
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null)
  const offsetRef   = useRef(0)
  const searchRef   = useRef("")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchCalls = useCallback(async (opts: { search: string; offset: number; append: boolean }) => {
    if (!business?.id) return
    const params = new URLSearchParams({
      limit:  String(PAGE_SIZE),
      offset: String(opts.offset),
      ...(opts.search ? { search: opts.search } : {}),
    })
    const res  = await fetch(`${API_URL}/businesses/${business.id}/calls?${params}`, {
      headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
    })
    const data = await res.json() as { calls: CallLog[]; total: number; hasMore: boolean }
    setTotal(data.total ?? 0)
    setHasMore(data.hasMore ?? false)
    setCallLogs((prev) => opts.append ? [...prev, ...(data.calls ?? [])] : (data.calls ?? []))
  }, [business?.id, session?.access_token])

  // Initial load + polling (no append, no search)
  useEffect(() => {
    if (!business?.id) return
    setLoading(true)
    fetchCalls({ search: "", offset: 0, append: false }).finally(() => setLoading(false))

    const interval = setInterval(() => {
      // Only auto-refresh if user hasn't searched or paged — keep it simple
      if (!searchRef.current && offsetRef.current === 0) {
        fetchCalls({ search: "", offset: 0, append: false })
      }
    }, 30_000)
    return () => clearInterval(interval)
  }, [business?.id, fetchCalls])

  // Debounced search
  const handleSearch = (value: string) => {
    setSearch(value)
    searchRef.current = value
    offsetRef.current = 0
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearching(true)
      fetchCalls({ search: value, offset: 0, append: false }).finally(() => setSearching(false))
    }, 400)
  }

  const handleLoadMore = async () => {
    const nextOffset = offsetRef.current + PAGE_SIZE
    offsetRef.current = nextOffset
    setLoadingMore(true)
    await fetchCalls({ search: searchRef.current, offset: nextOffset, append: true })
    setLoadingMore(false)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (callLogs.length === 0 && !search) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <PhoneCall size={20} className="text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">No calls yet</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Calls will appear here once your AI receptionist starts answering.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-lg font-semibold text-foreground">Recent Calls</h2>
          <div className="flex items-center gap-3">
            <div className="relative">
              {searching
                ? <div className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-border border-t-indigo-600" />
                : <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              }
              <Input
                placeholder="Search by phone…"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-8 w-52 h-8 text-sm"
              />
            </div>
            <span className="text-sm text-muted-foreground whitespace-nowrap">{total} calls</span>
          </div>
        </div>

        {callLogs.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">No calls match your search.</p>
          </div>
        ) : (
          <div className={`rounded-xl border border-border bg-card overflow-hidden transition-opacity ${searching ? "opacity-50" : "opacity-100"}`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Caller</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Duration</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Date</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {callLogs.map((call) => {
                  const cfg = STATUS_CONFIG[call.status] ?? STATUS_CONFIG.completed
                  return (
                    <tr key={call.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-5 py-4 font-mono text-foreground">{call.callerNumber}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.class}`}>
                          {cfg.icon}
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">{formatDuration(call.durationSeconds)}</td>
                      <td className="px-5 py-4 text-muted-foreground whitespace-nowrap">{formatDate(call.startedAt)}</td>
                      <td className="px-5 py-4">
                        {call.summary ? (
                          <button
                            aria-label="View summary"
                            onClick={() => setSelectedCall(call)}
                            className="text-xs text-indigo-600 hover:text-indigo-700 hover:underline font-medium"
                          >
                            View summary
                          </button>
                        ) : (
                          <span className="text-muted-foreground/50 text-xs">No summary</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
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
      </div>

      <Dialog
        open={selectedCall !== null}
        onOpenChange={(open) => { if (!open) setSelectedCall(null) }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Call Summary</DialogTitle>
            <DialogDescription>
              {selectedCall?.callerNumber} · {selectedCall && formatDate(selectedCall.startedAt)}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {selectedCall?.summary}
          </p>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </>
  )
}
