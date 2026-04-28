# How It Works Page Redesign

## Goal

Replace the current placeholder step content with copy that positions Front Desk as "Your AI" — a character the user creates and owns — rather than a phone-forwarding service. Improve the visual hierarchy of the step list to match the ghost-number aesthetic shown in the design session.

## Scope

Two files change:

| File | What changes |
|------|-------------|
| `apps/web/src/contexts/constants/landing.ts` | `HOW_IT_WORKS` array — new step titles, descriptions, and callout strings |
| `apps/web/src/pages/app/AppHowItWorksPage.tsx` | Descriptor prop, step number visual style, new benefit callout element per step |

No other files touched. `AppPageShell.tsx` is unchanged — descriptor is passed as a prop.

---

## Copy — HOW_IT_WORKS data

Replace the `HOW_IT_WORKS` export in `landing.ts` with:

```ts
export const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Start with your phone number",
    description:
      "That's all we need to get going. Verify with a one-time code — your free trial begins immediately. No credit card, no commitment, no forms to fill out.",
    callout: "7-day free trial · 100 free minutes · no card required",
  },
  {
    step: "02",
    title: "Design your AI",
    description:
      "Give your AI a name. Choose its voice — the one that represents your business. Then train it: your services, your pricing, your hours, exactly how you like things handled. This is your AI — built by you, for you.",
    callout: "Your name, your voice, your rules — edit any time",
  },
  {
    step: "03",
    title: "Pick your AI's number",
    description:
      "Choose a real local number for your AI — one you can advertise, put on your website, or hand to clients directly. Forward missed calls from your existing number, or let clients call your AI's number straight. Either way, your current number stays exactly as it is.",
    callout: "Keep your existing number · your AI gets its own",
  },
  {
    step: "04",
    title: "Call it. Then let it work.",
    description:
      "Dial your AI's number before you go live — hear it handle a call exactly the way your clients will. When you're satisfied, it answers every call, books every appointment, and texts you instantly when something needs your attention. In English and Spanish, around the clock.",
    callout: "24/7 · English & Spanish · instant SMS alerts",
  },
]
```

**Key decisions:**
- "Any language" removed — replaced with "English & Spanish" (accurate to current Retell support)
- Step 02 is "Design your AI" — character creation framing, not form-filling
- Step 03 is "Pick your AI's number" — gives user agency, mentions both use cases (forward OR direct)
- Step 04 includes the "call it yourself to test" hook before the 24/7 payoff
- `callout` is a new field on each step — rendered as a green accent line below the description

---

## Descriptor change

In `AppHowItWorksPage.tsx`, change the `descriptor` prop on `AppPageShell`:

```tsx
// Before
<AppPageShell title="How It Works" descriptor="Live in under 10 minutes">

// After
<AppPageShell title="How It Works" descriptor="Your AI. Ready in minutes.">
```

---

## Visual changes — AppHowItWorksPage.tsx

### Step number: ghost green style

Replace current number span styling with the ghost-green fading style. The number opacity fades from step 01 → 04 to suggest a journey receding into the future.

```tsx
// Step number span — replace current style object
<span
  className="shrink-0 w-14 text-right"
  style={{
    color: `rgba(61,158,96,${0.22 - index * 0.04})`,
    fontSize: '3rem',
    fontFamily: "'Jost', sans-serif",
    fontWeight: 200,
    lineHeight: 1,
  }}
>
  {step.step}
</span>
```

Opacity per step: 01 → 0.22, 02 → 0.18, 03 → 0.14, 04 → 0.10. Computed as `0.22 - index * 0.04`.

### Callout line: new element

Add a `callout` line after the description `<p>`. Rendered as small green uppercase text:

```tsx
<span
  style={{
    color: 'rgba(61,158,96,0.75)',
    fontSize: '0.65rem',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    marginTop: '10px',
    display: 'block',
  }}
>
  ✓ {step.callout}
</span>
```

### Container adjustment

The number span width increases from `w-10` to `w-14` (56px) to accommodate the larger `3rem` number without truncation.

---

## Full updated component

```tsx
import { motion } from "framer-motion"
import { AppPageShell } from "./AppPageShell"
import { HOW_IT_WORKS } from "@/contexts/constants/landing"

const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.15,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
}

export function AppHowItWorksPage() {
  return (
    <AppPageShell title="How It Works" descriptor="Your AI. Ready in minutes.">
      <motion.ol
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="flex flex-col max-w-md mx-auto w-full"
      >
        {HOW_IT_WORKS.map((step, index) => (
          <motion.li
            key={step.step}
            variants={itemVariants}
            className="flex gap-6 items-start py-5"
            style={{
              borderTop: index === 0 ? 'none' : '1px solid rgba(255,255,255,0.06)',
            }}
          >
            {/* Step number — ghost green, fades 01→04 */}
            <span
              className="shrink-0 w-14 text-right"
              style={{
                color: `rgba(61,158,96,${0.22 - index * 0.04})`,
                fontSize: '3rem',
                fontFamily: "'Jost', sans-serif",
                fontWeight: 200,
                lineHeight: 1,
              }}
            >
              {step.step}
            </span>

            {/* Step content */}
            <div className="flex flex-col gap-1.5">
              <h3
                className="uppercase"
                style={{
                  color: 'rgba(255,255,255,0.8)',
                  fontSize: '0.75rem',
                  letterSpacing: '0.18em',
                  fontFamily: "'Jost', sans-serif",
                  fontWeight: 300,
                }}
              >
                {step.title}
              </h3>
              <p
                style={{
                  color: 'rgba(255,255,255,0.38)',
                  fontSize: '0.75rem',
                  lineHeight: '1.75',
                  fontWeight: 300,
                  maxWidth: '26rem',
                }}
              >
                {step.description}
              </p>
              <span
                style={{
                  color: 'rgba(61,158,96,0.75)',
                  fontSize: '0.65rem',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase' as const,
                  marginTop: '2px',
                  display: 'block',
                }}
              >
                ✓ {step.callout}
              </span>
            </div>
          </motion.li>
        ))}
      </motion.ol>
    </AppPageShell>
  )
}
```

---

## E2E test updates

`apps/web/tests/app-how-it-works.spec.ts` must be updated:

- **Descriptor test:** currently checks for `/live in under 10 minutes/i` — update to `/your ai\. ready in minutes\./i`
- **Step title tests:** update "Create your account" → "Start with your phone number", "Tell us about your business" → "Design your AI", "Set up call forwarding" → "Pick your AI's number", "Go live" → "Call it. Then let it work."
- **Add callout test:** verify at least one callout line is visible (e.g., "7-day free trial")

---

## Success criteria

- Navigate to `/app/how-it-works` — descriptor reads "Your AI. Ready in minutes."
- All 4 step titles match new copy
- Step numbers are green-tinted ghosts that visually fade step 01 → 04
- Each step has a ✓ callout line in green
- All existing E2E tests pass (after updating descriptor + step title assertions)
- `bun run build` exits 0
