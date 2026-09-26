(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./plan-core.js'));else root.ReadinessCore=factory(root.PlanCore);})(typeof globalThis!=='undefined'?globalThis:this,function(PlanCore){
'use strict';
const ENGINE_VERSION='2026-09-25.1',arr=v=>Array.isArray(v)?v:[],txt=v=>typeof v==='string'?v:'';
function day(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(txt(s)))return null;const n=Date.parse(s+'T00:00:00Z');return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===s?n/86400000:null;}
function evaluate(onboarding,plan,catalog,methods){
 const view=PlanCore.derive(onboarding,plan,catalog),registry=arr(methods&&methods.methods);
 const globalIssues=view.issues.map(message=>({code:'plan-review',message,severity:'blocking'}));
 globalIssues.push({code:'method-release-blocked',severity:'blocking',message:'No approved released calculation methods or factors are available. Candidate inputs require method and accounting review.'});
 const items=view.items.map(item=>{
  const findings=[],add=(code,message,recordId,severity='blocking')=>findings.push({code,message,severity,...(recordId?{recordId}: {})});
  const key=item.subtypeId||item.screeningId||item.familyId,method=registry.find(m=>m.catalogId===key&&String(m.scope).replace(/^scope/,'')===item.scope),supported=method&&method.status==='candidate';
  const details=(plan&&plan.items&&plan.items[item.id]||{}).readinessDetails||{};
  const subtypeMissing=arr(item.subtypes).length>0&&!item.subtypeId;
  if(subtypeMissing)add('subtype-missing','Select an activity subtype before assessing a candidate method.');
  if(!supported&&!subtypeMissing)add('unsupported-method','This activity has no supported candidate method mapping.');
  else if(supported)add('method-approval-required','Candidate method only; method, factors and applicability are not released.',null,'review');
  if(supported&&!arr(method.acceptedUnits).length)add('unit-policy-unresolved','This candidate requires branch-specific unit and method review; an empty unit list does not accept arbitrary units.');
  arr(method&&method.requiredFields).forEach(field=>{if(!txt(details[field.id]).trim())add('detail-missing','Provide '+field.label+'.');});
  if(item.answer!=='Yes'&&item.kind!=='custom')add('source-unresolved','Confirm whether this activity occurs.');
  if(item.unassigned||item.orphanLocationIds.length)add('location-unresolved','Resolve operating-site coverage and removed location references.');
  if(item.locations.length>1)add('multi-site-allocation','Records cover multiple sites without record-level allocation; review site completeness and allocation.');
  if(item.needsReview)add('context-changed','Review the activity after changed onboarding or collection inputs.');
  if(!item.subtypeValid)add('subtype-invalid','Select a valid activity subtype.');
  if(item.scope==='1'&&!item.sourceNames.trim()&&item.kind!=='custom')add('source-name-missing','Identify the equipment or activity covered by these records.');
  if(item.records.length)add('record-semantic-review','Record labels, evidence sufficiency and source allocation require accounting review; text answers are not verified.',null,'review');
  if(!item.records.length)add('records-missing','Add activity records; no records is not zero emissions.');
  const seen=new Set(),ids=new Set(),intervals=[];let zeros=0;
  item.records.forEach((record,index)=>{
   const rid=txt(record.id)||'record-'+(index+1);
   if(!record.id||ids.has(record.id))add('record-id-invalid','Record IDs must be present and unique.',rid);ids.add(record.id);
   PlanCore.validateRecord(record,onboarding).forEach(message=>add('record-invalid',message,rid));
   const q=record.quantity;
   if(q==null||q==='')add('quantity-missing','Quantity is unknown; it is not treated as zero.',rid);
   else if(typeof q==='string'&&/^0+(?:\.0+)?$/.test(q.trim())){zeros++;add('zero-quantity','Explicit zero recorded; confirm its evidence and covered period.',rid,'review');}
   if(supported&&arr(method.acceptedUnits).length&&!method.acceptedUnits.includes(record.unit))add('unit-incompatible','Unit is not accepted by this candidate method: '+method.acceptedUnits.join(', ')+'.',rid);
   if(!txt(record.reference).trim()&&!arr(record.evidenceIds).length)add('evidence-missing','Link uploaded evidence or provide a traceable document reference.',rid);
   if(record.quality==='estimated'&&!txt(record.notes).trim())add('estimate-basis-missing','Document the estimation method, assumptions and uncertainty in record notes.',rid);
   if(record.quality==='unknown')add('quality-unknown','Confirm whether this is measured or estimated data.',rid);
   const signature=JSON.stringify([record.recordType,txt(q).replace(/^0+(?=\d)/,'').replace(/\.0+$/,''),record.unit,record.periodStart,record.periodEnd,txt(record.reference).trim(),arr(record.evidenceIds).slice().sort()]);
   if(seen.has(signature))add('duplicate-record','Potential duplicate activity record; reconcile before calculating.',rid);seen.add(signature);
   const start=day(record.periodStart),end=day(record.periodEnd);if(start!==null&&end!==null&&start<=end)intervals.push({start,end,rid});
  });
  const start=day(view.period.start),end=day(view.period.end);
  if(start!==null&&end!==null&&start<=end){
   intervals.sort((a,b)=>a.start-b.start||a.end-b.end);let cursor=start,previousEnd=null;
   for(const interval of intervals){
    if(previousEnd!==null&&interval.start<=previousEnd)add('period-overlap','Record periods overlap; confirm distinct sources or remove double counting.',interval.rid);
    previousEnd=Math.max(previousEnd===null?interval.end:previousEnd,interval.end);
    if(interval.end<start||interval.start>end)continue;
    if(interval.start>cursor)add('period-gap','Uncovered reporting dates: '+new Date(cursor*86400000).toISOString().slice(0,10)+' through '+new Date((Math.min(interval.start,end+1)-1)*86400000).toISOString().slice(0,10)+'.');
    cursor=Math.max(cursor,Math.min(interval.end,end)+1);
   }
   if(cursor<=end)add('period-gap','Activity records do not cover the reporting period through '+view.period.end+'.');
  }else add('reporting-period-invalid','Set a valid reporting period before assessing coverage.');
  return {id:item.id,title:item.title,scope:item.scope,status:subtypeMissing?'needs-input':!supported?'unsupported':findings.some(f=>f.severity==='blocking')?'needs-input':'candidate-for-method-review',readyForCalculation:false,methodId:method?method.id:null,method:method?{...method,title:method.title||method.label}:null,details,locationLabels:item.locations.map(l=>l.name),findings,recordCount:item.records.length,zeroQuantityCount:zeros};
 });
 view.exclusions.forEach(item=>items.push({id:item.id,title:item.title,scope:item.scope,status:'excluded-pending-review',readyForCalculation:false,recordCount:0,zeroQuantityCount:0,findings:[{code:'exclusion-review',severity:'blocking',message:item.reason?'Proposed exclusion requires boundary and completeness review: '+item.reason:'Provide a rationale for the proposed exclusion; No does not demonstrate non-applicability.'}]}));
 return {schemaVersion:1,engineVersion:ENGINE_VERSION,catalogVersion:catalog.version,methodsVersion:methods&&methods.version||'unknown',readyForCalculation:false,globalIssues,items,summary:{activityCount:items.length,needsInput:items.filter(i=>i.status!=='excluded-pending-review'&&i.findings.some(f=>f.severity==='blocking'&&f.code!=='unsupported-method')).length,candidates:items.filter(i=>i.status==='candidate-for-method-review').length,unsupported:items.filter(i=>i.status==='unsupported').length,excluded:items.filter(i=>i.status==='excluded-pending-review').length}};
}
return Object.freeze({ENGINE_VERSION,evaluate});
});
