import type { M76Link, M76RosterAsset, M76StatementInput, M76MeterRelationship } from '../../../../packages/neuvetra-database/src/m76-contract'
import type { M71Snapshot } from '../../../../packages/neuvetra-database/src/m71-contract'
import { newStationaryAsset, newMeterRelationship } from '@/lib/m76-form'

const text = (value:string) => value === '' ? null : value
export function StationaryEquipmentEditor({ statement, links, coverage, disabled, onStatement, onLinks }: {
  statement:M76StatementInput; links:M76Link[]; coverage:M71Snapshot|null; disabled:boolean;
  onStatement:(value:M76StatementInput)=>void; onLinks:(value:M76Link[])=>void;
}) {
  const patch=(value:Partial<M76StatementInput>)=>onStatement({...statement,...value})
  const asset=(rowId:string,value:Partial<M76RosterAsset>)=>patch({assets:statement.assets.map(row=>row.rowId===rowId?{...row,...value}:row)})
  const meter=(row:M76RosterAsset,value:Partial<M76MeterRelationship>)=>asset(row.rowId,{meterRelationship:{...(row.meterRelationship??newMeterRelationship()),...value}})
  const add=()=>{const row=newStationaryAsset();patch({assets:[...statement.assets,row]});onLinks([...links,{rowId:row.rowId,sourceId:null}])}
  return <fieldset disabled={disabled} className="stationary-editor">
    <legend>Declared stationary equipment · synthetic evidence</legend>
    <p>Use facility and equipment records to identify devices before matching fuel workpapers. Include unknown and unsupported equipment. This entered statement does not authenticate an original company record.</p>
    <div className="stationary-fields">
      <label>Statement issuer<input value={statement.issuer} maxLength={120} onChange={e=>patch({issuer:e.target.value})}/></label>
      <label>Statement reference<input value={statement.reference} maxLength={120} onChange={e=>patch({reference:e.target.value})}/></label>
      <label>Description<textarea value={statement.description} maxLength={2000} onChange={e=>patch({description:e.target.value})}/></label>
      <label>Facility records checked to identify all stationary equipment<textarea value={statement.discoveryBasis} maxLength={2000} onChange={e=>patch({discoveryBasis:e.target.value})}/></label>
      <label>Declared coverage<select value={statement.completeness} onChange={e=>patch({completeness:e.target.value as M76StatementInput['completeness']})}><option value="unknown">Unknown</option><option value="partial">Partial list</option><option value="declared_complete">Declared whole equipment list</option></select></label>
    </div>
    <fieldset><legend>Entities checked</legend>{coverage?.entities.map(entity=><label className="stationary-check" key={entity.id}><input type="checkbox" checked={statement.coveredEntityIds.includes(entity.id)} onChange={e=>patch({coveredEntityIds:e.target.checked?[...statement.coveredEntityIds,entity.id]:statement.coveredEntityIds.filter(id=>id!==entity.id)})}/>{entity.legalName}</label>)}</fieldset>
    <fieldset><legend>Facilities checked</legend>{coverage?.facilities.map(facility=><label className="stationary-check" key={facility.id}><input type="checkbox" checked={statement.coveredFacilityIds.includes(facility.id)} onChange={e=>patch({coveredFacilityIds:e.target.checked?[...statement.coveredFacilityIds,facility.id]:statement.coveredFacilityIds.filter(id=>id!==facility.id)})}/>{facility.name}</label>)}</fieldset>
    <label className="stationary-check"><input type="checkbox" checked={statement.allControlledLocationsIncluded} onChange={e=>patch({allControlledLocationsIncluded:e.target.checked})}/>The declaration includes all locations under the declared control boundary.</label>
    <p>{statement.assets.length} declared devices. This demo retains up to 25 equipment rows and supports three gas workpapers and one generator workpaper. Additional equipment remains a gap.</p>
    {statement.assets.map((row,index)=><details className="stationary-asset" key={row.rowId} open>
      <summary>Device {index+1}: {row.equipmentId??'Identity unknown'}</summary>
      <div className="stationary-fields">
        <label>Equipment ID<input value={row.equipmentId??''} maxLength={64} onChange={e=>asset(row.rowId,{equipmentId:text(e.target.value)})}/></label>
        <label>Other names or IDs (comma separated)<input value={row.aliases.join(',')} onChange={e=>asset(row.rowId,{aliases:e.target.value===''?[]:e.target.value.split(',').map(v=>v.trim())})}/></label>
        <label>Serial number or other identity evidence<textarea value={row.identifierBasis??''} maxLength={500} onChange={e=>asset(row.rowId,{identifierBasis:text(e.target.value)})}/></label>
        <label>Controlling entity<select value={row.entityId??''} onChange={e=>asset(row.rowId,{entityId:text(e.target.value)})}><option value="">Unknown</option>{coverage?.entities.map(e=><option key={e.id} value={e.id}>{e.legalName}</option>)}</select></label>
        <label>Facility<select value={row.facilityId??''} onChange={e=>asset(row.rowId,{facilityId:text(e.target.value)})}><option value="">Unknown</option>{coverage?.facilities.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
        <label>Period start<input type="date" value={row.period?.start??''} onChange={e=>asset(row.rowId,{period:{start:e.target.value,endExclusive:row.period?.endExclusive??''}})}/></label>
        <label>Period end (exclusive)<input type="date" value={row.period?.endExclusive??''} onChange={e=>asset(row.rowId,{period:{start:row.period?.start??'',endExclusive:e.target.value}})}/></label>
        <label>Equipment type<select value={row.equipmentType} onChange={e=>asset(row.rowId,{equipmentType:e.target.value as M76RosterAsset['equipmentType']})}>{[['unknown','Unknown'],['boiler','Boiler'],['space_heater','Space heater'],['stationary_emergency_generator','Fixed emergency generator'],['other','Other equipment']].map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label>
        <label>Fuel grade and composition<input value={row.fuel??''} maxLength={100} placeholder="Unknown until documented" onChange={e=>asset(row.rowId,{fuel:text(e.target.value)})}/></label>
        <label>Control arrangement<select value={row.controlBasis} onChange={e=>asset(row.rowId,{controlBasis:e.target.value as M76RosterAsset['controlBasis']})}><option value="unknown">Unknown</option><option value="owned_operational_control_full_year">Owned, operational control for the full year</option><option value="other_control_arrangement">Other arrangement</option></select></label>
        <label>Equipment and fuel classification evidence<textarea value={row.classificationBasis??''} maxLength={500} onChange={e=>asset(row.rowId,{classificationBasis:text(e.target.value)})}/></label>
        <label>Control evidence<textarea value={row.controlExplanation??''} maxLength={500} onChange={e=>asset(row.rowId,{controlExplanation:text(e.target.value)})}/></label>
        <label>Fuel evidence issuer<input value={row.meterRelationship?.issuer??''} maxLength={120} onChange={e=>meter(row,{issuer:text(e.target.value)})}/></label>
        <label>Fuel meter ID<input value={row.meterRelationship?.meterLabel??''} maxLength={120} onChange={e=>meter(row,{meterLabel:text(e.target.value)})}/></label>
        <label>Measurement relationship<select value={row.meterRelationship?.measurementBasis??'unknown'} onChange={e=>meter(row,{measurementBasis:e.target.value as M76MeterRelationship['measurementBasis']})}>{[['unknown','Unknown'],['dedicated_single_device_consumption','Dedicated measurement of this device’s consumed fuel'],['shared_meter','Meter shared by several devices'],['shared_tank_allocation','Shared fuel tank allocation'],['stock_derived','Derived from fuel stock changes'],['other','Other basis']].map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label>
        <label>Dedicated to one device<select value={row.meterRelationship?.dedicatedToSingleDevice===null||!row.meterRelationship?'unknown':String(row.meterRelationship.dedicatedToSingleDevice)} onChange={e=>meter(row,{dedicatedToSingleDevice:e.target.value==='unknown'?null:e.target.value==='true'})}><option value="unknown">Unknown</option><option value="true">Yes</option><option value="false">No</option></select></label>
        <label>How this meter measures this device's consumed fuel<textarea value={row.meterRelationship?.explanation??''} maxLength={500} onChange={e=>meter(row,{explanation:text(e.target.value)})}/></label>
        <label>Match to a corporate source<select value={links.find(l=>l.rowId===row.rowId)?.sourceId??''} onChange={e=>onLinks(links.map(l=>l.rowId===row.rowId?{...l,sourceId:text(e.target.value)}:l))}><option value="">No match yet</option>{coverage?.sources.map(source=><option key={source.id} value={source.id}>{source.name} · {source.domain.replace(/_/g,' ')}</option>)}</select></label>
      </div>
      <p className="stationary-note">Saved rows remain in history. Correct facts with a reason; unsupported devices cannot be removed to clear gaps.</p>
    </details>)}
    <button type="button" disabled={statement.assets.length>=25} onClick={add}>Add declared device</button>
  </fieldset>
}
