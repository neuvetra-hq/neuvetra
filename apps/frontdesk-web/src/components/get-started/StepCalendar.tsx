// apps/web/src/components/get-started/StepCalendar.tsx
import { useState } from "react"
import { Check } from "lucide-react"
import { toast } from "sonner"
import { jost, alpha } from "./types"
import { WizardButton } from "./WizardButton"
import { CalDAVConnectDialog } from "@/components/dashboard/CalDAVConnectDialog"
import { useAppMachine } from "@/pages/app/hooks/useAppMachine"

const API_URL = import.meta.env.VITE_API_URL as string

interface Props {
  businessId: string
  accessToken: string
  onDone: () => void
}

const BENEFITS = [
  "Checks your real availability before offering times",
  "Creates calendar events automatically when a caller books",
  "Never double-books — respects your existing schedule",
]

export function StepCalendar({ businessId, accessToken, onDone }: Props) {
  const [loading, setLoading] = useState(false)
  const [caldavOpen, setCaldavOpen] = useState(false)
  const [connected, setConnected] = useState(false)
  const light = useAppMachine((s) => s.context.currentTheme.light)

  const handleConnect = async (provider: "google" | "outlook") => {
    setLoading(true)
    try {
      const endpoint = provider === "outlook"
        ? `${API_URL}/calendar/microsoft/auth-url?businessId=${businessId}`
        : `${API_URL}/calendar/auth-url?businessId=${businessId}`
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json() as { url?: string; error?: string }
      if (data.error) throw new Error(data.error)
      if (data.url) window.location.href = data.url
    } catch (err) {
      toast.error((err as Error).message ?? "Failed to start connection")
      setLoading(false)
    }
  }

  if (connected) {
    return (
      <div className="text-center space-y-6 py-4">
        <div className="flex justify-center">
          <div
            className="size-14 flex items-center justify-center"
            style={{ border: `1px solid ${alpha(light, 0.3)}`, background: alpha(light, 0.06) }}
          >
            <Check className="size-6" strokeWidth={1.5} style={{ color: light }} />
          </div>
        </div>
        <p className="text-sm text-white/50" style={jost}>Calendar connected.</p>
        <WizardButton type="button" onClick={onDone}>Finish →</WizardButton>
      </div>
    )
  }

  const providerButton = (
    label: string,
    description: string,
    icon: React.ReactNode,
    onClick: () => void,
  ) => (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="flex w-full items-center gap-4 px-5 py-4 border-b border-white/[0.06] hover:bg-white/[0.02] transition-colors disabled:opacity-50 text-left last:border-b-0"
    >
      <div className="size-9 flex items-center justify-center border border-white/10 bg-white/[0.02] shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white/70" style={jost}>{label}</p>
        <p className="text-[10px] text-white/30" style={jost}>{description}</p>
      </div>
      <span className="text-[10px] shrink-0" style={{ color: alpha(light, 0.5), ...jost }}>Connect →</span>
    </button>
  )

  return (
    <div className="space-y-5">
      {/* Benefits */}
      <div className="space-y-2">
        {BENEFITS.map((b) => (
          <div key={b} className="flex items-start gap-2.5">
            <span className="text-[9px] mt-1 shrink-0" style={{ color: alpha(light, 0.4) }}>—</span>
            <p className="text-xs text-white/40" style={jost}>{b}</p>
          </div>
        ))}
      </div>

      {/* Providers */}
      <div className="border border-white/[0.08]">
        {providerButton(
          "Google Calendar",
          "Connect via Google account",
          <svg className="size-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>,
          () => handleConnect("google"),
        )}
        {providerButton(
          "Outlook Calendar",
          "Microsoft 365 & Outlook.com",
          <svg className="size-4" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="2" fill="#0078D4"/>
            <path d="M13 6h6.5A1.5 1.5 0 0 1 21 7.5v9a1.5 1.5 0 0 1-1.5 1.5H13V6z" fill="#fff" fillOpacity=".3"/>
            <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h8A1.5 1.5 0 0 1 14 8.5v7A1.5 1.5 0 0 1 12.5 17h-8A1.5 1.5 0 0 1 3 15.5v-7z" fill="#fff"/>
            <path d="M8.5 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" fill="#0078D4"/>
          </svg>,
          () => handleConnect("outlook"),
        )}
        {providerButton(
          "Apple / CalDAV",
          "iCloud, Fastmail, Nextcloud & more",
          <svg className="size-4" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="2" fill="rgba(255,255,255,0.06)"/>
            <path d="M17 3h-1V1h-2v2H10V1H8v2H7C5.9 3 5 3.9 5 5v14c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H7V9h10v10z" fill="rgba(255,255,255,0.5)"/>
          </svg>,
          () => setCaldavOpen(true),
        )}
      </div>

      <button
        type="button"
        onClick={onDone}
        className="w-full py-2.5 text-[10px] tracking-[.1em] uppercase text-white/20 hover:text-white/40 transition-colors"
        style={{ fontFamily: "'Jost', sans-serif" }}
      >
        Skip for now — I'll connect in Settings
      </button>

      <CalDAVConnectDialog
        open={caldavOpen}
        onOpenChange={setCaldavOpen}
        onConnected={() => setConnected(true)}
        businessId={businessId}
        accessToken={accessToken}
      />
    </div>
  )
}
