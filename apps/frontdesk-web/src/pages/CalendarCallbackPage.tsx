import { useEffect } from "react"
import { useNavigate } from "react-router"
import { useAuth } from "@/contexts/AuthContext"

/**
 * Handles the OAuth return from Google after calendar connect.
 * The API (api.neuvetra.com/calendar/callback) exchanges the code and
 * redirects here with ?calendar=connected or ?calendar=error.
 * This page just reads that param and routes the user accordingly.
 */
export function CalendarCallbackPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  useEffect(() => {
    if (!user) {
      navigate("/login", { replace: true })
      return
    }
    // The API already handled token exchange — redirect to Settings tab
    navigate("/dashboard/settings?calendar=connected", { replace: true })
  }, [user, navigate])

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50">
      <div className="flex flex-col items-center gap-3">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
        <p className="text-sm text-neutral-500">Connecting your calendar…</p>
      </div>
    </div>
  )
}
