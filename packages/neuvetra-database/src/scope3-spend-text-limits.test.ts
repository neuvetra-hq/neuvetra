/**
 * BF-32 F5: spend-mapping text and import-withdrawal reasons get the same named 422 (CollectionTextLimitError) as the
 * activity save, counted after NFC. These checks run before any database call, so no database is needed.
 */
import { describe, expect, test } from 'bun:test'
import { CollectionTextLimitError } from './collection-text-rule'
import { validateScope3SpendMappingSaveInput, withdrawScope3SpendImport } from './scope3-spend-imports'
import type { WorkspaceSql } from './workspace'

const ID = '93900000-0000-4000-8000-0000000000a9'
const noDb = { query: async () => { throw new Error('the database must not be reached') } } as unknown as WorkspaceSql
const mapping = (over: Record<string, string>) => ({ expectedRevision: 0, mapping: { glAccount: '6110', vendor: 'Staples', description: 'Ink', category: 1, naicsCode: '325910', marginChoice: 'with_margins', ...over }, categoryConfirmed: null, activityOverlapConfirmed: null })
const refusal = (run: () => unknown) => { try { run() } catch (e) { return e as Error } return undefined }
const refusalAsync = async (run: () => Promise<unknown>) => { try { await run() } catch (e) { return e as Error } return undefined }
const DECOMPOSED = 'é'

describe('BF-32 F5: spend text limits', () => {
  test('mapping text over its limit is a named refusal with the excess; the limit is the column limit', () => {
    for (const [field, label, max] of [['glAccount', 'GL account', 120], ['vendor', 'Vendor', 200], ['description', 'Description', 200]] as const) {
      const e = refusal(() => validateScope3SpendMappingSaveInput(mapping({ [field]: 'x'.repeat(max + 3) })))
      expect(e).toBeInstanceOf(CollectionTextLimitError)
      expect(e?.message).toContain(`${label} is ${max + 3} characters; the limit is ${max} (3 over).`)
      expect(refusal(() => validateScope3SpendMappingSaveInput(mapping({ [field]: 'x'.repeat(max) })))).toBeUndefined()
    }
  })
  test('mapping text is counted after NFC: decomposed pairs that compose to the limit are accepted, one more is refused', () => {
    expect(refusal(() => validateScope3SpendMappingSaveInput(mapping({ vendor: DECOMPOSED.repeat(200) })))).toBeUndefined()
    const e = refusal(() => validateScope3SpendMappingSaveInput(mapping({ vendor: DECOMPOSED.repeat(201) })))
    expect(e).toBeInstanceOf(CollectionTextLimitError)
    expect(e?.message).toContain('Vendor is 201 characters; the limit is 200 (1 over).')
  })
  test('an over-long import withdrawal reason is named (field "Withdrawal reason"), never the "at least 3 characters" sentence', async () => {
    const e = await refusalAsync(() => withdrawScope3SpendImport(noDb, ID, ID, ID, { reason: 'w'.repeat(2003) }))
    expect(e).toBeInstanceOf(CollectionTextLimitError)
    expect(e?.message).toContain('Withdrawal reason is 2,003 characters; the limit is 2,000 (3 over).')
    expect(e?.message).not.toContain('at least 3 characters')
    const exact = await refusalAsync(() => withdrawScope3SpendImport(noDb, ID, ID, ID, { reason: DECOMPOSED.repeat(2000) }))
    expect(exact?.message).toBe('the database must not be reached')
  })
  test('a short or control-character withdrawal reason keeps the "at least 3 characters" sentence', async () => {
    for (const reason of ['no', 'bad\u0001reason']) {
      const e = await refusalAsync(() => withdrawScope3SpendImport(noDb, ID, ID, ID, { reason }))
      expect(e).not.toBeInstanceOf(CollectionTextLimitError)
      expect(e?.message).toBe('Say why this import is withdrawn (at least 3 characters).')
    }
  })
})
