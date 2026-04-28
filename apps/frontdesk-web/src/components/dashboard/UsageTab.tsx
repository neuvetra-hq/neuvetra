import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { Skeleton } from "@/components/ui/skeleton"

const API_URL = import.meta.env.VITE_API_URL as string

interface UsageData {
  minutesUsed: number
  totalCalls: number
  stripePlanId: string | null
  periodStart: string
}

const PLAN_LIMITS: Record<string, { name: string; minutes: number; overageRate: string }> = {
  [import.meta.env.VITE_STRIPE_PRICE_STARTER_FLAT as string]: { name: "Starter", minutes: 150,  overageRate: "$0.25" },
  [import.meta.env.VITE_STRIPE_PRICE_GROWTH_FLAT as string]:  { name: "Growth",  minutes: 400,  overageRate: "$0.20" },
  [import.meta.env.VITE_STRIPE_PRICE_PRO_FLAT as string]:     { name: "Pro",     minutes: 1000, overageRate: "$0.18" },
}

export function UsageTab() {
  const { business } = useAuth()
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!business?.id) return

    const fetchUsage = () =>
      fetch(`${API_URL}/businesses/${business.id}/usage`)
        .then((r) => r.json())
        .then((d) => setUsage(d as UsageData))
        .finally(() => setLoading(false))

    fetchUsage()
    const interval = setInterval(fetchUsage, 30_000)
    return () => clearInterval(interval)
  }, [business?.id])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-7 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    )
  }

  const plan = usage?.stripePlanId ? PLAN_LIMITS[usage.stripePlanId] : null
  const minutesUsed = usage?.minutesUsed ?? 0
  const includedMinutes = plan?.minutes ?? 0
  // Only calculate overage when a plan is known — without a plan limit there's no overage
  const overageMinutes = plan ? Math.max(0, minutesUsed - includedMinutes) : 0
  const pct = includedMinutes > 0 ? Math.min(100, Math.round((minutesUsed / includedMinutes) * 100)) : 0

  const periodLabel = usage?.periodStart
    ? new Date(usage.periodStart).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "This month"

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">Usage — {periodLabel}</h2>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Calls this month" value={String(usage?.totalCalls ?? 0)} />
        <StatCard label="Minutes used" value={`${minutesUsed} min`} />
        <StatCard
          label="Overage minutes"
          value={overageMinutes > 0 ? `${overageMinutes} min` : "None"}
          valueClass={overageMinutes > 0 ? "text-amber-600" : "text-green-600"}
        />
      </div>

      {/* Progress bar */}
      {plan && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">{plan.name} Plan — {plan.minutes} min included</span>
            <span className="text-muted-foreground">{minutesUsed} / {plan.minutes} min</span>
          </div>

          <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-400" : "bg-indigo-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{pct}% used</span>
            {overageMinutes > 0 && (
              <span className="text-amber-600 font-medium">
                {overageMinutes} overage min × {plan.overageRate} = ~${(overageMinutes * parseFloat(plan.overageRate.replace("$", ""))).toFixed(2)} extra
              </span>
            )}
            {overageMinutes === 0 && (
              <span>{plan.minutes - minutesUsed} min remaining</span>
            )}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Usage resets on the 1st of each month. Overage is billed automatically via Stripe at the end of your billing period.
      </p>
    </div>
  )
}

function StatCard({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold text-foreground ${valueClass ?? ""}`}>{value}</p>
    </div>
  )
}
