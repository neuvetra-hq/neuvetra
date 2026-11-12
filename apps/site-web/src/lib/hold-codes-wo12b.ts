// WO-12b QA round 1: every hold, exclusion and engine finding code the calculation adapters, the results routes and the
// three engines can return, read from their source (not from a list kept by hand). hold-classification-wo12b.test.ts
// checks that hold-classification-wo12b.json classifies each one (field-level, record-level notice, company-level
// notice, …) and that the screen's record holds are exactly the codes classified as notices. Test-only: the app never
// imports this file.
const C = "([a-z][a-z0-9_]*)"
/** The argument list of each call to `name(` in TypeScript source, with nested brackets balanced. */
function calls(source: string, name: string): string[] {
  const out: string[] = []
  const re = new RegExp(`\\b${name}\\(`, "g")
  for (let m = re.exec(source); m; m = re.exec(source)) {
    let depth = 1, i = m.index + m[0].length
    const start = i
    while (i < source.length && depth > 0) { const ch = source[i]!; if ("([{".includes(ch)) depth++; else if (")]}".includes(ch)) depth--; i++ }
    out.push(source.slice(start, i - 1))
  }
  return out
}
/** The last top-level argument of an argument list. */
function lastArgument(args: string): string {
  let depth = 0, cut = 0
  for (let i = 0; i < args.length; i++) { const ch = args[i]!; if ("([{".includes(ch)) depth++; else if (")]}".includes(ch)) depth--; else if (ch === "," && depth === 0) cut = i + 1 }
  return args.slice(cut)
}
const quoted = (text: string) => [...text.matchAll(/['"]([a-z][a-z0-9_]*_[a-z0-9_]*)['"]/g)].map(m => m[1]!)
const STATUSES = new Set(["input_needed", "review_required", "method_pending", "complete", "partial", "excluded", "withdrawn", "provisional"])

/** Codes from a TypeScript adapter or route: need(…, code), held(code), hold(status, [codes]), waiting(…, code), reasons: [codes], reasons.push(code), `X_REASON = code`. */
export function typescriptCodes(source: string): string[] {
  const codes: string[] = []
  for (const args of calls(source, "need")) codes.push(...quoted(lastArgument(args)))
  for (const args of calls(source, "held")) codes.push(...quoted(args.split(",")[0]!))
  for (const args of calls(source, "hold")) { const list = args.match(/\[([^\]]*)\]/); if (list) codes.push(...quoted(list[1]!)) }
  for (const args of calls(source, "waiting")) codes.push(...quoted(lastArgument(args)))
  for (const m of source.matchAll(/reasons\s*:\s*\[([^\]]*)\]/g)) codes.push(...quoted(m[1]!))
  for (const m of source.matchAll(/reasons\s*\?\s*[^:]*:\s*\[([^\]]*)\]/g)) codes.push(...quoted(m[1]!))
  for (const args of calls(source, "reasons\\.push")) codes.push(...quoted(args))
  for (const m of source.matchAll(new RegExp(`_REASON = '${C}'`, "g"))) codes.push(m[1]!)
  // A template of the five refrigerant terms (`term_${term}_not_numeric`).
  for (const m of source.matchAll(/`([a-z_]*)\$\{term\}([a-z_]*)`/g)) for (const term of ["PN", "CN", "PS", "CD", "RD"]) codes.push(`${m[1]}${term}${m[2]}`)
  return codes.filter(code => !STATUSES.has(code))
}
/** Codes from a Python engine: _not_calculated(…, [codes]), findings=[…], findings.append/extend/+=, (status, code) and (code, status) pairs. */
export function pythonCodes(source: string): string[] {
  const codes: string[] = []
  const lists = [...source.matchAll(/_not_calculated\([^\n]*?\[([^\]]*)\]/g), ...source.matchAll(/findings\s*=\s*\[([^\]]*)\]/g), ...source.matchAll(/findings(?:\.append\(| \+= \[|\.extend\(\[)([^\n)\]]*)/g)].map(m => m[1]!)
  for (const list of lists) for (const m of list.matchAll(/'([a-z][a-z0-9_]*)'/g)) codes.push(m[1]!)
  for (const m of source.matchAll(new RegExp(`'(?:input_needed|review_required|excluded|method_pending|partial)', '${C}'`, "g"))) codes.push(m[1]!)
  for (const m of source.matchAll(new RegExp(`\\('${C}', '(?:input_needed|review_required|excluded|method_pending|partial)'\\)`, "g"))) codes.push(m[1]!)
  return codes.filter(code => !STATUSES.has(code))
}
/** The files read, relative to the repository root, and how. */
export const HOLD_CODE_SOURCES: ReadonlyArray<readonly [string, "ts" | "py"]> = [
  ["packages/neuvetra-database/src/collection-engine-input.ts", "ts"],
  ["packages/neuvetra-database/src/scope3-collection.ts", "ts"],
  ["packages/neuvetra-database/src/collection-duplicates.ts", "ts"],
  ["apps/site-api/src/workspace/scope3-results-routes.ts", "ts"],
  ["apps/site-api/src/workspace/collection-results-routes.ts", "ts"],
  ["apps/site-api/src/calculation/scope1_engine.py", "py"],
  ["apps/site-api/src/calculation/scope2_engine.py", "py"],
  ["apps/site-api/src/calculation/scope3_engine.py", "py"],
]
