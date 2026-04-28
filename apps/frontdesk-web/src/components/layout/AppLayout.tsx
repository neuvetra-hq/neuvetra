import { useEffect, useState, useRef } from "react"
import { NavLink, useLocation, useOutlet } from "react-router"
import { AnimatePresence, motion, useIsPresent } from "framer-motion"
import { Menu, X } from "lucide-react"
import { useAppMachine, useAppSend } from "@/pages/app/hooks/useAppMachine"
import { useSpiritMachine, useSpiritSend } from "@/hooks/useSpiritMachine"
import { APP_ROUTES } from "@/pages/app/routes"
import { AUDIO } from "@/data/spirit-presets"
import { AppSpiritProvider } from "./AppSpiritProvider"
import { AppMobileMenu } from "./AppMobileMenu"
import { RouteTransitionProvider, useRouteTransition } from "@/contexts/RouteTransitionContext"

const BAR_DELAYS = ["0s", "0.2s", "0.4s", "0.2s"]

export const ROUTE_TRANSITION_MS = 550

const SLIDE = {
  initial:    { y: "100vh" },
  animate:    { y: 0 },
  exit:       { y: "100vh" },
  transition: { duration: ROUTE_TRANSITION_MS / 1000, ease: [0.76, 0, 0.24, 1] as const },
}

function FrozenRoute({ children }: { children: React.ReactNode }) {
  const frozen = useRef(children)
  return <>{frozen.current}</>
}

function RouteSlide({ children }: { children: React.ReactNode }) {
  const isPresent = useIsPresent()
  const { notifyComplete, reset } = useRouteTransition()

  return (
    <motion.div
      initial={SLIDE.initial}
      animate={SLIDE.animate}
      exit={SLIDE.exit}
      transition={SLIDE.transition}
      onAnimationStart={reset}
      onAnimationComplete={() => { if (isPresent) notifyComplete() }}
      className="absolute inset-0 z-10 overflow-y-auto"
    >
      {children}
    </motion.div>
  )
}

function AnimatedOutlet() {
  const location = useLocation()
  const outlet = useOutlet()

  return (
    <AnimatePresence mode="wait">
      <RouteSlide key={location.pathname}>
        <FrozenRoute>{outlet}</FrozenRoute>
      </RouteSlide>
    </AnimatePresence>
  )
}

function NavItem({ label, href, end }: { label: string; href: string; end?: boolean }) {
  const [hovered, setHovered] = useState(false)
  const sendSpirit = useSpiritSend()
  return (
    <NavLink
      to={href}
      end={end}
      onMouseEnter={() => { setHovered(true);  sendSpirit({ type: "PLAY_SFX", name: AUDIO.hover, rate: AUDIO.hoverInRate, volume: AUDIO.hoverVolume }) }}
      onMouseLeave={() => { setHovered(false) }}
      className="text-[0.8rem] uppercase tracking-[0.2em]"
      style={({ isActive }) => ({
        color: isActive
          ? "rgba(255,255,255,0.95)"
          : hovered
            ? "rgba(255,255,255,0.85)"
            : "rgba(255,255,255,0.6)",
        textShadow: isActive
          ? "0 0 12px rgba(255,255,255,0.7), 0 0 28px rgba(255,255,255,0.3)"
          : hovered
            ? "0 0 10px rgba(255,255,255,0.45)"
            : "none",
        transition: "color 0.3s ease, text-shadow 0.3s ease",
      })}
    >
      {label}
    </NavLink>
  )
}

function AppLoaderOverlay() {
  const isLoading = useAppMachine((s) => s.matches({ view: "loading" }))
  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          data-testid="app-loader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="absolute inset-0 z-[200] flex items-center justify-center"
          style={{ background: "#0b0c0d" }}
        >
          <span
            className="text-[0.6rem] uppercase tracking-[0.3em]"
            style={{ color: "rgba(255,255,255,0.2)" }}
          >
            Loading
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function MuteButton() {
  const sendSpirit    = useSpiritSend()
  const audioUnlocked = useSpiritMachine((s) => !s.matches({ audio: "locked" }))
  const isMuted       = useSpiritMachine((s) => s.matches({ audio: { unlocked: "muted" } }))
  const barsActive    = audioUnlocked && !isMuted

  // On mobile: always visible — tapping while locked unlocks + starts audio.
  // On desktop: hidden until first interaction (opacity-0 pointer-events-none).
  const className = audioUnlocked
    ? "opacity-40 hover:opacity-90"
    : "opacity-20 md:opacity-0 md:pointer-events-none"

  return (
    <button
      onClick={() => sendSpirit({ type: audioUnlocked ? "TOGGLE_MUTE" : "USER_INTERACTED" })}
      aria-label={audioUnlocked ? (isMuted ? "Unmute" : "Mute") : "Enable sound"}
      className={`flex items-end gap-[3px] h-5 transition-opacity duration-500 cursor-pointer ${className}`}
    >
      {BAR_DELAYS.map((delay, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-white"
          style={{
            height: barsActive ? "4px" : "3px",
            animationName: barsActive ? "soundbar" : "none",
            animationDuration: "0.8s",
            animationTimingFunction: "ease-in-out",
            animationIterationCount: "infinite",
            animationDelay: delay,
          }}
        />
      ))}
    </button>
  )
}

function AppLayoutInner() {
  const location = useLocation()
  const sendApp  = useAppSend()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  useEffect(() => {
    sendApp({ type: "ROUTE_CHANGED", pathname: location.pathname })
  }, [location.pathname, sendApp])

  useEffect(() => {
    setIsMenuOpen(false)
  }, [location.pathname])

  return (
    <>
      <style>{`
        @keyframes soundbar {
          0%, 100% { height: 4px; }
          50% { height: 16px; }
        }
      `}</style>

      {/* Desktop: mute button top-right */}
      <div className="absolute top-9 right-10 z-[160] hidden md:block">
        <MuteButton />
      </div>

      {/* Mobile: mute + hamburger together, top-right */}
      <div
        className="absolute right-8 z-[160] flex items-center gap-5 md:hidden"
        style={{ top: "max(2rem, env(safe-area-inset-top, 2rem))" }}
      >
        <MuteButton />
        <button
          data-testid="hamburger-button"
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
          onClick={() => setIsMenuOpen((v) => !v)}
          className="flex items-center justify-center size-11 -mr-1"
          style={{ color: "rgba(255,255,255,0.6)" }}
        >
          {isMenuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* Desktop bottom nav */}
      <nav
        className="absolute left-0 right-0 z-50 hidden md:flex flex-wrap items-center justify-center gap-x-14 gap-y-3 select-none"
        style={{ bottom: "max(2.5rem, env(safe-area-inset-bottom, 2.5rem))" }}
      >
        {APP_ROUTES.map((route) => (
          <NavItem key={route.path} label={route.label} href={route.path} end={route.end} />
        ))}
      </nav>

      {/* Mobile menu overlay */}
      <AnimatePresence>
        {isMenuOpen && <AppMobileMenu onClose={() => setIsMenuOpen(false)} />}
      </AnimatePresence>

      <AnimatedOutlet />
    </>
  )
}

export function AppLayout() {
  const containerRef = useRef<HTMLDivElement>(null)
  return (
    <AppSpiritProvider containerRef={containerRef}>
      <RouteTransitionProvider>
        <div
          className="relative w-screen h-[100dvh] overflow-hidden"
          style={{ background: "radial-gradient(circle at 3% 5%, #253239 0%, #0b0c0d 50%)" }}
        >
          <div ref={containerRef} className="absolute inset-0" />
          <AppLayoutInner />
          <AppLoaderOverlay />
        </div>
      </RouteTransitionProvider>
    </AppSpiritProvider>
  )
}
