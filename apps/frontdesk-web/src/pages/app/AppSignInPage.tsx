import { AppPageShell } from "./AppPageShell"

export function AppSignInPage() {
  return (
    <AppPageShell title="Sign In" descriptor="Welcome back">
      <div className="flex items-center justify-center py-12">
        <p
          className="uppercase"
          style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.65rem', letterSpacing: '0.35em' }}
        >
          Coming soon
        </p>
      </div>
    </AppPageShell>
  )
}
