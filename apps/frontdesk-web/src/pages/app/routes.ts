export const APP_ROUTES = [
  { path: "/app",              label: "Home",         preset: "default",    theme: "blue",   end: true  },
  { path: "/app/how-it-works", label: "How It Works", preset: "howItWorks", theme: "green",  end: false },
  { path: "/app/pricing",      label: "Pricing",      preset: "pricing",    theme: "purple", end: false },
  { path: "/app/get-started",  label: "Get Started",  preset: "getStarted", theme: "amber",  end: false },
  { path: "/app/sign-in",      label: "Sign In",      preset: "signIn",     theme: "teal",   end: false },
] as const

export type AppRouteDef = (typeof APP_ROUTES)[number]

export const ROUTE_BY_PATH = Object.fromEntries(
  APP_ROUTES.map((r) => [r.path, r])
) as Record<string, AppRouteDef>
