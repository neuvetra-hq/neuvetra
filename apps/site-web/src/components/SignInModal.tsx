import { useState, useEffect, useRef, type FormEvent } from "react"
import { AUTH_UNAVAILABLE_MESSAGE, supabase } from "@/lib/supabase"

const JOST = "'Jost Variable', 'Jost', sans-serif"

interface SignInModalProps {
  onClose: () => void
}

type Step = "phone" | "otp"

/**
 * Two-step phone-OTP sign-in modal — alternative entry point to the
 * chat-driven scene flow. Opens via the SignInButton.
 *
 * Step 1: phone input → supabase.auth.signInWithOtp (sends SMS)
 * Step 2: 6-digit OTP input → supabase.auth.verifyOtp (creates session)
 *
 * On verify success, AgentIdentityBar's onAuthStateChange listener flips
 * the top bar to the authenticated state automatically. We just close the
 * modal and let the rest of the UI react.
 */
export function SignInModal({ onClose }: SignInModalProps) {
  const [step, setStep] = useState<Step>("phone")
  const [phone, setPhone] = useState("")
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const phoneInputRef = useRef<HTMLInputElement>(null)
  const codeInputRef = useRef<HTMLInputElement>(null)

  // Autofocus current step's input
  useEffect(() => {
    if (step === "phone") phoneInputRef.current?.focus()
    else codeInputRef.current?.focus()
  }, [step])

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [busy, onClose])

  const handlePhoneSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (!supabase) {
      setError(AUTH_UNAVAILABLE_MESSAGE)
      return
    }
    const normalized = normalizeE164(phone)
    if (!normalized) {
      setError("Enter a 10-digit US number, or +<country><number>")
      return
    }
    setBusy(true)
    setError(null)
    const { error: sendErr } = await supabase.auth.signInWithOtp({
      phone: normalized,
      options: { channel: "sms" },
    })
    setBusy(false)
    if (sendErr) {
      setError(sendErr.message ?? "Couldn't send the code — try again in a moment.")
      return
    }
    setPhone(normalized)
    setStep("otp")
  }

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault()
    if (busy || code.length !== 6) return
    if (!supabase) {
      setError(AUTH_UNAVAILABLE_MESSAGE)
      return
    }
    setBusy(true)
    setError(null)
    const { error: verifyErr } = await supabase.auth.verifyOtp({
      phone,
      token: code,
      type: "sms",
    })
    setBusy(false)
    if (verifyErr) {
      setError("That code didn't work — please double-check.")
      return
    }
    onClose()
  }

  const handleResend = async () => {
    if (busy) return
    if (!supabase) {
      setError(AUTH_UNAVAILABLE_MESSAGE)
      return
    }
    setBusy(true)
    setError(null)
    const { error: sendErr } = await supabase.auth.signInWithOtp({
      phone,
      options: { channel: "sms" },
    })
    setBusy(false)
    if (sendErr) {
      setError(sendErr.message ?? "Resend failed — try again.")
      return
    }
    setCode("")
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sign-in-title"
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ fontFamily: JOST }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => !busy && onClose()}
      />

      {/* Modal */}
      <div
        className="relative w-[min(92vw,26rem)] rounded-2xl border border-white/15 bg-black/55 p-6 backdrop-blur-md"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => !busy && onClose()}
          aria-label="Close sign-in"
          className="absolute top-3 right-3 text-white/40 hover:text-white/85 cursor-pointer"
          disabled={busy}
        >
          ×
        </button>

        <h2 id="sign-in-title" className="text-white/85 text-base font-light tracking-[0.18em] uppercase">
          {step === "phone" ? "Sign in" : "Enter code"}
        </h2>
        <p className="mt-1 text-white/55 text-xs tracking-wide">
          {step === "phone"
            ? "We'll text you a 6-digit code. By continuing, you agree to receive SMS for verification."
            : `Sent to ${phone}`}
        </p>

        {step === "phone" ? (
          <form onSubmit={handlePhoneSubmit} className="mt-5 flex flex-col gap-3">
            <input
              ref={phoneInputRef}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              aria-label="Phone number"
              placeholder="+1 (415) 555-0100"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="rounded-md border border-white/15 bg-black/30 px-3 py-2.5 text-base text-white outline-none focus:border-white/40 transition-colors"
              style={{ fontFamily: JOST }}
              disabled={busy}
            />
            {error && (
              <p className="text-sm text-red-400/85" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy || phone.trim().length === 0}
              className="rounded-md bg-white/85 px-3 py-2.5 text-sm font-medium text-black transition-opacity duration-150 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {busy ? "Sending…" : "Send code"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="mt-5 flex flex-col gap-3">
            <input
              ref={codeInputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              aria-label="Six-digit verification code"
              pattern="\d{6}"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="rounded-md border border-white/15 bg-black/30 px-3 py-2.5 text-center text-xl tracking-[0.4em] text-white outline-none focus:border-white/40 transition-colors"
              style={{ fontFamily: JOST }}
              disabled={busy}
            />
            {error && (
              <p className="text-sm text-red-400/85" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="rounded-md bg-white/85 px-3 py-2.5 text-sm font-medium text-black transition-opacity duration-150 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {busy ? "Verifying…" : "Verify"}
            </button>
            <div className="flex items-center justify-between text-xs text-white/55">
              <button
                type="button"
                onClick={() => {
                  setStep("phone")
                  setCode("")
                  setError(null)
                }}
                disabled={busy}
                className="hover:text-white/85 disabled:opacity-40 cursor-pointer"
              >
                ← Change number
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={busy}
                className="hover:text-white/85 disabled:opacity-40 cursor-pointer"
              >
                Resend code
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

/**
 * Permissive E.164 normalization. Accepts:
 *   - 10-digit US: 4155550100 → +14155550100
 *   - 11-digit starting with 1: 14155550100 → +14155550100
 *   - Already E.164 with +: +14155550100 → +14155550100
 *   - Junk in between: "+1 (415) 555-0100" works
 * Returns null on anything that can't be salvaged.
 */
function normalizeE164(input: string): string | null {
  const cleaned = input.replace(/[^\d+]/g, "")
  if (cleaned.startsWith("+")) {
    return cleaned.length >= 10 && cleaned.length <= 16 ? cleaned : null
  }
  if (cleaned.length === 10) return `+1${cleaned}`
  if (cleaned.length === 11 && cleaned.startsWith("1")) return `+${cleaned}`
  return null
}
