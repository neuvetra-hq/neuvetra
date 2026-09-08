// apps/web/src/components/get-started/StepVerify.tsx
import { useState, useEffect, useRef } from "react"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { supabase } from "@/lib/supabase"
import { findBusinessMembership } from "@/lib/account-data"
import { toast } from "sonner"
import { WizardButton } from "./WizardButton"
import { jost } from "./types"

interface Props {
  phone: string
  onVerified: (userId: string, accessToken: string) => void
}

export function StepVerify({ phone, onVerified }: Props) {
  const [otp, setOtp] = useState("")
  const [busy, setBusy] = useState(false)
  const [cooldown, setCooldown] = useState(30)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCooldown((s) => {
        if (s <= 1) { clearInterval(timerRef.current!); return 0 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current!)
  }, [])

  const handleVerifyToken = async (token: string) => {
    setBusy(true)
    try {
      const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" })
      if (error) throw error
      if (!data.user || !data.session) throw new Error("Verification failed — please try again")

      const existing = await findBusinessMembership(supabase, data.user.id)

      if (existing) {
        toast.info("You already have an account — signing you in.")
        window.location.href = "/dashboard"
        return
      }

      onVerified(data.user.id, data.session.access_token)
    } catch (err) {
      toast.error((err as Error).message ?? "Invalid code — try again")
      setOtp("")
    } finally {
      setBusy(false)
    }
  }

  const handleResend = async () => {
    if (cooldown > 0) return
    setBusy(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone })
      if (error) throw error
      setCooldown(30)
      timerRef.current = setInterval(() => {
        setCooldown((s) => {
          if (s <= 1) { clearInterval(timerRef.current!); return 0 }
          return s - 1
        })
      }, 1000)
      toast.success("New code sent.")
    } catch (err) {
      toast.error((err as Error).message ?? "Failed to resend")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-white/50 text-center" style={jost}>
        Sent to <span className="text-white/80">{phone}</span>
      </p>

      <div className="flex justify-center">
        <InputOTP
          maxLength={6}
          value={otp}
          onChange={(val) => {
            setOtp(val)
            if (val.length === 6) handleVerifyToken(val)
          }}
          disabled={busy}
          autoFocus
        >
          <InputOTPGroup style={{ borderRadius: 0 }}>
            <InputOTPSlot index={0} className="size-12 text-lg bg-white/[0.07] border-white/20 text-white" style={{ borderRadius: 0 }} />
            <InputOTPSlot index={1} className="size-12 text-lg bg-white/[0.07] border-white/20 text-white" style={{ borderRadius: 0 }} />
            <InputOTPSlot index={2} className="size-12 text-lg bg-white/[0.07] border-white/20 text-white" style={{ borderRadius: 0 }} />
            <InputOTPSlot index={3} className="size-12 text-lg bg-white/[0.07] border-white/20 text-white" style={{ borderRadius: 0 }} />
            <InputOTPSlot index={4} className="size-12 text-lg bg-white/[0.07] border-white/20 text-white" style={{ borderRadius: 0 }} />
            <InputOTPSlot index={5} className="size-12 text-lg bg-white/[0.07] border-white/20 text-white" style={{ borderRadius: 0 }} />
          </InputOTPGroup>
        </InputOTP>
      </div>

      {busy && (
        <p className="text-center text-[11px] text-white/40" style={jost}>Verifying…</p>
      )}

      <WizardButton
        type="button"
        onClick={handleResend}
        disabled={cooldown > 0 || busy}
      >
        {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
      </WizardButton>
    </div>
  )
}
