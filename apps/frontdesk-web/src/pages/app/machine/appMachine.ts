import { setup, assign } from "xstate"
import type { Session } from "@supabase/supabase-js"
import {
  checkWebGL,
  getSession,
  loadProfile,
  supabaseAuthListener,
} from "./appMachine.actors"
import type { AppContext, AppEvent, AppUserProfile, AppBusiness } from "./appMachine.types"
import { ROUTE_BY_PATH } from "@/pages/app/routes"
import { AUDIO } from "@/data/spirit-presets"
import { THEMES, DEFAULT_THEME } from "@/data/section-themes"

export const appMachine = setup({
  types: {} as {
    context: AppContext
    events: AppEvent
  },
  actors: {
    checkWebGL,
    getSession,
    loadProfile,
    supabaseAuthListener,
  },
  actions: {
    setSessionFromAuth: assign(({ event }) => ({
      session: (event as Extract<AppEvent, { type: "AUTH_STATE_CHANGED" }>).session,
    })),
    clearAuth: assign({
      session: null as Session | null,
      profile: null as AppUserProfile | null,
      business: null as AppBusiness | null,
    }),
    setRoute: assign(({ event }) => ({
      currentRoute: (event as Extract<AppEvent, { type: "ROUTE_CHANGED" }>).pathname,
    })),
    setCurrentTheme: assign(({ event }) => {
      const e = event as Extract<AppEvent, { type: "ROUTE_CHANGED" }>
      const themeName = ROUTE_BY_PATH[e.pathname]?.theme ?? "blue"
      return { currentTheme: THEMES[themeName] ?? DEFAULT_THEME }
    }),
    registerSpirit: assign(({ event }) => ({
      spiritActorRef: (event as Extract<AppEvent, { type: "REGISTER_SPIRIT" }>).actorRef,
    })),
    sendRouteToSpirit: ({ context, event }) => {
      const e = event as Extract<AppEvent, { type: "ROUTE_CHANGED" }>
      const routeDef = ROUTE_BY_PATH[e.pathname]
      const preset = routeDef?.preset ?? "default"
      const themeName = routeDef?.theme ?? "blue"
      const theme = THEMES[themeName] ?? DEFAULT_THEME
      context.spiritActorRef?.send({
        type: "SET_PRESET",
        name: preset,
        color1: theme.dark,
        color2: theme.mid,
      })
    },
    playNavSfx: ({ context }) => {
      context.spiritActorRef?.send({ type: "PLAY_SFX", name: AUDIO.nav })
    },
  },
}).createMachine({
  id: "neuvetraAI",
  type: "parallel",
  invoke: {
    src: "supabaseAuthListener",
    id: "authListener",
  },
  context: {
    session: null,
    profile: null,
    business: null,
    currentRoute: "/app",
    currentTheme: DEFAULT_THEME,
    spiritActorRef: null,
  },
  states: {
    // ── WebGL gate ──────────────────────────────────────────────
    webgl: {
      initial: "checking",
      states: {
        checking: {
          invoke: {
            src: "checkWebGL",
            onDone: [
              { guard: ({ event }) => event.output === true, target: "supported" },
              { target: "unsupported" },
            ],
          },
        },
        supported: { type: "final" },
        unsupported: { type: "final" },
      },
    },

    // ── Auth ─────────────────────────────────────────────────────
    auth: {
      initial: "loading",
      states: {
        loading: {
          invoke: {
            src: "getSession",
            onDone: [
              {
                guard: ({ event }) => event.output !== null,
                target: "authenticated",
                actions: assign(({ event }) => ({ session: event.output })),
              },
              { target: "unauthenticated" },
            ],
          },
          on: {
            AUTH_STATE_CHANGED: {
              guard: ({ event }) => event.session !== null,
              target: "authenticated",
              actions: "setSessionFromAuth",
            },
          },
        },
        unauthenticated: {
          on: {
            AUTH_STATE_CHANGED: {
              guard: ({ event }) => event.session !== null,
              target: "authenticated",
              actions: "setSessionFromAuth",
            },
          },
        },
        authenticated: {
          initial: "loadingProfile",
          on: {
            AUTH_STATE_CHANGED: [
              {
                guard: ({ event }) => event.session !== null,
                actions: "setSessionFromAuth",
              },
              {
                target: "#neuvetraAI.auth.unauthenticated",
                actions: "clearAuth",
              },
            ],
            SIGN_OUT: {
              target: "#neuvetraAI.auth.unauthenticated",
              actions: "clearAuth",
            },
          },
          states: {
            loadingProfile: {
              invoke: {
                src: "loadProfile",
                input: ({ context }) => ({ userId: context.session!.user.id }),
                onDone: [
                  {
                    guard: ({ event }) => event.output.business?.status === "active",
                    target: "ready",
                    actions: assign(({ event }) => ({
                      profile: event.output.profile,
                      business: event.output.business,
                    })),
                  },
                  {
                    target: "incomplete",
                    actions: assign(({ event }) => ({
                      profile: event.output.profile,
                      business: event.output.business,
                    })),
                  },
                ],
              },
            },
            incomplete: {},
            ready: {},
          },
        },
      },
    },

    // ── View ─────────────────────────────────────────────────────
    // Starts in 'loading' — blocks the overlay until SPIRIT_READY fires.
    // ROUTE_CHANGED in loading: record route + set theme + send to Spirit (no SFX yet).
    // ROUTE_CHANGED in active: record route + set theme + send to Spirit + play nav SFX.
    view: {
      initial: "loading",
      states: {
        loading: {
          on: {
            SPIRIT_READY:  { target: "active" },
            ROUTE_CHANGED: { actions: ["setRoute", "setCurrentTheme", "sendRouteToSpirit"] },
          },
        },
        active: {
          on: {
            ROUTE_CHANGED: { actions: ["setRoute", "setCurrentTheme", "sendRouteToSpirit", "playNavSfx"] },
          },
        },
      },
    },
  },
  on: {
    REGISTER_SPIRIT: { actions: "registerSpirit" },
  },
})

export type AppMachineSnapshot = ReturnType<typeof appMachine.transition>
