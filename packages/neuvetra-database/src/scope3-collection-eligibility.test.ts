import { describe, expect, test } from 'bun:test'
import type { CollectionContext } from './collection-contract'
import { SCOPE3_PAYLOAD_FIXTURES } from './scope3-payload-fixtures'
import { reasonText, reasonTextKnown } from './plain-language-labels'
import { planScope3Calculation, planScope3ProductOverlap, planScope3Supersession, scope3DistanceCommutingPeriods,
  type Scope3CollectionKind, type Scope3CollectionVersion, type Scope3PlanOptions } from './scope3-collection'

const year = { start: '2025-01-01', endExclusive: '2026-01-01' }
const nextYear = { start: '2026-01-01', endExclusive: '2027-01-01' }
const location: CollectionContext['locations'][number] = { id: 'office', name: 'Office', inclusion: 'included', control: 'reporting_company',
  entityId: null, startMode: 'period_start', endMode: 'period_end' }
const context: CollectionContext = { companyId: 'company', setupVersionId: 'setup', setupRevision: 1, boundaryApproach: 'operational_control', reportingPeriod: year, locations: [location] }
function record(kind: Scope3CollectionKind, id = kind as string): Scope3CollectionVersion {
  const f = structuredClone(SCOPE3_PAYLOAD_FIXTURES.find(f => f.valid && f.kind === kind)!)
  return { id: `version-${id}`, recordId: id, companyId: context.companyId, revision: 1, previousVersionId: null, correctionReason: null,
    activity: { locationId: location.id, setupVersionId: 'setup', sourceId: id, state: 'active', withdrawalReason: null, quality: 'actual', estimateBasis: null,
      reference: 'Synthetic eligibility regression', notes: '', evidenceIds: [], period: year, kind, quantity: f.quantity, payload: f.payload },
    payloadSha256: 'a'.repeat(64), createdBy: 'actor', createdAt: '2025-06-01T00:00:00.000Z' } as Scope3CollectionVersion
}
const at = (edits: Partial<typeof location>): CollectionContext => ({ ...context, locations: [{ ...location, ...edits }] })
const plan = (v: Scope3CollectionVersion, ctx = context, options: Scope3PlanOptions = {}) => planScope3Calculation(v, ctx, [], options)

describe('M1: superseded spend retains the recorded tax treatment', () => {
  for (const taxTreatment of ['includes_sales_tax', 'excludes_sales_tax', 'unknown'] as const) test(taxTreatment, () => {
    const v = record('purchase_spend')
    if (v.activity.kind !== 'purchase_spend') throw new Error('fixture kind')
    v.activity.payload.taxTreatment = taxTreatment
    const result = plan(v, context, { supersession: new Map([[v.recordId, 'supplier']]) })
    expect(result).toMatchObject({ action: 'hold', status: 'excluded', reasons: ['superseded_by_supplier_record'], call: null })
    expect(result.notes).toEqual([`spend_tax_treatment_${taxTreatment}`, 'superseded_by:supplier'])
    expect(plan(v).notes.filter(n => n.startsWith('spend_tax_treatment_'))).toEqual([`spend_tax_treatment_${taxTreatment}`])
    expect(JSON.stringify(plan(v).call)).not.toContain('taxTreatment')
  })
})

const invalidLocations: Array<[string, Partial<typeof location>, 'excluded' | 'input_needed', string]> = [
  ['excluded reporting entity', { entityId: 'entity', entity: { id: 'entity', inclusion: 'excluded', control: 'none', ownershipPercent: null } }, 'excluded', 'entity_excluded_by_company_setup'],
  ['unknown reporting entity', { entityId: 'entity', entity: { id: 'entity', inclusion: 'unknown', control: 'none', ownershipPercent: null } }, 'input_needed', 'entity_inclusion_unknown'],
  ['absent linkage metadata', { entityId: undefined }, 'input_needed', 'boundary_metadata_unavailable'],
  ['missing linked entity', { entityId: 'entity', entity: null }, 'input_needed', 'location_entity_unresolved'],
  ['wrong linked entity', { entityId: 'entity', entity: { id: 'other', inclusion: 'included', control: 'none', ownershipPercent: null } }, 'input_needed', 'location_entity_unresolved'],
  ['unknown coverage start', { startMode: 'unknown' }, 'input_needed', 'location_coverage_unknown'],
  ['unknown coverage end', { endMode: 'unknown' }, 'input_needed', 'location_coverage_unknown'],
  ['missing specific coverage date', { startMode: 'specific', start: null }, 'input_needed', 'location_coverage_unknown'],
  ['reversed coverage dates', { startMode: 'specific', start: '2025-07-01', endMode: 'specific', endExclusive: '2025-06-01' }, 'input_needed', 'location_coverage_unknown'],
  ['coverage starts after activity', { startMode: 'specific', start: '2025-02-01' }, 'input_needed', 'activity_outside_location_coverage'],
  ['coverage ends before activity', { endMode: 'specific', endExclusive: '2025-12-01' }, 'input_needed', 'activity_outside_location_coverage'],
]

describe('MR-02: reporting eligibility gates native Scope 3 and participation prepasses', () => {
  for (const approach of [undefined, 'unknown'] as const) test(`unresolved consolidation approach (${approach}) cannot calculate or participate`, () => {
    const ctx = { ...context, boundaryApproach: approach }
    for (const kind of new Set(SCOPE3_PAYLOAD_FIXTURES.map(f => f.kind)))
      expect(plan(record(kind), ctx)).toMatchObject({ action: 'hold', status: 'input_needed', reasons: ['scope3_consolidation_approach_required'], call: null })
    expect(scope3DistanceCommutingPeriods([record('employee_commuting')], ctx)).toEqual([])
  })
  test('unresolved company consolidation has a generic explanation; the existing lease explanation stays unchanged', () => {
    const code = 'scope3_consolidation_approach_required'
    expect(reasonTextKnown(code)).toBe(true)
    expect(reasonText(code)).toBe('Choose the company’s consolidation approach in company setup before calculating Scope 3 records. These records are not counted until the reporting boundary is defined.')
    expect(reasonText(code)).not.toMatch(/lease/i)
    expect(reasonText('consolidation_approach_required')).toBe('Choose the company’s consolidation approach in company setup; whether this lease belongs in Scope 3 or in Scope 1 and 2 depends on it. The record isn’t counted until then.')
  })
  for (const [label, edits, status, reason] of invalidLocations) {
    test(label, () => {
      const ctx = at(edits)
      for (const kind of new Set(SCOPE3_PAYLOAD_FIXTURES.map(f => f.kind))) {
        expect(plan(record(kind), ctx)).toMatchObject({ action: 'hold', status, reasons: [reason], call: null })
      }
    })
    test(`${label}: participation prepasses`, () => {
      const ctx = at(edits)
      const spend = record('purchase_spend'), supplier = record('purchase_supplier'), partner = record('partner_reported')
      if (supplier.activity.kind !== 'purchase_supplier' || partner.activity.kind !== 'partner_reported') throw new Error('fixture kind')
      const supersedes = { supplierName: 'Synthetic Software LLC', mappingKeys: [] }
      supplier.activity.payload.supersedesSpend = supersedes
      partner.activity.payload.supersedesSpend = supersedes
      const eligible = { ...location, id: 'eligible' }
      spend.activity.locationId = eligible.id
      const both = { ...ctx, locations: [...ctx.locations, eligible] }
      const ghg = record('sold_ghg_product'), eol = record('end_of_life_split')
      if (ghg.activity.kind !== 'sold_ghg_product' || eol.activity.kind !== 'end_of_life_split') throw new Error('fixture kind')
      ghg.activity.payload.productLabel = eol.activity.payload.productLabel = 'Same product'
      ghg.activity.payload.useReleasePercent = '100'
      eol.activity.locationId = eligible.id
      expect({ supersession: [...planScope3Supersession([spend, supplier, partner], both, { sha256: () => 'unused' })],
        commuting: scope3DistanceCommutingPeriods([record('employee_commuting')], ctx), productOverlap: [...planScope3ProductOverlap([ghg, eol], both)] })
        .toEqual({ supersession: [], commuting: [], productOverlap: [] })
    })
  }

  test('wrong-period records cannot calculate, supersede or introduce overlaps', () => {
    const spend = record('purchase_spend'), supplier = record('purchase_supplier'), commute = record('employee_commuting'), ghg = record('sold_ghg_product'), eol = record('end_of_life_split')
    if (supplier.activity.kind !== 'purchase_supplier' || ghg.activity.kind !== 'sold_ghg_product' || eol.activity.kind !== 'end_of_life_split') throw new Error('fixture kind')
    supplier.activity.payload.supersedesSpend = { supplierName: 'Synthetic Software LLC', mappingKeys: [] }
    ghg.activity.payload.productLabel = eol.activity.payload.productLabel = 'Same product'
    ghg.activity.payload.useReleasePercent = '100'
    for (const v of [supplier, commute, ghg, eol]) v.activity.period = nextYear
    expect(plan(commute)).toMatchObject({ status: 'input_needed', reasons: ['activity_outside_reporting_period'], call: null })
    expect(planScope3Supersession([spend, supplier], context, { sha256: () => 'unused' }).size).toBe(0)
    expect(scope3DistanceCommutingPeriods([commute], context)).toEqual([])
    expect(planScope3ProductOverlap([ghg, eol], context).size).toBe(0)
    expect(plan(commute, context, { reportingPeriod: null }).reasons).toEqual(['reporting_period_required_outside_2025'])
    expect(plan(commute, context, { reportingPeriod: nextYear }).action).toBe('calculate')
    expect(plan(commute, { ...context, reportingPeriod: undefined }).action).toBe('calculate')
  })

  test('exact coverage endpoints and explicit reporting-company linkage calculate', () => {
    expect(plan(record('waste'), at({ startMode: 'specific', start: year.start, endMode: 'specific', endExclusive: year.endExclusive })).action).toBe('calculate')
  })

  test('eligible third-party operating leases retain their category-specific consolidation rules', () => {
    const leased = record('asset_energy')
    if (leased.activity.kind !== 'asset_energy') throw new Error('fixture kind')
    leased.activity.payload.category = 8
    leased.activity.payload.leaseType = 'operating'
    leased.activity.payload.noOperationalControlBasis = 'Landlord operates the asset.'
    const external = at({ control: 'landlord', entityId: 'entity', entity: { id: 'entity', inclusion: 'included', control: 'none', ownershipPercent: '0' } })
    expect(plan(leased, external, { consolidationApproach: 'operational_control' }).action).toBe('calculate')
    expect(plan(leased, { ...external, boundaryApproach: 'equity_share' }, { consolidationApproach: 'equity_share' }).action).toBe('calculate')
    leased.activity.payload.leaseType = 'finance'
    expect(plan(leased, external, { consolidationApproach: 'operational_control' }).reasons).toContain('finance_lease_in_scope1_2')
  })
})
