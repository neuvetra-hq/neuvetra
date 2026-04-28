import { useState } from "react"
import { Navigate, useNavigate, Link } from "react-router"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/lib/supabase"
import { AuthLayout } from "@/components/auth/AuthLayout"
import { StepIdentity, type IdentityData } from "@/components/signup/StepIdentity"
import { StepVerify } from "@/components/signup/StepVerify"
import { StepBusiness, type BusinessData } from "@/components/signup/StepBusiness"
import { StepPickNumber } from "@/components/signup/StepPickNumber"
import { StepPayment } from "@/components/signup/StepPayment"
import { StepCalendar } from "@/components/signup/StepCalendar"
import { toast } from "sonner"

function toE164(raw: string): string {
  const digits = raw.replace(/\D/g, "")
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`
  return `+${digits}`
}

function extractAreaCode(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  const local = digits.startsWith("1") && digits.length === 11 ? digits.slice(1) : digits
  return local.slice(0, 3)
}

const STEPS = ["Your info", "Verify", "Your business", "Pick a number", "Payment", "Calendar"]

export function SignupPage() {
  const { session, profile, business, refreshProfile, refreshBusiness } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)

  const [identity, setIdentity] = useState<IdentityData | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [businessData, setBusinessData] = useState<BusinessData | null>(null)
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null)

  // Already fully set up — skip signup
  if (session && profile && business?.status === "active") {
    return <Navigate to="/dashboard" replace />
  }

  const handleIdentityNext = async (data: IdentityData) => {
    setBusy(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: toE164(data.phone) })
      if (error) throw error
      setIdentity(data)
      setStep(1)
      toast.success("Code sent — check your messages.")
    } catch (err) {
      toast.error((err as Error).message ?? "Failed to send code")
    } finally {
      setBusy(false)
    }
  }

  const handleVerified = async (verifiedUserId: string) => {
    if (!identity) return
    setBusy(true)
    try {
      // Check if this phone number already has an account
      const { data: existingMembership } = await supabase
        .from("business_members")
        .select("business_id")
        .eq("user_id", verifiedUserId)
        .limit(1)
        .maybeSingle()

      if (existingMembership) {
        await refreshProfile()
        await refreshBusiness()
        toast.info("You already have an account — signing you in.")
        navigate("/dashboard", { replace: true })
        return
      }

      const { error } = await supabase.from("users").upsert({
        id: verifiedUserId,
        first_name: identity.firstName,
        last_name: identity.lastName,
        phone: toE164(identity.phone),
      })
      if (error) throw error
      setUserId(verifiedUserId)
      await refreshProfile()

      // Fire opt-in confirmation SMS (A2P compliance) — fire-and-forget
      supabase.auth.getSession().then(({ data }) => {
        const token = data.session?.access_token
        if (token) {
          fetch(`${import.meta.env.VITE_API_URL}/auth/optin-confirm`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => {/* non-blocking */})
        }
      })

      setStep(2)
    } catch (err) {
      toast.error((err as Error).message ?? "Failed to save your profile")
    } finally {
      setBusy(false)
    }
  }

  const handleBusinessNext = (data: BusinessData) => {
    setBusinessData(data)
    setStep(3)
  }

  const handleNumberNext = (phoneNumber: string) => {
    setSelectedNumber(phoneNumber)
    setStep(4)
  }

  const handlePaymentSuccess = async () => {
    await refreshBusiness()
    setStep(5)
  }

  const handleSuccess = () => {
    navigate("/dashboard", { replace: true })
  }

  const titles = [
    "Create your account",
    "Verify your number",
    "About your business",
    "Choose your AI number",
    "Activate your Front Desk",
    "One last step",
  ]

  const descriptions = [
    "Tell us who you are — takes 30 seconds.",
    `We sent a 6-digit code to ${identity ? toE164(identity.phone) : "your phone"}.`,
    "Almost there. Tell us about your business.",
    "Pick a local number for your AI receptionist.",
    "Choose a plan and enter your payment details.",
    "Connect your calendar so your AI can book appointments.",
  ]

  return (
    <AuthLayout title={titles[step]} description={descriptions[step]}>
      {/* Step indicator */}
      <div className="mb-6 flex items-center gap-1">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all ${
              i <= step ? "bg-indigo-600" : "bg-muted"
            }`}
          />
        ))}
      </div>

      {step === 0 && <StepIdentity onNext={handleIdentityNext} busy={busy} />}

      {step === 1 && identity && (
        <StepVerify
          phone={toE164(identity.phone)}
          onVerified={handleVerified}
          onBack={() => setStep(0)}
          busy={busy}
          setBusy={setBusy}
        />
      )}

      {step === 2 && <StepBusiness onNext={handleBusinessNext} />}

      {step === 3 && identity && (
        <StepPickNumber
          areaCode={extractAreaCode(identity.phone)}
          onNext={handleNumberNext}
          onBack={() => setStep(2)}
        />
      )}

      {step === 4 && identity && businessData && selectedNumber && userId && (
        <StepPayment
          userId={userId}
          userName={`${identity.firstName} ${identity.lastName}`}
          businessName={businessData.businessName}
          businessType={businessData.businessType}
          phoneNumber={selectedNumber}
          onSuccess={handlePaymentSuccess}
          onBack={() => setStep(3)}
        />
      )}

      {step === 5 && business?.id && session && (
        <StepCalendar
          businessId={business.id}
          accessToken={session.access_token}
          onSkip={handleSuccess}
        />
      )}

      <p className="mt-4 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-indigo-600 hover:underline">Sign in</Link>
      </p>
    </AuthLayout>
  )
}
