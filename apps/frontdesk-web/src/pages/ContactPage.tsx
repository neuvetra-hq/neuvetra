import { useState } from "react"
import { Link } from "react-router"
import { Navbar } from "@/components/landing/Navbar"
import { Footer } from "@/components/landing/Footer"
import { Container } from "@/components/layout/Container"
import { Mail, MessageSquare, Zap, Building2, CheckCircle2 } from "lucide-react"

const REASONS = [
  { icon: Zap, label: "Product questions", desc: "Wondering if Front Desk is right for your business" },
  { icon: Building2, label: "Your industry", desc: "Don't see your industry listed — we want to hear about it" },
  { icon: MessageSquare, label: "Partnership", desc: "Integrations, referrals, or reseller programs" },
  { icon: Mail, label: "Anything else", desc: "We read every message and reply within one business day" },
]

export function ContactPage() {
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: "", email: "", company: "", subject: "", message: "" })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    // Small artificial delay for UX feel, then open mailto with pre-filled content
    await new Promise((r) => setTimeout(r, 600))
    const body = encodeURIComponent(
      `Name: ${form.name}\nCompany: ${form.company || "—"}\n\n${form.message}`
    )
    const subject = encodeURIComponent(form.subject || `Contact from ${form.name}`)
    window.location.href = `mailto:support@neuvetra.com?subject=${subject}&body=${body}&from=${encodeURIComponent(form.email)}`
    setLoading(false)
    setSubmitted(true)
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="border-b border-border py-16 md:py-20">
        <Container>
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary">Contact</p>
          <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            We'd love to hear from you.
          </h1>
          <p className="mt-4 max-w-lg text-lg text-muted-foreground">
            Whether you have a question about Front Desk, want to talk about your industry, or just want to say hello — we're here.
          </p>
        </Container>
      </section>

      {/* Main content */}
      <section className="py-16 md:py-24">
        <Container>
          <div className="grid gap-16 lg:grid-cols-2">

            {/* Left — reasons to reach out */}
            <div>
              <h2 className="mb-8 text-xl font-semibold text-foreground">What can we help with?</h2>
              <ul className="space-y-6">
                {REASONS.map(({ icon: Icon, label, desc }) => (
                  <li key={label} className="flex items-start gap-4">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted">
                      <Icon className="size-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{label}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{desc}</p>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-12 rounded-2xl border border-border bg-muted p-6">
                <p className="text-sm font-semibold text-foreground">Direct email</p>
                <a
                  href="mailto:support@neuvetra.com"
                  className="mt-1 block text-sm text-primary hover:underline"
                >
                  support@neuvetra.com
                </a>
                <p className="mt-3 text-xs text-muted-foreground">
                  We reply to every message within one business day.
                </p>
              </div>
            </div>

            {/* Right — form */}
            <div>
              {submitted ? (
                <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-border bg-muted px-8 py-16 text-center">
                  <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
                    <CheckCircle2 className="size-7 text-primary" />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold text-foreground">Your email client should open</h3>
                  <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                    If it didn't open automatically, email us directly at{" "}
                    <a href="mailto:support@neuvetra.com" className="text-primary hover:underline">
                      support@neuvetra.com
                    </a>
                    . We reply within one business day.
                  </p>
                  <button
                    onClick={() => { setSubmitted(false); setForm({ name: "", email: "", company: "", subject: "", message: "" }) }}
                    className="mt-8 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    ← Send another message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-foreground">
                        Name <span className="text-primary">*</span>
                      </label>
                      <input
                        id="name"
                        name="name"
                        type="text"
                        required
                        value={form.name}
                        onChange={handleChange}
                        placeholder="Jane Smith"
                        className="w-full rounded-xl border border-border bg-muted px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-primary"
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-foreground">
                        Email <span className="text-primary">*</span>
                      </label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        required
                        value={form.email}
                        onChange={handleChange}
                        placeholder="jane@example.com"
                        className="w-full rounded-xl border border-border bg-muted px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-primary"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="company" className="mb-1.5 block text-sm font-medium text-foreground">
                      Business <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                    </label>
                    <input
                      id="company"
                      name="company"
                      type="text"
                      value={form.company}
                      onChange={handleChange}
                      placeholder="Acme Plumbing"
                      className="w-full rounded-xl border border-border bg-muted px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-primary"
                    />
                  </div>

                  <div>
                    <label htmlFor="subject" className="mb-1.5 block text-sm font-medium text-foreground">
                      Subject <span className="text-primary">*</span>
                    </label>
                    <select
                      id="subject"
                      name="subject"
                      required
                      value={form.subject}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-border bg-muted px-4 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary"
                    >
                      <option value="" disabled>Select a topic…</option>
                      <option value="Product question">Product question</option>
                      <option value="My industry isn't listed">My industry isn't listed</option>
                      <option value="Partnership inquiry">Partnership inquiry</option>
                      <option value="Pricing question">Pricing question</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="message" className="mb-1.5 block text-sm font-medium text-foreground">
                      Message <span className="text-primary">*</span>
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      required
                      rows={5}
                      value={form.message}
                      onChange={handleChange}
                      placeholder="Tell us what's on your mind…"
                      className="w-full resize-none rounded-xl border border-border bg-muted px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-primary"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex w-full items-center justify-center rounded-full bg-primary px-8 py-3 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    {loading ? "Opening email…" : "Send message →"}
                  </button>

                  <p className="text-center text-xs text-muted-foreground">
                    This opens your email client with the form pre-filled.{" "}
                    <a href="mailto:support@neuvetra.com" className="text-primary hover:underline">
                      Email us directly
                    </a>{" "}
                    if that doesn't work.
                  </p>
                </form>
              )}
            </div>
          </div>
        </Container>
      </section>

      {/* CTA strip */}
      <section className="border-t border-border py-12">
        <Container className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <p className="font-semibold text-foreground">Ready to try Front Desk?</p>
            <p className="mt-0.5 text-sm text-muted-foreground">Set up in minutes. No credit card for 7 days.</p>
          </div>
          <Link
            to="/signup"
            className="inline-flex shrink-0 items-center justify-center rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Get started free →
          </Link>
        </Container>
      </section>

      <Footer />
    </div>
  )
}
