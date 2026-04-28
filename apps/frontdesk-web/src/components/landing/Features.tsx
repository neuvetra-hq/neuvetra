import { Phone, Brain, CalendarCheck, Globe, FileText, Bell } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Container } from "@/components/layout/Container"
import { FRONT_DESK_FEATURES } from "@/contexts/constants/landing"

const FEATURE_ICONS: LucideIcon[] = [Phone, Brain, CalendarCheck, Globe, FileText, Bell]

export function Features() {
  return (
    <section id="features" className="bg-background py-24 md:py-32">
      <Container>
        <div className="mb-16 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary mb-3">
            Neuvetra Front Desk
          </p>
          <h2 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            Everything your receptionist does.<br />
            <span className="text-muted-foreground">For a fraction of the cost.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Front Desk handles every inbound call with the knowledge, professionalism, and
            availability your business needs.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FRONT_DESK_FEATURES.map((feature, i) => {
            const Icon = FEATURE_ICONS[i]
            return (
              <div
                key={feature.title}
                className="group rounded-2xl border border-border bg-muted p-6 hover:border-primary/20 hover:bg-primary/5 transition-all"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="size-5 text-primary" strokeWidth={2} />
                </div>
                <h3 className="text-base font-bold text-foreground">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            )
          })}
        </div>
      </Container>
    </section>
  )
}
