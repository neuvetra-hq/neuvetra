# /app/get-started Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 10-step dark-themed signup wizard at `/app/get-started` that collects identity, OTP verification, business info, AI design preferences (name, personality, voice gender, knowledge seed), a Twilio phone number, Stripe payment (dark theme), and an optional calendar connection — all rendered inside the existing `/app` WebGL shell.

**Architecture:** `AppGetStartedPage` owns all wizard state. Each of the 10 steps is a focused component under `apps/web/src/components/get-started/`. Steps slide in/out with Framer Motion `AnimatePresence` using direction-aware x-axis transitions. Steps 0-2 (IDENTIFY, VERIFY, YOUR BUSINESS) have no back arrow — identity and OTP are immutable after verification. Step 3+ allow free bidirectional navigation. The backend `billing/activate` endpoint is extended to accept optional AI config fields and a KB seed, stored at activation. No per-business Retell agents are created yet — config is saved to `businesses.aiConfig` for future wiring.

**Tech Stack:** React 19, Framer Motion (already installed), react-hook-form + zod (already installed), Stripe Elements dark theme (already installed), Supabase OTP auth, Tailwind v4, Jost font (already loaded by `/app` shell), lucide-react.

---

## File Map

**New files:**
- `apps/web/tests/get-started.spec.ts` — Playwright E2E tests
- `apps/web/src/components/get-started/types.ts` — shared data types, step config, slide variants
- `apps/web/src/components/get-started/DarkInput.tsx` — dark-themed `<input>` primitive
- `apps/web/src/components/get-started/DarkTextarea.tsx` — dark-themed `<textarea>` primitive
- `apps/web/src/components/get-started/WizardNav.tsx` — back arrow + dot progress indicator
- `apps/web/src/components/get-started/StepIdentify.tsx` — step 0: name + phone + OTP send
- `apps/web/src/components/get-started/StepVerify.tsx` — step 1: 6-digit OTP confirm
- `apps/web/src/components/get-started/StepBusiness.tsx` — step 2: business name + type
- `apps/web/src/components/get-started/StepAiName.tsx` — step 3: AI receptionist name
- `apps/web/src/components/get-started/StepPersonality.tsx` — step 4: personality card pick
- `apps/web/src/components/get-started/StepVoice.tsx` — step 5: voice gender card pick
- `apps/web/src/components/get-started/StepKnowledge.tsx` — step 6: free-text KB seed
- `apps/web/src/components/get-started/StepPickNumber.tsx` — step 7: Twilio number picker (dark)
- `apps/web/src/components/get-started/StepActivate.tsx` — step 8: plan picker + Stripe dark theme
- `apps/web/src/components/get-started/StepCalendar.tsx` — step 9: calendar connection (dark, skippable)
- `apps/web/src/components/get-started/SuccessScreen.tsx` — post-wizard success state

**Modified files:**
- `apps/web/src/pages/app/AppGetStartedPage.tsx` — full rewrite: wizard container, all state, step transitions
- `apps/api/src/routes/billing.ts` — extend `/billing/activate`: accept aiConfig + KB seed, save at activation

---

## Task 1: Write Failing Playwright Tests

**Files:**
- Create: `apps/web/tests/get-started.spec.ts`

- [ ] **Step 1.1: Create the test file**

```typescript
// apps/web/tests/get-started.spec.ts
import { test, expect } from "@playwright/test"

test.describe("/app/get-started wizard", () => {
  test("renders the IDENTIFY step title by default", async ({ page }) => {
    await page.goto("/app/get-started")
    await expect(page.getByText("IDENTIFY")).toBeVisible()
  })

  test("shows first name, last name, and phone inputs on step 0", async ({ page }) => {
    await page.goto("/app/get-started")
    await expect(page.getByPlaceholder("Jane")).toBeVisible()
    await expect(page.getByPlaceholder("Smith")).toBeVisible()
    await expect(page.getByPlaceholder("+1 (415) 555-0100")).toBeVisible()
  })

  test("back arrow is hidden on step 0", async ({ page }) => {
    await page.goto("/app/get-started")
    // data-testid="wizard-back" exists but is invisible on steps 0-2
    const back = page.getByTestId("wizard-back")
    await expect(back).toBeHidden()
  })

  test("renders 10 progress dots", async ({ page }) => {
    await page.goto("/app/get-started")
    const dots = page.getByTestId("wizard-dot")
    await expect(dots).toHaveCount(10)
  })

  test("shows sign-in link on step 0", async ({ page }) => {
    await page.goto("/app/get-started")
    await expect(page.getByText("Already have an account?")).toBeVisible()
    await expect(page.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login")
  })
})
```

- [ ] **Step 1.2: Run tests to verify they all fail**

```bash
cd apps/web && bun run test:e2e --grep "get-started"
```

Expected: All 5 tests FAIL — page still shows "Coming soon" stub.

- [ ] **Step 1.3: Commit failing tests**

```bash
git add apps/web/tests/get-started.spec.ts
git commit -m "test(get-started): add failing E2E tests for wizard scaffold"
```

---

## Task 2: Backend — Extend billing/activate

**Files:**
- Modify: `apps/api/src/routes/billing.ts`

- [ ] **Step 2.1: Add knowledgeBase to the DB import**

In `apps/api/src/routes/billing.ts`, line 3, add `knowledgeBase` to the import:

```typescript
import { db, businesses, businessMembers, users, calls, knowledgeBase } from "@frontdesk/database"
```

- [ ] **Step 2.2: Extend the body schema with optional AI fields**

Find the `body: t.Object({...})` block at the bottom of the `.post("/activate", ...)` handler. Replace it with:

```typescript
  body: t.Object({
    userId: t.String(),
    businessName: t.String(),
    businessType: t.Union([
      t.Literal("medical"), t.Literal("dental"), t.Literal("spa"),
      t.Literal("salon"), t.Literal("plumbing"), t.Literal("legal"),
      t.Literal("real_estate"), t.Literal("other"),
    ]),
    phoneNumber: t.String(),
    planId: t.Union([t.Literal("starter"), t.Literal("growth"), t.Literal("pro")]),
    paymentMethodId: t.String(),
    stripeCustomerId: t.String(),
    aiName: t.Optional(t.String()),
    aiPersonality: t.Optional(t.String()),
    aiVoiceGender: t.Optional(t.String()),
    aiKbSeed: t.Optional(t.String()),
  }),
```

- [ ] **Step 2.3: Destructure the new fields in the handler**

At the top of the `.post("/activate", async ({ body }) => {` function, replace the existing destructure line with:

```typescript
    const {
      userId, businessName, businessType, phoneNumber, planId,
      paymentMethodId, stripeCustomerId,
      aiName, aiPersonality, aiVoiceGender, aiKbSeed,
    } = body
```

- [ ] **Step 2.4: Save aiConfig and KB seed after activation**

Find the `await db.update(businesses).set({...}).where(...)` block (currently after Twilio provisioning, around line 152). Replace it with:

```typescript
      const aiConfigData = (aiName || aiPersonality || aiVoiceGender)
        ? { name: aiName ?? null, personality: aiPersonality ?? null, voiceGender: aiVoiceGender ?? null }
        : null

      await db
        .update(businesses)
        .set({
          status: "active",
          twilioNumber: purchased.phoneNumber,
          twilioNumberSid: purchased.sid,
          stripeSubscriptionId: subscription.id,
          stripePlanId: plan.flatPriceId,
          ...(aiConfigData ? { aiConfig: aiConfigData } : {}),
          updatedAt: new Date(),
        })
        .where(eq(businesses.id, business.id))

      if (aiKbSeed?.trim()) {
        await db.insert(knowledgeBase).values({
          businessId: business.id,
          question: "About my business",
          answer: aiKbSeed.trim(),
          category: "General",
          sortOrder: 0,
        })
      }

      console.log(`✅ Activated business ${business.id} — Twilio: ${purchased.phoneNumber}, Stripe: ${subscription.id}`)
```

- [ ] **Step 2.5: Type-check**

```bash
cd apps/api && bun run --bun tsc --noEmit
```

Expected: No errors.

- [ ] **Step 2.6: Commit**

```bash
git add apps/api/src/routes/billing.ts
git commit -m "feat(api): extend billing/activate to store aiConfig and KB seed"
```

---

## Task 3: Shared Types + Dark Primitives

**Files:**
- Create: `apps/web/src/components/get-started/types.ts`
- Create: `apps/web/src/components/get-started/DarkInput.tsx`
- Create: `apps/web/src/components/get-started/DarkTextarea.tsx`

- [ ] **Step 3.1: Create types.ts**

```typescript
// apps/web/src/components/get-started/types.ts

export type IdentityData = {
  firstName: string
  lastName: string
  phone: string
}

export type BusinessData = {
  businessName: string
  businessType:
    | "medical" | "dental" | "spa" | "salon"
    | "plumbing" | "legal" | "real_estate" | "other"
}

export type AiPersonality = "professional" | "friendly" | "empathetic" | "concise"
export type AiVoiceGender = "male" | "female"

export type AiConfig = {
  name: string
  personality: AiPersonality
  voiceGender: AiVoiceGender
}

export const STEP_CONFIG = [
  { title: "IDENTIFY",      descriptor: "Let's start with you" },
  { title: "VERIFY",        descriptor: "Check your messages" },
  { title: "YOUR BUSINESS", descriptor: "Tell us about your business" },
  { title: "NAME YOUR AI",  descriptor: "What should your receptionist be called?" },
  { title: "PERSONALITY",   descriptor: "How should your AI sound?" },
  { title: "VOICE",         descriptor: "Choose a voice" },
  { title: "KNOWLEDGE",     descriptor: "What should your AI know?" },
  { title: "YOUR NUMBER",   descriptor: "Pick a local number" },
  { title: "ACTIVATE",      descriptor: "7-day free trial · cancel any time" },
  { title: "CALENDAR",      descriptor: "Connect your calendar" },
] as const

export const STEPS = {
  IDENTIFY:      0,
  VERIFY:        1,
  YOUR_BUSINESS: 2,
  AI_NAME:       3,
  PERSONALITY:   4,
  VOICE:         5,
  KNOWLEDGE:     6,
  PICK_NUMBER:   7,
  ACTIVATE:      8,
  CALENDAR:      9,
} as const

// Direction-aware slide variants for Framer Motion AnimatePresence
export const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? "55%" : "-55%",
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction > 0 ? "-55%" : "55%",
    opacity: 0,
  }),
}

// Shared Jost inline style used across all step components
export const jost: React.CSSProperties = {
  fontFamily: "'Jost', sans-serif",
  letterSpacing: "0.02em",
}

export const jostLabel: React.CSSProperties = {
  fontFamily: "'Jost', sans-serif",
  letterSpacing: "0.12em",
}
```

- [ ] **Step 3.2: Create DarkInput.tsx**

```tsx
// apps/web/src/components/get-started/DarkInput.tsx
import { forwardRef, type InputHTMLAttributes } from "react"

interface DarkInputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean
}

export const DarkInput = forwardRef<HTMLInputElement, DarkInputProps>(
  ({ className = "", hasError, style, ...props }, ref) => (
    <input
      ref={ref}
      className={[
        "w-full bg-white/[0.03] border px-4 py-3 text-sm text-white",
        "placeholder:text-white/25 focus:outline-none transition-colors",
        hasError
          ? "border-red-400/40 focus:border-red-400/60"
          : "border-white/10 focus:border-violet-500/50",
        className,
      ].join(" ")}
      style={{ fontFamily: "'Jost', sans-serif", letterSpacing: "0.02em", ...style }}
      {...props}
    />
  )
)
DarkInput.displayName = "DarkInput"
```

- [ ] **Step 3.3: Create DarkTextarea.tsx**

```tsx
// apps/web/src/components/get-started/DarkTextarea.tsx
import { forwardRef, type TextareaHTMLAttributes } from "react"

interface DarkTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean
}

export const DarkTextarea = forwardRef<HTMLTextAreaElement, DarkTextareaProps>(
  ({ className = "", hasError, style, ...props }, ref) => (
    <textarea
      ref={ref}
      className={[
        "w-full bg-white/[0.03] border px-4 py-3 text-sm text-white resize-none",
        "placeholder:text-white/25 focus:outline-none transition-colors",
        hasError
          ? "border-red-400/40 focus:border-red-400/60"
          : "border-white/10 focus:border-violet-500/50",
        className,
      ].join(" ")}
      style={{ fontFamily: "'Jost', sans-serif", letterSpacing: "0.02em", ...style }}
      {...props}
    />
  )
)
DarkTextarea.displayName = "DarkTextarea"
```

- [ ] **Step 3.4: Commit**

```bash
git add apps/web/src/components/get-started/
git commit -m "feat(get-started): add shared types, slide variants, DarkInput, DarkTextarea"
```

---

## Task 4: WizardNav + AppGetStartedPage Scaffold

**Files:**
- Create: `apps/web/src/components/get-started/WizardNav.tsx`
- Modify: `apps/web/src/pages/app/AppGetStartedPage.tsx` (full rewrite)

- [ ] **Step 4.1: Create WizardNav.tsx**

The back arrow is present in the DOM for all steps but hidden (via `visibility: hidden`) on steps 0-2 so layout stays stable. Dots use `data-testid="wizard-dot"` so Playwright can count them.

```tsx
// apps/web/src/components/get-started/WizardNav.tsx
import { ChevronLeft } from "lucide-react"
import { STEP_CONFIG, jost } from "./types"

interface WizardNavProps {
  currentStep: number
  canGoBack: boolean
  onBack: () => void
}

export function WizardNav({ currentStep, canGoBack, onBack }: WizardNavProps) {
  return (
    <div className="flex items-center gap-4 mt-8">
      {/* Back arrow — invisible (not removed) on steps 0-2 to preserve layout */}
      <button
        type="button"
        data-testid="wizard-back"
        onClick={onBack}
        disabled={!canGoBack}
        aria-label="Go back"
        className="flex items-center justify-center size-9 border border-white/15 text-white/40 hover:border-white/30 hover:text-white/70 transition-colors cursor-pointer disabled:pointer-events-none"
        style={{ visibility: canGoBack ? "visible" : "hidden" }}
      >
        <ChevronLeft className="size-4" strokeWidth={1.5} />
      </button>

      {/* Step progress dots */}
      <div className="flex items-center gap-1.5 flex-1 justify-center">
        {STEP_CONFIG.map((_, i) => (
          <div
            key={i}
            data-testid="wizard-dot"
            className="h-px transition-all duration-300"
            style={{
              width: i === currentStep ? 24 : 12,
              backgroundColor:
                i === currentStep
                  ? "rgba(167,139,250,0.7)"   // violet-400/70
                  : i < currentStep
                  ? "rgba(255,255,255,0.3)"
                  : "rgba(255,255,255,0.1)",
            }}
          />
        ))}
      </div>

      {/* Spacer mirrors the back arrow width to keep dots centered */}
      <div className="size-9" />
    </div>
  )
}
```

- [ ] **Step 4.2: Rewrite AppGetStartedPage.tsx**

This is the full wizard container. Step components are imported — some don't exist yet; they'll be created in subsequent tasks. The file will have TS errors until all step files exist.

```tsx
// apps/web/src/pages/app/AppGetStartedPage.tsx
import { useState } from "react"
import { useNavigate, Link } from "react-router"
import { AnimatePresence, motion } from "framer-motion"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { AppPageShell } from "./AppPageShell"
import { WizardNav } from "@/components/get-started/WizardNav"
import { SuccessScreen } from "@/components/get-started/SuccessScreen"
import { StepIdentify } from "@/components/get-started/StepIdentify"
import { StepVerify } from "@/components/get-started/StepVerify"
import { StepBusiness } from "@/components/get-started/StepBusiness"
import { StepAiName } from "@/components/get-started/StepAiName"
import { StepPersonality } from "@/components/get-started/StepPersonality"
import { StepVoice } from "@/components/get-started/StepVoice"
import { StepKnowledge } from "@/components/get-started/StepKnowledge"
import { StepPickNumber } from "@/components/get-started/StepPickNumber"
import { StepActivate } from "@/components/get-started/StepActivate"
import { StepCalendar } from "@/components/get-started/StepCalendar"
import {
  STEP_CONFIG, STEPS, slideVariants,
  type IdentityData, type BusinessData, type AiConfig, type AiPersonality, type AiVoiceGender,
} from "@/components/get-started/types"

function toE164(raw: string): string {
  const digits = raw.replace(/\D/g, "")
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`
  return `+${digits}`
}

function extractAreaCode(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  const local = digits.startsWith("1") && digits.length === 11 ? digits.slice(1) : digits
  return local.slice(0, 3)
}

const API_URL = import.meta.env.VITE_API_URL as string

export function AppGetStartedPage() {
  const { session, business } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1) // 1 = forward, -1 = backward
  const [success, setSuccess] = useState(false)

  const [identity, setIdentity] = useState<IdentityData | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [businessData, setBusinessData] = useState<BusinessData | null>(null)
  const [aiConfig, setAiConfig] = useState<AiConfig>({
    name: "",
    personality: "professional",
    voiceGender: "female",
  })
  const [kbSeed, setKbSeed] = useState("")
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null)
  const [businessId, setBusinessId] = useState<string | null>(null)

  // Guard: already fully set up
  if (session && business?.status === "active") {
    return (
      <AppPageShell title="WELCOME BACK" descriptor="You're already set up">
        <div className="max-w-sm mx-auto text-center pt-8 space-y-6">
          <p
            className="text-sm text-white/40"
            style={{ fontFamily: "'Jost', sans-serif", letterSpacing: "0.04em" }}
          >
            Your AI receptionist is already live.
          </p>
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="px-8 py-3 text-[11px] font-light tracking-[.18em] uppercase text-violet-200 bg-violet-500/15 border border-violet-500/35 hover:bg-violet-500/20 transition-colors"
            style={{ fontFamily: "'Jost', sans-serif" }}
          >
            Go to Dashboard →
          </button>
        </div>
      </AppPageShell>
    )
  }

  if (success) {
    return (
      <AppPageShell title="YOU'RE LIVE" descriptor="Your AI receptionist is ready">
        <SuccessScreen onDashboard={() => navigate("/dashboard")} />
      </AppPageShell>
    )
  }

  const goTo = (next: number, dir: number) => {
    setDirection(dir)
    setStep(next)
  }
  const advance = () => goTo(step + 1, 1)
  const retreat = () => goTo(step - 1, -1)

  // No back arrow on steps 0 (IDENTIFY), 1 (VERIFY), 2 (YOUR BUSINESS)
  const canGoBack = step > STEPS.YOUR_BUSINESS

  const currentConfig = STEP_CONFIG[step]

  const renderStep = () => {
    switch (step) {
      case STEPS.IDENTIFY:
        return (
          <StepIdentify
            onNext={async (data) => {
              setIdentity(data)
              advance()
            }}
          />
        )

      case STEPS.VERIFY:
        return identity ? (
          <StepVerify
            phone={toE164(identity.phone)}
            onVerified={async (uid, token) => {
              // Upsert public.users with full identity data
              await supabase.from("users").upsert({
                id: uid,
                first_name: identity.firstName,
                last_name: identity.lastName,
                phone: toE164(identity.phone),
              })
              // Fire opt-in confirmation SMS (A2P compliance, non-blocking)
              fetch(`${API_URL}/auth/optin-confirm`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
              }).catch(() => {})
              setUserId(uid)
              setAccessToken(token)
              advance()
            }}
          />
        ) : null

      case STEPS.YOUR_BUSINESS:
        return (
          <StepBusiness
            onNext={(data) => {
              setBusinessData(data)
              advance()
            }}
          />
        )

      case STEPS.AI_NAME:
        return (
          <StepAiName
            value={aiConfig.name}
            onNext={(name) => {
              setAiConfig((prev) => ({ ...prev, name }))
              advance()
            }}
          />
        )

      case STEPS.PERSONALITY:
        return (
          <StepPersonality
            value={aiConfig.personality}
            onNext={(personality: AiPersonality) => {
              setAiConfig((prev) => ({ ...prev, personality }))
              advance()
            }}
          />
        )

      case STEPS.VOICE:
        return (
          <StepVoice
            value={aiConfig.voiceGender}
            onNext={(voiceGender: AiVoiceGender) => {
              setAiConfig((prev) => ({ ...prev, voiceGender }))
              advance()
            }}
          />
        )

      case STEPS.KNOWLEDGE:
        return (
          <StepKnowledge
            value={kbSeed}
            onNext={(seed) => {
              setKbSeed(seed)
              advance()
            }}
          />
        )

      case STEPS.PICK_NUMBER:
        return identity ? (
          <StepPickNumber
            areaCode={extractAreaCode(identity.phone)}
            onNext={(number) => {
              setSelectedNumber(number)
              advance()
            }}
          />
        ) : null

      case STEPS.ACTIVATE:
        return userId && businessData && selectedNumber ? (
          <StepActivate
            userId={userId}
            userName={identity ? `${identity.firstName} ${identity.lastName}` : ""}
            businessName={businessData.businessName}
            businessType={businessData.businessType}
            phoneNumber={selectedNumber}
            aiName={aiConfig.name}
            aiPersonality={aiConfig.personality}
            aiVoiceGender={aiConfig.voiceGender}
            aiKbSeed={kbSeed}
            onSuccess={(bId) => {
              setBusinessId(bId)
              advance()
            }}
            onBack={retreat}
          />
        ) : null

      case STEPS.CALENDAR:
        return businessId && accessToken ? (
          <StepCalendar
            businessId={businessId}
            accessToken={accessToken}
            onDone={() => setSuccess(true)}
          />
        ) : null

      default:
        return null
    }
  }

  return (
    <AppPageShell title={currentConfig.title} descriptor={currentConfig.descriptor}>
      <div className="max-w-sm mx-auto w-full">
        <div className="overflow-hidden">
          <AnimatePresence custom={direction} mode="wait">
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: "easeInOut" }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </div>

        <WizardNav
          currentStep={step}
          canGoBack={canGoBack}
          onBack={retreat}
        />

        {step === STEPS.IDENTIFY && (
          <p
            className="text-center mt-6 text-[11px] text-white/20 tracking-[.06em]"
            style={{ fontFamily: "'Jost', sans-serif" }}
          >
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-violet-400/60 hover:text-violet-300 transition-colors"
            >
              Sign in
            </Link>
          </p>
        )}
      </div>
    </AppPageShell>
  )
}
```

- [ ] **Step 4.3: Run the tests — scaffold tests should now pass**

```bash
cd apps/web && bun run test:e2e --grep "get-started"
```

Expected: Tests for title, back-arrow, and dots PASS once all step stubs are created (steps 5-12). Tests for form inputs will pass after Task 5.

- [ ] **Step 4.4: Commit scaffold**

```bash
git add apps/web/src/components/get-started/WizardNav.tsx apps/web/src/pages/app/AppGetStartedPage.tsx
git commit -m "feat(get-started): wizard scaffold with AnimatePresence, step routing, auth guard"
```

---

## Task 5: Step 0 — IDENTIFY

**Files:**
- Create: `apps/web/src/components/get-started/StepIdentify.tsx`

- [ ] **Step 5.1: Create StepIdentify.tsx**

```tsx
// apps/web/src/components/get-started/StepIdentify.tsx
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { DarkInput } from "./DarkInput"
import { jostLabel } from "./types"
import type { IdentityData } from "./types"

const schema = z.object({
  firstName: z.string().min(1, "Enter your first name"),
  lastName: z.string().min(1, "Enter your last name"),
  phone: z
    .string()
    .min(7, "Enter your mobile number")
    .refine((v) => v.replace(/\D/g, "").length >= 10, "Enter a valid 10-digit number"),
})

function toE164(raw: string): string {
  const digits = raw.replace(/\D/g, "")
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`
  return `+${digits}`
}

interface Props {
  onNext: (data: IdentityData) => void
}

export function StepIdentify({ onNext }: Props) {
  const [busy, setBusy] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<IdentityData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: IdentityData) => {
    setBusy(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: toE164(data.phone) })
      if (error) throw error
      toast.success("Code sent — check your messages.")
      onNext(data)
    } catch (err) {
      toast.error((err as Error).message ?? "Failed to send code")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="block text-[10px] uppercase text-white/30" style={jostLabel}>
            First name
          </label>
          <DarkInput
            placeholder="Jane"
            autoComplete="given-name"
            hasError={!!errors.firstName}
            {...register("firstName")}
          />
          {errors.firstName && (
            <p className="text-[10px] text-red-400/70">{errors.firstName.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="block text-[10px] uppercase text-white/30" style={jostLabel}>
            Last name
          </label>
          <DarkInput
            placeholder="Smith"
            autoComplete="family-name"
            hasError={!!errors.lastName}
            {...register("lastName")}
          />
          {errors.lastName && (
            <p className="text-[10px] text-red-400/70">{errors.lastName.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="block text-[10px] uppercase text-white/30" style={jostLabel}>
          Mobile number
        </label>
        <DarkInput
          type="tel"
          placeholder="+1 (415) 555-0100"
          autoComplete="tel"
          autoFocus
          hasError={!!errors.phone}
          {...register("phone")}
        />
        {errors.phone && (
          <p className="text-[10px] text-red-400/70">{errors.phone.message}</p>
        )}
      </div>

      <p
        className="text-[10px] text-white/18 leading-relaxed pt-1"
        style={{ fontFamily: "'Jost', sans-serif" }}
      >
        By continuing you agree to receive SMS messages from Front Desk by Neuvetra, including
        verification codes and transactional notifications. Reply STOP to opt out. See our{" "}
        <a href="/terms" className="text-violet-400/50 hover:text-violet-300 transition-colors underline">Terms</a>
        {" "}and{" "}
        <a href="/privacy" className="text-violet-400/50 hover:text-violet-300 transition-colors underline">Privacy Policy</a>.
      </p>

      <button
        type="submit"
        disabled={busy}
        className="w-full py-3 mt-1 text-[11px] font-light tracking-[.18em] uppercase text-violet-200 bg-violet-500/15 border border-violet-500/35 hover:bg-violet-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ fontFamily: "'Jost', sans-serif" }}
      >
        {busy ? "Sending…" : "Send verification code →"}
      </button>
    </form>
  )
}
```

- [ ] **Step 5.2: Run Playwright — inputs test should now pass**

```bash
cd apps/web && bun run test:e2e --grep "shows first name"
```

Expected: PASS.

- [ ] **Step 5.3: Commit**

```bash
git add apps/web/src/components/get-started/StepIdentify.tsx
git commit -m "feat(get-started): add IDENTIFY step"
```

---

## Task 6: Step 1 — VERIFY

**Files:**
- Create: `apps/web/src/components/get-started/StepVerify.tsx`

- [ ] **Step 6.1: Create StepVerify.tsx**

```tsx
// apps/web/src/components/get-started/StepVerify.tsx
import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { DarkInput } from "./DarkInput"
import { jostLabel } from "./types"

interface Props {
  phone: string // E.164
  onVerified: (userId: string, accessToken: string) => void
}

export function StepVerify({ phone, onVerified }: Props) {
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [resending, setResending] = useState(false)

  const handleVerify = async () => {
    if (code.length < 6) return
    setBusy(true)
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token: code,
        type: "sms",
      })
      if (error) throw error
      if (!data.user || !data.session) throw new Error("Verification failed — please try again")

      // If this phone already has a business, redirect to dashboard
      const { data: existing } = await supabase
        .from("business_members")
        .select("business_id")
        .eq("user_id", data.user.id)
        .limit(1)
        .maybeSingle()

      if (existing) {
        toast.info("You already have an account — signing you in.")
        window.location.href = "/dashboard"
        return
      }

      onVerified(data.user.id, data.session.access_token)
    } catch (err) {
      toast.error((err as Error).message ?? "Invalid code — try again")
    } finally {
      setBusy(false)
    }
  }

  const handleResend = async () => {
    setResending(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone })
      if (error) throw error
      toast.success("Code resent.")
    } catch (err) {
      toast.error((err as Error).message ?? "Failed to resend")
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="space-y-4">
      <p
        className="text-sm text-white/40 text-center"
        style={{ fontFamily: "'Jost', sans-serif", letterSpacing: "0.04em" }}
      >
        Sent to{" "}
        <span className="text-white/70">{phone}</span>
      </p>

      <div className="space-y-1.5">
        <label className="block text-[10px] uppercase text-white/30" style={jostLabel}>
          6-digit code
        </label>
        <DarkInput
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          placeholder="000000"
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className="text-center tracking-[0.5em] text-lg"
        />
      </div>

      <button
        type="button"
        onClick={handleVerify}
        disabled={code.length < 6 || busy}
        className="w-full py-3 text-[11px] font-light tracking-[.18em] uppercase text-violet-200 bg-violet-500/15 border border-violet-500/35 hover:bg-violet-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ fontFamily: "'Jost', sans-serif" }}
      >
        {busy ? "Verifying…" : "Verify →"}
      </button>

      <button
        type="button"
        onClick={handleResend}
        disabled={resending}
        className="w-full py-2 text-[10px] tracking-[.1em] uppercase text-white/20 hover:text-white/40 transition-colors disabled:opacity-40"
        style={{ fontFamily: "'Jost', sans-serif" }}
      >
        {resending ? "Resending…" : "Resend code"}
      </button>
    </div>
  )
}
```

- [ ] **Step 6.2: Commit**

```bash
git add apps/web/src/components/get-started/StepVerify.tsx
git commit -m "feat(get-started): add VERIFY step"
```

---

## Task 7: Step 2 — YOUR BUSINESS

**Files:**
- Create: `apps/web/src/components/get-started/StepBusiness.tsx`

- [ ] **Step 7.1: Create StepBusiness.tsx**

```tsx
// apps/web/src/components/get-started/StepBusiness.tsx
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ChevronDown } from "lucide-react"
import { useState } from "react"
import { DarkInput } from "./DarkInput"
import { jostLabel } from "./types"
import type { BusinessData } from "./types"

const BUSINESS_TYPES = [
  ["medical",      "Medical / Healthcare"],
  ["dental",       "Dental"],
  ["spa",          "MedSpa / Wellness"],
  ["salon",        "Salon & Beauty"],
  ["plumbing",     "Plumbing & Trades"],
  ["legal",        "Legal"],
  ["real_estate",  "Real Estate"],
  ["other",        "Other"],
] as const

const schema = z.object({
  businessName: z.string().min(2, "Enter your business name"),
  businessType: z.enum(
    ["medical", "dental", "spa", "salon", "plumbing", "legal", "real_estate", "other"],
    { error: "Select a business type" }
  ),
})

interface Props {
  onNext: (data: BusinessData) => void
}

export function StepBusiness({ onNext }: Props) {
  const { register, handleSubmit, control, formState: { errors } } = useForm<BusinessData>({
    resolver: zodResolver(schema),
  })
  const [open, setOpen] = useState(false)
  const [selectedLabel, setSelectedLabel] = useState("")

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-3">
      <div className="space-y-1.5">
        <label className="block text-[10px] uppercase text-white/30" style={jostLabel}>
          Business name
        </label>
        <DarkInput
          placeholder="Sunrise MedSpa"
          hasError={!!errors.businessName}
          {...register("businessName")}
        />
        {errors.businessName && (
          <p className="text-[10px] text-red-400/70">{errors.businessName.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="block text-[10px] uppercase text-white/30" style={jostLabel}>
          Business type
        </label>
        <Controller
          control={control}
          name="businessType"
          render={({ field }) => (
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className={[
                  "w-full bg-white/[0.03] border px-4 py-3 text-sm text-left flex items-center justify-between transition-colors",
                  errors.businessType
                    ? "border-red-400/40"
                    : "border-white/10 hover:border-white/20",
                ].join(" ")}
                style={{ fontFamily: "'Jost', sans-serif" }}
              >
                <span className={selectedLabel ? "text-white" : "text-white/25"}>
                  {selectedLabel || "Select a type…"}
                </span>
                <ChevronDown className="size-4 text-white/30 shrink-0" strokeWidth={1.5} />
              </button>

              {open && (
                <div className="absolute top-full left-0 right-0 z-20 border border-white/10 bg-[#0f0f10] mt-0.5 max-h-52 overflow-y-auto">
                  {BUSINESS_TYPES.map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        field.onChange(value)
                        setSelectedLabel(label)
                        setOpen(false)
                      }}
                      className="w-full px-4 py-3 text-sm text-left text-white/60 hover:text-white hover:bg-white/[0.03] transition-colors"
                      style={{ fontFamily: "'Jost', sans-serif" }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        />
        {errors.businessType && (
          <p className="text-[10px] text-red-400/70">{errors.businessType.message}</p>
        )}
      </div>

      <button
        type="submit"
        className="w-full py-3 mt-1 text-[11px] font-light tracking-[.18em] uppercase text-violet-200 bg-violet-500/15 border border-violet-500/35 hover:bg-violet-500/20 transition-colors"
        style={{ fontFamily: "'Jost', sans-serif" }}
      >
        Continue →
      </button>
    </form>
  )
}
```

- [ ] **Step 7.2: Commit**

```bash
git add apps/web/src/components/get-started/StepBusiness.tsx
git commit -m "feat(get-started): add YOUR BUSINESS step"
```

---

## Task 8: Steps 3-5 — AI Name, Personality, Voice

**Files:**
- Create: `apps/web/src/components/get-started/StepAiName.tsx`
- Create: `apps/web/src/components/get-started/StepPersonality.tsx`
- Create: `apps/web/src/components/get-started/StepVoice.tsx`

- [ ] **Step 8.1: Create StepAiName.tsx**

```tsx
// apps/web/src/components/get-started/StepAiName.tsx
import { useState } from "react"
import { DarkInput } from "./DarkInput"
import { jostLabel } from "./types"

interface Props {
  value: string
  onNext: (name: string) => void
}

export function StepAiName({ value, onNext }: Props) {
  const [name, setName] = useState(value)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim()) onNext(name.trim())
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="block text-[10px] uppercase text-white/30" style={jostLabel}>
          AI name
        </label>
        <DarkInput
          placeholder="Aria"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <p
          className="text-[10px] text-white/20 leading-relaxed"
          style={{ fontFamily: "'Jost', sans-serif" }}
        >
          Your callers will hear: "Hi, I'm {name || "Aria"} — how can I help you today?"
        </p>
      </div>

      <button
        type="submit"
        disabled={!name.trim()}
        className="w-full py-3 text-[11px] font-light tracking-[.18em] uppercase text-violet-200 bg-violet-500/15 border border-violet-500/35 hover:bg-violet-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ fontFamily: "'Jost', sans-serif" }}
      >
        Continue →
      </button>
    </form>
  )
}
```

- [ ] **Step 8.2: Create StepPersonality.tsx**

Tapping a card immediately calls `onNext` — no separate submit button needed.

```tsx
// apps/web/src/components/get-started/StepPersonality.tsx
import { jost } from "./types"
import type { AiPersonality } from "./types"

const OPTIONS: { value: AiPersonality; label: string; description: string }[] = [
  { value: "professional", label: "Professional", description: "Precise and courteous — focused on efficiency" },
  { value: "friendly",     label: "Friendly",     description: "Warm and approachable — puts callers at ease" },
  { value: "empathetic",   label: "Empathetic",   description: "Attentive and caring — ideal for healthcare" },
  { value: "concise",      label: "Concise",      description: "Brief and direct — respects everyone's time" },
]

interface Props {
  value: AiPersonality
  onNext: (personality: AiPersonality) => void
}

export function StepPersonality({ value, onNext }: Props) {
  return (
    <div className="space-y-2">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onNext(opt.value)}
          className={[
            "w-full text-left px-5 py-4 border transition-colors",
            value === opt.value
              ? "border-violet-500/50 bg-violet-500/[0.06]"
              : "border-white/10 hover:border-white/20 hover:bg-white/[0.02]",
          ].join(" ")}
        >
          <p
            className="text-[11px] font-semibold tracking-[.1em] uppercase mb-1"
            style={{ color: value === opt.value ? "rgba(167,139,250,0.9)" : "rgba(255,255,255,0.6)" }}
          >
            {opt.label}
          </p>
          <p className="text-xs text-white/30" style={jost}>
            {opt.description}
          </p>
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 8.3: Create StepVoice.tsx**

```tsx
// apps/web/src/components/get-started/StepVoice.tsx
import { jost } from "./types"
import type { AiVoiceGender } from "./types"

const OPTIONS: { value: AiVoiceGender; label: string; description: string }[] = [
  { value: "female", label: "Female", description: "Warm, clear, and natural-sounding" },
  { value: "male",   label: "Male",   description: "Deep, confident, and professional" },
]

interface Props {
  value: AiVoiceGender
  onNext: (gender: AiVoiceGender) => void
}

export function StepVoice({ value, onNext }: Props) {
  return (
    <div className="space-y-3">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onNext(opt.value)}
          className={[
            "w-full text-left px-5 py-5 border transition-colors",
            value === opt.value
              ? "border-violet-500/50 bg-violet-500/[0.06]"
              : "border-white/10 hover:border-white/20 hover:bg-white/[0.02]",
          ].join(" ")}
        >
          <p
            className="text-sm font-light tracking-[.08em] uppercase mb-1"
            style={{ color: value === opt.value ? "rgba(167,139,250,0.9)" : "rgba(255,255,255,0.7)", fontFamily: "'Jost', sans-serif" }}
          >
            {opt.label}
          </p>
          <p className="text-xs text-white/30" style={jost}>
            {opt.description}
          </p>
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 8.4: Commit**

```bash
git add apps/web/src/components/get-started/StepAiName.tsx apps/web/src/components/get-started/StepPersonality.tsx apps/web/src/components/get-started/StepVoice.tsx
git commit -m "feat(get-started): add NAME YOUR AI, PERSONALITY, and VOICE steps"
```

---

## Task 9: Step 6 — KNOWLEDGE

**Files:**
- Create: `apps/web/src/components/get-started/StepKnowledge.tsx`

- [ ] **Step 9.1: Create StepKnowledge.tsx**

```tsx
// apps/web/src/components/get-started/StepKnowledge.tsx
import { useState } from "react"
import { DarkTextarea } from "./DarkTextarea"
import { jost, jostLabel } from "./types"

interface Props {
  value: string
  onNext: (seed: string) => void
}

export function StepKnowledge({ value, onNext }: Props) {
  const [text, setText] = useState(value)

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="block text-[10px] uppercase text-white/30" style={jostLabel}>
          About your business
        </label>
        <DarkTextarea
          rows={6}
          placeholder="We're a dental office open Mon-Fri 9am-5pm. We offer cleanings, fillings, and cosmetic work. New patients welcome. Our number is (415) 555-0100."
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <p className="text-[10px] text-white/20 leading-relaxed" style={jost}>
          Your AI will use this to answer common questions. You can always add more in Settings.
        </p>
      </div>

      <button
        type="button"
        onClick={() => onNext(text)}
        className="w-full py-3 text-[11px] font-light tracking-[.18em] uppercase text-violet-200 bg-violet-500/15 border border-violet-500/35 hover:bg-violet-500/20 transition-colors"
        style={{ fontFamily: "'Jost', sans-serif" }}
      >
        Continue →
      </button>

      <button
        type="button"
        onClick={() => onNext("")}
        className="w-full py-2 text-[10px] tracking-[.1em] uppercase text-white/20 hover:text-white/40 transition-colors"
        style={{ fontFamily: "'Jost', sans-serif" }}
      >
        Skip for now
      </button>
    </div>
  )
}
```

- [ ] **Step 9.2: Commit**

```bash
git add apps/web/src/components/get-started/StepKnowledge.tsx
git commit -m "feat(get-started): add KNOWLEDGE step"
```

---

## Task 10: Step 7 — YOUR NUMBER

**Files:**
- Create: `apps/web/src/components/get-started/StepPickNumber.tsx`

- [ ] **Step 10.1: Create StepPickNumber.tsx**

Dark-themed version of the existing number picker. Fetches from `/available-numbers`.

```tsx
// apps/web/src/components/get-started/StepPickNumber.tsx
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { jost, jostLabel } from "./types"

const API_URL = import.meta.env.VITE_API_URL as string

interface AvailableNumber {
  phoneNumber: string
  friendlyName: string
  locality: string
  region: string
}

interface Props {
  areaCode: string
  onNext: (phoneNumber: string) => void
}

export function StepPickNumber({ areaCode, onNext }: Props) {
  const [numbers, setNumbers] = useState<AvailableNumber[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_URL}/available-numbers?areaCode=${areaCode}`)
        const data = await res.json() as { numbers: AvailableNumber[] }
        setNumbers(data.numbers ?? [])
      } catch {
        toast.error("Failed to load available numbers")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [areaCode])

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-white/35" style={jost}>
        Available numbers near area code{" "}
        <span className="text-white/60">({areaCode})</span>
      </p>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-white/[0.02] border border-white/5 animate-pulse" />
          ))}
        </div>
      ) : numbers.length === 0 ? (
        <div className="border border-white/10 px-5 py-6 text-center">
          <p className="text-sm text-white/30" style={jost}>
            No numbers found for area code ({areaCode}).
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {numbers.map((n) => (
            <button
              key={n.phoneNumber}
              type="button"
              onClick={() => setSelected(n.phoneNumber)}
              className={[
                "w-full text-left px-5 py-3.5 border transition-colors",
                selected === n.phoneNumber
                  ? "border-violet-500/50 bg-violet-500/[0.06]"
                  : "border-white/10 hover:border-white/20 hover:bg-white/[0.02]",
              ].join(" ")}
            >
              <p className="font-mono text-sm text-white/80">{n.friendlyName}</p>
              <p className="text-[10px] text-white/30 mt-0.5" style={jost}>
                {n.locality}, {n.region}
              </p>
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        disabled={!selected || loading}
        onClick={() => selected && onNext(selected)}
        className="w-full py-3 text-[11px] font-light tracking-[.18em] uppercase text-violet-200 bg-violet-500/15 border border-violet-500/35 hover:bg-violet-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ fontFamily: "'Jost', sans-serif" }}
      >
        Continue →
      </button>
    </div>
  )
}
```

- [ ] **Step 10.2: Commit**

```bash
git add apps/web/src/components/get-started/StepPickNumber.tsx
git commit -m "feat(get-started): add YOUR NUMBER step (dark)"
```

---

## Task 11: Step 8 — ACTIVATE (Stripe Dark Theme)

**Files:**
- Create: `apps/web/src/components/get-started/StepActivate.tsx`

- [ ] **Step 11.1: Create StepActivate.tsx**

Stripe's `appearance.theme = "night"` renders a dark Stripe PaymentElement. Plan picker uses the same card-selection pattern as the other steps.

```tsx
// apps/web/src/components/get-started/StepActivate.tsx
import { useEffect, useState } from "react"
import { loadStripe } from "@stripe/stripe-js"
import {
  Elements, PaymentElement, useStripe, useElements,
} from "@stripe/react-stripe-js"
import { toast } from "sonner"
import { jost } from "./types"

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string)
const API_URL = import.meta.env.VITE_API_URL as string

const PLANS = [
  { id: "starter" as const, name: "Starter",  price: "$49",  minutes: "150 min/mo",   overage: "$0.25/min after" },
  { id: "growth"  as const, name: "Growth",   price: "$99",  minutes: "400 min/mo",   overage: "$0.20/min after", popular: true },
  { id: "pro"     as const, name: "Pro",       price: "$199", minutes: "1,000 min/mo", overage: "$0.18/min after" },
] as const

type PlanId = "starter" | "growth" | "pro"

interface ActivatePayload {
  userId: string
  businessName: string
  businessType: string
  phoneNumber: string
  planId: PlanId
  paymentMethodId: string
  stripeCustomerId: string
  aiName: string
  aiPersonality: string
  aiVoiceGender: string
  aiKbSeed: string
}

interface FormProps {
  payload: Omit<ActivatePayload, "planId" | "paymentMethodId" | "stripeCustomerId">
  stripeCustomerId: string
  onSuccess: (businessId: string) => void
  onBack: () => void
}

function PaymentForm({ payload, stripeCustomerId, onSuccess, onBack }: FormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [busy, setBusy] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("growth")
  const [confirmedPmId, setConfirmedPmId] = useState<string | null>(null)

  const trialEnd = new Date()
  trialEnd.setDate(trialEnd.getDate() + 7)
  const trialEndStr = trialEnd.toLocaleDateString("en-US", { month: "long", day: "numeric" })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setBusy(true)
    try {
      let pmId = confirmedPmId

      if (!pmId) {
        const { error, setupIntent } = await stripe.confirmSetup({
          elements,
          redirect: "if_required",
        })
        if (error) throw new Error(error.message)
        if (!setupIntent?.payment_method) throw new Error("No payment method returned")
        pmId = typeof setupIntent.payment_method === "string"
          ? setupIntent.payment_method
          : setupIntent.payment_method.id
        setConfirmedPmId(pmId)
      }

      const res = await fetch(`${API_URL}/billing/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          planId: selectedPlan,
          paymentMethodId: pmId,
          stripeCustomerId,
        }),
      })
      const data = await res.json() as { businessId?: string; phoneNumber?: string; error?: string; code?: string }

      if (data.code === "number_unavailable") {
        toast.error(data.error ?? "That number was just taken. Please go back and pick a different one.")
        onBack()
        return
      }
      if (data.error) throw new Error(data.error)

      toast.success(`Your AI Front Desk is live at ${data.phoneNumber}!`)
      onSuccess(data.businessId ?? "")
    } catch (err) {
      toast.error((err as Error).message ?? "Activation failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Plan picker */}
      <div className="space-y-2">
        {PLANS.map((plan) => (
          <button
            key={plan.id}
            type="button"
            onClick={() => setSelectedPlan(plan.id)}
            className={[
              "w-full text-left px-5 py-4 border transition-colors",
              selectedPlan === plan.id
                ? "border-violet-500/50 bg-violet-500/[0.06]"
                : "border-white/10 hover:border-white/20",
            ].join(" ")}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="text-[11px] font-semibold tracking-[.1em] uppercase"
                  style={{ color: selectedPlan === plan.id ? "rgba(167,139,250,0.9)" : "rgba(255,255,255,0.6)", fontFamily: "'Jost', sans-serif" }}
                >
                  {plan.name}
                </span>
                {"popular" in plan && plan.popular && (
                  <span className="text-[9px] tracking-[.08em] uppercase text-violet-400/60 border border-violet-500/25 px-1.5 py-0.5" style={{ fontFamily: "'Jost', sans-serif" }}>
                    Popular
                  </span>
                )}
              </div>
              <span className="text-white/70 text-sm" style={jost}>
                {plan.price}<span className="text-white/30 text-[10px]">/mo</span>
              </span>
            </div>
            <p className="text-[10px] text-white/30 mt-1" style={jost}>
              {plan.minutes} · {plan.overage}
            </p>
          </button>
        ))}
      </div>

      {/* Stripe dark PaymentElement */}
      <div className="border border-white/10 p-4">
        <PaymentElement options={{ layout: "tabs" }} />
      </div>

      {/* Trial notice */}
      <p className="text-[10px] text-white/30 text-center" style={jost}>
        7-day free trial · card charged {trialEndStr} if not cancelled
      </p>

      <button
        type="submit"
        disabled={!stripe || busy}
        className="w-full py-3 text-[11px] font-light tracking-[.18em] uppercase text-violet-200 bg-violet-500/15 border border-violet-500/35 hover:bg-violet-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ fontFamily: "'Jost', sans-serif" }}
      >
        {busy ? "Activating…" : "Activate my Front Desk →"}
      </button>
    </form>
  )
}

interface Props {
  userId: string
  userName: string
  businessName: string
  businessType: string
  phoneNumber: string
  aiName: string
  aiPersonality: string
  aiVoiceGender: string
  aiKbSeed: string
  onSuccess: (businessId: string) => void
  onBack: () => void
}

export function StepActivate({ userId, userName, businessName, businessType, phoneNumber, aiName, aiPersonality, aiVoiceGender, aiKbSeed, onSuccess, onBack }: Props) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch(`${API_URL}/billing/setup-intent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, name: userName }),
        })
        const data = await res.json() as { clientSecret: string; customerId: string }
        setClientSecret(data.clientSecret)
        setStripeCustomerId(data.customerId)
      } catch {
        toast.error("Failed to initialize payment. Please try again.")
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [userId, userName])

  if (loading || !clientSecret || !stripeCustomerId) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="size-5 animate-spin rounded-full border-2 border-white/10 border-t-violet-400" />
      </div>
    )
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: "night",
          variables: {
            colorPrimary: "#8b5cf6",
            colorBackground: "rgba(255,255,255,0.02)",
            colorText: "rgba(255,255,255,0.85)",
            colorTextSecondary: "rgba(255,255,255,0.4)",
            borderRadius: "0px",
            fontFamily: "'Jost', sans-serif",
          },
          rules: {
            ".Input": {
              border: "1px solid rgba(255,255,255,0.08)",
              backgroundColor: "rgba(255,255,255,0.02)",
            },
            ".Input:focus": {
              border: "1px solid rgba(139,92,246,0.5)",
              boxShadow: "0 0 0 3px rgba(139,92,246,0.12)",
            },
          },
        },
      }}
    >
      <PaymentForm
        payload={{ userId, businessName, businessType, phoneNumber, userName, aiName, aiPersonality, aiVoiceGender, aiKbSeed }}
        stripeCustomerId={stripeCustomerId}
        onSuccess={onSuccess}
        onBack={onBack}
      />
    </Elements>
  )
}
```

- [ ] **Step 11.2: Update billing/activate API response to return businessId**

In `apps/api/src/routes/billing.ts`, the `return` statement at the end of the success path (around line 165) currently returns:

```typescript
      return {
        businessId: business.id,
        phoneNumber: purchased.phoneNumber,
        plan: planId,
      }
```

Verify this already returns `businessId`. If not, add it. The frontend `StepActivate` uses `data.businessId` to advance.

- [ ] **Step 11.3: Commit**

```bash
git add apps/web/src/components/get-started/StepActivate.tsx
git commit -m "feat(get-started): add ACTIVATE step with Stripe night theme"
```

---

## Task 12: Step 9 — CALENDAR + Success Screen

**Files:**
- Create: `apps/web/src/components/get-started/StepCalendar.tsx`
- Create: `apps/web/src/components/get-started/SuccessScreen.tsx`

- [ ] **Step 12.1: Create StepCalendar.tsx**

Dark-themed version of the existing calendar connection step.

```tsx
// apps/web/src/components/get-started/StepCalendar.tsx
import { useState } from "react"
import { Check } from "lucide-react"
import { toast } from "sonner"
import { jost } from "./types"
import { CalDAVConnectDialog } from "@/components/dashboard/CalDAVConnectDialog"

const API_URL = import.meta.env.VITE_API_URL as string

interface Props {
  businessId: string
  accessToken: string
  onDone: () => void
}

const BENEFITS = [
  "Checks your real availability before offering times",
  "Creates calendar events automatically when a caller books",
  "Never double-books — respects your existing schedule",
]

export function StepCalendar({ businessId, accessToken, onDone }: Props) {
  const [loading, setLoading] = useState(false)
  const [caldavOpen, setCaldavOpen] = useState(false)
  const [connected, setConnected] = useState(false)

  const handleConnect = async (provider: "google" | "outlook") => {
    setLoading(true)
    try {
      const endpoint = provider === "outlook"
        ? `${API_URL}/calendar/microsoft/auth-url?businessId=${businessId}`
        : `${API_URL}/calendar/auth-url?businessId=${businessId}`
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json() as { url?: string; error?: string }
      if (data.error) throw new Error(data.error)
      if (data.url) window.location.href = data.url
    } catch (err) {
      toast.error((err as Error).message ?? "Failed to start connection")
      setLoading(false)
    }
  }

  if (connected) {
    return (
      <div className="text-center space-y-6 py-4">
        <div className="flex justify-center">
          <div className="size-14 flex items-center justify-center border border-violet-500/30 bg-violet-500/[0.06]">
            <Check className="size-6 text-violet-400" strokeWidth={1.5} />
          </div>
        </div>
        <p className="text-sm text-white/50" style={jost}>Calendar connected.</p>
        <button
          type="button"
          onClick={onDone}
          className="w-full py-3 text-[11px] font-light tracking-[.18em] uppercase text-violet-200 bg-violet-500/15 border border-violet-500/35 hover:bg-violet-500/20 transition-colors"
          style={{ fontFamily: "'Jost', sans-serif" }}
        >
          Finish →
        </button>
      </div>
    )
  }

  const providerButton = (
    label: string,
    description: string,
    icon: React.ReactNode,
    onClick: () => void,
  ) => (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="flex w-full items-center gap-4 px-5 py-4 border-b border-white/[0.06] hover:bg-white/[0.02] transition-colors disabled:opacity-50 text-left last:border-b-0"
    >
      <div className="size-9 flex items-center justify-center border border-white/10 bg-white/[0.02] shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white/70" style={jost}>{label}</p>
        <p className="text-[10px] text-white/30" style={jost}>{description}</p>
      </div>
      <span className="text-[10px] text-violet-400/50 shrink-0" style={jost}>Connect →</span>
    </button>
  )

  return (
    <div className="space-y-5">
      {/* Benefits */}
      <div className="space-y-2">
        {BENEFITS.map((b) => (
          <div key={b} className="flex items-start gap-2.5">
            <span className="text-[9px] text-violet-400/40 mt-1 shrink-0">—</span>
            <p className="text-xs text-white/40" style={jost}>{b}</p>
          </div>
        ))}
      </div>

      {/* Providers */}
      <div className="border border-white/[0.08]">
        {providerButton(
          "Google Calendar",
          "Connect via Google account",
          <svg className="size-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>,
          () => handleConnect("google"),
        )}
        {providerButton(
          "Outlook Calendar",
          "Microsoft 365 & Outlook.com",
          <svg className="size-4" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="2" fill="#0078D4"/>
            <path d="M13 6h6.5A1.5 1.5 0 0 1 21 7.5v9a1.5 1.5 0 0 1-1.5 1.5H13V6z" fill="#fff" fillOpacity=".3"/>
            <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h8A1.5 1.5 0 0 1 14 8.5v7A1.5 1.5 0 0 1 12.5 17h-8A1.5 1.5 0 0 1 3 15.5v-7z" fill="#fff"/>
            <path d="M8.5 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" fill="#0078D4"/>
          </svg>,
          () => handleConnect("outlook"),
        )}
        {providerButton(
          "Apple / CalDAV",
          "iCloud, Fastmail, Nextcloud & more",
          <svg className="size-4" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="2" fill="rgba(255,255,255,0.06)"/>
            <path d="M17 3h-1V1h-2v2H10V1H8v2H7C5.9 3 5 3.9 5 5v14c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H7V9h10v10z" fill="rgba(255,255,255,0.5)"/>
          </svg>,
          () => setCaldavOpen(true),
        )}
      </div>

      <button
        type="button"
        onClick={onDone}
        className="w-full py-2.5 text-[10px] tracking-[.1em] uppercase text-white/20 hover:text-white/40 transition-colors"
        style={{ fontFamily: "'Jost', sans-serif" }}
      >
        Skip for now — I'll connect in Settings
      </button>

      <CalDAVConnectDialog
        open={caldavOpen}
        onOpenChange={setCaldavOpen}
        onConnected={() => setConnected(true)}
        businessId={businessId}
        accessToken={accessToken}
      />
    </div>
  )
}
```

- [ ] **Step 12.2: Create SuccessScreen.tsx**

```tsx
// apps/web/src/components/get-started/SuccessScreen.tsx
import { motion } from "framer-motion"
import { jost } from "./types"

interface Props {
  onDashboard: () => void
}

export function SuccessScreen({ onDashboard }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="max-w-sm mx-auto text-center pt-6 space-y-8"
    >
      {/* Animated ring */}
      <div className="flex justify-center">
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
          className="size-16 flex items-center justify-center border border-violet-500/40 bg-violet-500/[0.06]"
        >
          <div className="size-2 rounded-full bg-violet-400/80" />
        </motion.div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] tracking-[.16em] uppercase text-violet-400/60" style={jost}>
          Active
        </p>
        <p className="text-sm text-white/40 leading-relaxed" style={jost}>
          Your AI receptionist is live and ready to answer calls.
          Head to your dashboard to configure business hours and review calls.
        </p>
      </div>

      <button
        type="button"
        onClick={onDashboard}
        className="px-10 py-3.5 text-[11px] font-light tracking-[.18em] uppercase text-violet-200 bg-violet-500/15 border border-violet-500/35 hover:bg-violet-500/20 transition-colors"
        style={{ fontFamily: "'Jost', sans-serif" }}
      >
        Go to Dashboard →
      </button>
    </motion.div>
  )
}
```

- [ ] **Step 12.3: Commit**

```bash
git add apps/web/src/components/get-started/StepCalendar.tsx apps/web/src/components/get-started/SuccessScreen.tsx
git commit -m "feat(get-started): add CALENDAR step and success screen"
```

---

## Task 13: Final Run — Tests + Build

- [ ] **Step 13.1: Run all get-started Playwright tests**

```bash
cd apps/web && bun run test:e2e --grep "get-started"
```

Expected output:
```
✓  renders the IDENTIFY step title by default
✓  shows first name, last name, and phone inputs on step 0
✓  back arrow is hidden on step 0
✓  renders 10 progress dots
✓  shows sign-in link on step 0
5 passed
```

- [ ] **Step 13.2: Run the full test suite to catch regressions**

```bash
cd apps/web && bun run test:e2e
```

Expected: All pre-existing tests still pass.

- [ ] **Step 13.3: Production build check (required before push — build gate)**

```bash
cd apps/web && bun run build
```

Expected: No TypeScript errors, `dist/` produced.

- [ ] **Step 13.4: Final commit**

```bash
git add -A
git commit -m "feat(get-started): complete 10-step dark wizard with AI design, Stripe night theme, calendar"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] 10 steps in correct order: IDENTIFY → VERIFY → YOUR BUSINESS → NAME YOUR AI → PERSONALITY → VOICE → KNOWLEDGE → YOUR NUMBER → ACTIVATE → CALENDAR
- [x] Steps 0-2 have no back arrow; step 3+ have free bidirectional navigation
- [x] Dynamic title updates per step (passed to AppPageShell)
- [x] Framer Motion direction-aware slide transitions
- [x] Personality options: Professional, Friendly, Empathetic, Concise
- [x] Voice selection: Male / Female
- [x] KB seed saved at activation via extended billing/activate
- [x] aiConfig stored in businesses.aiConfig (Option B — no Retell agent created)
- [x] Stripe dark theme (`theme: "night"`)
- [x] Already-logged-in guard shows welcome-back screen
- [x] "Already have an account? Sign in" link on step 0 → /login
- [x] After success → /dashboard
- [x] Calendar step is skippable
- [x] Auth goes to /dashboard if existing business found on OTP verify

**Type consistency check:**
- `AiConfig.personality` is `AiPersonality` type throughout — StepPersonality, StepVoice, AppGetStartedPage, types.ts all match
- `StepActivate.onSuccess` receives `(businessId: string)` — matches AppGetStartedPage handler
- `BusinessData.businessType` union matches both StepBusiness schema and billing.ts body schema
- `slideVariants` in types.ts uses `(direction: number)` — matches `custom={direction}` in AnimatePresence

**No placeholder check:** All steps contain complete code. No "TBD" or "implement later".
