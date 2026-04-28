# XState Machine for `/app` (neuvetra.ai)

**Date:** 2026-04-21
**Status:** Approved
**Scope:** `apps/web/src/pages/app/` only — no changes to `.com` routes or shared contexts

---

## Context

`neuvetra.com` is the stable HTML product. `neuvetra.ai` is a separate futuristic product being built inside the `/app` route — WebGL/Three.js, 3D animations, music, and eventually AI interactions and dynamic function-calling interfaces. It will eventually live at its own domain.

The `/app` route needs XState as its application spine so that all state — renderer capability, auth, audio, navigation — is explicit, debuggable, and extensible as the product grows.

---

## Decisions

| Question | Decision |
|---|---|
| Architecture | Full parallel machine (Approach B) — XState owns all `/app` state |
| Navigation | Router drives machine — React Router owns URL, fires events into machine |
| Auth | Machine talks to Supabase directly — independent from shared `.com` AuthContext |
| Renderer gate | WebGL2 check (not WebGPU) — Spirit uses `THREE.WebGLRenderer` |
| XState version | v5 (`setup()` API) |

---

## Machine: `neuvetraAI`

A single parallel XState v5 machine with four orthogonal state dimensions. All four run simultaneously.

### Parallel states

#### 1. `webgl`
Checks WebGL2 support once on mount. Synchronous — no async adapter request needed.

```
checking → supported (final)
         → unsupported (final) → side-effect: navigate to /
```

- Actor: `checkWebGL` — synchronous `canvas.getContext('webgl2')` check wrapped in a promise for XState `invoke` compatibility
- Replaces the existing `useWebGPU` hook and `GpuRoute` component

#### 2. `auth`
Subscribes to Supabase `onAuthStateChange` directly. Independent from the `.com` `AuthContext`.

```
loading → unauthenticated
        → authenticated
            → loadingProfile → incomplete (session + no active business)
                             → ready      (session + profile + active business)
```

- Context carries: `session`, `profile`, `business`
- Actors: `getSession` (initial load), `loadProfile` (fetches user + business from Supabase)
- Guards: `hasSession`, `hasActiveBusiness`
- Actions: `setSession`, `setProfile`, `clearAuth`

#### 3. `audio`
Tracks the ambient sound state of the Spirit engine.

```
dormant → [USER_INTERACTED] → active
                                → unmuted ⇄ [TOGGLE_MUTE] ⇄ muted
```

- `dormant`: audio cannot start until a user gesture (browser policy)
- First click / keydown / touchstart fires `USER_INTERACTED`

#### 4. `view`
Mirrors the current React Router location. Machine never calls `navigate()` — it reacts to URL changes.

```
States: home | howItWorks | pricing | signIn | getStarted
Event:  ROUTE_CHANGED { pathname: string }
```

- A `useEffect` in `AppLayout` watches `useLocation()` and fires `ROUTE_CHANGED` on every pathname change — `AppLayout` already imports `useLocation` so no new component is needed
- Future sub-applications (3D onboarding, AI chat, dashboard) add new states here

---

## Events

| Event | Fired by | Target state |
|---|---|---|
| `WEBGL_SUPPORTED` | `checkWebGL` actor | `webgl.supported` |
| `WEBGL_UNSUPPORTED` | `checkWebGL` actor | `webgl.unsupported` → redirect `/` |
| `AUTH_STATE_CHANGED` | Supabase listener | `auth.*` |
| `PROFILE_LOADED` | `loadProfile` actor | `auth.authenticated.ready` or `.incomplete` |
| `SIGN_OUT` | UI button | `auth.unauthenticated`, clears context |
| `ROUTE_CHANGED` | `useEffect` in `AppLayout` (useLocation) | `view.*` |
| `USER_INTERACTED` | First click/key/touch | `audio.active` |
| `TOGGLE_MUTE` | Sound button | `audio.active.muted` ⇄ `audio.active.unmuted` |

Future events (not implemented yet): `START_ONBOARDING`, `AI_RESPONSE`, `FUNCTION_CALL_RESULT`

---

## Context shape

```ts
interface AppContext {
  session: Session | null
  profile: UserProfile | null
  business: Business | null
  currentRoute: string
}
```

`UserProfile` and `Business` types match the existing shapes in `AuthContext.tsx` but are redefined inside the machine to keep `/app` independent.

---

## File structure

All files under `apps/web/src/pages/app/`:

```
machine/
  appMachine.ts         — setup() + createMachine(), the root definition
  appMachine.types.ts   — AppContext, AppEvent union, UserProfile, Business
  appMachine.actors.ts  — checkWebGL, getSession, loadProfile promise actors
  appMachine.guards.ts  — hasSession, hasActiveBusiness, routeIs* guards
  appMachine.actions.ts — assign() calls: setSession, setProfile, clearAuth, setRoute
AppMachineProvider.tsx  — useMachine() + React.createContext + provider component
hooks/
  useAppMachine.ts      — typed selector hook (wraps useContext)
```

---

## Integration with existing components

| Component | Change |
|---|---|
| `GpuRoute.tsx` | Deleted — machine owns WebGL gate |
| `useWebGPU.ts` | Deleted — replaced by `checkWebGL` actor |
| `AppLayout.tsx` | Reads audio/view state from machine; fires `USER_INTERACTED` + `TOGGLE_MUTE` + `ROUTE_CHANGED` |
| `App.tsx` | `<GpuRoute>` wrapper removed; `AppMachineProvider` wraps `<AppLayout>` instead |
| Shared `AuthContext` | Not touched — `.com` routes continue to use it unchanged |

---

## What this does NOT cover (future)

- Sign-in flow within `/app` (3D-styled auth UI)
- Get-started / onboarding flow within `/app`
- AI chat state
- Function-calling / dynamic 3D interface loading

These will each be new states added to the `view` or `auth` dimensions of the same machine.

---

## Non-goals

- No changes to any route outside `/app`
- No changes to `AuthContext.tsx`, `ProtectedRoute.tsx`, or any `.com` page
- No backend API changes
