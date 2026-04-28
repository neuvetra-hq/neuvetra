import { useEffect, useState } from "react"
import { loadStripe } from "@stripe/stripe-js"
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string)
const API_URL = import.meta.env.VITE_API_URL as string

const PLANS = [
  {
    id: "starter" as const,
    name: "Starter",
    price: "$49",
    minutes: "150 min/mo",
    overage: "$0.25/min after",
  },
  {
    id: "growth" as const,
    name: "Growth",
    price: "$99",
    minutes: "400 min/mo",
    overage: "$0.20/min after",
    popular: true,
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: "$199",
    minutes: "1,000 min/mo",
    overage: "$0.18/min after",
  },
]

type PlanId = "starter" | "growth" | "pro"

interface ActivatePayload {
  userId: string
  businessName: string
  businessType: string
  phoneNumber: string
  planId: PlanId
  paymentMethodId: string
  stripeCustomerId: string
}

interface FormProps {
  payload: Omit<ActivatePayload, "paymentMethodId" | "stripeCustomerId">
  stripeCustomerId: string
  onSuccess: () => void
  onBack: () => void
}

function PaymentForm({ payload, stripeCustomerId, onSuccess, onBack }: FormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [busy, setBusy] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("growth")
  // Store paymentMethodId after first confirmSetup so retries skip re-confirming
  const [confirmedPaymentMethodId, setConfirmedPaymentMethodId] = useState<string | null>(null)

  const activate = async (paymentMethodId: string, planId: PlanId) => {
    const res = await fetch(`${API_URL}/billing/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        planId,
        paymentMethodId,
        stripeCustomerId,
      }),
    })
    const data = await res.json() as { phoneNumber?: string; error?: string; code?: string }

    if (data.code === "number_unavailable") {
      toast.error(data.error ?? "That number was just taken. Please pick a different one.")
      onBack()
      return
    }

    if (data.error) throw new Error(data.error)

    toast.success(`Your AI Front Desk is live at ${data.phoneNumber}!`)
    onSuccess()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setBusy(true)
    try {
      let paymentMethodId = confirmedPaymentMethodId

      if (!paymentMethodId) {
        // First attempt — confirm the SetupIntent
        const { error, setupIntent } = await stripe.confirmSetup({
          elements,
          redirect: "if_required",
        })

        if (error) throw new Error(error.message)
        if (!setupIntent?.payment_method) throw new Error("No payment method returned")

        paymentMethodId = typeof setupIntent.payment_method === "string"
          ? setupIntent.payment_method
          : setupIntent.payment_method.id

        setConfirmedPaymentMethodId(paymentMethodId)
      }

      await activate(paymentMethodId, selectedPlan)
    } catch (err) {
      toast.error((err as Error).message ?? "Activation failed")
    } finally {
      setBusy(false)
    }
  }

  const trialEnd = new Date()
  trialEnd.setDate(trialEnd.getDate() + 7)
  const trialEndStr = trialEnd.toLocaleDateString("en-US", { month: "long", day: "numeric" })

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Plan picker */}
      <div>
        <p className="text-sm font-medium text-neutral-700 mb-2">Choose your plan</p>
        <div className="space-y-2">
          {PLANS.map((plan) => (
            <Button
              key={plan.id}
              type="button"
              variant="outline"
              onClick={() => setSelectedPlan(plan.id)}
              className={`h-auto w-full justify-start rounded-xl border px-4 py-3 text-left transition-all ${
                selectedPlan === plan.id
                  ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200"
                  : "border-neutral-200 bg-white hover:border-neutral-300"
              }`}
            >
              <div className="w-full">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-neutral-900">{plan.name}</span>
                    {plan.popular && (
                      <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                        Most popular
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-bold text-neutral-900">{plan.price}<span className="text-xs font-normal text-neutral-500">/mo</span></span>
                </div>
                <p className="text-xs text-neutral-500 mt-0.5">{plan.minutes} · {plan.overage}</p>
              </div>
            </Button>
          ))}
        </div>
      </div>

      {/* Stripe PaymentElement — card data never touches our server */}
      <div>
        <p className="text-sm font-medium text-neutral-700 mb-2">Payment</p>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <PaymentElement options={{ layout: "tabs" }} />
        </div>
      </div>

      {/* Trial callout */}
      <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
        🎉 <span className="font-semibold">7-day free trial</span> — your card won't be charged until {trialEndStr}.
      </div>

      <Button
        type="submit"
        className="w-full bg-indigo-600 text-white hover:bg-indigo-700"
        disabled={!stripe || busy}
      >
        {busy ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Activating…
          </span>
        ) : "Activate my Front Desk"}
      </Button>

      <Button
        type="button"
        variant="ghost"
        onClick={onBack}
        disabled={busy}
        className="w-full text-sm text-neutral-400 hover:text-neutral-600"
      >
        ← Back
      </Button>
    </form>
  )
}

interface Props {
  userId: string
  userName: string
  userEmail?: string
  businessName: string
  businessType: string
  phoneNumber: string
  onSuccess: () => void
  onBack: () => void
}

export function StepPayment({
  userId, userName, userEmail, businessName, businessType, phoneNumber, onSuccess, onBack,
}: Props) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch(`${API_URL}/billing/setup-intent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, name: userName, email: userEmail }),
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
  }, [userId, userName, userEmail])

  if (loading || !clientSecret || !stripeCustomerId) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-indigo-600" />
      </div>
    )
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: "stripe",
          variables: {
            colorPrimary: "#4f46e5",
            borderRadius: "10px",
            fontFamily: "inherit",
          },
        },
      }}
    >
      <PaymentForm
        payload={{ userId, businessName, businessType, phoneNumber, planId: "growth" }}
        stripeCustomerId={stripeCustomerId}
        onSuccess={onSuccess}
        onBack={onBack}
      />
    </Elements>
  )
}
