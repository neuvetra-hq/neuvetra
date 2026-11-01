import { scope3SpendNaicsAllowed } from "../../../../packages/neuvetra-database/src/scope3-collection"
import { SCOPE3_NAICS_TITLES } from "./scope3-naics-titles"
import { scope3NaicsGuard, type Scope3NaicsChoice } from "./scope3-forms"

/**
 * The spend forms' NAICS search and titles (Scope 3 completion I-08; moved here in round 2 polish, lane D, Claude,
 * 31 October 2026, ENG-13 follow-up). Only the spend line form, the spend import and the record fields import this module,
 * so the 1,016 titles (`scope3-naics-titles.ts`, about 58 kB) load with those lazy chunks and not with the entry chunk.
 */
/**
 * The NAICS codes a spend line of this category may map to (`scope3SpendNaicsAllowed`: any code for 1 and 2, the
 * category's own set for 3, 4, 5, 6 and 9), with their EPA titles, filtered by a search over the code and the title
 * (case-insensitive), in code order; at most `limit`.
 */
export function scope3NaicsChoices(category: number, query: string, limit = 60): Scope3NaicsChoice[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const out: Scope3NaicsChoice[] = []
  for (const code of Object.keys(SCOPE3_NAICS_TITLES).sort()) {
    if (!scope3SpendNaicsAllowed(category, code)) continue
    const title = SCOPE3_NAICS_TITLES[code]!
    const haystack = `${code} ${title}`.toLowerCase()
    if (words.every(word => haystack.includes(word))) out.push({ code, title, guard: scope3NaicsGuard(category, code) })
    if (out.length >= limit) break
  }
  return out
}
export const scope3NaicsTitle = (code: string | null) => code === null ? null : SCOPE3_NAICS_TITLES[code] ?? null
