// Round 2 UX-1 (Claude, 31 October 2026): spend lines are mapped in groups of the same vendor (normalised) and GL
// account, not one form per ledger description. A group mapping is remembered under its own key (0030's mapping table,
// description empty), a later file's line with a new description is mapped from it, a line's own remembered mapping
// (a per-line override) always wins over its group's, and saving a group mapping corrects exactly the group's lines that
// are not mapped by the file and have no override.
import { createHash } from 'node:crypto'
import { describe, expect, test } from 'bun:test'
import {
  scope3SpendAccountKey, scope3SpendGroupKeyInput, scope3SpendGroupOf, scope3SpendIsGroupMapping, scope3SpendMappingKeyInputOf, scope3SpendRememberedMapping, scope3SpendVendorKey,
} from './scope3-spend-grouping'
import { scope3SpendMappingKeyInput } from './scope3-collection'
import { buildScope3SpendImportRequest, parseScope3SpendCsv, SCOPE3_SPEND_IMPORT_COLUMNS } from './scope3-spend-import'
import { scope3SpendMappingGroup, validateScope3SpendMappingSaveInput } from './scope3-spend-imports'
import type { CollectionActivityRecord } from './collection-contract'

const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex')
const HEADER = SCOPE3_SPEND_IMPORT_COLUMNS.join(',')

describe('vendor and account normalisation', () => {
  test('case, punctuation, spacing and legal suffixes do not split a vendor', () => {
    for (const name of ['Staples Inc.', 'STAPLES, INC', '  staples ', 'Staples Incorporated', 'Staples, L.L.C.', 'The Staples Co']) expect(scope3SpendVendorKey(name)).toBe('staples')
    expect(scope3SpendVendorKey('Smith & Wesson Corp.')).toBe('smith and wesson')
    expect(scope3SpendVendorKey('AT&T')).toBe('at and t')
    expect(scope3SpendVendorKey('Bayview Office Supply TEST')).toBe('bayview office supply test')
    // A name that is only a suffix keeps it (never an empty vendor from a real name).
    expect(scope3SpendVendorKey('Inc.')).toBe('inc')
    expect(scope3SpendVendorKey('')).toBe('')
  })
  // BF-12 (QA F4): combining marks are part of a vendor's name, so names that differ only in them are separate vendors.
  test('combining marks are kept: Devanagari and Thai names that differ in vowel signs stay apart; NFKC-composed accents as before', () => {
    expect(scope3SpendVendorKey('काल')).not.toBe(scope3SpendVendorKey('कुल'))
    expect(scope3SpendVendorKey('กิน')).not.toBe(scope3SpendVendorKey('กัน'))
    expect(scope3SpendVendorKey('काल ट्रेडर्स')).toBe('काल ट्रेडर्स')
    expect(scope3SpendVendorKey('Cafe\u0301 Supply Inc')).toBe(scope3SpendVendorKey('Café Supply'))
    expect(scope3SpendVendorKey('Acme ★ Metals, Inc.')).toBe('acme metals')
  })
  test('accounts compare trimmed, lower-cased, spaces collapsed', () => {
    expect(scope3SpendAccountKey(' 6100 ')).toBe('6100')
    expect(scope3SpendAccountKey('Office  Supplies')).toBe('office supplies')
  })
})

describe('group keys', () => {
  test('one group per normalised vendor and account; description never splits a group; account kept apart when present', () => {
    const a = scope3SpendGroupKeyInput({ glAccount: '6100', supplierName: 'Staples Inc.' })
    expect(a).toBe(scope3SpendGroupKeyInput({ glAccount: ' 6100', supplierName: 'STAPLES' }))
    expect(a).not.toBe(scope3SpendGroupKeyInput({ glAccount: '6200', supplierName: 'Staples' }))
    expect(scope3SpendGroupKeyInput({ glAccount: '', supplierName: 'Staples' })).not.toBe(a)
    expect(scope3SpendGroupKeyInput({ glAccount: '7000', supplierName: '' })).not.toBeNull()
    // Neither vendor nor account: no group (the line is its own group, by its line key).
    expect(scope3SpendGroupKeyInput({ glAccount: ' ', supplierName: '' })).toBeNull()
  })
  test('a group key can never equal a line key (a control character no line text may hold separates its namespace)', () => {
    const group = scope3SpendGroupKeyInput({ glAccount: '6100', supplierName: 'Staples' })!
    expect(group).toContain('\u001e')
    expect(group).not.toBe(scope3SpendMappingKeyInput({ glAccount: '6100', supplierName: 'staples', description: '' }))
  })
  test('the group of a line, and the key a mapping row is stored under (group rows have an empty description)', () => {
    const line = { glAccount: '6100', supplierName: 'Staples Inc.', description: 'Toner' }
    expect(scope3SpendGroupOf(line)).toEqual({ keyInput: scope3SpendGroupKeyInput(line)!, scope: 'group' })
    expect(scope3SpendGroupOf({ glAccount: '', supplierName: '', description: 'Misc' })).toEqual({ keyInput: scope3SpendMappingKeyInput({ glAccount: '', supplierName: '', description: 'Misc' }), scope: 'line' })
    expect(scope3SpendIsGroupMapping({ description: '' })).toBe(true)
    expect(scope3SpendIsGroupMapping({ description: 'Toner' })).toBe(false)
    expect(scope3SpendMappingKeyInputOf({ glAccount: '6100', vendor: 'Staples', description: '' })).toBe(scope3SpendGroupKeyInput({ glAccount: '6100', supplierName: 'Staples' })!)
    expect(scope3SpendMappingKeyInputOf({ glAccount: '6100', vendor: 'Staples', description: 'Toner' })).toBe(scope3SpendMappingKeyInput({ glAccount: '6100', supplierName: 'Staples', description: 'Toner' }))
  })
  test('remembered mapping precedence: the line’s own key, then its group’s, else none', () => {
    const line = { glAccount: '6100', supplierName: 'Staples', description: 'Toner' }
    const own = { mappingKeySha256: sha256(scope3SpendMappingKeyInput(line)), category: 1, naicsCode: '322230', marginChoice: 'with_margins' }
    const group = { mappingKeySha256: sha256(scope3SpendGroupKeyInput(line)!), category: 1, naicsCode: '339940', marginChoice: 'with_margins' }
    expect(scope3SpendRememberedMapping(line, [group, own], sha256)).toEqual({ head: own, scope: 'line' })
    expect(scope3SpendRememberedMapping(line, [group], sha256)).toEqual({ head: group, scope: 'group' })
    expect(scope3SpendRememberedMapping({ ...line, description: 'Pens' }, [group, own], sha256)).toEqual({ head: group, scope: 'group' })
    expect(scope3SpendRememberedMapping(line, [], sha256)).toBeNull()
  })
})

describe('the import maps a new description from its group’s remembered mapping', () => {
  const company = '93930000-0000-4000-8000-000000000001', setup = '93930000-0000-4000-8000-0000000000c1', loc = '93930000-0000-4000-8000-0000000000b1', evidence = '93930000-0000-4000-8000-0000000000e1'
  const build = (csv: string, mappings: Array<{ mappingKeySha256: string; category: number; naicsCode: string; marginChoice: string }>) => {
    const parsed = parseScope3SpendCsv(new TextEncoder().encode(csv))
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors))
    return buildScope3SpendImportRequest({ companyId: company, parsed, fileSha256: sha256(csv), fileName: 'ledger.csv', evidenceId: evidence, locationId: loc, setupVersionId: setup, reportingYear: 2025,
      reportingPeriod: { start: '2025-01-01', endExclusive: '2026-01-01' }, mappings, earlierLines: [], sha256 })
  }
  test('group memory maps every line of the vendor and account; a line override wins; other vendors stay unmatched; a file code wins over both', () => {
    const groupKey = sha256(scope3SpendGroupKeyInput({ glAccount: '6100', supplierName: 'Staples' })!)
    const override = sha256(scope3SpendMappingKeyInput({ glAccount: '6100', supplierName: 'STAPLES INC', description: 'Paper' }))
    const built = build(`${HEADER}\nA1,2025-02-01,Staples Inc.,6100,,Toner,10,USD,,,,,\nA2,2025-02-02,STAPLES INC,6100,,Paper,20,USD,,,,,\nA3,2025-02-03,Staples,6200,,Chairs,30,USD,,,,,\nA4,2025-02-04,Staples,6100,,Pens,40,USD,,1,322230,,\n`,
      [{ mappingKeySha256: groupKey, category: 1, naicsCode: '339940', marginChoice: 'with_margins' }, { mappingKeySha256: override, category: 1, naicsCode: '322230', marginChoice: 'with_margins' }])
    const payloads = built.request.rows.map(row => (row.request.activity as { payload: { naicsCode: string | null; mappingSource: string } }).payload)
    expect(payloads.map(p => [p.naicsCode, p.mappingSource])).toEqual([['339940', 'memory'], ['322230', 'memory'], [null, 'unmatched'], ['322230', 'file']])
    // The line's key (what the mapping table and supersession use) is unchanged: the line key, never the group key.
    expect(built.lines[0]!.mappingKeySha256).toBe(sha256(scope3SpendMappingKeyInput({ glAccount: '6100', supplierName: 'Staples Inc.', description: 'Toner' })))
  })
  test('a group mapping in another category than the file states is not applied', () => {
    const groupKey = sha256(scope3SpendGroupKeyInput({ glAccount: '6100', supplierName: 'Staples' })!)
    const built = build(`${HEADER}\nA1,2025-02-01,Staples,6100,,Toner,10,USD,,2,,,\n`, [{ mappingKeySha256: groupKey, category: 1, naicsCode: '339940', marginChoice: 'with_margins' }])
    expect((built.request.rows[0]!.request.activity as { payload: { naicsCode: string | null; mappingSource: string } }).payload).toMatchObject({ naicsCode: null, mappingSource: 'unmatched' })
  })
})

describe('saving a group mapping', () => {
  const company = '93930000-0000-4000-8000-000000000001'
  let n = 0
  const record = (payload: Record<string, unknown>, state = 'active'): CollectionActivityRecord => {
    const id = `93930000-0000-4000-8000-${String(++n).padStart(12, '0')}`
    return { id, companyId: company, kind: 'purchase_spend', history: [], currentVersion: { id, recordId: id, companyId: company, revision: 1, activity: { kind: 'purchase_spend', state,
      payload: { importId: '93930000-0000-4000-8000-0000000000a1', mappingSource: 'unmatched', glAccount: '6100', supplierName: 'Staples', description: 'Toner', ...payload } } } } as unknown as CollectionActivityRecord
  }
  test('the body says its scope: a group mapping has an empty description, a line mapping a description', () => {
    const mapping = { glAccount: '6100', vendor: 'Staples', description: '', category: 1, naicsCode: '339940', marginChoice: 'with_margins' }
    expect(validateScope3SpendMappingSaveInput({ expectedRevision: 0, scope: 'group', mapping, categoryConfirmed: null, activityOverlapConfirmed: null }).scope).toBe('group')
    expect(validateScope3SpendMappingSaveInput({ expectedRevision: 0, mapping: { ...mapping, description: 'Toner' }, categoryConfirmed: null, activityOverlapConfirmed: null }).scope).toBe('line')
    expect(() => validateScope3SpendMappingSaveInput({ expectedRevision: 0, scope: 'group', mapping: { ...mapping, description: 'Toner' }, categoryConfirmed: null, activityOverlapConfirmed: null })).toThrow()
    expect(() => validateScope3SpendMappingSaveInput({ expectedRevision: 0, scope: 'line', mapping, categoryConfirmed: null, activityOverlapConfirmed: null })).toThrow()
    expect(() => validateScope3SpendMappingSaveInput({ expectedRevision: 0, scope: 'group', mapping: { ...mapping, vendor: '', glAccount: ' ' }, categoryConfirmed: null, activityOverlapConfirmed: null })).toThrow()
    expect(() => validateScope3SpendMappingSaveInput({ expectedRevision: 0, scope: 'all', mapping, categoryConfirmed: null, activityOverlapConfirmed: null })).toThrow()
  })
  test('the group is every active imported line of the vendor and account not mapped by the file and without its own remembered mapping', () => {
    const toner = record({}), paper = record({ description: 'Paper', supplierName: 'STAPLES INC.' }), file = record({ description: 'Pens', mappingSource: 'file' }), withdrawn = record({ description: 'Desk' }, 'withdrawn')
    const otherAccount = record({ glAccount: '6200' }), manual = record({ importId: null, description: 'Manual' }), override = record({ description: 'Ink' })
    const overrideKey = sha256(scope3SpendMappingKeyInput({ glAccount: '6100', supplierName: 'Staples', description: 'Ink' }))
    const groupKey = sha256(scope3SpendGroupKeyInput({ glAccount: '6100', supplierName: 'Staples' })!)
    const all = [toner, paper, file, withdrawn, otherAccount, manual, override]
    expect(scope3SpendMappingGroup(all, groupKey, sha256, { scope: 'group', lineKeysWithOwnMapping: new Set([overrideKey]) }).map(r => r.id)).toEqual([toner.id, paper.id])
    // A line mapping still corrects exactly its own key's lines (the per-line override).
    expect(scope3SpendMappingGroup(all, overrideKey, sha256).map(r => r.id)).toEqual([override.id])
  })
})
