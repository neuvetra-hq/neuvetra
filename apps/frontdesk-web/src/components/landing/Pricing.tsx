"use client"

import { useState } from "react"
import { Container } from "@/components/layout/Container"
import { PRICING_TIERS } from "@/contexts/constants/landing"
import { Check } from "lucide-react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

export function Pricing() {
  const [annual, setAnnual] = useState(false)

  return (
    <section id="pricing" className="bg-muted py-24 md:py-32">
      <Container>
        <div className="mb-12 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary mb-3">Pricing</p>
          <h2 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            Simple, transparent pricing.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Start free for 7 days. Your card won't be charged until day 8. Cancel any time.
          </p>

          <div className="mt-8">
            <ToggleGroup
              value={[annual ? "annual" : "monthly"]}
              onValueChange={(v) => { if (v[0]) setAnnual(v[0] === "annual") }}
              spacing={1}
              className="rounded-xl border border-border bg-background p-1"
            >
              <ToggleGroupItem value="monthly" className="rounded-lg px-4 py-2 text-sm font-semibold">
                Monthly
              </ToggleGroupItem>
              <ToggleGroupItem value="annual" className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold">
                Annual
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                  Save 20%
                </span>
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {PRICING_TIERS.map((tier) => {
            const price = annual ? tier.annualPrice : tier.monthlyPrice

            return (
              <div
                key={tier.name}
                className={`relative flex flex-col rounded-2xl border p-8 transition-all ${tier.popular
                    ? "border-primary bg-background shadow-lg shadow-primary/10 ring-1 ring-primary"
                    : "border-border bg-background shadow-sm"
                  }`}
              >
                {tier.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-primary px-4 py-1 text-xs font-semibold text-primary-foreground shadow">
                      Most Popular
                    </span>
                  </div>
                )}

                <h3 className="text-lg font-bold text-foreground">{tier.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{tier.description}</p>

                <div className="mt-6 flex items-end gap-1">
                  <span className="text-5xl font-bold tracking-tight text-foreground">${price}</span>
                  <span className="mb-1.5 text-sm text-muted-foreground">/mo</span>
                </div>
                {annual && (
                  <p className="mt-1 text-xs text-emerald-600 font-medium">
                    Billed ${tier.annualPrice * 12}/year · save ${(tier.monthlyPrice - tier.annualPrice) * 12}/yr
                  </p>
                )}

                <a
                  href="/signup"
                  className={`mt-6 inline-flex w-full items-center justify-center rounded-full px-4 py-3 text-sm font-semibold transition-colors ${tier.popular
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "border border-primary text-primary hover:bg-primary/5"
                    }`}
                >
                  Start free trial →
                </a>

                <p className="mt-2 text-center text-xs text-muted-foreground">
                  7-day free trial · Not charged until day 8
                </p>

                <div className="my-6 border-t border-border" />

                <ul className="space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={2.5} />
                      {feature}
                    </li>
                  ))}
                </ul>

                <p className="mt-6 text-xs text-muted-foreground">
                  Overage: <span className="font-medium text-foreground">${tier.overageRate}/min</span>{" "}
                  after {tier.minutes} min · capped at your limit by default
                </p>
              </div>
            )
          })}
        </div>

        <p className="mt-10 text-center text-sm text-muted-foreground">
          All plans include 1 dedicated local phone number, call transcripts, SMS alerts, and full
          dashboard access.
          <br />
          Need more?{" "}
          <a href="mailto:hello@neuvetra.com" className="text-primary hover:underline">
            Contact us
          </a>{" "}
          for custom volume pricing.
        </p>
      </Container>
    </section>
  )
}
