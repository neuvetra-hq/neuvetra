import { Container } from "@/components/layout/Container"
import { HOW_IT_WORKS } from "@/contexts/constants/landing"

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-foreground py-24 md:py-32">
      <Container>
        <div className="mb-16 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-background/50 mb-3">Setup</p>
          <h2 className="text-4xl font-semibold tracking-tight text-background md:text-5xl">
            Live in under 10 minutes.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-background/60">
            No IT team. No hardware. No phone system changes. Just sign up and forward your calls.
          </p>
        </div>

        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-4">
          {HOW_IT_WORKS.map((item) => (
            <div
              key={item.step}
              className="relative rounded-2xl border border-background/20 bg-background/10 p-6"
            >
              <p className="mb-3 text-3xl font-bold text-background/30">{item.step}</p>
              <h3 className="text-sm font-bold text-background">{item.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-background/60">{item.description}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  )
}
