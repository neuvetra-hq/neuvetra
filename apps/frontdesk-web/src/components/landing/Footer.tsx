import { Link } from "react-router"
import { Container } from "@/components/layout/Container"
import { FOOTER } from "@/contexts/constants/landing"

export function Footer() {
  return (
    <footer className="border-t border-border bg-background py-16">
      <Container>
        <div className="grid gap-12 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground">
                <span className="text-sm font-black text-background">N</span>
              </div>
              <span className="text-lg font-bold text-foreground tracking-tight">Neuvetra</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{FOOTER.tagline}</p>
            <p className="mt-4 text-xs text-muted-foreground">Birgani Enterprises Inc.</p>
          </div>

          {/* Link columns */}
          {FOOTER.columns.map((col) => (
            <div key={col.heading}>
              <h4 className="mb-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {col.heading}
              </h4>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.disabled || !link.href ? (
                      <span className="text-sm text-muted-foreground/50">{link.label}</span>
                    ) : link.href.startsWith("/") ? (
                      <Link
                        to={link.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <a
                        href={link.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-border pt-8 md:flex-row md:items-center md:justify-between">
          <p className="text-xs text-muted-foreground">{FOOTER.copyright}</p>
          <p className="text-xs text-muted-foreground">Powered by Twilio · Retell AI · OpenAI</p>
        </div>
      </Container>
    </footer>
  )
}
