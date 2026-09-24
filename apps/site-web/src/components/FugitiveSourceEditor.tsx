import type { M77SourceActivity, M77CalculatorInput, M77Equipment } from '../../../../packages/neuvetra-database/src/m77-contract'

import {names,evidenceNames,equipmentChoices,blankCalculator} from '@/lib/m77-form'

export function FugitiveSourceEditor({value,onChange,disabled}:{value:M77SourceActivity;onChange:(v:M77SourceActivity)=>void;disabled:boolean}) {
  const patch=(v:Partial<M77SourceActivity>)=>onChange({...value,...v})
  const c=value.calculatorInput
  const calc=(v:Partial<M77CalculatorInput>)=>{if(c)patch({calculatorInput:{...c,...v}})}
  const identity=(v:Partial<M77SourceActivity>)=>{const next={...value,...v};onChange({...next,calculatorInput:c?{...c,asset_id:next.assetId,gas:next.gas??'',equipment:next.equipment,opening_capacity:next.capacityKg??'',closing_capacity:next.capacityKg??''}:null})}
  return <fieldset disabled={disabled} className="stationary-editor"><legend>Fugitive source workpaper</legend>
    <p>Use equipment and contractor records. Unknown facts remain gaps. All entries in this demonstration are synthetic evidence statements.</p>
    <div className="stationary-fields">
      <label>Workpaper name<input value={value.label} onChange={e=>patch({label:e.target.value})}/></label>
      <label>Equipment identifier<input value={value.assetId} onChange={e=>identity({assetId:e.target.value})}/></label>
      <label>Equipment type<select value={value.equipment} onChange={e=>identity({equipment:e.target.value as M77Equipment})}>{equipmentChoices.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
      <label>Gas identity<input value={value.gas??''} placeholder="For example, R-410A" onChange={e=>identity({gas:e.target.value||null})}/></label>
      <label>Documented proper charge (kg)<input inputMode="decimal" value={value.capacityKg??''} onChange={e=>identity({capacityKg:e.target.value||null})}/></label>
    </div>
    <label className="stationary-check"><input type="checkbox" checked={!!c} onChange={e=>patch({calculatorInput:e.target.checked?blankCalculator(value):null})}/>Prepare a candidate calculation from complete servicing and boundary records</label>
    {!c&&<p>This source will be saved as incomplete. No amount is assumed.</p>}
    {c&&<>
      <p>Supported cases: R-410A fixed HVAC, HFC-134a fixed refrigeration, and HFC-227ea fire suppression. Missing or unsupported facts prevent calculation.</p>
      <fieldset><legend>Method eligibility — confirm only with evidence</legend>{Object.entries(names).map(([key,label])=><label className="stationary-check" key={key}><input type="checkbox" checked={c.declarations[key as keyof typeof names]} onChange={e=>calc({declarations:{...c.declarations,[key]:e.target.checked}})}/>{label}</label>)}</fieldset>
      <div className="stationary-fields"><label>Opening proper charge (kg)<input value={c.opening_capacity} inputMode="decimal" onChange={e=>calc({opening_capacity:e.target.value})}/></label><label>Closing proper charge (kg)<input value={c.closing_capacity} inputMode="decimal" onChange={e=>calc({closing_capacity:e.target.value})}/></label></div>
      <fieldset><legend>Supporting record references</legend><p>Use the reference of a retained statement below. Nameplate capacity alone does not prove full charge at either year boundary.</p><div className="stationary-fields">{Object.entries(evidenceNames).map(([key,label])=><label key={key}>{label}<input value={c.evidence[key as keyof typeof evidenceNames]} onChange={e=>calc({evidence:{...c.evidence,[key]:e.target.value}})}/></label>)}</div></fieldset>
      <fieldset><legend>Servicing consumption</legend><p>Record new gas used for this equipment, including gas lost during servicing. Do not enter purchases, container capacity, or only the gas retained in the equipment.</p>
        {c.refills.map((event,i)=><div className="stationary-asset" key={i}><h4>Service visit {i+1}</h4><div className="stationary-fields">{(['id','date','kg','contractor','reference'] as const).map(key=><label key={key}>{{id:'Event identifier',date:'Visit date',kg:'Gas used in servicing (kg)',contractor:'Contractor identifier',reference:'Retained record reference'}[key]}<input type={key==='date'?'date':'text'} value={event[key]} onChange={e=>calc({refills:c.refills.map((v,n)=>n===i?{...v,[key]:e.target.value}:v)})}/></label>)}</div><button type="button" onClick={()=>calc({refills:c.refills.filter((_,n)=>n!==i)})}>Remove unsaved visit {i+1}</button></div>)}
        <button type="button" disabled={c.refills.length>=100} onClick={()=>calc({refills:[...c.refills,{id:'',date:'',kg:'',contractor:'',reference:''}],zero_activity_evidence:null})}>Add service visit</button>
      </fieldset>
      <fieldset><legend>Known leaks and fire discharges</legend><p>Link each known release to its later servicing visit. These quantities explain the balance and are not added to servicing consumption again.</p>
        {c.releases.map((event,i)=><div className="stationary-asset" key={i}><h4>Known release {i+1}</h4><div className="stationary-fields">{(['id','date','kg','evidence','refill_id'] as const).map(key=><label key={key}>{{id:'Release identifier',date:'Release date',kg:'Released gas (kg)',evidence:'Retained record reference',refill_id:'Later service event identifier'}[key]}<input type={key==='date'?'date':'text'} value={event[key]} onChange={e=>calc({releases:c.releases.map((v,n)=>n===i?{...v,[key]:e.target.value}:v)})}/></label>)}</div><label className="stationary-check"><input type="checkbox" checked={event.preceded_refill_verified} onChange={e=>calc({releases:c.releases.map((v,n)=>n===i?{...v,preceded_refill_verified:e.target.checked}:v)})}/>The evidence confirms this release occurred before the linked service, including when both were on the same date.</label><button type="button" onClick={()=>calc({releases:c.releases.filter((_,n)=>n!==i)})}>Remove unsaved release {i+1}</button></div>)}
        <button type="button" disabled={c.releases.length>=100} onClick={()=>calc({releases:[...c.releases,{id:'',date:'',kg:'',evidence:'',refill_id:'',preceded_refill_verified:false}]})}>Add known release</button>
      </fieldset>
      {!c.refills.length&&<><label>Explicit zero-activity record reference<input value={c.zero_activity_evidence??''} onChange={e=>calc({zero_activity_evidence:e.target.value||null})}/></label><p>An empty service log is not evidence of zero emissions. Complete annual and full-charge records are still required.</p></>}
      <label>Uncertainty and evidence limitations<textarea value={c.uncertainty} onChange={e=>calc({uncertainty:e.target.value})}/></label>
    </>}
    <fieldset><legend>Retained synthetic evidence statements</legend><p>Reference identifiers use uppercase letters, numbers, periods, underscores or hyphens. Describe what the original record would establish; this demonstration does not authenticate a real document.</p>
      {value.evidenceStatements.map((s,i)=><div className="stationary-asset" key={i}><div className="stationary-fields"><label>Reference<input value={s.reference} onChange={e=>patch({evidenceStatements:value.evidenceStatements.map((v,n)=>n===i?{...v,reference:e.target.value}:v)})}/></label><label>Issuer<input value={s.issuer} onChange={e=>patch({evidenceStatements:value.evidenceStatements.map((v,n)=>n===i?{...v,issuer:e.target.value}:v)})}/></label><label>What the evidence establishes<textarea value={s.description} onChange={e=>patch({evidenceStatements:value.evidenceStatements.map((v,n)=>n===i?{...v,description:e.target.value}:v)})}/></label></div><button type="button" onClick={()=>patch({evidenceStatements:value.evidenceStatements.filter((_,n)=>n!==i)})}>Remove unsaved statement {i+1}</button></div>)}
      <button type="button" onClick={()=>patch({evidenceStatements:[...value.evidenceStatements,{reference:'',issuer:'',description:''}]})}>Add evidence statement</button>
    </fieldset>
  </fieldset>
}
