// TEST-ONLY REFERENCE (BF-20). Never imported by product code (not exported from index.ts).
// `convertScope3SpendCurrency` exactly as on main at 5b98b86 (after BF-14, PR #76): one save_collection_activity call per
// converted line, each line with its own correction reason. The BF-20 differential tests run this and the set-based
// implementation over the same data and compare every stored row and the response. The only change from main is the
// optional `reason` override, so the reference can also be run with BF-20's one shared reason (then every stored row,
// receipt hash included, must be identical).
import type { WorkspaceSql } from './workspace'
import { readCollectionActivities } from './collection'
import { validateCollectionSaveInput, type CollectionActivityRecord } from './collection-contract'
import type { PurchaseSpendCollectionPayload } from './scope3-collection-contract'
import { scope3SpendConversionReason, scope3SpendConvertAmount, scope3SpendNotesWithConversion, scope3SpendRateMatchesLineYear, validateScope3SpendConversionInput, type Scope3SpendConversion } from './scope3-spend-currency'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const problem = (message: string, code: string) => Object.assign(new Error(message), { code })
async function checkActor(tx: WorkspaceSql, actorId: string, message: string) {
  const actor = await tx.query<{ id: string }>('select neuvetra.current_user_id() id')
  if (actor.rows[0]?.id !== actorId) throw problem(message, '42501')
}

/**
 * Round 3 lane C (PR-11): converts every active imported spend line in one currency to US dollars at the user's rate, in
 * the caller's one transaction, through the existing record-save RPC (`save_collection_activity`, owner or admin; one
 * correction per line against the version read here). A line whose amount is not a plain positive number (a credit, text)
 * is skipped and listed, and so is a line whose calendar year is not the rate date's (BF-14, `rate_date_outside_line_year`). The lines are read back once at the end and checked. No new SQL: the integrator may later move
 * this to a set-based 0030 statement (see the round 3 lane C log).
 */
export async function convertScope3SpendCurrencyPerLineReference(tx: WorkspaceSql, actorId: string, companyId: string, input: unknown, options: { reason?: (c: Scope3SpendConversion) => string } = {}): Promise<{
  converted: Array<{ recordId: string; sourceId: string; versionId: string; revision: number; from: string; usd: string }>; skipped: Array<{ recordId: string; sourceId: string; reason: string }> }> {
  if (!UUID.test(actorId) || !UUID.test(companyId)) throw new Error('Scope 3 currency conversion unavailable.')
  await checkActor(tx, actorId, 'Scope 3 currency conversion unavailable.')
  const conversion = validateScope3SpendConversionInput(input)
  // Bug hunt (PR 22, 1 November 2026): each converted line is saved against the current setup version, as every correction
  // is (save_collection_activity requires it); a line imported before the latest setup save kept its old version and the
  // conversion was refused (23503) for good.
  const setupHead = (await tx.query<{ version_id: string }>('select version_id from neuvetra.company_setup_heads where company_id=$1', [companyId])).rows[0]?.version_id
  if (!setupHead) throw problem('Save company setup before converting spend.', 'setup_required')
  const lines = (await readCollectionActivities(tx, companyId)).filter(record => {
    const a = record.currentVersion.activity, p = a.payload as PurchaseSpendCollectionPayload
    return record.kind === 'purchase_spend' && a.state === 'active' && p.importId !== null && a.quantity.originalUnit === conversion.currency
  }).sort((x, y) => x.currentVersion.activity.sourceId.localeCompare(y.currentVersion.activity.sourceId) || x.id.localeCompare(y.id))
  const planned: Array<{ record: CollectionActivityRecord; from: string; usd: string }> = []
  const skipped: Array<{ recordId: string; sourceId: string; reason: string }> = []
  for (const record of lines) {
    const written = record.currentVersion.activity.quantity.originalValue.trim()
    if (!/^(0|[1-9][0-9]{0,11})(\.[0-9]{1,3})?$/.test(written)) { skipped.push({ recordId: record.id, sourceId: record.currentVersion.activity.sourceId, reason: written.startsWith('-') ? 'negative_amount_not_supported' : 'amount_not_a_number' }); continue }
    // BF-14 (audit B-5), after the amount checks so a credit is reported as a credit in any year: one rate is never applied across
    // years. Only a line of the rate date's own calendar year is converted; any other line of the currency (or one whose year is unknown:
    // no date and a period crossing years) is listed and stays held in its own currency, to be converted at a rate dated in its own year.
    const a = record.currentVersion.activity
    if (!scope3SpendRateMatchesLineYear({ lineDate: (a.payload as PurchaseSpendCollectionPayload).lineDate, period: a.period }, conversion.rateDate)) { skipped.push({ recordId: record.id, sourceId: a.sourceId, reason: 'rate_date_outside_line_year' }); continue }
    planned.push({ record, from: written, usd: scope3SpendConvertAmount(written, conversion.rate) })
  }
  for (const { record, from, usd } of planned) {
    const version = record.currentVersion, a = version.activity
    const full = { ...conversion, amount: from, usd }
    const request = validateCollectionSaveInput({ idempotencyKey: crypto.randomUUID(), expectedRevision: version.revision, expectedVersionId: version.id, correctionReason: (options.reason ?? scope3SpendConversionReason)(full),
      activity: { ...a, setupVersionId: setupHead, quantity: { originalValue: usd, originalUnit: 'USD', normalizedValue: usd, normalizedUnit: 'USD' }, notes: scope3SpendNotesWithConversion(a.notes, full) } })
    const receipt = (await tx.query<{ record_id: string; version_id: string; replayed: boolean }>('select * from neuvetra.save_collection_activity($1,$2,$3::text::jsonb)', [companyId, record.id, JSON.stringify(request)])).rows[0]
    if (!receipt || receipt.record_id !== record.id || receipt.replayed) throw new Error('Scope 3 currency conversion returned no receipt.')
  }
  // Read back once: each converted line is one revision later, in US dollars, with exactly the planned amount.
  const after = new Map((await readCollectionActivities(tx, companyId)).map(record => [record.id, record]))
  const converted = planned.map(({ record, from, usd }) => {
    const now = after.get(record.id)!.currentVersion
    if (now.revision !== record.currentVersion.revision + 1 || now.previousVersionId !== record.currentVersion.id || now.activity.quantity.originalUnit !== 'USD' || now.activity.quantity.originalValue !== usd) throw new Error('Scope 3 currency conversion could not be read back.')
    return { recordId: record.id, sourceId: now.activity.sourceId, versionId: now.id, revision: now.revision, from, usd }
  })
  return { converted, skipped }
}
