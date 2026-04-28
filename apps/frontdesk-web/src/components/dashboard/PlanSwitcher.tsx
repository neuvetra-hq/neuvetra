import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { ChevronDown, Check } from "lucide-react"

const API_URL = import.meta.env.VITE_API_URL as string

type PlanId = "starter" | "growth" | "pro"

const PLANS = [
  { id: "starter" as PlanId, name: "Starter", monthlyPrice: 49, minutes: 200 },
  { id: "growth"  as PlanId, name: "Growth",  monthlyPrice: 99, minutes: 500 },
  { id: "pro"     as PlanId, name: "Pro",      monthlyPrice: 199, minutes: 1000 },
]

interface SubInfo {
  planId: PlanId | null
  status: string
  currentPeriodEnd: number | null
}

interface Props {
  accessToken: string
}

export function PlanSwitcher({ accessToken }: Props) {
  const [sub, setSub] = useState<SubInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState<PlanId | null>(null)
  const [switching, setSwitching] = useState(false)

  useEffect(() => {
    fetch(`${API_URL}/billing/subscription`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((data) => setSub(data))
      .catch(() => toast.error("Could not load subscription info"))
      .finally(() => setLoading(false))
  }, [accessToken])

  const handleSwitch = async (planId: PlanId) => {
    setSwitching(true)
    try {
      const res = await fetch(`${API_URL}/billing/change-plan`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ planId }),
      })
      const data = await res.json() as { success?: boolean; error?: string; planName?: string }
      if (data.error) throw new Error(data.error)
      setSub((prev) => prev ? { ...prev, planId } : prev)
      setConfirming(null)
      toast.success(`Switched to ${data.planName}!`)
    } catch (err) {
      toast.error((err as Error).message ?? "Plan switch failed")
    } finally {
      setSwitching(false)
    }
  }

  if (loading) return <Skeleton className="h-10 w-56 rounded-xl" />

  const currentPlan = PLANS.find((p) => p.id === sub?.planId)
  const otherPlans = PLANS.filter((p) => p.id !== sub?.planId)

  return (
    <div className="rounded-2xl border border-border bg-card p-5 flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-foreground">
          {currentPlan ? currentPlan.name : "No active plan"}
        </p>
        {currentPlan && (
          <p className="text-xs text-muted-foreground mt-0.5">
            ${currentPlan.monthlyPrice}/mo · {currentPlan.minutes.toLocaleString()} min included
          </p>
        )}
        {sub?.currentPeriodEnd && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Renews{" "}
            {new Date(sub.currentPeriodEnd * 1000).toLocaleDateString("en-US", {
              month: "short", day: "numeric", year: "numeric",
            })}
          </p>
        )}
      </div>

      {/* Confirm inline state */}
      {confirming ? (
        <div className="flex items-center gap-2 shrink-0">
          <p className="text-xs text-muted-foreground">
            Switch to {PLANS.find(p => p.id === confirming)?.name}?
          </p>
          <Button
            size="sm"
            className="h-8 text-xs px-3"
            onClick={() => handleSwitch(confirming)}
            disabled={switching}
          >
            {switching ? "Switching…" : "Confirm"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs px-3"
            onClick={() => setConfirming(null)}
            disabled={switching}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="sm" className="shrink-0 gap-1.5" />}
          >
            Change plan
            <ChevronDown className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {currentPlan && (
              <>
                <div className="px-2 py-1.5 flex items-center gap-2">
                  <Check className="size-3.5 text-primary shrink-0" />
                  <span className="text-sm font-medium">{currentPlan.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">${currentPlan.monthlyPrice}/mo</span>
                </div>
                <DropdownMenuSeparator />
              </>
            )}
            {otherPlans.map((plan) => (
              <DropdownMenuItem
                key={plan.id}
                onClick={() => setConfirming(plan.id)}
                className="flex items-center justify-between cursor-pointer"
              >
                <span>{plan.name}</span>
                <span className="text-xs text-muted-foreground">${plan.monthlyPrice}/mo</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
