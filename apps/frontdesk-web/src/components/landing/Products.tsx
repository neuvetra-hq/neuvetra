import { Container } from "@/components/layout/Container"
import { PRODUCTS } from "@/contexts/constants/landing"
import { Button } from "@/components/ui/button"

const colorMap: Record<string, { bg: string; text: string; badge: string }> = {
  indigo: { bg: "bg-indigo-50", text: "text-indigo-700", badge: "bg-indigo-100 text-indigo-700" },
  violet: { bg: "bg-violet-50", text: "text-violet-700", badge: "bg-violet-100 text-violet-700" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-700", badge: "bg-emerald-100 text-emerald-700" },
  amber: { bg: "bg-amber-50", text: "text-amber-700", badge: "bg-amber-100 text-amber-700" },
}

export function Products() {
  return (
    <section id="products" className="bg-neutral-50 py-24 md:py-32">
      <Container>
        <div className="mb-16 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600 mb-3">Our Products</p>
          <h2 className="text-4xl font-semibold tracking-tight text-neutral-900 md:text-5xl">
            The Neuvetra Suite
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-neutral-500">
            A growing family of AI products, each purpose-built for a specific job. Start with one, expand as you grow.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {PRODUCTS.map((product) => {
            const colors = colorMap[product.color]
            return (
              <div
                key={product.name}
                className={`relative flex flex-col rounded-2xl border p-6 transition-all ${product.available
                    ? "border-neutral-200 bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5"
                    : "border-neutral-100 bg-white/60 opacity-75"
                  }`}
              >
                {/* Icon */}
                <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${colors.bg}`}>
                  {product.icon}
                </div>

                {/* Tag */}
                <span className={`mb-3 inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${colors.badge}`}>
                  {product.tag}
                </span>

                {/* Name */}
                <h3 className="text-base font-bold text-neutral-900 leading-snug">{product.name}</h3>

                {/* Description */}
                <p className="mt-2 flex-1 text-sm leading-relaxed text-neutral-500">{product.description}</p>

                {/* CTA */}
                <div className="mt-6">
                  {product.available ? (
                    <a
                      href={product.href}
                      className="inline-flex w-full items-center justify-center rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-700 transition-colors"
                    >
                      {product.cta} →
                    </a>
                  ) : (
                    <Button
                      disabled
                      variant="outline"
                      className="w-full rounded-xl border-neutral-200 text-neutral-400"
                    >
                      {product.cta}
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Container>
    </section>
  )
}
