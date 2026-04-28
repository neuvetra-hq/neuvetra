# WebGPU-Gated `/app` Route

**Date:** 2026-04-21  
**Status:** Approved

## Overview

Add a `/app` route that is publicly accessible but only renders if the user's browser supports WebGPU (via a full async adapter probe). Browsers without WebGPU are silently redirected to `/`. The route is auth-aware — child components know whether the user is logged in or anonymous via `isAuthenticated` on the existing `AuthContext`.

## Architecture

### New files

| File | Purpose |
|------|---------|
| `apps/web/src/hooks/useWebGPU.ts` | Async WebGPU detection hook |
| `apps/web/src/components/auth/GpuRoute.tsx` | Route guard (mirrors `ProtectedRoute`) |
| `apps/web/src/pages/AppPage.tsx` | The `/app` page content |

### Edited files

| File | Change |
|------|--------|
| `apps/web/src/contexts/AuthContext.tsx` | Add `isAuthenticated: !!session` to context value and type |
| `apps/web/src/App.tsx` | Add `<Route path="/app" element={<GpuRoute><AppPage /></GpuRoute>} />` |

## `useWebGPU` Hook

Returns one of three states:

```ts
{ checking: true,  supported: false, adapter: null }   // probing
{ checking: false, supported: false, adapter: null }   // not supported
{ checking: false, supported: true,  adapter: GPUAdapter } // ready
```

**Detection logic:**
1. If `navigator.gpu` is absent → immediately resolve `supported: false`
2. Call `navigator.gpu.requestAdapter()` and await
3. If result is `null` → `supported: false`
4. If result is a `GPUAdapter` → `supported: true`, store adapter

**Caching:** Result is stored in a module-level variable so repeated calls (once from `GpuRoute`, once from `AppPage`) return the cached result with no re-probe.

## `GpuRoute` Component

```tsx
function GpuRoute({ children }) {
  const { checking, supported } = useWebGPU()
  if (checking) return <spinner />         // same style as ProtectedRoute
  if (!supported) return <Navigate to="/" replace />
  return <>{children}</>
}
```

Only reads `checking` and `supported`. Does not need the adapter.

## `AppPage` Content

Minimal centered layout — intentionally bare, to be redesigned later:

```
/app

WebGPU is available
GPU: <adapter.info.vendor> / <adapter.info.architecture>

Logged in as: user@example.com   ← when isAuthenticated
Anonymous user                    ← when !isAuthenticated
```

Reads:
- `useWebGPU()` — cached adapter for GPU info
- `useAuth()` — `isAuthenticated` + `session?.user?.email`

## `AuthContext` Change

Add one derived field to the existing context value and type:

```ts
isAuthenticated: !!session
```

No new context, no new provider. All existing consumers are unaffected (additive change).

## Data Flow

```
User navigates to /app
  → GpuRoute mounts
    → useWebGPU() probes navigator.gpu.requestAdapter()
    → [spinner while checking]
    → adapter null? → Navigate to /
    → adapter ok?  → render AppPage
      → useWebGPU() returns cached adapter
      → useAuth() returns isAuthenticated + email
      → display status text
```

## Error Handling

- `requestAdapter()` rejects (unexpected error) → treat as `supported: false`, redirect to `/`
- `adapter.info` missing (older WebGPU draft) → display "GPU info unavailable" instead of crashing

## Testing

Playwright spec: `apps/web/tests/app-route.spec.ts`

- Mock `navigator.gpu` as undefined → assert redirect to `/`
- Mock `navigator.gpu.requestAdapter()` returning `null` → assert redirect to `/`
- Mock `navigator.gpu.requestAdapter()` returning a fake adapter → assert `/app` renders with GPU info
- Assert anonymous state shown when not logged in
- Assert email shown when logged in (use existing `storageState` session fixture)
