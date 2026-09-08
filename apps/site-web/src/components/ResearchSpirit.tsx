import { useEffect, useRef, useState } from "react"
import type { SpiritEngine } from "@/lib/spirit/engine"

export function ResearchSpirit() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [motionEnabled, setMotionEnabled] = useState(true)

  useEffect(() => {
    const container = containerRef.current
    if (!container || !motionEnabled) return

    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)")
    const smallScreen = window.matchMedia("(max-width: 768px)")
    let engine: SpiritEngine | undefined
    let generation = 0

    const updateMotion = () => {
      const currentGeneration = ++generation
      engine?.dispose()
      engine = undefined
      if (motionPreference.matches || smallScreen.matches) return

      // The preview needs only the decorative renderer, never chat, tools, or audio.
      void import("@/lib/spirit/engine").then(async ({ SpiritEngine: Engine }) => {
        if (generation !== currentGeneration) return
        const nextEngine = new Engine()
        engine = nextEngine
        try {
          await nextEngine.init(container)
        } catch {
          nextEngine.dispose()
          if (engine === nextEngine) engine = undefined
          // The static orbital illustration remains if WebGL is unavailable.
        }
      }).catch(() => {
        // An optional visual must not prevent the source library from working.
      })
    }

    updateMotion()
    motionPreference.addEventListener("change", updateMotion)
    smallScreen.addEventListener("change", updateMotion)
    return () => {
      generation++
      motionPreference.removeEventListener("change", updateMotion)
      smallScreen.removeEventListener("change", updateMotion)
      engine?.dispose()
    }
  }, [motionEnabled])

  return (
    <div className="research-visual">
      <div className="research-spirit" ref={containerRef} aria-hidden="true" />
      <div className="research-orbits" aria-hidden="true">
        <span /><span /><span />
        <div className="research-orbit-core">N</div>
      </div>
      <div className="research-visual-caption">
        <span className="research-eyebrow">The starting point</span>
        <p>Every answer begins<br />with a source.</p>
        <div className="research-publisher-list"><span>GHG Protocol</span><span>EPA</span><span>CARB</span></div>
      </div>
      <button
        className="research-motion-toggle"
        type="button"
        onClick={() => setMotionEnabled((enabled) => !enabled)}
        aria-pressed={!motionEnabled}
      >
        {motionEnabled ? "Pause motion" : "Resume motion"}
      </button>
    </div>
  )
}
