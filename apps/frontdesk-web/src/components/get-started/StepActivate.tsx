// apps/web/src/components/get-started/StepActivate.tsx
import { useEffect, useState } from "react"
import { loadStripe } from "@stripe/stripe-js"
import {
  Elements, PaymentElement, useStripe, useElements,
} from "@stripe/react-stripe-js"
import { toast } from "sonner"
import { jost, alpha } from "./types"
import { WizardButton } from "./WizardButton"
import { useAppMachine } from "@/pages/app/hooks/useAppMachine"

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string)
const API_URL = import.meta.env.VITE_API_URL as string

const PLANS = [
  { id: "starter" as const, name: "Starter",  price: "$49",  minutes: "150 min/mo",   overage: "$0.25/min after" },
  { id: "growth"  as const, name: "Growth",   price: "$99",  minutes: "400 min/mo",   overage: "$0.20/min after", popular: true },
  { id: "pro"     as const, name: "Pro",       price: "$199", minutes: "1,000 min/mo", overage: "$0.18/min after" },
] as const

type PlanId = "starter" | "growth" | "pro"

interface ActivatePayload {
  userId: string
  businessName: string
  businessType: string
  phoneNumber: string
  aiName: string
  aiPersonality: string
  aiVoiceGender: string
  aiKbSeed: string
  planId: PlanId
  paymentMethodId: string
  stripeCustomerId: string
}

interface FormProps {
  payload: Omit<ActivatePayload, "planId" | "paymentMethodId" | "stripeCustomerId">
  stripeCustomerId: string
  onSuccess: (businessId: string) => void
  onBack: () => void
}

function SpinnerLoader() {
  const light = useAppMachine((s) => s.context.currentTheme.light)
  return (
    <div className="size-5 animate-spin rounded-full border-2 border-white/10" style={{ borderTopColor: light }} />
  )
}

function PaymentForm({ payload, stripeCustomerId, onSuccess, onBack }: FormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [busy, setBusy] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("growth")
  const [confirmedPmId, setConfirmedPmId] = useState<string | null>(null)
  const light = useAppMachine((s) => s.context.currentTheme.light)

  const trialEnd = new Date()
  trialEnd.setDate(trialEnd.getDate() + 7)
  const trialEndStr = trialEnd.toLocaleDateString("en-US", { month: "long", day: "numeric" })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setBusy(true)
    try {
      let pmId = confirmedPmId

      if (!pmId) {
        const { error, setupIntent } = await stripe.confirmSetup({
          elements,
          redirect: "if_required",
        })
        if (error) throw new Error(error.message)
        if (!setupIntent?.payment_method) throw new Error("No payment method returned")
        pmId = typeof setupIntent.payment_method === "string"
          ? setupIntent.payment_method
          : setupIntent.payment_method.id
        setConfirmedPmId(pmId)
      }

      const res = await fetch(`${API_URL}/billing/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          planId: selectedPlan,
          paymentMethodId: pmId,
          stripeCustomerId,
        }),
      })
      const data = await res.json() as { businessId?: string; phoneNumber?: string; error?: string; code?: string }

      if (data.code === "number_unavailable") {
        toast.error(data.error ?? "That number was just taken. Please go back and pick a different one.")
        onBack()
        return
      }
      if (data.error) throw new Error(data.error)

      toast.success(`Your AI Front Desk is live at ${data.phoneNumber}!`)
      onSuccess(data.businessId ?? "")
    } catch (err) {
      toast.error((err as Error).message ?? "Activation failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Plan picker */}
      <div className="space-y-2">
        {PLANS.map((plan) => (
          <button
            key={plan.id}
            type="button"
            onClick={() => setSelectedPlan(plan.id)}
            className="w-full text-left px-5 py-4 border transition-colors border-white/10 hover:border-white/20"
            style={selectedPlan === plan.id ? { borderColor: alpha(light, 0.5), background: alpha(light, 0.06) } : {}}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="text-[11px] font-semibold tracking-[.1em] uppercase"
                  style={{
                    color: selectedPlan === plan.id ? alpha(light, 0.9) : "rgba(255,255,255,0.6)",
                    fontFamily: "'Jost', sans-serif",
                  }}
                >
                  {plan.name}
                </span>
                {"popular" in plan && plan.popular && (
                  <span
                    className="text-[9px] tracking-[.08em] uppercase px-1.5 py-0.5"
                    style={{ color: alpha(light, 0.6), border: `1px solid ${alpha(light, 0.25)}`, fontFamily: "'Jost', sans-serif" }}
                  >
                    Popular
                  </span>
                )}
              </div>
              <span className="text-white/70 text-sm" style={jost}>
                {plan.price}<span className="text-white/30 text-[10px]">/mo</span>
              </span>
            </div>
            <p className="text-[10px] text-white/30 mt-1" style={jost}>
              {plan.minutes} · {plan.overage}
            </p>
          </button>
        ))}
      </div>

      {/* Stripe dark PaymentElement */}
      <div className="border border-white/10 p-4">
        <PaymentElement options={{ layout: "tabs" }} />
      </div>

      {/* Trial notice */}
      <p className="text-[10px] text-white/30 text-center" style={jost}>
        7-day free trial · card charged {trialEndStr} if not cancelled
      </p>

      <WizardButton type="submit" disabled={!stripe || busy}>
        {busy ? "Activating…" : "Activate my Front Desk"}
      </WizardButton>
    </form>
  )
}

interface Props {
  userId: string
  userName: string
  businessName: string
  businessType: string
  phoneNumber: string
  aiName: string
  aiPersonality: string
  aiVoiceGender: string
  aiKbSeed: string
  onSuccess: (businessId: string) => void
  onBack: () => void
}

export function StepActivate({
  userId, userName, businessName, businessType, phoneNumber,
  aiName, aiPersonality, aiVoiceGender, aiKbSeed,
  onSuccess, onBack,
}: Props) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const light = useAppMachine((s) => s.context.currentTheme.light)

  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch(`${API_URL}/billing/setup-intent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, name: userName }),
        })
        const data = await res.json() as { clientSecret: string; customerId: string }
        setClientSecret(data.clientSecret)
        setStripeCustomerId(data.customerId)
      } catch {
        toast.error("Failed to initialize payment. Please try again.")
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [userId, userName])

  if (loading || !clientSecret || !stripeCustomerId) {
    return (
      <div className="flex items-center justify-center py-12">
        <SpinnerLoader />
      </div>
    )
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: "night",
          variables: {
            colorPrimary: light,
            colorBackground: "rgba(255,255,255,0.02)",
            colorText: "rgba(255,255,255,0.85)",
            colorTextSecondary: "rgba(255,255,255,0.4)",
            borderRadius: "0px",
            fontFamily: "'Jost', sans-serif",
          },
          rules: {
            ".Input": {
              border: "1px solid rgba(255,255,255,0.08)",
              backgroundColor: "rgba(255,255,255,0.02)",
            },
            ".Input:focus": {
              border: `1px solid ${alpha(light, 0.5)}`,
              boxShadow: `0 0 0 3px ${alpha(light, 0.12)}`,
            },
          },
        },
      }}
    >
      <PaymentForm
        payload={{ userId, businessName, businessType, phoneNumber, aiName, aiPersonality, aiVoiceGender, aiKbSeed }}
        stripeCustomerId={stripeCustomerId}
        onSuccess={onSuccess}
        onBack={onBack}
      />
    </Elements>
  )
}
