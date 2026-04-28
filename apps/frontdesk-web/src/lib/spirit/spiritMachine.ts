import { setup, assign, fromCallback } from "xstate"
import type { RefObject } from "react"
import { PRESETS } from "@/data/spirit-presets"
import { resolveTarget } from "./spiritMachine.anchors"
import type { SpiritMachineContext, SpiritEvent } from "./spiritMachine.types"
import type { SpiritEngine } from "./engine"
import type { SpiritPreset } from "@/data/spirit-presets"

export function createSpiritMachine(engineRef: RefObject<SpiritEngine | null>) {
  const eng = () => engineRef.current

  return setup({
    types: {} as {
      context: SpiritMachineContext
      events: SpiritEvent
    },
    actors: {
      listenForUserInteraction: fromCallback<SpiritEvent>(({ sendBack }) => {
        const handle = () => sendBack({ type: "USER_INTERACTED" })
        document.addEventListener("click",      handle, { once: true })
        document.addEventListener("keydown",    handle, { once: true })
        document.addEventListener("touchstart", handle, { once: true })
        return () => {
          document.removeEventListener("click",      handle)
          document.removeEventListener("keydown",    handle)
          document.removeEventListener("touchstart", handle)
        }
      }),
    },
    guards: {
      isKnownPreset: ({ event }) =>
        event.type === "SET_PRESET" && event.name in PRESETS,
    },
    actions: {
      // ── visual ───────────────────────────────────────────────────────
      applyPreset: assign(({ context, event }) => {
        const e = event as Extract<SpiritEvent, { type: "SET_PRESET" }>
        const base = PRESETS[e.name]
        const to: SpiritPreset = {
          ...base,
          color1: e.color1 ?? base.color1,
          color2: e.color2 ?? base.color2,
        }
        const from = context.currentPreset
        const durationMs = e.durationMs ?? 1400
        eng()?.setVisualTarget(from, to, durationMs)
        return { fromPreset: from, toPreset: to, visualDurationMs: durationMs }
      }),

      applyColors: assign(({ context, event }) => {
        const e = event as Extract<SpiritEvent, { type: "CHANGE_COLORS" }>
        const to: SpiritPreset = { ...context.currentPreset }
        if (e.color1)  to.color1  = e.color1
        if (e.color2)  to.color2  = e.color2
        if (e.bgColor) to.bgColor = e.bgColor
        const durationMs = e.durationMs ?? 1400
        eng()?.setVisualTarget(context.currentPreset, to, durationMs)
        return { fromPreset: context.currentPreset, toPreset: to, visualDurationMs: durationMs }
      }),

      commitPreset: assign(({ context }) => ({
        currentPreset: context.toPreset ?? context.currentPreset,
        toPreset: null,
      })),

      resetVisual: assign(() => {
        eng()?.setVisualTarget(PRESETS.default, PRESETS.default, 0)
        return { currentPreset: PRESETS.default, fromPreset: PRESETS.default, toPreset: null }
      }),

      // ── attractor ────────────────────────────────────────────────────
      applyAttractorTarget: assign(({ event }) => {
        const e = event as Extract<SpiritEvent, { type: "MOVE_TO" }>
        const pos = resolveTarget(e.target)
        const kickAngle = Math.random() * Math.PI * 2
        eng()?.setAttractorTarget(pos, kickAngle)
        return {
          attractorTarget: pos,
          holdMs: e.holdMs ?? 2000,
          returnMs: e.returnMs ?? 1200,
          kickAngle,
        }
      }),

      beginReturn: ({ context }) => {
        eng()?.setAttractorTarget(null, context.kickAngle)
      },

      clearAttractorTarget: assign(() => {
        eng()?.setAttractorTarget(null, 0)
        return { attractorTarget: null }
      }),

      // ── motion ───────────────────────────────────────────────────────
      applySurge: assign(({ event }) => {
        const e = event as Extract<SpiritEvent, { type: "SURGE" }>
        const intensity  = e.intensity  ?? 0.55
        const durationMs = e.durationMs ?? 1400
        const kickAngle  = e.kickAngle  ?? Math.random() * Math.PI * 2
        eng()?.setSurge(intensity, durationMs, kickAngle)
        return { surgeIntensity: intensity, surgeDurationMs: durationMs, kickAngle }
      }),

      applySpeed: assign(({ context, event }) => {
        const e = event as Extract<SpiritEvent, { type: "SET_SPEED" }>
        const patched: SpiritPreset = {
          ...context.currentPreset,
          speed: e.speed,
          followSpeed: e.followSpeed ?? context.currentPreset.followSpeed,
        }
        eng()?.setVisualTarget(patched, patched, 0)
        return { currentPreset: patched }
      }),

      applyCurl: assign(({ context, event }) => {
        const e = event as Extract<SpiritEvent, { type: "SET_CURL" }>
        const patched: SpiritPreset = {
          ...context.currentPreset,
          curlSize: e.curlSize,
          attraction: e.attraction ?? context.currentPreset.attraction,
        }
        eng()?.setVisualTarget(patched, patched, 0)
        return { currentPreset: patched }
      }),

      autoSurgePreset: () => {
        const kickAngle = Math.random() * Math.PI * 2
        eng()?.setSurge(0.55, 1400, kickAngle)
      },

      autoSurgeMove: () => {
        const kickAngle = Math.random() * Math.PI * 2
        eng()?.setSurge(0.4, 800, kickAngle)
      },

      // ── audio ────────────────────────────────────────────────────────
      unlockAudio: () => { eng()?.unlockAudio() },
      playSFX:     ({ event }) => {
        const e = event as Extract<SpiritEvent, { type: "PLAY_SFX" }>
        eng()?.playSFX(e.name, e.rate, e.volume)
      },
      setMuted: (_, params: { muted: boolean }) => { eng()?.setMuted(params.muted) },
    },
    delays: {
      holdMs:           ({ context }) => context.holdMs,
      returnMs:         ({ context }) => context.returnMs,
      visualDurationMs: ({ context }) => context.visualDurationMs,
      surgeDurationMs:  ({ context }) => context.surgeDurationMs,
    },
  }).createMachine({
    id: "spirit",
    type: "parallel",
    context: {
      currentPreset:    PRESETS.default,
      fromPreset:       PRESETS.default,
      toPreset:         null,
      visualDurationMs: 1400,
      attractorTarget:  null,
      holdMs:           2000,
      returnMs:         1200,
      kickAngle:        0,
      surgeIntensity:   0.55,
      surgeDurationMs:  1400,
    },
    on: {
      RESET: {
        actions: ["resetVisual", "clearAttractorTarget"],
      },
      SET_SPEED: { actions: "applySpeed" },
      SET_CURL:  { actions: "applyCurl" },
    },
    states: {

      // ── attractor ──────────────────────────────────────────────────────
      attractor: {
        initial: "wandering",
        on: {
          WANDER: { target: ".wandering", actions: "clearAttractorTarget" },
        },
        states: {
          wandering: {
            on: {
              MOVE_TO: {
                target: "targeting",
                actions: ["applyAttractorTarget", "autoSurgeMove"],
              },
            },
          },
          targeting: {
            after: {
              holdMs: { target: "returning", actions: "beginReturn" },
            },
          },
          returning: {
            after: {
              returnMs: { target: "wandering" },
            },
          },
        },
      },

      // ── visual ─────────────────────────────────────────────────────────
      visual: {
        initial: "stable",
        on: {
          SET_PRESET: {
            guard: "isKnownPreset",
            target: ".transitioning",
            actions: ["applyPreset", "autoSurgePreset"],
          },
          CHANGE_COLORS: {
            target: ".transitioning",
            actions: "applyColors",
          },
        },
        states: {
          stable: {},
          transitioning: {
            after: {
              visualDurationMs: { target: "stable", actions: "commitPreset" },
            },
            on: {
              SET_PRESET: {
                guard: "isKnownPreset",
                target: "transitioning",
                reenter: true,
                actions: ["applyPreset", "autoSurgePreset"],
              },
              CHANGE_COLORS: {
                target: "transitioning",
                reenter: true,
                actions: "applyColors",
              },
            },
          },
        },
      },

      // ── motion ─────────────────────────────────────────────────────────
      motion: {
        initial: "calm",
        on: {
          SURGE: { target: ".surging", actions: "applySurge" },
        },
        states: {
          calm: {},
          surging: {
            after: {
              surgeDurationMs: { target: "calm" },
            },
            on: {
              SURGE: { target: "surging", reenter: true, actions: "applySurge" },
            },
          },
        },
      },

      // ── audio ──────────────────────────────────────────────────────────
      audio: {
        initial: "locked",
        states: {
          locked: {
            invoke: { src: "listenForUserInteraction" },
            on: {
              USER_INTERACTED: { target: "unlocked", actions: "unlockAudio" },
            },
          },
          unlocked: {
            initial: "unmuted",
            states: {
              unmuted: {
                entry: { type: "setMuted", params: { muted: false } },
                on: {
                  TOGGLE_MUTE: { target: "muted" },
                  PLAY_SFX:    { actions: "playSFX" },
                },
              },
              muted: {
                entry: { type: "setMuted", params: { muted: true } },
                on: {
                  TOGGLE_MUTE: { target: "unmuted" },
                },
              },
            },
          },
        },
      },

    },
  })
}
