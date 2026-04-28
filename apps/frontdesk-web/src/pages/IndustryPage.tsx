import { useParams, Link } from "react-router"
import { Check, ArrowLeft, ArrowRight } from "lucide-react"
import { Container } from "@/components/layout/Container"
import { CTABanner } from "@/components/landing/CTABanner"
import { Navbar } from "@/components/landing/Navbar"
import { Footer } from "@/components/landing/Footer"
import industriesData from "@/data/industries.json"
import type { Industry } from "@/types/industry"

export function IndustryPage() {
  const { slug } = useParams<{ slug: string }>()
  const industry = (industriesData.industries as Industry[]).find((i) => i.slug === slug)

  if (!industry) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <Container className="py-32 text-center">
          <h1 className="text-3xl font-bold text-foreground">Industry not found</h1>
          <p className="mt-4 text-muted-foreground">
            We couldn't find a page for this industry.
          </p>
          <Link to="/" className="mt-8 inline-flex items-center gap-2 text-primary hover:underline">
            <ArrowLeft className="size-4" />
            Back to home
          </Link>
        </Container>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden bg-foreground py-24 md:py-32">
        {/* Background photo */}
        <img
          src={industry.thumbnail}
          alt={industry.name}
          className="absolute inset-0 h-full w-full object-cover opacity-20"
          onError={(e) => { e.currentTarget.style.display = "none" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground via-foreground/80 to-foreground/60" />

        <Container className="relative">
          <Link
            to="/#industries"
            className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-background/60 hover:text-background transition-colors"
          >
            <ArrowLeft className="size-4" />
            All industries
          </Link>

          <div className="max-w-3xl">
            <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-primary">
              Front Desk for {industry.name}
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-background md:text-5xl lg:text-6xl leading-tight">
              {industry.headline}
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-background/70 md:text-xl max-w-2xl">
              {industry.subheadline}
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link
                to="/signup"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Start your free trial →
              </Link>
              <Link
                to="/#pricing"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-background/20 bg-background/10 px-8 py-3.5 text-sm font-semibold text-background hover:bg-background/20 transition-colors"
              >
                View pricing
              </Link>
            </div>
            <p className="mt-4 text-sm text-background/50">
              7-day free trial · Your card won't be charged until day 8
            </p>
          </div>
        </Container>
      </section>

      {/* Pain points */}
      <section className="bg-muted py-20">
        <Container>
          <div className="mx-auto max-w-3xl">
            <h2 className="text-2xl font-bold text-foreground md:text-3xl">
              The problem with missing calls in {industry.name.toLowerCase()}
            </h2>
            <ul className="mt-8 space-y-4">
              {industry.painPoints.map((point, i) => (
                <li key={i} className="flex items-start gap-4">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 text-xs font-bold">
                    ✕
                  </div>
                  <p className="text-muted-foreground">{point}</p>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      {/* Features */}
      <section className="bg-background py-20">
        <Container>
          <div className="mx-auto max-w-3xl">
            <h2 className="text-2xl font-bold text-foreground md:text-3xl">
              What Front Desk does for {industry.name.toLowerCase()} businesses
            </h2>
            <ul className="mt-8 space-y-4">
              {industry.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-4">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Check className="size-3.5 text-primary" strokeWidth={2.5} />
                  </div>
                  <p className="font-medium text-foreground">{feature}</p>
                </li>
              ))}
            </ul>

            <div className="mt-12 rounded-2xl border border-border bg-muted p-8">
              <p className="text-lg font-semibold text-foreground">
                Ready to stop missing {industry.name.toLowerCase()} calls?
              </p>
              <p className="mt-2 text-muted-foreground">
                Set up takes under 10 minutes. Your AI receptionist answers the first call immediately.
              </p>
              <Link
                to="/signup"
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Get started free
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </Container>
      </section>

      {/* Browse other industries */}
      <section className="bg-muted py-16">
        <Container>
          <h3 className="mb-6 text-center text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Browse other industries
          </h3>
          <div className="flex flex-wrap justify-center gap-2">
            {(industriesData.industries as Industry[])
              .filter((i) => i.slug !== slug)
              .slice(0, 10)
              .map((i) => (
                <Link
                  key={i.id}
                  to={`/industries/${i.slug}`}
                  className="rounded-full border border-border bg-background px-4 py-1.5 text-sm font-medium text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors"
                >
                  {i.name}
                </Link>
              ))}
            <Link
              to="/#industries"
              className="rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
            >
              View all →
            </Link>
          </div>
        </Container>
      </section>

      <CTABanner />
      <Footer />
    </div>
  )
}
