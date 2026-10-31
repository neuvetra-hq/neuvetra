// Round 2 polish, lane D (Claude, 31 October 2026; integration-r2 deferred list, ENG-13 follow-up): the 1,016 NAICS titles
// (about 58 kB) load with the spend form and the spend import, never with the entry chunk. This walks the static imports
// from the staging entry (`src/staging.tsx`, the script `staging.html` loads) the way the bundler does: `import type` is
// erased, `import(...)` starts a lazy chunk and is not followed. The build's own budget check (scripts/finalize-staging.ts)
// looks for a title in the built entry chunk as well.
import { describe, expect, test } from "bun:test"
import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"

const src = resolve(import.meta.dir, "..")
const STATIC = /^\s*(?:import|export)\s+(type\s+)?(?:[\s\S]*?)\s+from\s+["']([^"']+)["']|^\s*import\s+["']([^"']+)["']/gm
function resolveImport(from: string, spec: string): string | null {
  const base = spec.startsWith("@/") ? resolve(src, spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(from), spec) : null
  if (!base) return null // a package
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) if (existsSync(candidate) && /\.tsx?$/.test(candidate)) return candidate
  return null // css, json, assets
}
/** Every source module a file pulls in through static imports (its chunk and the chunks it needs at load). */
function staticGraph(entry: string): Set<string> {
  const seen = new Set<string>(), queue = [entry]
  while (queue.length) {
    const file = queue.pop()!
    if (seen.has(file)) continue
    seen.add(file)
    for (const match of readFileSync(file, "utf8").matchAll(STATIC)) {
      if (match[1]) continue // `import type … from`: erased
      const next = resolveImport(file, match[2] ?? match[3]!)
      if (next) queue.push(next)
    }
  }
  return seen
}
const declaresTitles = (file: string) => /export const SCOPE3_NAICS_TITLES\b/.test(readFileSync(file, "utf8"))

describe("the NAICS titles are not in the entry chunk", () => {
  test("the Scope 3 results and report rendering load outside the staging entry", () => {
    const entry = staticGraph(resolve(src, "staging.tsx"))
    for (const file of ["components/Scope3Results.tsx", "components/scope3/Scope3ResultsPanel.tsx", "components/scope3/Scope3ScreeningEditor.tsx"])
      expect(entry.has(resolve(src, file))).toBe(false)
  })
  test("the Scope 3 response decoder is deferred until a successful Scope 3 response", () => {
    const entry = staticGraph(resolve(src, "staging.tsx"))
    expect([...entry].filter(file => readFileSync(file, "utf8").includes("export function decodeScope3Results("))).toEqual([])
  })
  test("the combined Results screen loads when opened, without adding its report renderers to Overview", () => {
    expect(staticGraph(resolve(src, "staging.tsx")).has(resolve(src, "components/ResultsReport.tsx"))).toBe(false)
  })
  test("the preserved example workspace loads only when its earlier-view route is opened", () => {
    expect(staticGraph(resolve(src, "staging.tsx")).has(resolve(src, "components/CompanyWorkspaceDemo.tsx"))).toBe(false)
  })
  test("no module statically reachable from the staging entry declares the NAICS titles; the spend form and import still reach them", () => {
    const entry = staticGraph(resolve(src, "staging.tsx"))
    expect(entry.size).toBeGreaterThan(50) // the walker follows the real graph
    expect([...entry].filter(declaresTitles).map(file => file.slice(src.length + 1))).toEqual([])
    for (const lazy of ["components/scope3/SpendImport.tsx", "components/scope3/SpendLineForm.tsx", "components/scope3/Scope3RecordForm.tsx"])
      expect([lazy, [...staticGraph(resolve(src, lazy))].some(declaresTitles)]).toEqual([lazy, true])
  })
})
