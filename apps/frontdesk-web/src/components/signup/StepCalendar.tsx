import { useState } from "react"
import { Calendar, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { CalDAVConnectDialog } from "@/components/dashboard/CalDAVConnectDialog"

const API_URL = import.meta.env.VITE_API_URL as string

interface Props {
  businessId: string
  accessToken: string
  onSkip: () => void
}

export function StepCalendar({ businessId, accessToken, onSkip }: Props) {
  const [loading, setLoading]       = useState(false)
  const [caldavOpen, setCaldavOpen] = useState(false)
  const [connected, setConnected]   = useState(false)

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
      toast.error((err as Error).message ?? "Failed to start calendar connection")
      setLoading(false)
    }
  }

  if (connected) {
    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-50 border border-green-100">
            <Check className="size-8 text-green-600" strokeWidth={2} />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-neutral-900">Calendar connected!</h2>
          <p className="text-sm text-neutral-500">Your AI can now check availability and book appointments.</p>
        </div>
        <Button className="w-full" onClick={onSkip}>Continue</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Icon */}
      <div className="flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 border border-indigo-100">
          <Calendar className="size-8 text-indigo-600" strokeWidth={1.5} />
        </div>
      </div>

      {/* Copy */}
      <div className="text-center space-y-2">
        <h2 className="text-lg font-semibold text-neutral-900">Connect your calendar</h2>
        <p className="text-sm text-neutral-500 leading-relaxed">
          Your AI receptionist will check your availability and book appointments
          directly into your calendar during calls.
        </p>
      </div>

      {/* What it does */}
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 space-y-2.5">
        {[
          "Checks your real availability before offering times",
          "Creates calendar events automatically when a caller books",
          "Never double-books — respects your existing schedule",
        ].map((item) => (
          <div key={item} className="flex items-start gap-2.5">
            <Check className="size-4 text-indigo-500 mt-0.5 shrink-0" strokeWidth={2.5} />
            <span className="text-sm text-neutral-600">{item}</span>
          </div>
        ))}
      </div>

      {/* Provider list */}
      <div className="rounded-xl border border-neutral-200 overflow-hidden">
        {/* Google */}
        <button
          type="button"
          onClick={() => handleConnect("google")}
          disabled={loading}
          className="flex w-full items-center gap-3 px-4 py-3.5 border-b border-neutral-200 hover:bg-neutral-50 transition-colors disabled:opacity-60 text-left"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white border border-neutral-200">
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-neutral-800">Google Calendar</p>
            <p className="text-xs text-neutral-400">Connect via Google account</p>
          </div>
          <span className="text-xs text-indigo-600 font-medium shrink-0">Connect →</span>
        </button>

        {/* Outlook */}
        <button
          type="button"
          onClick={() => handleConnect("outlook")}
          disabled={loading}
          className="flex w-full items-center gap-3 px-4 py-3.5 border-b border-neutral-200 hover:bg-neutral-50 transition-colors disabled:opacity-60 text-left"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white border border-neutral-200">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
              <rect width="24" height="24" rx="4" fill="#0078D4"/>
              <path d="M13 6h6.5A1.5 1.5 0 0 1 21 7.5v9a1.5 1.5 0 0 1-1.5 1.5H13V6z" fill="#fff" fillOpacity=".3"/>
              <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h8A1.5 1.5 0 0 1 14 8.5v7A1.5 1.5 0 0 1 12.5 17h-8A1.5 1.5 0 0 1 3 15.5v-7z" fill="#fff"/>
              <path d="M8.5 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" fill="#0078D4"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-neutral-800">Outlook Calendar</p>
            <p className="text-xs text-neutral-400">Microsoft 365 &amp; Outlook.com</p>
          </div>
          <span className="text-xs text-indigo-600 font-medium shrink-0">Connect →</span>
        </button>

        {/* Apple / CalDAV */}
        <button
          type="button"
          onClick={() => setCaldavOpen(true)}
          disabled={loading}
          className="flex w-full items-center gap-3 px-4 py-3.5 hover:bg-neutral-50 transition-colors disabled:opacity-60 text-left"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white border border-neutral-200">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
              <rect width="24" height="24" rx="4" fill="#f5f5f7"/>
              <path d="M17 3h-1V1h-2v2H10V1H8v2H7C5.9 3 5 3.9 5 5v14c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H7V9h10v10z" fill="#555"/>
              <circle cx="15" cy="13" r="1.5" fill="#555"/>
              <circle cx="11.5" cy="13" r="1.5" fill="#555"/>
              <circle cx="8" cy="13" r="1.5" fill="#555"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-neutral-800">Apple / CalDAV</p>
            <p className="text-xs text-neutral-400">iCloud, Fastmail, Nextcloud &amp; more</p>
          </div>
          <span className="text-xs text-indigo-600 font-medium shrink-0">Connect →</span>
        </button>
      </div>

      <Button
        type="button"
        variant="ghost"
        onClick={onSkip}
        className="w-full text-sm text-neutral-400 hover:text-neutral-600"
      >
        Skip for now — I'll connect in Settings
      </Button>

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
