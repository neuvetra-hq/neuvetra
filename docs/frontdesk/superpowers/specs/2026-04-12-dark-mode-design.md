# Dark / Light Mode — Design Spec

**Goal:** Let users toggle between dark and light themes from the dashboard header, persisted across sessions.

**Architecture:** A `ThemeProvider` React context manages theme state, applies/removes the `.dark` class on `document.documentElement`, and persists the choice to `localStorage`. The dashboard header has a `Sun`/`Moon` icon button pinned to the top-right corner via `flex-1` spacer.

---

## CSS

Already complete. `index.css` has full `.dark` token overrides for every CSS variable. The dark variant is `@custom-variant dark (&:is(.dark *))` — toggling `.dark` on `<html>` activates it everywhere.

## ThemeContext (`src/contexts/ThemeContext.tsx`)

- On mount: read `localStorage.getItem("theme")`. Default to `"light"` if absent.
- Apply `.dark` class to `document.documentElement` when theme is `"dark"`, remove it when `"light"`.
- Expose `{ theme: "light" | "dark", toggleTheme: () => void }` via `useTheme()` hook.
- `ThemeProvider` wraps children; throws if `useTheme()` called outside it.

## main.tsx

Wrap `<App />` with `<ThemeProvider>` — placed inside `<BrowserRouter>` but outside `<AuthProvider>` (theme is independent of auth).

## Dashboard header toggle

In `DashboardPage.tsx`, the existing header is:
```
<header className="sticky top-0 ...">
  <SidebarTrigger />
  <div className="flex flex-1 items-center gap-3 overflow-hidden">
    {phone number display}
  </div>
</header>
```

Add a theme toggle button after the `flex-1` div (pushing it to the far right):
- `Sun` icon when dark mode is active (click → switch to light)
- `Moon` icon when light mode is active (click → switch to dark)
- `Button variant="ghost" size="icon"` — `size-8`, `text-muted-foreground`

## Files

| Action | File |
|---|---|
| Create | `src/contexts/ThemeContext.tsx` |
| Modify | `src/main.tsx` |
| Modify | `src/pages/DashboardPage.tsx` |
