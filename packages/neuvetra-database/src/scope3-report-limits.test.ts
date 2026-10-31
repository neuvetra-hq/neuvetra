// Round 2c integration (Claude, 31 October 2026; owner decision on integration-r2b "At risk"): the frozen report's size
// limits. 0030 stores each text (report and CSV) up to 128 MiB, and its prepare RPC takes a request whose text form is at
// most 255 MiB: the most PostgreSQL's jsonb holds (268,435,455 bytes, JENTRY_OFFLENMASK) with room for the request's other
// fields. The API refuses anything larger before any call (413 report_too_large), so a request it sends can never be
// refused by 0030's size checks or fail jsonb's own ceiling (which would surface as a different error).
// Measured worst case at the line cap (3,000 ten-mode average commuting records, every free-text field at its maximum,
// 20 evidence files each, the longest numbers): report text 83,903,788 bytes, CSV 68,205,657, request JSON 161.7 MB
// (tmp-int8/logs/report-size-*.log); the native suite (scope3-round2-postgres.test.ts) prepares and approves it.
import { describe, expect, test } from 'bun:test'
import { SCOPE3_REPORT_MAX_REQUEST_BYTES, SCOPE3_REPORT_MAX_TEXT_BYTES, SCOPE3_REPORT_REQUEST_SLACK_BYTES } from './scope3-assessment-contract'
import { scope3ReportDraft, scope3TextChunks, SCOPE3_REPORT_TEXT_CHUNK_CHARS } from './scope3-reports'
import { readMigrationManifest } from './staging-migrations'
import type { Scope3ResultsDocument } from './scope3-trace'

const fixture: Scope3ResultsDocument = await Bun.file(new URL('../../../apps/site-web/src/lib/scope3-results.fixture.json', import.meta.url)).json()
const company = '31020000-0000-4000-8000-000000000001', setupVersion = '31050000-0000-4000-8000-000000000001', owner = '31010000-0000-4000-8000-000000000001'
const labels = { kind: (kind: string) => kind.replace(/_/g, ' '), reason: (code: string) => code, period: (start: string | null | undefined, end: string | null | undefined) => `${start} – ${end}` }
const draft = (limits: { maxTextBytes?: number; maxRequestBytes?: number } = {}) => scope3ReportDraft({
  results: { ...JSON.parse(JSON.stringify(fixture)), companyId: company, records: [], lineBudget: { max: 3000, used: 0, remaining: 3000 } }, previous: null, reportingYear: 2025, expectedRevision: 0,
  reason: null, idempotencyKey: '31090000-0000-4000-8000-000000000001', setupVersionId: setupVersion, consolidationApproach: 'operational_control', preparedBy: owner,
  preparedAt: '2026-10-31T10:00:00.000Z', engineSha256: fixture.methods[0]!.engineSha256, labels, ...limits,
})
const bytes = (text: string) => Buffer.byteLength(text, 'utf8')
const refusal = (run: () => unknown) => { try { run(); return null } catch (error) { return (error as { code?: string }).code ?? String(error) } }

describe('Scope 3 frozen report size limits (round 2c; round 3)', () => {
  test('0030 stores each text up to 128 MiB; the texts travel as plain text parameters and the request is small (round 3)', async () => {
    expect(SCOPE3_REPORT_MAX_TEXT_BYTES).toBe(128 * 1024 * 1024)
    expect(SCOPE3_REPORT_MAX_REQUEST_BYTES).toBe(4 * 1024 * 1024)
    const sql = (await readMigrationManifest()).find(item => item.name === '0030_scope3_completion.sql')!.sql
    expect(sql).toContain(`report_text text not null check(octet_length(report_text) between 2 and ${SCOPE3_REPORT_MAX_TEXT_BYTES})`)
    expect(sql).toContain(`csv_text text not null check(octet_length(csv_text)<=${SCOPE3_REPORT_MAX_TEXT_BYTES})`)
    // Round 3 (owner decision 6): the texts are staged in chunks (at most 8 MiB each) and assembled by prepare; the request
    // limit covers the small fields only.
    expect(sql).toContain('create function neuvetra.prepare_scope3_report(target_company uuid,request jsonb)')
    expect(sql).toContain(`if octet_length(request::text)>${SCOPE3_REPORT_MAX_REQUEST_BYTES} then raise exception 'Scope 3 report too large'`)
    expect(sql).toContain(`if report_text is null or octet_length(report_text) not between 2 and ${SCOPE3_REPORT_MAX_TEXT_BYTES} or octet_length(csv_text)>${SCOPE3_REPORT_MAX_TEXT_BYTES} then raise exception 'Scope 3 report too large'`)
    expect(sql).toContain('chunk text not null check(octet_length(chunk) between 1 and 8388608)')
    // 2,000,000 UTF-16 units are at most 6,000,000 UTF-8 bytes (3 per unit at most), inside a chunk's limit.
    expect(3 * SCOPE3_REPORT_TEXT_CHUNK_CHARS).toBeLessThanOrEqual(8_388_608)
    const emoji = '😀'.repeat(5) // surrogate pairs are never split
    expect(scope3TextChunks(`a${emoji}`, 2).join('')).toBe(`a${emoji}`)
    expect(scope3TextChunks(`a${emoji}`, 2).every(chunk => !/[\ud800-\udbff]$/.test(chunk))).toBe(true)
    // No parse, re-serialisation or re-hash of a text in the RPC: the table's two checks hash each text once.
    const prepare = sql.slice(sql.indexOf('create function neuvetra.prepare_scope3_report('), sql.indexOf('revoke all on function neuvetra.prepare_scope3_report('))
    expect(prepare).not.toContain("::jsonb; exception")
    expect(prepare).not.toContain("sha256(convert_to(")
    expect(prepare).not.toContain("request->>'reportText'")
    // No other size is left for either text or the request (round 2's 64 MiB, 160 MiB and round 2c's 255 MiB are gone).
    for (const old of ['67108864', '167772160', '267386880']) expect(sql).not.toContain(old)
    expect(SCOPE3_REPORT_REQUEST_SLACK_BYTES).toBeGreaterThanOrEqual(2 * 20_000 + 1024)
  })

  test('the draft refuses a text over its limit and a request over its limit (report_too_large), before any call', () => {
    const full = draft()
    const json = bytes(JSON.stringify(full.request))
    const report = bytes(full.reportText), csv = bytes(full.csvText)
    // The request no longer carries the texts (only the change-log basis, a fraction of the report text).
    expect(json).toBeLessThan(report + csv)
    expect(Object.keys(full.request)).not.toContain("csvText")
    expect(Object.keys(full.request)).not.toContain('reportText')
    // Each text exactly at its limit is accepted; one byte over is refused.
    expect(refusal(() => draft({ maxTextBytes: Math.max(report, csv) }))).toBeNull()
    expect(refusal(() => draft({ maxTextBytes: Math.max(report, csv) - 1 }))).toBe('report_too_large')
    // The request: its JSON plus the slack exactly at the limit is accepted; one byte less is refused.
    expect(refusal(() => draft({ maxRequestBytes: json + SCOPE3_REPORT_REQUEST_SLACK_BYTES }))).toBeNull()
    expect(refusal(() => draft({ maxRequestBytes: json + SCOPE3_REPORT_REQUEST_SLACK_BYTES - 1 }))).toBe('report_too_large')
    // A test can only lower the limits, never raise them past 0030's.
    expect(refusal(() => draft({ maxRequestBytes: Number.MAX_SAFE_INTEGER, maxTextBytes: Number.MAX_SAFE_INTEGER }))).toBeNull()
  })
})
