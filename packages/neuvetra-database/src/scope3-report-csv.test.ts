import { expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { scope3Csv, scope3CsvEscape } from './scope3-report-csv'
import { buildScope3ReportDocument, scope3ReportCsv, scope3ReportText } from './scope3-report-document'
import { SCOPE3_CSV_LABELS } from './plain-language-labels'
import type { Scope3ResultsDocument } from './scope3-trace'
import baseline from './testdata/scope3-csv-byte-baseline.json'

const sha = (text: string) => createHash('sha256').update(text).digest('hex')
// Keep the exact inputs behind the historical byte baseline when current UI fixtures acquire a new engine pin.
const fixture = async (name: string): Promise<Scope3ResultsDocument> => Bun.file(new URL(`./testdata/scope3-csv-frozen-inputs/${name}`, import.meta.url)).json()

test('CSV and frozen v3 bytes keep record order, quoting, Unicode and formula protection', async () => {
  for (const file of ['scope3-results.fixture.json', 'scope3-results-downstream.fixture.json']) {
    const original = await fixture(file)
    const special = structuredClone(original)
    special.records[0]!.reference = '"雪😀", first\r\nsecond'
    special.records[0]!.sourceId = '=SUM(1,2)'
    const inputs = [
      ['original', original, SCOPE3_CSV_LABELS],
      ['reversed order', { ...original, records: [...original.records].reverse(), registerSha256s: Object.fromEntries(Object.entries(original.registerSha256s).reverse()) }, SCOPE3_CSV_LABELS],
      ['quotes newlines unicode formula', special, { ...SCOPE3_CSV_LABELS, kind: (kind: string) => `=label,"${kind}" 雪😀\nnext` }],
    ] as const
    for (const [name, results, labels] of inputs) {
      const document = buildScope3ReportDocument({ results, reportingYear: 2025, revision: 1, setupVersionId: '93300000-0000-4000-8000-0000000000c1',
        consolidationApproach: 'operational_control', preparedBy: '93300000-0000-4000-8000-0000000000a1', preparedAt: '2026-10-30T10:00:00.000Z', previous: null })
      const expected = baseline.cases.find(row => row.name === `${file}: ${name}`)!
      expect(expected).toBeDefined()
      const csv = scope3Csv(results, labels), frozen = scope3ReportCsv(document, labels)
      expect(sha(csv)).toBe(expected.csvSha256)
      expect(Buffer.byteLength(csv)).toBe(expected.csvBytes)
      expect(sha(frozen)).toBe(expected.frozenCsvSha256)
      expect(Buffer.byteLength(frozen)).toBe(expected.frozenCsvBytes)
      expect(sha(scope3ReportText(document))).toBe(expected.reportSha256)
    }
  }
})

test('a prefixed CSV retains exactly the existing escaping and final newline', async () => {
  const results = await fixture('scope3-results.fixture.json')
  const prefix = ['# 雪😀, "quoted"', '=SUM(1,2)', '# first\r\nsecond']
  const expected = prefix.map(scope3CsvEscape).join('\n') + '\n' + scope3Csv(results, SCOPE3_CSV_LABELS)
  expect(scope3Csv(results, SCOPE3_CSV_LABELS, prefix)).toBe(expected)
  expect(scope3Csv(results, SCOPE3_CSV_LABELS, [])).toBe(scope3Csv(results, SCOPE3_CSV_LABELS))
})

test('large CSV builds provide bounded cleanup opportunities without changing bytes', async () => {
  const results = await fixture('scope3-results.fixture.json')
  results.records = Array.from({ length: 600 }, () => results.records[0]!)
  const expected = scope3Csv(results, SCOPE3_CSV_LABELS)
  let checkpoints = 0
  expect(scope3Csv(results, SCOPE3_CSV_LABELS, [], () => { checkpoints++ })).toBe(expected)
  expect(checkpoints).toBeGreaterThan(1)
})
