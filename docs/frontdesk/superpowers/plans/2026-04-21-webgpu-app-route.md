# WebGPU-Gated `/app` Route Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/app` route that is publicly accessible but only renders if the browser supports WebGPU — redirecting to `/` otherwise — and exposes an `isAuthenticated` flag to all child components.

**Architecture:** A `GpuRoute` wrapper (mirroring the existing `ProtectedRoute`) performs a full async WebGPU probe via a `useWebGPU` hook, shows a spinner while checking, and either redirects to `/` or renders children. `isAuthenticated: !!session` is added to the existing `AuthContext` as a derived boolean — no new context or provider needed.

**Tech Stack:** React 19, React Router v7, TypeScript, Playwright (tests), `@webgpu/types` (WebGPU type definitions)

---

### Task 1: Install WebGPU types and update tsconfig

**Files:**
- Modify: `apps/web/tsconfig.app.json`

- [ ] **Step 1: Install `@webgpu/types`**

```bash
cd apps/web && bun add -d @webgpu/types
```

Expected output: package added to `devDependencies` in `apps/web/package.json`.

- [ ] **Step 2: Add `@webgpu/types` to tsconfig**

In `apps/web/tsconfig.app.json`, update `compilerOptions` to add the `types` array:

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["@webgpu/types"],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Verify TypeScript is happy**

```bash
cd apps/web && bun run build 2>&1 | head -20
```

Expected: build succeeds (or only pre-existing errors, none about `navigator.gpu`).

---

### Task 2: Write failing Playwright tests

**Files:**
- Create: `apps/web/tests/app-route.spec.ts`

- [ ] **Step 1: Create the test file**

```ts
// apps/web/tests/app-route.spec.ts
import { test, expect, type Page } from "@playwright/test"

// Helper: mock navigator.gpu as absent (simulates unsupported browser)
async function mockNoWebGPU(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "gpu", {
      get: () => undefined,
      configurable: true,
    })
  })
}

// Helper: mock navigator.gpu with a working fake adapter
async function mockWebGPU(page: Page) {
  await page.addInitScript(() => {
    const fakeAdapter = {
      info: {
        vendor: "Test Vendor",
        architecture: "test-arch",
        device: "",
        description: "",
      },
      requestAdapterInfo: async () => ({
        vendor: "Test Vendor",
        architecture: "test-arch",
        device: "",
        description: "",
      }),
    }
    Object.defineProperty(navigator, "gpu", {
      get: () => ({
        requestAdapter: () => Promise.resolve(fakeAdapter),
      }),
      configurable: true,
    })
  })
}

test.describe("/app route", () => {
  test("redirects to home when WebGPU is not supported", async ({ page }) => {
    await mockNoWebGPU(page)
    await page.goto("/app")
    await expect(page).toHaveURL("/")
  })

  test("renders /app when WebGPU is available", async ({ page }) => {
    await mockWebGPU(page)
    await page.goto("/app")
    await expect(page.getByText("WebGPU is available")).toBeVisible()
    await expect(page.getByText(/Test Vendor.*test-arch/)).toBeVisible()
  })

  test("shows anonymous user when not logged in", async ({ page }) => {
    await mockWebGPU(page)
    await page.goto("/app")
    await expect(page.getByText("Anonymous user")).toBeVisible()
  })
})
```

- [ ] **Step 2: Run the tests and confirm they all fail**

```bash
cd apps/web && bun run test:e2e --grep "app route"
```

Expected: all 3 tests FAIL — either timeout navigating to `/app` (route doesn't exist) or wrong URL after redirect.

---

### Task 3: Implement the `useWebGPU` hook

**Files:**
- Create: `apps/web/src/hooks/useWebGPU.ts`

- [ ] **Step 1: Create the hook**

```ts
// apps/web/src/hooks/useWebGPU.ts
import { useState, useEffect } from "react"

interface WebGPUState {
  checking: boolean
  supported: boolean
  adapter: GPUAdapter | null
}

// Module-level cache: the probe runs once per page load.
// A second call to useWebGPU() (e.g. from AppPage) returns the cached result instantly.
let cached: { supported: boolean; adapter: GPUAdapter | null } | null = null

export function useWebGPU(): WebGPUState {
  const [state, setState] = useState<WebGPUState>(() => {
    if (cached) return { checking: false, ...cached }
    return { checking: true, supported: false, adapter: null }
  })

  useEffect(() => {
    if (cached) return

    async function probe() {
      if (!navigator.gpu) {
        cached = { supported: false, adapter: null }
        setState({ checking: false, supported: false, adapter: null })
        return
      }
      try {
        const adapter = await navigator.gpu.requestAdapter()
        if (!adapter) {
          cached = { supported: false, adapter: null }
          setState({ checking: false, supported: false, adapter: null })
        } else {
          cached = { supported: true, adapter }
          setState({ checking: false, supported: true, adapter })
        }
      } catch {
        cached = { supported: false, adapter: null }
        setState({ checking: false, supported: false, adapter: null })
      }
    }

    probe()
  }, [])

  return state
}
```

---

### Task 4: Implement `GpuRoute`

**Files:**
- Create: `apps/web/src/components/auth/GpuRoute.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/src/components/auth/GpuRoute.tsx
import { Navigate } from "react-router"
import { useWebGPU } from "@/hooks/useWebGPU"

export function GpuRoute({ children }: { children: React.ReactNode }) {
  const { checking, supported } = useWebGPU()

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
      </div>
    )
  }

  if (!supported) return <Navigate to="/" replace />

  return <>{children}</>
}
```

---

### Task 5: Create `AppPage`

**Files:**
- Create: `apps/web/src/pages/AppPage.tsx`

- [ ] **Step 1: Create the page**

```tsx
// apps/web/src/pages/AppPage.tsx
import { useWebGPU } from "@/hooks/useWebGPU"
import { useAuth } from "@/contexts/AuthContext"

export function AppPage() {
  const { adapter } = useWebGPU()
  const { isAuthenticated, session } = useAuth()

  const vendor = adapter?.info.vendor || "unknown"
  const architecture = adapter?.info.architecture || "unknown"

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">/app</h1>
      <p>WebGPU is available</p>
      <p>
        GPU: {vendor} / {architecture}
      </p>
      <p>
        {isAuthenticated
          ? `Logged in as: ${session?.user?.email}`
          : "Anonymous user"}
      </p>
    </div>
  )
}
```

---

### Task 6: Add `isAuthenticated` to `AuthContext`

**Files:**
- Modify: `apps/web/src/contexts/AuthContext.tsx`

- [ ] **Step 1: Add `isAuthenticated` to the interface**

In `AuthContext.tsx`, update the `AuthContextValue` interface (line 23):

```ts
interface AuthContextValue {
  session: Session | null
  user: User | null
  loading: boolean
  profile: UserProfile | null
  business: Business | null
  isAuthenticated: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  refreshBusiness: () => Promise<void>
}
```

- [ ] **Step 2: Add `isAuthenticated` to the context value**

In `AuthContext.tsx`, update the `<AuthContext.Provider value={...}>` block (around line 129):

```tsx
<AuthContext.Provider value={{
  session,
  user: session?.user ?? null,
  loading,
  profile,
  business,
  isAuthenticated: !!session,
  signOut,
  refreshProfile,
  refreshBusiness,
}}>
  {children}
</AuthContext.Provider>
```

---

### Task 7: Register the route in `App.tsx`

**Files:**
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Import `GpuRoute` and `AppPage`**

Add these two imports to `apps/web/src/App.tsx` after the existing imports:

```ts
import { GpuRoute } from "@/components/auth/GpuRoute"
import { AppPage } from "@/pages/AppPage"
```

- [ ] **Step 2: Add the route**

Add the `/app` route inside `<Routes>` in `App.tsx`, after the marketing routes block and before the auth routes:

```tsx
{/* GPU-gated — publicly accessible, requires WebGPU */}
<Route path="/app" element={<GpuRoute><AppPage /></GpuRoute>} />
```

The full `<Routes>` block should look like:

```tsx
<Routes>
  {/* Marketing routes */}
  <Route element={<MarketingLayout />}>
    <Route path="/" element={<LandingPage />} />
    <Route path="/industries/:slug" element={<IndustryPage />} />
    <Route path="/contact" element={<ContactPage />} />
  </Route>

  {/* GPU-gated — publicly accessible, requires WebGPU */}
  <Route path="/app" element={<GpuRoute><AppPage /></GpuRoute>} />

  {/* Auth + legal */}
  <Route path="/login" element={<LoginPage />} />
  <Route path="/auth/callback" element={<AuthCallbackPage />} />
  <Route path="/terms" element={<TermsPage />} />
  <Route path="/privacy" element={<PrivacyPage />} />

  {/* Signup wizard — public */}
  <Route path="/signup" element={<SignupPage />} />

  {/* Legacy redirect */}
  <Route path="/onboarding" element={<Navigate to="/signup" replace />} />

  {/* Calendar OAuth return */}
  <Route path="/calendar/callback" element={<ProtectedRoute><CalendarCallbackPage /></ProtectedRoute>} />
  <Route path="/calendar/microsoft/callback" element={<ProtectedRoute><CalendarCallbackPage /></ProtectedRoute>} />
  <Route path="/calendar/caldav/callback" element={<ProtectedRoute><CalendarCallbackPage /></ProtectedRoute>} />

  {/* Protected */}
  <Route path="/dashboard" element={<ProtectedRoute><Navigate to="/dashboard/overview" replace /></ProtectedRoute>} />
  <Route path="/dashboard/:tab" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
</Routes>
```

---

### Task 8: Run all tests and verify

- [ ] **Step 1: Run the app-route tests**

```bash
cd apps/web && bun run test:e2e --grep "app route"
```

Expected: all 3 tests PASS.

- [ ] **Step 2: Run the full test suite to check for regressions**

```bash
cd apps/web && bun run test:e2e
```

Expected: all tests pass (no regressions from the `AuthContext` change).

- [ ] **Step 3: Run TypeScript build to verify no type errors**

```bash
cd apps/web && bun run build
```

Expected: build succeeds with no errors.

---

### Task 9: Commit

- [ ] **Step 1: Stage and commit**

```bash
git add \
  apps/web/tsconfig.app.json \
  apps/web/src/hooks/useWebGPU.ts \
  apps/web/src/components/auth/GpuRoute.tsx \
  apps/web/src/pages/AppPage.tsx \
  apps/web/src/contexts/AuthContext.tsx \
  apps/web/src/App.tsx \
  apps/web/tests/app-route.spec.ts \
  apps/web/package.json \
  bun.lock

git commit -m "feat: add WebGPU-gated /app route with isAuthenticated flag"
```
