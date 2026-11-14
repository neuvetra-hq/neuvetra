// BF-18 (migration 0032, 13 November 2026). PGlite with every migration up to 0032: the database refuses exactly what the
// TypeScript contract refuses for the new optional keys (an electricity instrument's instrumentId, registry and faceMwh,
// for BF-11; scope2OverlapConfirmedDistinct on asset_energy and building_average, for BF-17), and a payload saved
// without them is read back byte for byte as before. The migration of a populated schema-31 database (backfills, hashes,
// readiness, re-run) is proved natively in hosted.test.ts and apps/site-api/src/staging/postgres.test.ts.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { PGlite } from '@electric-sql/pglite'
import { readMigrationManifest } from './staging-migrations'
import { validateCollectionActivity } from './collection-contract'
import { SCOPE3_PAYLOAD_FIXTURES } from './scope3-payload-fixtures'

const linkage = { setupVersionId: '32500000-0000-4000-8000-000000000001', locationId: '32600000-0000-4000-8000-000000000001', state: 'active', withdrawalReason: null, quality: 'actual', estimateBasis: null,
  period: { start: '2025-01-01', endExclusive: '2026-01-01' }, reference: 'Synthetic BF-18', notes: '', evidenceIds: [] as string[] }
const certificate = { type: 'energy_attribute_certificate', mwh: '250', qualityCriteriaMet: true, vintageYear: 2025, evidenceReference: null, generationTechnology: 'wind', rateLbPerMwh: null }
const electricity = (instrument: Record<string, unknown>) => ({ ...linkage, kind: 'electricity', sourceId: 'M-2', quantity: { originalValue: '250000', originalUnit: 'kWh', normalizedValue: '250000', normalizedUnit: 'kWh' },
  payload: { meterOrAccountNumber: 'M-2', utilityName: 'Utility', site: 'Site', zip: '94105', subregion: 'CAMX', utilityEiaId: null, instruments: [instrument] } })
const fixture = (kind: string, label: string) => SCOPE3_PAYLOAD_FIXTURES.find(f => f.kind === kind && f.label === `${kind}: ${label}` && f.valid)!
const scope3 = (f: ReturnType<typeof fixture>, extra: Record<string, unknown>) => ({ ...linkage, kind: f.kind, sourceId: 'S-1', quantity: f.quantity, payload: { ...(f.payload as Record<string, unknown>), ...extra } })

describe('0032: the new optional keys, in the database and in the contract', () => {
  let db: PGlite
  beforeAll(async () => {
    db = new PGlite()
    await db.exec(`create role authenticated; create role anon; create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`)
    const manifest = await readMigrationManifest()
    expect(manifest[31]!.name).toBe('0032_instrument_identity_and_bindings.sql')
    for (const migration of manifest.slice(0, 26)) await db.exec(migration.sql)
    await db.exec(`create schema storage;
      create table storage.buckets(id text primary key,name text not null,public boolean not null,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text not null references storage.buckets(id),name text not null,unique(bucket_id,name));
      alter table storage.objects enable row level security; grant usage on schema storage to authenticated,anon;`)
    for (const migration of manifest.slice(26)) await db.exec(migration.sql)
  }, 120_000)
  afterAll(async () => { await db?.close() })

  const sqlAccepts = (activity: unknown) => db.query('select neuvetra.collection_assert_activity($1::text::jsonb)', [JSON.stringify(activity)]).then(() => true, (error: { code?: string }) => { expect(error.code).toBe('22023'); return false })
  const contractAccepts = (activity: unknown) => { try { validateCollectionActivity(activity); return true } catch { return false } }

  test('an instrument identity: accepted and refused alike by the database and the contract', async () => {
    const cases: Array<[Record<string, unknown>, boolean]> = [
      [{}, true], [{ instrumentId: 'WREGIS-123' }, true], [{ instrumentId: 'WREGIS-123', registry: 'WREGIS', faceMwh: '250' }, true],
      [{ registry: null }, true], [{ registry: 'M-RETS', faceMwh: '120.5' }, true], [{ instrumentId: 'x'.repeat(120), registry: 'r'.repeat(80) }, true],
      [{ instrumentId: 'PG&E 2025 power content label, rate 0.0331' }, true], [{ faceMwh: '999999999999.999' }, true],
      [{ instrumentId: '' }, false], [{ instrumentId: '   ' }, false], [{ instrumentId: 'x'.repeat(121) }, false], [{ instrumentId: 'A\tB' }, false], [{ instrumentId: 'A\nB' }, false],
      [{ instrumentId: 'A\u0085B' }, false], [{ instrumentId: 7 }, false], [{ instrumentId: null }, false],
      [{ registry: '' }, false], [{ registry: 'r'.repeat(81) }, false], [{ registry: 'R\u0007' }, false], [{ registry: 5 }, false],
      [{ faceMwh: '0' }, false], [{ faceMwh: '0.000' }, false], [{ faceMwh: '1.2345' }, false], [{ faceMwh: '' }, false], [{ faceMwh: '-1' }, false],
      [{ faceMwh: '01' }, false], [{ faceMwh: '1e3' }, false], [{ faceMwh: 250 }, false], [{ faceMwh: null }, false], [{ serial: 'WREGIS-123' }, false],
    ]
    for (const [extra, expected] of cases) {
      const activity = electricity({ ...certificate, ...extra })
      expect([JSON.stringify(extra), await sqlAccepts(activity), contractAccepts(activity)]).toEqual([JSON.stringify(extra), expected, expected])
    }
  })

  test('the contract keeps each identity key present exactly when sent, so a saved payload reads back byte for byte', () => {
    const read = (instrument: Record<string, unknown>) => (validateCollectionActivity(electricity(instrument)).payload as { instruments: unknown[] }).instruments[0]
    expect(read(certificate)).toEqual(certificate)
    expect(Object.keys(read(certificate) as object)).not.toContain('instrumentId')
    expect(read({ ...certificate, registry: null })).toEqual({ ...certificate, registry: null })
    expect(read({ ...certificate, instrumentId: 'GT-2025', faceMwh: '120' })).toEqual({ ...certificate, instrumentId: 'GT-2025', faceMwh: '120' })
  })

  test('scope2OverlapConfirmedDistinct: a boolean on asset_energy and building_average only, alike in both', async () => {
    const asset = fixture('asset_energy', 'electricity, sub-metered'), building = fixture('building_average', 'office'), partner = fixture('partner_reported', 'tenant share by area')
    const cases: Array<[ReturnType<typeof fixture>, Record<string, unknown>, boolean]> = [
      [asset, {}, true], [asset, { scope2OverlapConfirmedDistinct: true }, true], [asset, { scope2OverlapConfirmedDistinct: false }, true],
      [asset, { scope2OverlapConfirmedDistinct: null }, false], [asset, { scope2OverlapConfirmedDistinct: 'yes' }, false],
      [building, { scope2OverlapConfirmedDistinct: true }, true], [building, { scope2OverlapConfirmedDistinct: 1 }, false],
      [partner, { scope2OverlapConfirmedDistinct: true }, false],
    ]
    for (const [f, extra, expected] of cases) {
      const activity = scope3(f, extra)
      expect([f.kind, JSON.stringify(extra), await sqlAccepts(activity), contractAccepts(activity)]).toEqual([f.kind, JSON.stringify(extra), expected, expected])
    }
    const confirmed = validateCollectionActivity(scope3(asset, { scope2OverlapConfirmedDistinct: false })).payload
    expect((confirmed as { scope2OverlapConfirmedDistinct?: boolean }).scope2OverlapConfirmedDistinct).toBe(false)
    expect(Object.keys(validateCollectionActivity(scope3(asset, {})).payload)).not.toContain('scope2OverlapConfirmedDistinct')
  })
})
