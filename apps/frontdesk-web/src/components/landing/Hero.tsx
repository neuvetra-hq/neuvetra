import { buttonVariants } from "@/components/ui/button"
import { Container } from "@/components/layout/Container"
import { HERO, STATS } from "@/contexts/constants/landing"

function CallVisual() {
  return (
    <div className="hidden lg:flex lg:items-center lg:justify-center">
      <div className="relative">
        <div className="w-56 rounded-[2.5rem] bg-zinc-900 p-3 shadow-2xl ring-1 ring-white/10">
          <div className="overflow-hidden rounded-[2rem] bg-zinc-800">
            <div className="flex items-center justify-between px-5 pt-4 pb-1">
              <span className="text-[10px] font-semibold text-zinc-400">9:41</span>
              <span className="text-[10px] text-zinc-400">●●●</span>
            </div>

            <div className="flex flex-col items-center px-5 pt-3 pb-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400">
                Active call
              </p>
              <p className="mt-1 text-sm font-bold text-white">(555) 123-4567</p>
              <p className="text-[10px] text-zinc-400">0:42</p>

              <div className="mt-3 flex items-end gap-0.5" style={{ height: 24 }}>
                {[3, 7, 5, 10, 6, 14, 8, 5, 12, 7, 4, 9, 6, 11, 5].map((h, i) => (
                  <div
                    key={i}
                    className="w-1 rounded-full bg-emerald-400"
                    style={{
                      height: h,
                      animation: `wave ${0.6 + i * 0.07}s ease-in-out infinite alternate`,
                      animationDelay: `${i * 0.05}s`,
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2 px-4 pb-4">
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-blue-600 px-3 py-2">
                  <p className="text-[10px] text-white">Hi, I'd like to book a cleaning</p>
                </div>
              </div>
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-zinc-700 px-3 py-2">
                  <p className="text-[10px] text-zinc-100">I have Tuesday 2pm or Thursday 10am — which works?</p>
                </div>
              </div>
              <div className="flex justify-end">
                <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-blue-600 px-3 py-2">
                  <p className="text-[10px] text-white">Thursday at 10 please</p>
                </div>
              </div>
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-zinc-700 px-3 py-2">
                  <p className="text-[10px] text-zinc-100">Done! Booked for Thursday. See you then ✓</p>
                </div>
              </div>
            </div>

            <div className="mx-4 mb-4 flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 py-3">
              <p className="text-center text-[9px] leading-relaxed text-zinc-500">
                ▶ AI demo video<br />coming soon
              </p>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute -inset-4 rounded-[3rem] bg-primary/5 blur-2xl" />
      </div>

      <style>{`
        @keyframes wave {
          from { transform: scaleY(0.4); }
          to { transform: scaleY(1); }
        }
      `}</style>
    </div>
  )
}

export function Hero() {
  const headlineLines = HERO.headline.split("\n")

  return (
    <section className="relative overflow-hidden bg-background py-24 md:py-36">
      {/* Subtle grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />
      {/* Accent blobs */}
      <div className="pointer-events-none absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-primary/5 blur-3xl" />

      <Container className="relative">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Left — copy */}
          <div>
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-muted px-4 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {HERO.badge}
              </span>
            </div>

            <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl leading-[1.1]">
              {headlineLines.map((line, i) => (
                <span
                  key={i}
                  className={`block ${i === headlineLines.length - 1 ? "text-primary text-3xl md:text-4xl" : ""}`}
                >
                  {line}
                </span>
              ))}
            </h1>

            <p className="mt-8 max-w-lg text-lg leading-relaxed text-muted-foreground md:text-xl">
              {HERO.subheadline}
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <a
                href="/signup"
                className={
                  buttonVariants({ size: "lg" }) +
                  " bg-primary text-primary-foreground hover:bg-primary/90 px-8 rounded-full"
                }
              >
                {HERO.primaryCTA}
              </a>
              <a
                href="#how-it-works"
                className={
                  buttonVariants({ size: "lg", variant: "outline" }) +
                  " border-border text-foreground hover:bg-muted px-8 rounded-full"
                }
              >
                {HERO.secondaryCTA}
              </a>
            </div>

            <p className="mt-6 text-sm text-muted-foreground">{HERO.trust}</p>
          </div>

          {/* Right — voice call mockup */}
          <CallVisual />
        </div>

        {/* Stats bar */}
        <div className="mx-auto mt-20 grid max-w-2xl grid-cols-3 divide-x divide-border rounded-2xl border border-border bg-muted shadow-sm">
          {STATS.map(({ value, label }) => (
            <div key={label} className="px-6 py-6 text-center">
              <p className="text-3xl font-bold text-foreground">{value}</p>
              <p className="mt-1 text-xs font-medium text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  )
}
