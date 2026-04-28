import { Link } from "react-router"
import { Container } from "@/components/layout/Container"
import { CTA_BANNER } from "@/contexts/constants/landing"

export function CTABanner() {
  return (
    <section className="relative overflow-hidden bg-primary py-24 md:py-32">
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary-foreground/5 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-primary-foreground/5 blur-3xl" />

      <Container className="relative text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary-foreground/70 mb-4">
          Get Started
        </p>
        <h2 className="text-4xl font-semibold tracking-tight text-primary-foreground md:text-5xl">
          {CTA_BANNER.headline}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-primary-foreground/70">
          {CTA_BANNER.subheadline}
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            to="/signup"
            className="inline-flex w-full items-center justify-center rounded-full bg-background px-8 py-3.5 text-sm font-bold text-primary hover:bg-muted transition-colors sm:w-auto"
          >
            {CTA_BANNER.primaryCTA} →
          </Link>
        </div>
        <p className="mt-6 text-sm text-primary-foreground/60">
          Your card won't be charged for 7 days · Cancel anytime · Setup in minutes
        </p>
      </Container>
    </section>
  )
}
