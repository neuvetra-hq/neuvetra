import { useEffect, useRef, type FormEvent } from "react"
import { Icon, type IconName } from "./Icon"

export interface LandingProps {
  ready: boolean
  busy: boolean
  message: string
  email: string
  password: string
  onEmail: (value: string) => void
  onPassword: (value: string) => void
  onSignIn: (event: FormEvent) => void
  onSendLink: () => void
}

const STEPS = [
  { title: "Describe your company", body: "Legal entity, reporting year, boundary approach and every site — with “not sure yet” allowed wherever you are." },
  { title: "Add activity and evidence", body: "One record per bill, meter, vehicle group, generator or cooling system, with the original document attached." },
  { title: "Calculate with reviewed methods", body: "Published EPA, eGRID and Green-e factors. Records with missing inputs are held and explained, never counted as zero." },
  { title: "Review your draft report", body: "Totals by scope, every figure traced to its record and factor, and a list of what’s still open. Print or export." },
]
const FEATURES: Array<{ icon: IconName; title: string; body: string }> = [
  { icon: "layers", title: "Traceable by design", body: "Each figure links to the record, the evidence file, the emission factor and the method version used to produce it." },
  { icon: "alert", title: "Gaps stay visible", body: "Missing or unsupported data is held with a plain reason. Unknown is never quietly turned into zero." },
  { icon: "file", title: "Evidence kept with the numbers", body: "Bills and records are fingerprinted on upload, kept private to your company and linked to each activity." },
  { icon: "chart", title: "Scope 2, both ways", body: "Location-based and market-based electricity results side by side, including certificates and green tariffs." },
  { icon: "records", title: "Corrections with a history", body: "Every change is a new version with a reason, so the audit trail stays intact from first entry to final draft." },
  { icon: "help", title: "Help where you need it", body: "Ask Neuvetra answers common questions in plain language from written, reviewed guidance — and says so when it doesn’t have an answer." },
]
const FAQ = [
  { q: "Who is Neuvetra for?", a: "Finance, operations and sustainability teams preparing a Scope 1 and Scope 2 inventory — whether for California’s SB 253, a customer’s supplier request, or their own targets." },
  { q: "What does SB 253 require?", a: "U.S. companies with more than $1 billion in annual revenue that do business in California must report Scope 1 and Scope 2 emissions each year. CARB’s February 2026 regulation set August 10, 2026 as the first deadline; in June 2026 CARB proposed moving it to November 10, 2026, which still needed final approval when we last checked (29 Sep 2026). Under CARB’s current rulemaking, reports submitted from 2027 need limited assurance of Scope 1 and 2, and Scope 3 reporting starts in 2027 for specified categories. Confirm current dates with CARB or your advisor." },
  { q: "Which methods and factors do you use?", a: "Scope 1 uses the EPA GHG Emission Factors Hub (2025). Scope 2 uses EPA eGRID2023 for location-based results and the Green-e 2025 residual mix for market-based results. Gases are combined with IPCC AR5 100-year global warming potentials." },
  { q: "Is the output an official filing?", a: "Not yet. During the private beta every report is a draft prepared with beta methods and is not externally assured. It is structured so an independent assurance provider can follow every number." },
  { q: "How is our data protected?", a: "Records and files are scoped to your company — other companies cannot list, open or download them. During the private beta, use synthetic or test data only." },
]

function tone(message: string): "error" | "info" | null {
  if (!message || /^(Checking private staging|Sign in with your invited|Private staging access verified)/.test(message)) return null
  return /fail|unavailable|could not|inactive|changed|Enter your/i.test(message) ? "error" : "info"
}

export function Landing(props: LandingProps) {
  const emailRef = useRef<HTMLInputElement>(null)
  useEffect(() => { document.title = "Neuvetra — Greenhouse-gas reporting (private beta)" }, [])
  const goToSignIn = () => { document.getElementById("sign-in")?.scrollIntoView({ behavior: "smooth", block: "start" }); window.setTimeout(() => emailRef.current?.focus({ preventScroll: true }), 350) }
  const kind = tone(props.message)
  return <div className="nv-landing">
    <a className="nv-skip" href="#sign-in">Skip to sign in</a>
    <header className="nv-landing__nav">
      <a className="nv-brand" href="/" aria-label="Neuvetra home"><span className="nv-brand__mark" aria-hidden="true" />Neuvetra</a>
      <span className="nv-badge">Private beta</span>
      <nav className="nv-landing__links" aria-label="Page sections"><a href="#how">How it works</a><a href="#features">What you get</a><a href="#coverage">Coverage</a><a href="#faq">FAQ</a></nav>
      <button type="button" className="nv-btn nv-btn--sm" onClick={goToSignIn}>Sign in</button>
    </header>

    <main>
      <section className="nv-section nv-hero" aria-labelledby="hero-title">
        <div>
          <p className="nv-eyebrow">Scope 1 & 2 reporting · California SB 253</p>
          <h1 id="hero-title">Greenhouse-gas reporting your auditor can <em>trace</em>.</h1>
          <p className="nv-hero__lead">Neuvetra guides your team from company setup to a draft Scope 1 and Scope 2 inventory. Every figure links back to the bill, the record and the published emission factor behind it — and anything missing stays visibly missing.</p>
          <div className="nv-hero__cta">
            <button type="button" className="nv-btn nv-btn--primary" onClick={goToSignIn}>Sign in to your workspace <Icon name="arrow" size={18} /></button>
            <a className="nv-btn nv-btn--ghost" href="#how">See how it works</a>
          </div>
          <div className="nv-hero__trust"><span><Icon name="check" size={16} />EPA 2025 emission factors</span><span><Icon name="check" size={16} />eGRID2023 and Green-e for electricity</span><span><Icon name="check" size={16} />Unknown is never zero</span></div>
        </div>
        <div className="nv-preview" role="img" aria-label="Illustration of a Neuvetra workspace for a synthetic company: company setup complete, six activity records with one needing input, and a draft report.">
          <span className="nv-preview__tag">Illustration · synthetic company</span>
          <p className="nv-subtle" style={{ margin: "0 0 4px" }}>Bayline Supply Co. · 2025 draft</p>
          <p className="nv-h3" style={{ margin: "0 0 14px" }}>Your reporting progress</p>
          <div className="nv-progress" aria-hidden="true"><span style={{ width: "78%" }} /></div>
          <div style={{ marginTop: 14 }}>
            <div className="nv-preview__row"><span><Icon name="building" size={18} /> Company setup</span><span className="nv-chip nv-chip--ready">3 sites</span></div>
            <div className="nv-preview__row"><span><Icon name="records" size={18} /> Activity & evidence</span><span className="nv-chip nv-chip--warn">1 input needed</span></div>
            <div className="nv-preview__row"><span><Icon name="bolt" size={18} /> Scope 2 electricity</span><span className="nv-chip nv-chip--info">Location + market</span></div>
            <div className="nv-preview__row"><span><Icon name="file" size={18} /> Draft report</span><span className="nv-chip nv-chip--muted">Not externally assured</span></div>
          </div>
        </div>
      </section>

      <section id="how" className="nv-section" aria-labelledby="how-title">
        <div className="nv-section__head"><p className="nv-eyebrow">How it works</p><h2 id="how-title">Four steps from records to a draft report</h2><p>Work at your own pace. Everything saves as a draft, and the overview always shows what’s done and what’s next.</p></div>
        <ol className="nv-steps4">{STEPS.map(step => <li key={step.title}><h3>{step.title}</h3><p>{step.body}</p></li>)}</ol>
      </section>

      <section id="features" className="nv-section" aria-labelledby="features-title">
        <div className="nv-section__head"><p className="nv-eyebrow">What you get</p><h2 id="features-title">Built for the review, not just the number</h2><p>An inventory is only as good as the trail behind it. Neuvetra keeps that trail as you work.</p></div>
        <div className="nv-features">{FEATURES.map(feature => <div className="nv-feature" key={feature.title}><Icon name={feature.icon} size={24} /><h3>{feature.title}</h3><p>{feature.body}</p></div>)}</div>
      </section>

      <section id="coverage" className="nv-section" aria-labelledby="coverage-title">
        <div className="nv-section__head"><p className="nv-eyebrow">Coverage in the beta</p><h2 id="coverage-title">What you can report today</h2></div>
        <div className="nv-coverage">
          <div><p className="nv-h3">Scope 1 — direct</p><ul><li>Natural gas</li><li>Generator diesel and fuel oil</li><li>Company vehicles (gasoline and diesel)</li><li>Refrigerants and fire suppression</li></ul></div>
          <div><p className="nv-h3">Scope 2 — purchased electricity</p><ul><li>Location-based, by eGRID subregion</li><li>Market-based, with certificates, PPAs, green tariffs and supplier rates</li><li>Green-e residual mix for uncovered use</li></ul></div>
          <div><p className="nv-h3">Coming next</p><ul><li>Scope 3 calculation (screening today)</li><li>Assurance-provider handoff package</li><li>More jurisdictions after California</li></ul></div>
        </div>
        <div className="nv-notice nv-notice--info" style={{ marginTop: 22 }}><Icon name="info" /><p><strong>Private beta.</strong> Access is by invitation, with synthetic or test company data only. Results are drafts prepared with beta methods and are not externally assured.</p></div>
      </section>

      <section id="faq" className="nv-section nv-faq" aria-labelledby="faq-title">
        <div className="nv-section__head"><p className="nv-eyebrow">Questions</p><h2 id="faq-title">Frequently asked</h2></div>
        {FAQ.map(item => <details key={item.q}><summary>{item.q}</summary><p>{item.a}</p></details>)}
      </section>

      <section id="sign-in" className="nv-section nv-signin-wrap" aria-labelledby="signin-title">
        <div className="nv-section__head">
          <p className="nv-eyebrow">Private beta</p>
          <h2>Invited to Neuvetra?</h2>
          <p>Sign in with the email address your invitation was sent to. Your workspace opens on an overview that shows exactly where you left off.</p>
          <ul className="nv-list" style={{ marginTop: 20 }}>
            <li><span className="nv-list__main"><span className="nv-list__title">No public registration</span><br /><span className="nv-subtle">Not invited yet? Ask your Neuvetra contact.</span></span></li>
            <li><span className="nv-list__main"><span className="nv-list__title">Shared computer?</span><br /><span className="nv-subtle">Sign out when you finish — it clears the session on this browser.</span></span></li>
          </ul>
        </div>
        <div className="nv-signin">
          <h2 id="signin-title">Sign in</h2>
          <p className="nv-muted" style={{ margin: 0 }}>Use your invited account.</p>
          <form onSubmit={props.onSignIn}>
            <label className="nv-field"><span>Email</span><input ref={emailRef} type="email" autoComplete="username" required value={props.email} onChange={event => props.onEmail(event.target.value)} /></label>
            <label className="nv-field"><span>Password</span><input type="password" autoComplete="current-password" required value={props.password} onChange={event => props.onPassword(event.target.value)} /></label>
            <button type="submit" className="nv-btn nv-btn--primary nv-btn--block" disabled={!props.ready || props.busy}>{!props.ready ? (kind === "error" ? "Sign-in unavailable" : "Loading…") : props.busy ? "Signing in…" : "Sign in"}</button>
            <div className="nv-or">or</div>
            <button type="button" className="nv-btn nv-btn--block" disabled={!props.ready || props.busy} onClick={props.onSendLink}>Email me a sign-in link</button>
          </form>
          <div>{kind && <div className={`nv-notice ${kind === "error" ? "nv-notice--error" : "nv-notice--ok"}`}><Icon name={kind === "error" ? "alert" : "check"} /><p>{props.message}</p></div>}</div>
          <p className="nv-subtle" style={{ margin: "14px 0 0" }}>Access is by invitation. There is no public registration.</p>
        </div>
      </section>
    </main>
    <footer className="nv-footer"><div className="nv-section"><span>© 2026 Neuvetra</span><span>Private beta · synthetic data only · drafts are not externally assured</span></div></footer>
  </div>
}
