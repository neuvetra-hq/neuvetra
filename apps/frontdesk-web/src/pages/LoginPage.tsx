import { useState, useEffect, useRef } from "react"
import { Navigate, useNavigate, Link } from "react-router"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/lib/supabase"
import { AuthLayout } from "@/components/auth/AuthLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { toast } from "sonner"

function toE164(raw: string): string {
  const digits = raw.replace(/\D/g, "")
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`
  return `+${digits}`
}

type Step = "phone" | "otp"

export function LoginPage() {
  const { session, loading, refreshProfile, refreshBusiness } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>("phone")
  const [phone, setPhone] = useState("")
  const [otp, setOtp] = useState("")
  const [busy, setBusy] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
      </div>
    )
  }

  if (session) return <Navigate to="/dashboard" replace />

  const startCooldown = () => {
    setCooldown(30)
    timerRef.current = setInterval(() => {
      setCooldown((s) => { if (s <= 1) { clearInterval(timerRef.current!); return 0 } return s - 1 })
    }, 1000)
  }

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: toE164(phone) })
      if (error) throw error
      setStep("otp")
      startCooldown()
      toast.success("Code sent — check your messages.")
    } catch (err) {
      toast.error((err as Error).message ?? "Failed to send code")
    } finally {
      setBusy(false)
    }
  }

  const handleVerifyOtp = async (token: string) => {
    setBusy(true)
    try {
      const { data, error } = await supabase.auth.verifyOtp({ phone: toE164(phone), token, type: "sms" })
      if (error) throw error
      if (!data.user) throw new Error("No user returned")

      const { data: existingProfile } = await supabase
        .from("users")
        .select("id")
        .eq("id", data.user.id)
        .maybeSingle()

      if (!existingProfile) {
        navigate("/signup", { replace: true })
      } else {
        await Promise.all([refreshProfile(), refreshBusiness()])
        navigate("/dashboard", { replace: true })
      }
    } catch (err) {
      toast.error((err as Error).message ?? "Invalid or expired code")
    } finally {
      setBusy(false)
    }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    await handleVerifyOtp(otp)
  }

  const handleResend = async () => {
    if (cooldown > 0) return
    setBusy(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: toE164(phone) })
      if (error) throw error
      startCooldown()
      toast.success("New code sent.")
    } catch (err) {
      toast.error((err as Error).message ?? "Failed to resend")
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title={step === "phone" ? "Welcome back" : "Check your phone"}
      description={
        step === "phone"
          ? "Enter your mobile number to sign in"
          : `We sent a code to ${phone}`
      }
    >
      {step === "phone" && (
        <form onSubmit={handleSendCode} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="phone">Mobile number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+1 (415) 555-0100"
              autoComplete="tel"
              autoFocus
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Sending…" : "Send code"}
          </Button>
          <p className="text-center text-sm text-neutral-500">
            New here?{" "}
            <Link to="/signup" className="font-medium text-indigo-600 hover:underline">Create an account</Link>
          </p>
        </form>
      )}

      {step === "otp" && (
        <form onSubmit={handleVerify} className="space-y-4">
          <div className="flex flex-col items-center gap-4 py-2">
            <InputOTP
              maxLength={6}
              value={otp}
              onChange={(val) => {
                setOtp(val)
                if (val.length === 6) handleVerifyOtp(val)
              }}
              disabled={busy}
              autoFocus
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} className="size-12 text-lg" />
                <InputOTPSlot index={1} className="size-12 text-lg" />
                <InputOTPSlot index={2} className="size-12 text-lg" />
                <InputOTPSlot index={3} className="size-12 text-lg" />
                <InputOTPSlot index={4} className="size-12 text-lg" />
                <InputOTPSlot index={5} className="size-12 text-lg" />
              </InputOTPGroup>
            </InputOTP>
            <p className="text-xs text-muted-foreground">
              {busy ? "Verifying…" : "Enter the 6-digit code sent to your phone"}
            </p>
          </div>
          <div className="flex items-center justify-between text-sm">
            <Button type="button" variant="link" className="h-auto p-0 text-neutral-400 hover:text-neutral-600" onClick={() => { setStep("phone"); setOtp("") }}>
              ← Change number
            </Button>
            <Button
              type="button"
              variant="link"
              onClick={handleResend}
              disabled={cooldown > 0 || busy}
              className="h-auto p-0 text-neutral-500 hover:text-neutral-900"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend"}
            </Button>
          </div>
        </form>
      )}
    </AuthLayout>
  )
}
