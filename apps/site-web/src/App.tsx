import { useCallback, useEffect, useRef, useState } from "react"
import { createActor, type Actor } from "xstate"
import { useActorRef } from "@xstate/react"
// SpiritEngine is dynamically imported below — keeps Three.js out of the initial bundle
// so the wordmark / cards / chat input paint before the WebGL chunk arrives.
import type { SpiritEngine as SpiritEngineType } from "@/lib/spirit/engine"
import type { createSpiritMachine } from "@/lib/spirit/spiritMachine"
import type { NamedAnchor } from "@/lib/spirit/spiritMachine.types"
import { Chat } from "@/components/Chat"
import { ProductPill, type ProductPillTheme } from "@/components/ProductPill"
import { AgentIdentityBar } from "@/components/AgentIdentityBar"
import { SceneRegion } from "@/components/SceneRegion"
import { SignInButton } from "@/components/SignInButton"
import { useChat } from "@/hooks/useChat"
import type { ChatToolCall } from "@/lib/api"
import { sceneMachine } from "@/actors/scene.actor"

type SpiritActor = Actor<ReturnType<typeof createSpiritMachine>>

/** Maps the agent's cardinal direction enum to existing Spirit anchors. */
const DIRECTION_TO_ANCHOR: Record<string, NamedAnchor> = {
  up: "top",
  down: "bottom",
  left: "left",
  right: "right",
}

/**
 * Maps the agent's named-color enum to (color1, color2) hex pairs.
 * color1 = bright/alive particle color; color2 = dim/dying.
 *
 * Brightness budget: color1 channels stay near ~0.5–0.65 (the default preset's
 * `#3080e0` peaks at 224/255 ≈ 0.88). Saturated #ff____ values dominate the
 * bloom pass and turn the cloud into a glowing blob. These tuned values keep
 * a vivid hue while preserving particle silhouettes through the same bloom.
 */
const COLOR_PALETTE: Record<string, { color1: string; color2: string }> = {
  red:    { color1: "#c0303e", color2: "#3a000a" },
  green:  { color1: "#30c050", color2: "#003015" },
  blue:   { color1: "#3060c0", color2: "#000a35" },
  white:  { color1: "#c8c8c8", color2: "#404040" },
  purple: { color1: "#8040c0", color2: "#200040" },
  orange: { color1: "#c06530", color2: "#3a1408" },
  yellow: { color1: "#b89a20", color2: "#332b08" },
  pink:   { color1: "#c05089", color2: "#380a20" },
  cyan:   { color1: "#30aac0", color2: "#003040" },
}

const JOST = "'Jost Variable', 'Jost', sans-serif"

interface ProductTheme {
  /** Degrees to rotate the spirit's hue as seen through the card. 0 = keep spirit blue. */
  hueRotate: number
  /** 1px border color, matched to the recolored spirit. */
  border:    string
  /** Hover halo colors. */
  glowClose: string
  glowFar:   string
  glowInset: string
}

const FRONTDESK_THEME: ProductTheme = {
  hueRotate: 80,
  border:    "rgba(180, 140, 230, 0.32)",
  glowClose: "rgba(170, 130, 230, 0.11)",
  glowFar:   "rgba(140, 100, 220, 0.06)",
  glowInset: "rgba(180, 140, 235, 0.03)",
}

const TERRASCOPE_THEME: ProductTheme = {
  hueRotate: -90,
  border:    "rgba(140, 220, 180, 0.32)",
  glowClose: "rgba(120, 220, 170, 0.11)",
  glowFar:   "rgba(100, 200, 150, 0.06)",
  glowInset: "rgba(140, 230, 180, 0.03)",
}

/** Pill-mode borders track the card-mode borders so the visual identity carries through. */
const FRONTDESK_PILL_THEME: ProductPillTheme = { border: FRONTDESK_THEME.border }
const TERRASCOPE_PILL_THEME: ProductPillTheme = { border: TERRASCOPE_THEME.border }

interface ProductCardProps {
  name: string
  kicker: string
  line1: string
  line2: string
  theme: ProductTheme
}

function ProductCard({ name, kicker, line1, line2, theme }: ProductCardProps) {
  const [hovered, setHovered] = useState(false)
  const backdropFilter = `blur(12px) hue-rotate(${theme.hueRotate}deg)`
  return (
    <article
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="site-product-card flex flex-1 flex-col rounded-2xl px-6 py-7 text-center transition-shadow duration-200 sm:px-8 sm:py-9 md:min-h-[20rem] md:py-11"
      style={{
        fontFamily: JOST,
        backdropFilter,
        WebkitBackdropFilter: backdropFilter,
        border: `1px solid ${theme.border}`,
        boxShadow: hovered
          ? `0 0 20px ${theme.glowClose}, 0 0 56px ${theme.glowFar}, inset 0 0 16px ${theme.glowInset}`
          : "none",
      }}
    >
      <p
        className="text-white"
        style={{
          fontWeight: 300,
          fontSize: "clamp(1.4rem, 2.6vw, 2rem)",
          letterSpacing: "0.04em",
        }}
      >
        {name}
      </p>
      <p
        className="mt-3 uppercase text-white/55"
        style={{
          fontWeight: 300,
          fontSize: "clamp(0.6rem, 1vw, 0.75rem)",
          letterSpacing: "0.4em",
        }}
      >
        {kicker}
      </p>
      <div
        className="mt-auto pt-7 text-white/65 md:pt-10"
        style={{
          fontWeight: 300,
          fontSize: "clamp(0.85rem, 1.4vw, 0.95rem)",
          letterSpacing: "0.04em",
          lineHeight: 1.7,
        }}
      >
        <p>{line1}</p>
        <p>{line2}</p>
      </div>
    </article>
  )
}

export function App() {
  const containerRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<SpiritEngineType | null>(null)
  const spiritActorRef = useRef<SpiritActor | null>(null)

  // React owns the scene lifecycle independently of the optional Spirit canvas.
  const sceneActor = useActorRef(sceneMachine)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Skip the Spirit on small screens or when reduced motion is preferred.
    // Three.js is ~135 KB gzipped plus heavy WebGL init + a 60fps RAF loop —
    // on mobile (Lighthouse throttles CPU 4×) it dominates TBT and LCP.
    // The dark page background is a fine fallback; brand color still lives in the wordmark glow.
    const skipSpirit =
      window.matchMedia("(max-width: 768px)").matches ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (skipSpirit) return

    let cancelled = false
    Promise.all([
      import("@/lib/spirit/engine"),
      import("@/lib/spirit/spiritMachine"),
    ]).then(([engineMod, machineMod]) => {
      if (cancelled) return
      const engine = new engineMod.SpiritEngine()
      engineRef.current = engine
      engine.init(container).catch((err) => console.error("[Spirit] init failed", err))

      const actor = createActor(machineMod.createSpiritMachine(engineRef)).start()
      spiritActorRef.current = actor
    })

    return () => {
      cancelled = true
      spiritActorRef.current?.stop()
      spiritActorRef.current = null
      engineRef.current?.dispose()
      engineRef.current = null
    }
  }, [])

  const handleToolCall = useCallback((toolCall: ChatToolCall) => {
    const actor = spiritActorRef.current
    if (!actor) return

    if (toolCall.name === "move_spirit") {
      const direction = (toolCall.input as { direction?: string }).direction
      if (!direction) return
      const anchor = DIRECTION_TO_ANCHOR[direction]
      if (!anchor) return
      actor.send({ type: "MOVE_TO", target: anchor })
      return
    }

    if (toolCall.name === "set_spirit_color") {
      const color = (toolCall.input as { color?: string }).color
      if (!color) return
      const palette = COLOR_PALETTE[color]
      if (!palette) return
      actor.send({
        type: "CHANGE_COLORS",
        color1: palette.color1,
        color2: palette.color2,
        durationMs: 1200,
      })
      return
    }
  }, [])

  const handleScenarioActivate = useCallback(
    (activate: { id: string; props: Record<string, unknown> }) => {
      // M2.1 ships one scenario, hardcoded mapping. M2.3 will surface the
      // component name on the scenario directive itself (server-side
      // descriptor → wire payload), removing this client-side switch.
      if (activate.id === "collect_otp_verification") {
        sceneActor.send({
          type: "ACTIVATE",
          scenarioId: activate.id,
          component: "otp_input",
          props: activate.props,
        })
      } else {
        console.warn("[App.handleScenarioActivate] unknown scenario id:", activate.id)
      }
    },
    [sceneActor],
  )

  useEffect(() => {
    const sub = sceneActor.on("SCENARIO_DONE", (ev) => {
      // Auth state flip happens automatically — Supabase JS client emits
      // onAuthStateChange after verifyOtp; AgentIdentityBar + streamChat both
      // react. This log just records the lifecycle for debugging.
      console.log("[App] scenario complete:", ev)
    })
    return () => sub.unsubscribe()
  }, [sceneActor])

  // Lifted from Chat so layout decisions can read chat state too.
  const chat = useChat({ onToolCall: handleToolCall, onScenarioActivate: handleScenarioActivate })

  // Chat mode = "the visitor has engaged the conversation." Once true for a session
  // it stays true — the cards don't pop back. (User-driven re-expansion routes
  // through agent control in M2; pre-M2 they can refresh the page.)
  const inChatMode = chat.messages.length > 0

  return (
    <>
      {/* Spirit canvas — full-bleed background */}
      <div ref={containerRef} aria-hidden="true" className="site-background fixed inset-0 bg-[#0b0c0d]" />

      <header className="fixed inset-x-0 top-0 z-30 px-4 py-4 sm:px-6 sm:py-5">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <AgentIdentityBar />
          <SignInButton />
        </div>
      </header>
      <SceneRegion sceneActor={sceneActor} />

      {/* Compact product pills — top-left, only in chat mode */}
      {inChatMode && (
        <div className="pointer-events-none fixed top-20 left-4 z-20 flex gap-2 sm:left-6 lg:flex-col">
          <ProductPill
            name="FrontDesk"
            kicker="AI Receptionist"
            theme={FRONTDESK_PILL_THEME}
            onClick={() => chat.sendMessage("Tell me about FrontDesk")}
          />
          <ProductPill
            name="Terrascope"
            kicker="Emissions Reporting"
            theme={TERRASCOPE_PILL_THEME}
            onClick={() => chat.sendMessage("Tell me about Terrascope")}
          />
        </div>
      )}

      {/* Foreground content — sits on top, scrolls with the page; canvas behind stays fixed */}
      <main className={`site-main pointer-events-none relative z-10 flex min-h-svh flex-col items-center px-5 pb-8 text-center sm:px-6 md:pb-12 ${inChatMode ? "site-main-chat pt-44 lg:pt-32" : "pt-28 md:pt-32"}`}>
        {/* TOP — wordmark + slogan + product cards stacked together */}
        <div className="flex flex-col items-center w-full max-w-4xl">
          <h1
            className="site-wordmark max-w-full uppercase leading-none"
            style={{
              fontFamily: JOST,
              fontWeight: 150,
              letterSpacing: "0.09em",
              color: "rgba(145, 190, 232, 0.78)",
              textShadow:
                "0 0 28px rgba(80, 150, 230, 0.55), 0 0 70px rgba(60, 120, 210, 0.4), 0 0 140px rgba(40, 90, 180, 0.25)",
            }}
          >
            Neuvetra
          </h1>
          <p
            className="site-tagline mt-5 max-w-[28rem] text-balance uppercase text-white/85 md:max-w-none"
            style={{
              fontFamily: JOST,
              fontWeight: 300,
              fontSize: "clamp(0.7rem, 1.4vw, 0.95rem)",
              letterSpacing: "0.2em",
              lineHeight: 1.8,
            }}
          >
            AI specialists for every job in your business
          </p>

          {/* Expanded product cards — only outside chat mode */}
          {!inChatMode && (
            <div className="site-product-grid pointer-events-auto mt-10 flex w-full max-w-[48rem] flex-col items-stretch justify-center gap-4 sm:mt-12 sm:flex-row sm:gap-6 md:mt-14">
              <ProductCard
                name="FrontDesk"
                kicker="AI Receptionist"
                line1="Picks up your calls."
                line2="Books appointments. Never sleeps."
                theme={FRONTDESK_THEME}
              />
              <ProductCard
                name="Terrascope"
                kicker="Emissions Reporting"
                line1="Scope 1, 2 and 3 reporting."
                line2="In development."
                theme={TERRASCOPE_THEME}
              />
            </div>
          )}
        </div>

        {/* BOTTOM — chat input. mt-auto pushes it to the bottom on desktop; on mobile it just flows after the cards. */}
        <div className="site-chat-entry mt-10 flex w-full flex-col items-center pt-2 md:mt-auto md:pt-12">
          <Chat chat={chat} />
        </div>
      </main>
    </>
  )
}
