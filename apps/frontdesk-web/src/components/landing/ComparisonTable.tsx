import { Check, X, Minus } from "lucide-react"
import { Container } from "@/components/layout/Container"
import { COMPARISON } from "@/contexts/constants/landing"

const iconFor = (value: string) => {
  if (
    value === "Always" ||
    value === "Every call" ||
    value === "Fully trained by you" ||
    value === "< 10 minutes" ||
    value === "Direct calendar sync"
  )
    return <Check className="mx-auto h-4 w-4 text-emerald-500" />
  if (value === "None")
    return <X className="mx-auto h-4 w-4 text-red-400" />
  if (value === "Partial coverage" || value === "Rarely")
    return <Minus className="mx-auto h-4 w-4 text-amber-400" />
  return null
}

export function ComparisonTable() {
  return (
    <section className="bg-background py-24">
      <Container>
        <div className="mb-12 text-center">
          <span className="mb-3 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            Comparison
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Why Front Desk beats the alternatives
          </h2>
          <p className="mt-4 text-muted-foreground">
            See how we stack up against hiring staff or using a generic answering service.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="bg-muted px-6 py-4 text-left font-medium text-muted-foreground w-1/4" />
                {COMPARISON.columns.map((col) => (
                  <th
                    key={col.name}
                    className={`px-6 py-4 text-center font-semibold ${col.highlight
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                      }`}
                  >
                    {col.highlight && (
                      <span className="mb-1 block text-xs font-normal text-primary-foreground/70">
                        Recommended
                      </span>
                    )}
                    {col.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {COMPARISON.features.map((feature, rowIdx) => (
                <tr key={feature} className="hover:bg-muted/50">
                  <td className="px-6 py-4 font-medium text-foreground">{feature}</td>
                  {COMPARISON.columns.map((col) => {
                    const val = col.values[rowIdx]
                    const icon = iconFor(val)
                    return (
                      <td
                        key={col.name}
                        className={`px-6 py-4 text-center ${col.highlight
                            ? "bg-primary/5 font-medium text-primary"
                            : "text-muted-foreground"
                          }`}
                      >
                        {icon ?? val}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Container>
    </section>
  )
}
