/**
 * Spend mapping groups (round 2 UX-1; Claude, 31 October 2026). Pure and browser-safe: the web review grid, the import
 * and the mapping save group lines identically.
 *
 * A ledger export has one description per line, so the per-line mapping key (GL account + vendor + description, DESIGN
 * §3.6) gives one mapping per line. Lines are mapped instead in **groups**: the same vendor (normalised: case,
 * punctuation, spacing and legal suffixes such as Inc or LLC ignored) on the same GL account (or the vendor alone when
 * the line has no account, the account alone when it has no vendor). A group mapping is remembered in 0030's mapping
 * table like any other, under its own key (description empty), so a later file's line of that vendor and account with a
 * new description is mapped from memory. A line's own remembered mapping (a per-line override, keyed by the line key)
 * always wins over its group's. Nothing here calculates emissions.
 */
/**
 * The text whose SHA-256 (lowercase hex) is a spend line's mapping key (DESIGN §3.6 revision 1, as 0030's mapping
 * table stores it): the GL account, the vendor (the line's supplier name) and the description, each trimmed and
 * lower-cased, separated by U+001F. The spend import (I-09) computes the same key for a file line.
 */
export function scope3SpendMappingKeyInput(line: { glAccount: string; supplierName: string; description: string }): string {
  return [line.glAccount, line.supplierName, line.description].map(text => text.trim().toLowerCase()).join('\u001f')
}

/** Legal-form words dropped from the end (and "the" from the start) of a vendor name when grouping. */
const LEGAL_SUFFIXES = new Set(['inc', 'incorporated', 'llc', 'l l c', 'ltd', 'limited', 'corp', 'corporation', 'co', 'company', 'plc', 'lp', 'llp', 'l p', 'gmbh', 'ag', 'sa', 'bv', 'pty', 'pc', 'pllc'])

/**
 * A vendor name as groups compare it: NFKC, lower case, `&` as "and", punctuation and symbols as spaces, legal suffixes
 * dropped. BF-12 (QA F4): combining marks (\p{M}: Devanagari and Thai vowel signs, for example) are part of the name and
 * kept, so names that differ only in them stay apart.
 */
export function scope3SpendVendorKey(vendor: string): string {
  const words = vendor.normalize('NFKC').toLowerCase().replace(/&/g, ' and ').replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim()
  if (!words) return ''
  let out = words
  for (;;) {
    const before = out
    for (const suffix of LEGAL_SUFFIXES) if (out.endsWith(` ${suffix}`)) out = out.slice(0, -suffix.length - 1).trim()
    out = out.replace(/ and$/, '').replace(/^the /, '').trim()
    if (out === before) break
  }
  // A name that is only a legal word keeps it: a real name never becomes an empty vendor.
  return out || words
}
/** A GL account as groups compare it: trimmed, lower case, spaces collapsed. */
export const scope3SpendAccountKey = (account: string) => account.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ')

/**
 * The text whose SHA-256 is a group's mapping key, or null when the line has neither vendor nor account (it is then its
 * own group, by its line key). U+001E separates the namespace: line texts may not hold control characters (parser and
 * contract), so a group key never equals a line key.
 */
export function scope3SpendGroupKeyInput(line: { glAccount: string; supplierName: string }): string | null {
  const account = scope3SpendAccountKey(line.glAccount), vendor = scope3SpendVendorKey(line.supplierName)
  if (!account && !vendor) return null
  return `vendor-account\u001e${account}\u001f${vendor}`
}

/** The group a line is mapped in: its vendor-and-account group, or (no vendor and no account) its own line key. */
export function scope3SpendGroupOf(line: { glAccount: string; supplierName: string; description: string }): { keyInput: string; scope: 'group' | 'line' } {
  const group = scope3SpendGroupKeyInput(line)
  return group === null ? { keyInput: scope3SpendMappingKeyInput(line), scope: 'line' } : { keyInput: group, scope: 'group' }
}

/** A remembered mapping row is a group mapping when its description is empty (a line's description never is). */
export const scope3SpendIsGroupMapping = (mapping: { description: string }) => mapping.description === ''

/** The key text a stored mapping row is remembered under (group or line), from its own texts. */
export function scope3SpendMappingKeyInputOf(mapping: { glAccount: string; vendor: string; description: string }): string {
  if (scope3SpendIsGroupMapping(mapping)) {
    const group = scope3SpendGroupKeyInput({ glAccount: mapping.glAccount, supplierName: mapping.vendor })
    if (group === null) throw new Error('A group mapping needs a vendor or a GL account.')
    return group
  }
  return scope3SpendMappingKeyInput({ glAccount: mapping.glAccount, supplierName: mapping.vendor, description: mapping.description })
}

/** The remembered mapping that applies to a line: its own (line key) first, else its group's; null when neither exists. */
export function scope3SpendRememberedMapping<T extends { mappingKeySha256: string }>(line: { glAccount: string; supplierName: string; description: string }, heads: readonly T[], sha256: (text: string) => string): { head: T; scope: 'line' | 'group' } | null {
  const byKey = new Map(heads.map(head => [head.mappingKeySha256, head]))
  const own = byKey.get(sha256(scope3SpendMappingKeyInput(line)))
  if (own) return { head: own, scope: 'line' }
  const groupInput = scope3SpendGroupKeyInput(line)
  const group = groupInput === null ? undefined : byKey.get(sha256(groupInput))
  return group ? { head: group, scope: 'group' } : null
}
