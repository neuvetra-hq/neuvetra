import { useState, type FormEvent } from "react"
import { defaultVerifyOtp, type VerifyOtp } from "@/lib/verify-otp"
import type { SceneComponentProps } from "./registry"

const JOST = "'Jost Variable', 'Jost', sans-serif"

export interface VerifyOtpDeps {
  verify: VerifyOtp
}

interface OtpInputProps extends SceneComponentProps {
  /** Override the verify path in tests. */
  verifyDeps?: VerifyOtpDeps
}

export function OtpInput({ sceneActor, props, verifyDeps }: OtpInputProps) {
  const phone = (props.phone as string | undefined) ?? ""
  const verify = verifyDeps?.verify ?? defaultVerifyOtp
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (code.length !== 6 || busy) return
    setBusy(true)
    setError(null)
    const result = await verify(phone, code)
    setBusy(false)
    if (result.ok) {
      sceneActor.send({ type: "DONE", output: { authenticated: true, phone } })
    } else {
      setError("That code didn't work — please double-check.")
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded-2xl border border-white/15 bg-black/40 p-5 backdrop-blur-md"
      style={{ fontFamily: JOST }}
    >
      <div className="text-white/85 text-sm font-light tracking-wide">
        Enter the 6-digit code we just texted to <span className="font-medium">{phone}</span>:
      </div>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-label="Six-digit verification code"
        pattern="\d{6}"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        autoFocus
        className="rounded-md border border-white/15 bg-black/30 px-3 py-2 text-center text-xl tracking-[0.4em] text-white outline-none focus:border-white/40 transition-colors"
        style={{ fontFamily: JOST }}
      />
      {error && (
        <p className="text-sm text-red-400/85" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={code.length !== 6 || busy}
        className="rounded-md bg-white/85 px-3 py-2 text-sm font-medium text-black transition-opacity duration-150 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      >
        {busy ? "Verifying…" : "Verify"}
      </button>
    </form>
  )
}
