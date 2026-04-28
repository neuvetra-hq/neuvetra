import { useRef, useEffect, type RefObject } from "react"
import { SpiritEngine } from "@/lib/spirit/engine"

export function useSpirit(
  containerRef: RefObject<HTMLDivElement | null>,
  onReady?: () => void,
): { engineRef: RefObject<SpiritEngine | null> } {
  const engineRef = useRef<SpiritEngine | null>(null)
  const onReadyRef = useRef(onReady)

  // Keep onReadyRef in sync with the latest onReady prop without touching
  // the ref during render (React 19 disallows that).
  useEffect(() => {
    onReadyRef.current = onReady
  }, [onReady])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const engine = new SpiritEngine()
    engineRef.current = engine
    const MIN_BOOT_MS = 1200
    Promise.all([
      engine.init(container),
      new Promise<void>(r => setTimeout(r, MIN_BOOT_MS)),
    ])
      .then(() => onReadyRef.current?.())
      .catch(err => console.error("[useSpirit] engine init failed", err))

    // Unlock AudioContext synchronously within the user gesture, bypassing XState.
    // iOS Safari closes the gesture window before async event delivery completes.
    const unlock = () => engineRef.current?.unlockAudio()
    document.addEventListener("touchstart", unlock, { once: true, passive: true })
    document.addEventListener("click",      unlock, { once: true })

    return () => {
      document.removeEventListener("touchstart", unlock)
      document.removeEventListener("click",      unlock)
      engine.dispose()
      engineRef.current = null
    }
  }, [containerRef])

  return { engineRef }
}
