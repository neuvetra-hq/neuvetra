import { Navigate, useLocation } from "react-router"
import { useAuth } from "@/contexts/AuthContext"

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, profile, business } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
      </div>
    )
  }

  // Not logged in at all
  if (!session) return <Navigate to="/login" replace />

  const onSignup = location.pathname === "/signup"

  // Has session but no verified profile → must complete signup
  if (!profile && !onSignup) return <Navigate to="/signup" replace />

  // Has profile but no active business → must create one
  const hasActiveBusiness = business?.status === "active"
  if (profile && !hasActiveBusiness && !onSignup) return <Navigate to="/signup" replace />

  // Already fully set up — bounce away from signup
  if (profile && hasActiveBusiness && onSignup) return <Navigate to="/dashboard" replace />

  return <>{children}</>
}
