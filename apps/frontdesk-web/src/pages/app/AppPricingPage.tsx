import { useState, useRef, useLayoutEffect } from "react"
import { Link } from "react-router"
import { motion } from "framer-motion"
import { AppPageShell } from "./AppPageShell"
import { PRICING_TIERS } from "@/contexts/constants/landing"

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.15, delayChildren: 0.1 } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" as const } },
}

const fadeVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" as const } },
}

export function AppPricingPage() {
  const [annual, setAnnual] = useState(false)
  const monthlyRef = useRef<HTMLButtonElement>(null)
  const annualRef  = useRef<HTMLButtonElement>(null)
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })

  useLayoutEffect(() => {
    const tab = annual ? annualRef.current : monthlyRef.current
    if (!tab) return
    setIndicator({ left: tab.offsetLeft, width: tab.offsetWidth })
  }, [annual])

  return (
    <AppPageShell title="Pricing" descriptor="From $49 / month · 7-day free trial · Cancel any time">

      {/* Billing toggle */}
      <div className="flex justify-center mb-10">
        <div className="relative inline-flex items-center">
          <button
            type="button"
            ref={monthlyRef}
            onClick={() => setAnnual(false)}
            className={`relative z-10 px-5 py-2.5 text-[11px] font-light tracking-[.18em] uppercase transition-colors cursor-pointer bg-transparent border-0 ${
              !annual ? "text-white/90" : "text-white/30 hover:text-white/55"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            ref={annualRef}
            onClick={() => setAnnual(true)}
            className={`relative z-10 px-5 py-2.5 text-[11px] font-light tracking-[.18em] uppercase transition-colors cursor-pointer bg-transparent border-0 ${
              annual ? "text-white/90" : "text-white/30 hover:text-white/55"
            }`}
          >
            Annual
            <span className="relative ml-0.5 -top-1.5 text-[9px] font-extralight tracking-[.06em] text-violet-400">
              −20%
            </span>
          </button>
          <div
            className="absolute top-0 bottom-0 pointer-events-none border-b border-violet-500/35 bg-white/[0.015]"
            style={{
              left: indicator.left,
              width: indicator.width,
              transition: "left 250ms cubic-bezier(0.4,0,0.2,1), width 250ms cubic-bezier(0.4,0,0.2,1)",
            }}
          />
        </div>
      </div>

      {/* Cards */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid gap-4 grid-cols-1 md:grid-cols-3 items-stretch max-w-4xl mx-auto"
      >
        {PRICING_TIERS.map((tier) => {
          const price = annual ? tier.annualPrice : tier.monthlyPrice
          const overageCents = Math.round(parseFloat(tier.overageRate) * 100)

          return (
            <motion.div
              key={tier.name}
              variants={cardVariants}
              className={`plan-card relative flex flex-col p-7 ${
                tier.popular
                  ? "order-first md:order-none bg-violet-500/[0.06] backdrop-blur-xl"
                  : "bg-white/[0.01] backdrop-blur-xl"
              }`}
            >
              <p className={`text-[11px] font-semibold tracking-[.14em] uppercase mb-5 ${
                tier.popular ? "text-violet-200/70" : "text-white/45"
              }`}>
                {tier.name}
              </p>

              <div className="flex items-baseline gap-1 mb-6">
                <span className={`text-base font-light self-start mt-2 ${
                  tier.popular ? "text-violet-200/45" : "text-white/40"
                }`}>$</span>
                <span className="text-[52px] font-light tracking-tight text-white leading-none">
                  {price}
                </span>
                <span className={`text-xs font-light self-end pb-1.5 ${
                  tier.popular ? "text-violet-200/30" : "text-white/30"
                }`}>/month</span>
              </div>

              <div className={`h-px mb-5 ${tier.popular ? "bg-violet-500/12" : "bg-white/7"}`} />

              <ul className="flex flex-col gap-2.5 flex-1">
                {tier.features.map((feature) => (
                  <li key={feature} className={`text-xs leading-snug pl-3 relative ${
                    tier.popular ? "text-white/55" : "text-white/45"
                  }`}>
                    <span className={`absolute left-0 top-0.5 text-[9px] ${
                      tier.popular ? "text-violet-400/40" : "text-white/18"
                    }`}>—</span>
                    {feature}
                  </li>
                ))}
              </ul>

              <p className={`text-[10px] mt-4 ${
                tier.popular ? "text-violet-200/20" : "text-white/20"
              }`}>
                Overage: {overageCents}¢ / min after {tier.minutes.toLocaleString()} min
              </p>

              <div className={`mt-5 pt-4 border-t ${
                tier.popular ? "border-violet-500/10" : "border-white/5"
              }`}>
                <p className={`text-[9px] font-semibold tracking-[.14em] uppercase mb-1.5 ${
                  tier.popular ? "text-violet-200/20" : "text-white/20"
                }`}>Good for</p>
                <p className={`text-[11px] leading-relaxed ${
                  tier.popular ? "text-violet-200/35" : "text-white/35"
                }`}>
                  {tier.goodFor}
                </p>
              </div>
            </motion.div>
          )
        })}
      </motion.div>

      {/* Enterprise bar */}
      <motion.div
        variants={fadeVariants}
        initial="hidden"
        animate="show"
        transition={{ delay: 0.55 }}
        className="mt-4 flex flex-col gap-4 bg-white/[0.01] px-8 py-5 max-w-4xl mx-auto md:flex-row md:items-center md:justify-between"
      >
        <div>
          <p className="text-[10px] font-semibold tracking-[.14em] uppercase text-white/30 mb-1">
            Enterprise
          </p>
          <p className="text-[15px] font-normal text-white/70">
            Replacing a call center? Let's build something custom.
          </p>
          <p className="text-xs text-white/30 mt-0.5">
            Custom minutes, dedicated infrastructure, white-glove onboarding.
          </p>
        </div>
        <a
          href="mailto:hello@neuvetra.com"
          className="shrink-0 px-5 py-2.5 text-[11px] font-light tracking-[.18em] uppercase text-violet-300/70 bg-white/[0.02] backdrop-blur-md hover:text-violet-200 hover:bg-white/[0.04] transition-colors"
        >
          Contact us
        </a>
      </motion.div>

      {/* CTA */}
      <motion.div
        variants={fadeVariants}
        initial="hidden"
        animate="show"
        transition={{ delay: 0.7 }}
        className="mt-10 flex justify-center"
      >
        <Link
          to="/app/get-started"
          className="px-8 py-3.5 text-[11px] font-light tracking-[.18em] uppercase text-violet-200 bg-violet-500/15 border border-violet-500/35 hover:bg-violet-500/20 transition-colors"
        >
          Start free trial
        </Link>
      </motion.div>

    </AppPageShell>
  )
}
