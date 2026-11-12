// WO-01 (design §6 P0-00, §7.1-7.2): cascade layers, the --nv-* role tokens and the 3 px focus ring on form fields.
// These tests read the CSS sources; the built bundle and the computed styles were compared against main in the PR.
import { describe, expect, test } from "bun:test"

const read = async (file: string) => (await Bun.file(new URL(file, import.meta.url)).text()).replace(/\/\*[\s\S]*?\*\//g, "")
const index = await read("./index.css")
const journey = await read("./journey.css")
const staging = await read("./staging.css")

/** The declarations of the first top-level block whose prelude is exactly `prelude`. */
function block(css: string, prelude: string): string {
  const start = css.indexOf(`${prelude} {`)
  if (start < 0) throw new Error(`no block ${prelude}`)
  let depth = 0
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++
    else if (css[i] === "}" && --depth === 0) return css.slice(css.indexOf("{", start) + 1, i)
  }
  throw new Error(`unclosed block ${prelude}`)
}
const declarations = (body: string) => Object.fromEntries([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [name!, value!.trim()]))

describe("cascade layers", () => {
  test("the layer order is declared before Tailwind, with legacy between base and components", () => {
    const order = index.indexOf("@layer theme, base, legacy, components, utilities;")
    expect(order).toBeGreaterThanOrEqual(0)
    expect(order).toBeLessThan(index.indexOf('@import "tailwindcss"'))
  })

  test("the global element defaults sit in the base layer", () => {
    const base = [...index.matchAll(/@layer base \{([\s\S]*?)\n\}/g)].map(match => match[1]).join("\n")
    for (const rule of ["* { box-sizing: border-box; }", "h1, h2, h3, p { margin: 0; }", ":is(button, input, a):focus-visible", "[tabindex=\"-1\"]:focus"]) {
      expect([rule, base.includes(rule)]).toEqual([rule, true])
    }
  })

  test("staging.css opens with the legacy layer, and only the listed rules stay outside it", () => {
    expect(staging.trimStart().startsWith("@layer legacy {")).toBe(true)
    const layered = block(staging, "@layer legacy")
    const outside = staging.slice(staging.indexOf(layered) + layered.length + 1)
    // Rules that would lose to an unlayered design-system rule on the same element stay unlayered (see the PR's cascade check).
    for (const selector of [".worksheet button,.worksheet-nav button", ".worksheet h1", ".setup-field span", ".collection-evidence-choice{display:flex!important"]) {
      expect([selector, outside.includes(selector)]).toEqual([selector, true])
    }
    for (const selector of [".staging-shell{", ".worksheet{", ".worksheet-card{", ".company-setup{"]) {
      expect([selector, layered.includes(selector)]).toEqual([selector, true])
    }
    // An !important declaration inside a layer would beat the unlayered !important print rules.
    expect(layered.includes("!important")).toBe(false)
  })

  test("no Tailwind theme namespace is redefined", () => {
    for (const css of [index, journey, staging]) expect(css.includes("@theme")).toBe(false)
    expect(/(^|[;{\s])--(text|radius|breakpoint|shadow)-[\w-]+\s*:/.test(block(journey, ":root"))).toBe(false)
  })
})

describe("design tokens", () => {
  const root = declarations(block(journey, ":root"))

  test("every token family is declared on :root", () => {
    for (const family of ["fs", "space", "color", "radius", "shadow", "motion"]) {
      expect([family, Object.keys(root).some(name => name.startsWith(`--nv-${family}-`))]).toEqual([family, true])
    }
    expect(root["--nv-color-focus"]).toBe("#cfe8b3")
    expect(root["--nv-color-border-control"]).toBe("#7a8a71")
    expect(root["--nv-focus-width"]).toBe("3px")
    for (const name of ["--nv-topbar-h", "--nv-contextbar-h", "--nv-bottom-chrome", "--nv-sticky-offset"]) expect([name, name in root]).toEqual([name, true])
  })

  test("the existing short names are aliases that resolve to their previous values", () => {
    const aliases = declarations(block(journey, ".nv-app, .nv-landing, .nv-access"))
    const previous: Record<string, string> = {
      "--bg": "#0b0c0d", "--surface": "#121611", "--surface-2": "#171d16", "--surface-3": "#1e261c", "--line": "#2b3528", "--line-2": "#3e4b39",
      "--text": "#f1efe8", "--muted": "#bcc4b2", "--subtle": "#939c89", "--accent": "#b8d997", "--accent-hi": "#cfe8b3", "--accent-ink": "#16200e",
      "--accent-soft": "#223019", "--warn": "#f2d38a", "--warn-bg": "#2d2613", "--warn-line": "#5f4d1d", "--danger": "#f5b4a1", "--danger-bg": "#331f19",
      "--danger-line": "#6c3b2d", "--info": "#b3d4f5", "--info-bg": "#15222f", "--info-line": "#2f4a63", "--ok": "#a9dc9b", "--ok-bg": "#18261a",
      "--ok-line": "#365a33", "--radius": "14px", "--radius-sm": "10px", "--shadow": "0 1px 0 rgba(255,255,255,.03) inset, 0 12px 32px rgba(0,0,0,.28)",
    }
    expect(Object.keys(aliases).sort()).toEqual(Object.keys(previous).sort())
    for (const [name, value] of Object.entries(previous)) {
      const token = /^var\((--nv-[\w-]+)\)$/.exec(aliases[name]!)?.[1]
      expect([name, token ? root[token] : aliases[name]]).toEqual([name, value])
    }
  })
})

describe("focus ring (UI-B05, QA-170)", () => {
  test("a focused input, select or textarea shows the 3 px focus outline, not the faint glow", () => {
    const rule = /\.nv-field input:focus, \.nv-field select:focus, \.nv-field textarea:focus,[^{]*\{([^}]*)\}/.exec(journey)?.[1] ?? ""
    expect(rule).toContain("outline: var(--nv-focus-width) solid var(--nv-color-focus)")
    expect(rule).not.toContain("outline: none")
    expect(rule).not.toContain("box-shadow")
  })

  test("every other control keeps the same 3 px ring, now from the focus token", () => {
    expect(journey).toContain(".nv-app :focus-visible, .nv-landing :focus-visible, .nv-access :focus-visible { outline: var(--nv-focus-width) solid var(--nv-color-focus);")
  })

  test("headings in the app clear the sticky chrome when scrolled to", () => {
    expect(journey).toContain("@layer base { .nv-app :is(h1, h2, h3, h4) { scroll-margin-top: var(--nv-sticky-offset); } }")
  })
})
