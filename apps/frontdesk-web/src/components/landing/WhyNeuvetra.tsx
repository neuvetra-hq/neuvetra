import { Container } from "@/components/layout/Container"
import { WHY_NEUVETRA } from "@/contexts/constants/landing"

export function WhyNeuvetra() {
  return (
    <section className="bg-muted py-24 md:py-32">
      <Container>
        <div className="grid gap-16 md:grid-cols-2 md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-primary mb-3">Why Neuvetra</p>
            <h2 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl leading-tight">
              Enterprise AI.<br />Small business price.
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              We believe the AI tools that help Fortune 500 companies grow should be available to
              every local business owner. Neuvetra makes that possible.
            </p>
            <a
              href="/signup"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Get started free →
            </a>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {WHY_NEUVETRA.map((item) => (
              <div key={item.title} className="rounded-2xl border border-border bg-background p-5">
                <h3 className="text-sm font-bold text-foreground">{item.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  )
}
