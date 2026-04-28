"use client"

import { useState } from "react"
import { Container } from "@/components/layout/Container"
import { HoverEffect } from "@/components/ui/card-hover-effect"
import industriesData from "@/data/industries.json"

const CATEGORY_GRADIENTS: Record<string, string> = {
  "home-services":   "from-blue-900 to-blue-700",
  "healthcare":      "from-teal-900 to-teal-700",
  "beauty-wellness": "from-purple-900 to-purple-700",
  "professional":    "from-slate-900 to-slate-700",
  "automotive":      "from-orange-900 to-orange-700",
}

const CATEGORY_LABELS: Record<string, string> = {
  "home-services":   "Home Services",
  "healthcare":      "Healthcare",
  "beauty-wellness": "Beauty",
  "professional":    "Professional",
  "automotive":      "Automotive",
}

export function Industries() {
  const [activeCategory, setActiveCategory] = useState("all")

  const filtered = (activeCategory === "all"
    ? industriesData.industries
    : industriesData.industries.filter((i) => i.category === activeCategory)
  ).map((industry) => ({
    title:       industry.name,
    description: industry.painHook,
    link:        `/industries/${industry.slug}`,
    category:    CATEGORY_LABELS[industry.category],
    thumbnail:   industry.thumbnail,
    gradient:    CATEGORY_GRADIENTS[industry.category],
  }))

  return (
    <section id="industries" className="bg-background py-24 md:py-32">
      <Container>
        <div className="mb-12 text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary">
            Industries
          </p>
          <h2 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            Built for your industry.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            If your phone rings and missing it costs you a customer, Front Desk is for you.
          </p>
        </div>

        {/* Category filter tabs */}
        <div className="mb-8 flex flex-wrap justify-center gap-2">
          {industriesData.categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-all ${
                activeCategory === cat.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "border border-border bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <HoverEffect items={filtered} />

        <p className="mt-10 text-center text-sm text-muted-foreground">
          Don't see your industry?{" "}
          <a href="mailto:hello@neuvetra.com" className="text-primary hover:underline">
            Contact us
          </a>{" "}
          — if your phone rings and missing it costs money, we can help.
        </p>
      </Container>
    </section>
  )
}
