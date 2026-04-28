import { motion } from "framer-motion"
import { AppPageShell } from "./AppPageShell"
import { HOW_IT_WORKS } from "@/contexts/constants/landing"

const BRAND_GREEN_RGB = '61,158,96'

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
      <div
        className="w-full max-w-md md:max-w-2xl mx-auto px-10 py-8"
        style={{
          background: 'rgba(0,0,0,0.18)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          maskImage: 'linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 8%, black 92%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 8%, black 92%, transparent 100%)',
          maskComposite: 'intersect',
          WebkitMaskComposite: 'source-in',
        }}
      >
      <motion.ol
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="flex flex-col w-full"
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
                color: `rgba(${BRAND_GREEN_RGB},${0.45 - index * 0.06})`,
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
                  fontSize: '0.85rem',
                  letterSpacing: '0.18em',
                  fontFamily: "'Jost', sans-serif",
                  fontWeight: 300,
                }}
              >
                {step.title}
              </h3>
              <p
                style={{
                  color: 'rgba(255,255,255,0.42)',
                  fontSize: '0.75rem',
                  lineHeight: '1.75',
                  fontWeight: 300,
                  maxWidth: '38rem',
                }}
              >
                {step.description}
              </p>
              <div
                className="md:whitespace-nowrap flex items-center gap-2"
                style={{
                  color: `rgba(${BRAND_GREEN_RGB},0.75)`,
                  fontSize: '0.65rem',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase' as const,
                  marginTop: '10px',
                }}
              >
                <span style={{
                  display: 'inline-block',
                  width: '7px',
                  height: '7px',
                  background: `rgba(30,90,50,0.95)`,
                  flexShrink: 0,
                }} />
                {step.callout}
              </div>
            </div>
          </motion.li>
        ))}
      </motion.ol>
      </div>
    </AppPageShell>
  )
}
