import { useAppMachine } from "@/pages/app/hooks/useAppMachine"

export function AppHomePage() {
  const themeLight = useAppMachine((s) => s.context.currentTheme.light)

  return (
    <div className="relative flex h-full flex-col items-center justify-center px-8 select-none">
      <div className="flex flex-col items-center text-center">
        <h1
          className="uppercase leading-none"
          style={{ color: themeLight, transition: 'color 1400ms ease', fontSize: 'clamp(1.8rem, 7vw, 9rem)', letterSpacing: '0.12em', fontFamily: "'Jost', sans-serif", fontWeight: 200 }}
        >
          Front Desk
        </h1>
        <p
          className="mt-5 uppercase text-white/50"
          style={{ fontSize: 'clamp(0.65rem, 2vw, 1rem)', letterSpacing: '0.5em' }}
        >
          AI Receptionist &nbsp;·&nbsp; By Neuvetra
        </p>
      </div>
    </div>
  )
}
