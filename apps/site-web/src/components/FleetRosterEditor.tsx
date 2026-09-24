import type { M75Link, M75RosterAsset, M75StatementInput } from '../../../../packages/neuvetra-database/src/m75-contract'
import type { M71Snapshot } from '../../../../packages/neuvetra-database/src/m71-contract'

import { newFleetAsset } from '@/lib/m75-form'

const text = (value: string) => value === '' ? null : value

export function FleetRosterEditor({ statement, links, coverage, disabled, onStatement, onLinks }: {
  statement: M75StatementInput; links: M75Link[]; coverage: M71Snapshot | null; disabled: boolean;
  onStatement: (value: M75StatementInput) => void; onLinks: (value: M75Link[]) => void;
}) {
  const patch = (value: Partial<M75StatementInput>) => onStatement({ ...statement, ...value })
  const asset = (rowId: string, value: Partial<M75RosterAsset>) => patch({ assets: statement.assets.map(row => row.rowId === rowId ? { ...row, ...value } : row) })
  const add = () => { const row = newFleetAsset(); patch({ assets: [...statement.assets, row] }); onLinks([...links, { rowId: row.rowId, sourceId: null }]) }
  return <fieldset disabled={disabled} className="fleet-editor">
    <legend>Declared fleet · synthetic evidence</legend>
    <p>Enter the fleet from its own records before matching workpapers. Include vehicles with unknown facts or an unsupported method. This declaration does not establish that every real vehicle was discovered.</p>
    <div className="fleet-fields">
      <label>Roster issuer<input value={statement.issuer} maxLength={120} onChange={e => patch({ issuer: e.target.value })} /></label>
      <label>Roster reference<input value={statement.reference} maxLength={120} onChange={e => patch({ reference: e.target.value })} /></label>
      <label>Description<textarea value={statement.description} maxLength={2000} onChange={e => patch({ description: e.target.value })} /></label>
      <label>Records checked to identify the whole fleet<textarea value={statement.discoveryBasis} maxLength={2000} onChange={e => patch({ discoveryBasis: e.target.value })} /></label>
      <label>Declared coverage<select value={statement.completeness} onChange={e => patch({ completeness: e.target.value as M75StatementInput['completeness'] })}><option value="unknown">Unknown</option><option value="partial">Partial roster</option><option value="declared_complete">Declared whole fleet</option></select></label>
    </div>
    <fieldset><legend>Entities covered by this declaration</legend>{coverage?.entities.map(entity => <label className="fleet-check" key={entity.id}><input type="checkbox" checked={statement.coveredEntityIds.includes(entity.id)} onChange={e => patch({ coveredEntityIds: e.target.checked ? [...statement.coveredEntityIds, entity.id] : statement.coveredEntityIds.filter(id => id !== entity.id) })} />{entity.legalName}</label>)}</fieldset>
    <label className="fleet-check"><input type="checkbox" checked={statement.allTripLocationsIncluded} onChange={e => patch({ allTripLocationsIncluded: e.target.checked })} />The declaration includes all controlled trips, including travel outside California.</label>
    <p>{statement.assets.length} declared rows. Up to 25 roster rows can be retained; the current demo supports three diesel workpapers. Additional vehicles remain visible as gaps.</p>
    {statement.assets.map((row, index) => <details className="fleet-asset" key={row.rowId} open>
      <summary>Vehicle {index + 1}: {row.assetId || 'Identity unknown'}</summary>
      <div className="fleet-fields">
        <label>Asset ID<input value={row.assetId ?? ''} maxLength={64} onChange={e => asset(row.rowId, { assetId: text(e.target.value) })} /></label>
        <label>Declared aliases (comma separated)<input value={row.aliases.join(',')} onChange={e => asset(row.rowId, { aliases: e.target.value === '' ? [] : e.target.value.split(',').map(value => value.trim()) })} /></label>
        <label>Controlling entity<select value={row.entityId ?? ''} onChange={e => asset(row.rowId, { entityId: text(e.target.value) })}><option value="">Unknown</option>{coverage?.entities.map(entity => <option key={entity.id} value={entity.id}>{entity.legalName}</option>)}</select></label>
        <label>Base facility<select value={row.facilityId ?? ''} onChange={e => asset(row.rowId, { facilityId: text(e.target.value) })}><option value="">Unknown</option>{coverage?.facilities.map(facility => <option key={facility.id} value={facility.id}>{facility.name}</option>)}</select></label>
        <label>Period start<input type="date" value={row.period?.start ?? ''} onChange={e => asset(row.rowId, { period: { start: e.target.value, endExclusive: row.period?.endExclusive ?? '' } })} /></label>
        <label>Period end (exclusive)<input type="date" value={row.period?.endExclusive ?? ''} onChange={e => asset(row.rowId, { period: { start: row.period?.start ?? '', endExclusive: e.target.value } })} /></label>
        <label>Vehicle mode<select value={row.mode} onChange={e => asset(row.rowId, { mode: e.target.value as M75RosterAsset['mode'] })}>{[['unknown','Unknown'],['on_road','On road'],['off_road','Off road'],['rail','Rail'],['marine','Marine'],['air','Air'],['other','Other']].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Vehicle class<input value={row.vehicleClass ?? ''} maxLength={100} placeholder="Unknown until documented" onChange={e => asset(row.rowId, { vehicleClass: text(e.target.value) })} /></label>
        <label>Model year<input type="number" min={1900} max={2100} step={1} value={row.modelYear ?? ''} onChange={e => asset(row.rowId, { modelYear: e.target.value === '' ? null : Number(e.target.value) })} /></label>
        <label>Fuel<input value={row.fuel ?? ''} maxLength={100} placeholder="Unknown until documented" onChange={e => asset(row.rowId, { fuel: text(e.target.value) })} /></label>
        <label>Control arrangement<select value={row.controlBasis} onChange={e => asset(row.rowId, { controlBasis: e.target.value as M75RosterAsset['controlBasis'] })}><option value="unknown">Unknown</option><option value="owned_operational_control_full_year">Owned, operational control for the full year</option><option value="other_control_arrangement">Other arrangement</option></select></label>
        <label>Classification evidence<textarea value={row.classificationBasis ?? ''} maxLength={500} onChange={e => asset(row.rowId, { classificationBasis: text(e.target.value) })} /></label>
        <label>Control evidence<textarea value={row.controlExplanation ?? ''} maxLength={500} onChange={e => asset(row.rowId, { controlExplanation: text(e.target.value) })} /></label>
        <label>Match to a registered corporate source<select value={links.find(link => link.rowId === row.rowId)?.sourceId ?? ''} onChange={e => onLinks(links.map(link => link.rowId === row.rowId ? { ...link, sourceId: text(e.target.value) } : link))}><option value="">No match yet</option>{coverage?.sources.map(source => <option key={source.id} value={source.id}>{source.name} · {source.domain.replace(/_/g, ' ')}</option>)}</select></label>
      </div>
      <p className="fleet-note">Saved rows remain in history. Correct inaccurate facts with a reason; do not remove a vehicle to hide an unresolved gap.</p>
    </details>)}
    <button type="button" disabled={statement.assets.length >= 25} onClick={add}>Add declared vehicle</button>
  </fieldset>
}
