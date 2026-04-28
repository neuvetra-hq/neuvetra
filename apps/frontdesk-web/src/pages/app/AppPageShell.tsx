// apps/web/src/pages/app/AppPageShell.tsx
import { useAppMachine } from "@/pages/app/hooks/useAppMachine"

interface AppPageShellProps {
  title: string
  descriptor: string
  children?: React.ReactNode
}

export function AppPageShell({ title, descriptor, children }: AppPageShellProps) {
  const themeLight = useAppMachine((s) => s.context.currentTheme.light)

  return (
    <div className="min-h-full flex flex-col pb-32 select-none">
      {/* Ghost title — upper zone, clears top controls (mute button / hamburger) */}
      <div className="pt-20 md:pt-16 text-center px-8">
        <h1
          className="uppercase leading-none pointer-events-none"
          style={{
            color: themeLight,
            transition: 'color 1400ms ease',
            fontSize: 'clamp(2.5rem, 8vw, 7rem)',
            letterSpacing: '0.12em',
            fontFamily: "'Jost', sans-serif",
            fontWeight: 200,
          }}
        >
          {title}
        </h1>
        <p
          className="mt-4 uppercase"
          style={{
            color: 'rgba(255, 255, 255, 0.85)',
            fontSize: '1rem',
            fontWeight: 500,
            letterSpacing: '0.06em',
            fontFamily: "'Jost', sans-serif",
          }}
        >
          {descriptor}
        </p>
      </div>

      {/* Content area — grows below the header */}
      {children && (
        <div className="mt-12 flex-1 px-8">
          {children}
        </div>
      )}
    </div>
  )
}
