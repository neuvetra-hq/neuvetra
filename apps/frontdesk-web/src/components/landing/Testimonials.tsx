import { Container } from "@/components/layout/Container"
import { AnimatedTestimonials } from "@/components/ui/animated-testimonials"
import { TESTIMONIALS } from "@/contexts/constants/landing"

export function Testimonials() {
  return (
    <section className="bg-background py-24 md:py-32">
      <Container>
        <div className="mb-16 text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary">
            Customer Stories
          </p>
          <h2 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            Real businesses. Real results.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            From dental offices to plumbers — here's what Neuvetra customers are saying.
          </p>
        </div>

        <AnimatedTestimonials testimonials={TESTIMONIALS} autoplay />
      </Container>
    </section>
  )
}
