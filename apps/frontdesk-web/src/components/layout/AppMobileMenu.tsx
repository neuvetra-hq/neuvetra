import { motion } from "framer-motion"
import { NavLink, useLocation } from "react-router"
import { APP_ROUTES } from "@/pages/app/routes"

const SLIDE = {
  initial:    { y: "100vh" },
  animate:    { y: 0 },
  exit:       { y: "100vh" },
  transition: { duration: 0.55, ease: [0.76, 0, 0.24, 1] as const },
}

interface AppMobileMenuProps {
  onClose: () => void
}

export function AppMobileMenu({ onClose }: AppMobileMenuProps) {
  const location = useLocation()

  return (
    <motion.div
      data-testid="mobile-menu"
      initial={SLIDE.initial}
      animate={SLIDE.animate}
      exit={SLIDE.exit}
      transition={SLIDE.transition}
      className="absolute inset-0 z-[150] flex flex-col"
      style={{ background: "#0b0c0d" }}
    >
      <nav className="flex flex-col gap-8 px-10 mt-28">
        {APP_ROUTES.map((route) => {
          const isActive = route.end
            ? location.pathname === route.path
            : location.pathname.startsWith(route.path)
          return (
            <NavLink
              key={route.path}
              to={route.path}
              end={route.end}
              onClick={onClose}
              className="text-[1.1rem] uppercase tracking-[0.25em] w-fit"
              style={{
                color: isActive ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.5)",
                textShadow: isActive
                  ? "0 0 12px rgba(255,255,255,0.7), 0 0 28px rgba(255,255,255,0.3)"
                  : "none",
                transition: "color 0.3s ease, text-shadow 0.3s ease",
              }}
            >
              {route.label}
            </NavLink>
          )
        })}
      </nav>
    </motion.div>
  )
}
