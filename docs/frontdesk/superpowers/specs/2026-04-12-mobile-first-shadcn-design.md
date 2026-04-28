# Mobile-First + shadcn/ui Standardisation — Design Spec

**Date:** 2026-04-12
**Status:** Approved
**Task:** 26

## Goal

Make the entire app mobile-first and responsive, while completing the shadcn/ui component standardisation. Every interactive element, form control, and layout primitive should use a shadcn component so that reskinning = updating the component library.

## Decisions Made

| Decision | Choice | Reason |
|---|---|---|
| Dashboard navigation on mobile | shadcn Sidebar block | Full-width content on mobile, drawer on tap, collapses to icons on desktop |
| Business hours rows on mobile | Compact single row (B) | Everything on one line — smaller toggle, abbreviated layout, no stacking |
| OTP input | shadcn `InputOTP` | Auto-advances focus, submits on 6th digit, proper slot UI |
| Form errors | shadcn `Form` / `FormMessage` | Replaces manual `{errors.x && <p>}` pattern throughout |
| Icon library | Keep `lucide-react` | Already shadcn's official icon library — no change needed |

## Components to Install

Run from `apps/web/`:

```bash
bunx shadcn@latest add sidebar
bunx shadcn@latest add input-otp
bunx shadcn@latest add form
bunx shadcn@latest add collapsible
bunx shadcn@latest add dropdown-menu
bunx shadcn@latest add avatar
bunx shadcn@latest add breadcrumb
bunx shadcn@latest add sheet
bunx shadcn@latest add tooltip
```

> Some may already be installed as sidebar dependencies — the CLI will skip duplicates.

## Architecture Changes

### Dashboard Layout — shadcn Sidebar

`DashboardPage.tsx` is restructured around the shadcn sidebar shell:

```
SidebarProvider
  ├── AppSidebar (new component)
  │   ├── SidebarHeader — logo + business name
  │   ├── SidebarContent
  │   │   └── SidebarMenu — nav items (Overview, Calls, Messages, Usage, Knowledge, Settings)
  │   └── SidebarFooter — user name + sign out
  └── SidebarInset
      ├── header — SidebarTrigger (hamburger) + breadcrumb + live badge
      └── main — tab content (same components as today)
```

- URL routing (`/dashboard/:tab`) is unchanged — sidebar nav items call `navigate('/dashboard/:tab')`
- Active item highlighted via `isActive` prop driven by current route param
- On mobile: sidebar hidden by default, `SidebarTrigger` opens it as a `Sheet` (drawer)
- On desktop: sidebar visible, can collapse to icon-only with `collapsible="icon"`

### InputOTP Migration

`LoginPage.tsx` and `StepVerify.tsx`:

```tsx
// Before
<Input type="text" inputMode="numeric" maxLength={6} value={otp} onChange={...} />

// After
<InputOTP maxLength={6} value={otp} onChange={setOtp}>
  <InputOTPGroup>
    <InputOTPSlot index={0} />
    <InputOTPSlot index={1} />
    <InputOTPSlot index={2} />
    <InputOTPSlot index={3} />
    <InputOTPSlot index={4} />
    <InputOTPSlot index={5} />
  </InputOTPGroup>
</InputOTP>
```

On `LoginPage`, auto-submit `handleVerify` when `otp.length === 6` via `useEffect`.
On `StepVerify`, same pattern — call `handleVerify` directly from `InputOTP`'s `onChange` when length hits 6.

### Form Component Migration

All `useForm` + manual error `<p>` forms migrated to shadcn `Form`:

**Affected files:**
- `LoginForm.tsx`
- `SignupForm.tsx`
- `StepIdentity.tsx`
- `StepBusiness.tsx`
- `StepBusinessInfo.tsx` (onboarding)
- `KnowledgeBaseTab.tsx`

**Pattern:**
```tsx
const form = useForm<FormData>({ resolver: zodResolver(schema) })

<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)}>
    <FormField control={form.control} name="email" render={({ field }) => (
      <FormItem>
        <FormLabel>Email</FormLabel>
        <FormControl><Input type="email" placeholder="you@company.com" {...field} /></FormControl>
        <FormMessage />
      </FormItem>
    )} />
  </form>
</Form>
```

### Mobile Responsive Polish

| Area | Change |
|---|---|
| Auth pages (LoginPage, LoginForm, SignupForm) | Ensure `px-4 sm:px-6` on wrappers, card max-width constrained |
| Signup wizard steps | `max-w-md mx-auto px-4` on step containers |
| SettingsTab business hours | Already compact single-row — verify touch target sizes |
| Landing page | Minor `px-4` fixes on mobile; pricing toggle already has `md:` breakpoints |

### Remaining Raw Button Cleanup

| File | Element | Replacement |
|---|---|---|
| `Pricing.tsx` | Monthly/annual toggle `<button>` × 2 | `Button variant="ghost"` with active state |
| `StepConfirm.tsx` (onboarding) | "← Back" `<button>` | `Button variant="ghost"` |
| `DashboardPage.tsx` | Tab nav `<button>` elements | Removed — replaced by sidebar nav |

## File Impact Summary

**New files:**
- `apps/web/src/components/dashboard/AppSidebar.tsx` — sidebar component extracted from DashboardPage

**Modified files:**
- `apps/web/src/pages/DashboardPage.tsx` — full restructure around SidebarProvider
- `apps/web/src/pages/LoginPage.tsx` — InputOTP + Form
- `apps/web/src/components/auth/LoginForm.tsx` — Form migration
- `apps/web/src/components/auth/SignupForm.tsx` — Form migration
- `apps/web/src/components/signup/StepIdentity.tsx` — Form migration
- `apps/web/src/components/signup/StepBusiness.tsx` — Form migration
- `apps/web/src/components/signup/StepVerify.tsx` — InputOTP
- `apps/web/src/components/onboarding/StepBusinessInfo.tsx` — Form migration
- `apps/web/src/components/onboarding/StepConfirm.tsx` — Button cleanup
- `apps/web/src/components/dashboard/KnowledgeBaseTab.tsx` — Form migration
- `apps/web/src/components/landing/Pricing.tsx` — Button cleanup
- `apps/web/src/components/ui/` — new component files added by shadcn CLI

**New shadcn component files (added by CLI):**
`sidebar.tsx`, `input-otp.tsx`, `form.tsx`, `collapsible.tsx`, `dropdown-menu.tsx`, `avatar.tsx`, `breadcrumb.tsx`, `sheet.tsx`, `tooltip.tsx`

## Testing

New Playwright tests in `apps/web/tests/mobile-responsive.spec.ts`:
- Viewport set to 375×667 (iPhone SE) — verify sidebar trigger visible, content visible
- Open sidebar drawer on mobile — verify nav items present
- OTP input: type 6 digits — verify auto-submit fires
- Form errors: submit empty form — verify FormMessage appears under each field
- Business hours row: verify time inputs visible at 375px width
- Build verification: `bun run build` must pass with zero TS errors

## Done When

- [ ] All shadcn components installed
- [ ] Dashboard uses sidebar layout with mobile drawer
- [ ] OTP screens use `InputOTP`
- [ ] All forms use shadcn `Form` / `FormMessage`
- [ ] No raw `<button>` or `<input>` elements outside `components/ui/`
- [ ] `bun run build` passes
- [ ] Playwright mobile tests pass at 375px viewport
- [ ] Task file created and marked done
