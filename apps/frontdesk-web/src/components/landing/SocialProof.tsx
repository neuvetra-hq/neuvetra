import { Star } from "lucide-react"
import { Container } from "@/components/layout/Container"

const INDUSTRIES = ["Dental", "Legal", "MedSpa", "Home Services", "Real Estate"]

export function SocialProof() {
  return (
    <section id="social-proof" className="border-y border-border bg-muted py-4">
      <Container>
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Trusted by</span>
            {INDUSTRIES.map((industry) => (
              <span
                key={industry}
                className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-foreground"
              >
                {industry}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="size-3.5 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <span className="text-sm font-medium text-muted-foreground">Rated 5.0 by our customers</span>
          </div>
        </div>
      </Container>
    </section>
  )
}
