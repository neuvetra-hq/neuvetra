import { createContext, useContext, type ReactNode } from "react"
import { useVoiceCall, type CallStatus } from "@/hooks/useVoiceCall"

interface VoiceCallContextValue {
  status: CallStatus
  isMuted: boolean
  duration: string
  errorMessage: string
  start: () => void
  hangUp: () => void
  toggleMute: () => void
}

const VoiceCallContext = createContext<VoiceCallContextValue | null>(null)

export function VoiceCallProvider({ children }: { children: ReactNode }) {
  const call = useVoiceCall()
  return <VoiceCallContext.Provider value={call}>{children}</VoiceCallContext.Provider>
}

export function useVoiceCallContext() {
  const ctx = useContext(VoiceCallContext)
  if (!ctx) throw new Error("useVoiceCallContext must be used inside VoiceCallProvider")
  return ctx
}
