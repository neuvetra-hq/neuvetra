import { useState } from "react"
import { useNavigate } from "react-router"
import { Check } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { StepBusinessInfo, type BusinessInfoData } from "@/components/onboarding/StepBusinessInfo"
import { StepConfirm } from "@/components/onboarding/StepConfirm"

const STEPS = ["Business info", "Confirm & activate"] as const

export function OnboardingPage() {
  const { business, refreshBusiness } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [formData, setFormData] = useState<BusinessInfoData | null>(null)

  const handleNext = async (data: BusinessInfoData) => {
    setFormData(data)
    if (!business) await refreshBusiness()
    setStep(1)
  }

  const handleSuccess = async () => {
    await refreshBusiness()
    navigate("/dashboard", { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-12">
      <div className="w-full max-w-md">

        {/* Logo + header */}
        <div className="mb-8 text-center">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-neutral-900 text-white font-bold text-sm mb-4 shadow-sm">
            FD
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
            Set up your Front Desk
          </h1>
          <p className="mt-1.5 text-sm text-neutral-500">
            Takes about 60 seconds. No phone number changes needed.
          </p>
        </div>

        {/* Step indicator */}
        <div className="mb-6 flex items-center">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 items-center">
              <div className="flex items-center gap-2.5 shrink-0">
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all duration-200 ${
                    i < step
                      ? "bg-neutral-900 text-white"
                      : i === step
                      ? "bg-neutral-900 text-white ring-4 ring-neutral-900/10"
                      : "bg-neutral-100 text-neutral-400"
                  }`}
                >
                  {i < step ? (
                    <Check className="size-3.5" strokeWidth={2.5} />
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={`text-sm transition-colors ${
                    i <= step ? "font-medium text-neutral-900" : "text-neutral-400"
                  }`}
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="mx-3 flex-1 h-px bg-neutral-200" />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-7 shadow-sm">
          {step === 0 && (
            <StepBusinessInfo
              defaultValues={
                formData
                  ? formData
                  : business?.name
                  ? { businessName: business.name }
                  : undefined
              }
              onNext={handleNext}
            />
          )}

          {step === 1 && formData && !business && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
              <p className="text-sm text-neutral-500">Loading your account…</p>
            </div>
          )}

          {step === 1 && formData && business && (
            <StepConfirm
              businessId={business.id}
              data={formData}
              onBack={() => setStep(0)}
              onSuccess={handleSuccess}
            />
          )}
        </div>

        {/* Footer note */}
        <p className="mt-5 text-center text-xs text-neutral-400">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  )
}
