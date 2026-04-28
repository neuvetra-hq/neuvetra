"use client"

import { useState, useRef } from "react"
import { Link } from "react-router"
import { Menu, ChevronDown } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { Container } from "@/components/layout/Container"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import industriesData from "@/data/industries.json"

const SIMPLE_NAV = [
  { label: "How It Works", href: "/#how-it-works" },
  { label: "Pricing", href: "/#pricing" },
]

const INDUSTRY_CATEGORIES = industriesData.categories.filter((c) => c.id !== "all")

export function Navbar() {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/90 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5">
          <img src="/logo-v2.png" alt="Front Desk" className="h-9 w-9 object-contain" />
          <span className="text-lg font-bold text-foreground tracking-tight">Front Desk</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 md:flex">
          {SIMPLE_NAV.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}

          {/* Industries dropdown */}
          <div
            ref={dropdownRef}
            className="relative"
            onMouseEnter={() => setDropdownOpen(true)}
            onMouseLeave={() => setDropdownOpen(false)}
          >
            <button className="flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              Industries
              <ChevronDown className={`size-3.5 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute left-1/2 top-full w-[680px] -translate-x-1/2 pt-2">
              <div className="rounded-2xl border border-border bg-background shadow-xl">
                <div className="grid grid-cols-5 gap-6 p-6">
                  {INDUSTRY_CATEGORIES.map((cat) => {
                    const catIndustries = industriesData.industries.filter(
                      (i) => i.category === cat.id
                    )
                    return (
                      <div key={cat.id}>
                        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                          {cat.label}
                        </p>
                        <ul className="space-y-2">
                          {catIndustries.map((industry) => (
                            <li key={industry.id}>
                              <Link
                                to={`/industries/${industry.slug}`}
                                className="text-sm text-muted-foreground transition-colors hover:text-primary"
                                onClick={() => setDropdownOpen(false)}
                              >
                                {industry.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })}
                </div>
                <div className="border-t border-border px-6 py-3">
                  <a
                    href="/#industries"
                    className="text-sm font-semibold text-primary hover:underline"
                    onClick={() => setDropdownOpen(false)}
                  >
                    View all industries →
                  </a>
                </div>
              </div>
              </div>
            )}
          </div>
        </nav>

        {/* Desktop CTA + mobile hamburger */}
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="hidden text-sm font-medium text-muted-foreground hover:text-foreground md:block"
          >
            Sign in
          </Link>
          <Link
            to="/signup"
            className={
              buttonVariants({ size: "sm" }) +
              " bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-5"
            }
          >
            Get Started
          </Link>

          {/* Mobile hamburger */}
          <Sheet>
            <SheetTrigger
              render={
                <button
                  className="inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
                  aria-label="Open menu"
                />
              }
            >
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="right" className="w-72 bg-background pt-10 overflow-y-auto">
              <nav className="flex flex-col gap-6">
                {SIMPLE_NAV.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="text-base font-medium text-foreground hover:text-primary transition-colors"
                  >
                    {link.label}
                  </a>
                ))}

                {/* Mobile industries — flat list by category */}
                <div>
                  <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Industries
                  </p>
                  <div className="flex flex-col gap-2">
                    {INDUSTRY_CATEGORIES.map((cat) => (
                      <div key={cat.id}>
                        <p className="mt-2 text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">
                          {cat.label}
                        </p>
                        {industriesData.industries
                          .filter((i) => i.category === cat.id)
                          .map((industry) => (
                            <Link
                              key={industry.id}
                              to={`/industries/${industry.slug}`}
                              className="block py-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {industry.name}
                            </Link>
                          ))}
                      </div>
                    ))}
                  </div>
                </div>

                <Link
                  to="/login"
                  className="text-base font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  to="/signup"
                  className={
                    buttonVariants({ size: "sm" }) +
                    " bg-primary text-primary-foreground hover:bg-primary/90 rounded-full w-full justify-center"
                  }
                >
                  Get Started
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </Container>
    </header>
  )
}
