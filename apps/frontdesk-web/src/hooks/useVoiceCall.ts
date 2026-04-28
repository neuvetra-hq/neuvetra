import { useState, useRef, useCallback } from "react"
import { Device, type Call } from "@twilio/voice-sdk"

export type CallStatus = "idle" | "connecting" | "in-call" | "ended" | "error"

const API_URL = import.meta.env.VITE_API_URL as string

export function useVoiceCall() {
  const [status, setStatus] = useState<CallStatus>("idle")
  const [isMuted, setIsMuted] = useState(false)
  const [duration, setDuration] = useState(0)
  const [errorMessage, setErrorMessage] = useState("")

  const deviceRef = useRef<Device | null>(null)
  const callRef = useRef<Call | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function cleanup() {
    if (timerRef.current) clearInterval(timerRef.current)
    deviceRef.current?.destroy()
    deviceRef.current = null
    callRef.current = null
    setIsMuted(false)
    setDuration(0)
  }

  const start = useCallback(async () => {
    if (status !== "idle") return
    setStatus("connecting")

    try {
      const res = await fetch(`${API_URL}/voice-token`)
      if (!res.ok) throw new Error("Failed to get token")
      const { token } = await res.json()

      const device = new Device(token, { logLevel: "warn" })
      deviceRef.current = device

      const call = await device.connect()
      callRef.current = call

      call.on("accept", () => {
        setStatus("in-call")
        timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000)
      })

      call.on("disconnect", () => {
        cleanup()
        setStatus("ended")
        setTimeout(() => setStatus("idle"), 3000)
      })

      call.on("error", () => {
        cleanup()
        setErrorMessage("Call failed. Please try again.")
        setStatus("error")
        setTimeout(() => setStatus("idle"), 4000)
      })
    } catch (err: unknown) {
      cleanup()
      const name = err instanceof Error ? err.name : ""
      setErrorMessage(
        name === "NotAllowedError"
          ? "Microphone access denied — please allow it and try again."
          : "Could not connect. Please try again."
      )
      setStatus("error")
      setTimeout(() => setStatus("idle"), 4000)
    }
  }, [status])

  const hangUp = useCallback(() => {
    callRef.current?.disconnect()
  }, [])

  const toggleMute = useCallback(() => {
    if (!callRef.current) return
    const next = !isMuted
    callRef.current.mute(next)
    setIsMuted(next)
  }, [isMuted])

  const formattedDuration = `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, "0")}`

  return { status, isMuted, duration: formattedDuration, errorMessage, start, hangUp, toggleMute }
}
