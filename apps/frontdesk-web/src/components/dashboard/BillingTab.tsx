import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { PlanSwitcher } from "./PlanSwitcher"
import { FileText, ExternalLink, Download, TrendingUp } from "lucide-react"

const API_URL = import.meta.env.VITE_API_URL as string

interface UsageData {
  minutesUsed: number
  minutesIncluded: number
  overageMinutes: number
  overageCost: number
  periodStart: number | null
  periodEnd: number | null
  planId: string | null
}

interface Invoice {
  id: string
  number: string | null
  date: number
  amount: number
  currency: string
  status: string | null
  pdfUrl: string | null
  hostedUrl: string | null
}

function fmt(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  })
}

function fmtMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: currency.toUpperCase(),
  }).format(cents / 100)
}

function UsageMeter({ data }: { data: UsageData }) {
  const pct = data.minutesIncluded > 0
    ? Math.min(100, Math.round((data.minutesUsed / data.minutesIncluded) * 100))
    : 0
  const isOver = data.minutesUsed > data.minutesIncluded

  const periodLabel = data.periodStart && data.periodEnd
    ? `${fmt(data.periodStart)} – ${fmt(data.periodEnd)}`
    : null

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Minutes used this period</p>
          {periodLabel && (
            <p className="mt-0.5 text-xs text-muted-foreground">{periodLabel}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold tabular-nums text-foreground">
            {data.minutesUsed.toLocaleString()}
            <span className="text-base font-normal text-muted-foreground">
              {" "}/ {data.minutesIncluded.toLocaleString()} min
            </span>
          </p>
          <p className="text-xs text-muted-foreground">{pct}% of plan</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isOver ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-primary"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl bg-muted px-4 py-3">
          <p className="text-xs text-muted-foreground">Included</p>
          <p className="mt-1 text-sm font-semibold text-foreground tabular-nums">
            {data.minutesIncluded.toLocaleString()} min
          </p>
        </div>
        <div className="rounded-xl bg-muted px-4 py-3">
          <p className="text-xs text-muted-foreground">Remaining</p>
          <p className={`mt-1 text-sm font-semibold tabular-nums ${isOver ? "text-red-600" : "text-foreground"}`}>
            {isOver ? "0" : (data.minutesIncluded - data.minutesUsed).toLocaleString()} min
          </p>
        </div>
        <div className="rounded-xl bg-muted px-4 py-3">
          <p className="text-xs text-muted-foreground">Overage</p>
          <p className={`mt-1 text-sm font-semibold tabular-nums ${data.overageMinutes > 0 ? "text-red-600" : "text-foreground"}`}>
            {data.overageMinutes > 0
              ? `${data.overageMinutes} min (+$${data.overageCost.toFixed(2)})`
              : "None"}
          </p>
        </div>
      </div>

      {isOver && (
        <p className="text-xs text-red-600 dark:text-red-400">
          You've exceeded your plan limit. Overage charges will appear on your next invoice.
        </p>
      )}
    </div>
  )
}

function InvoiceRow({ invoice }: { invoice: Invoice }) {
  const statusColor: Record<string, string> = {
    paid:     "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
    open:     "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
    draft:    "bg-muted text-muted-foreground",
    void:     "bg-muted text-muted-foreground",
    uncollectible: "bg-red-100 text-red-700",
  }
  const color = statusColor[invoice.status ?? ""] ?? "bg-muted text-muted-foreground"

  return (
    <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/40 transition-colors">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <FileText className="size-4 text-muted-foreground" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          {invoice.number ?? invoice.id.slice(-8).toUpperCase()}
        </p>
        <p className="text-xs text-muted-foreground">{fmt(invoice.date)}</p>
      </div>

      <p className="text-sm font-semibold tabular-nums text-foreground">
        {fmtMoney(invoice.amount, invoice.currency)}
      </p>

      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${color}`}>
        {invoice.status}
      </span>

      <div className="flex items-center gap-1.5 shrink-0">
        {invoice.pdfUrl && (
          <a
            href={invoice.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Download PDF"
          >
            <Download className="size-3.5" />
          </a>
        )}
        {invoice.hostedUrl && (
          <a
            href={invoice.hostedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="View invoice"
          >
            <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>
    </div>
  )
}

export function BillingTab() {
  const { session } = useAuth()
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [usageLoading, setUsageLoading] = useState(true)
  const [invoicesLoading, setInvoicesLoading] = useState(true)

  const token = session?.access_token ?? ""

  useEffect(() => {
    if (!token) return
    const headers = { Authorization: `Bearer ${token}` }

    fetch(`${API_URL}/billing/usage`, { headers })
      .then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json() })
      .then((d) => setUsage(d as UsageData))
      .catch(() => toast.error("Failed to load usage data"))
      .finally(() => setUsageLoading(false))

    fetch(`${API_URL}/billing/invoices`, { headers })
      .then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json() })
      .then((d) => setInvoices((d as { invoices: Invoice[] }).invoices ?? []))
      .catch(() => toast.error("Failed to load invoices"))
      .finally(() => setInvoicesLoading(false))
  }, [token])

  return (
    <div className="space-y-10 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your plan, track usage, and download invoices.
        </p>
      </div>

      {/* Usage */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">Usage</h2>
        </div>
        {usageLoading
          ? <Skeleton className="h-48 w-full rounded-2xl" />
          : usage
            ? <UsageMeter data={usage} />
            : <p className="text-sm text-muted-foreground">No usage data available.</p>
        }
      </section>

      {/* Plan */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-foreground">Your Plan</h2>
        {token && <PlanSwitcher accessToken={token} />}
      </section>

      {/* Invoices */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-foreground">Invoices</h2>

        {invoicesLoading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
          </div>
        ) : invoices.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">No invoices yet.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            {invoices.map((inv, i) => (
              <div key={inv.id} className={i < invoices.length - 1 ? "border-b border-border" : ""}>
                <InvoiceRow invoice={inv} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
