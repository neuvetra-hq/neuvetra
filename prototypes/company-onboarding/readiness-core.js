(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./plan-core.js'));else root.ReadinessCore=factory(root.PlanCore);})(typeof globalThis!=='undefined'?globalThis:this,function(PlanCore){
'use strict';
const ENGINE_VERSION='2026-09-26.1',arr=v=>Array.isArray(v)?v:[],txt=v=>typeof v==='string'?v:'';
const EMPTY_FACT=/^(?:n\/?a|none|not applicable|unknown|tbd|to be determined|-+)$/i;
function day(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(txt(s)))return null;const n=Date.parse(s+'T00:00:00Z');return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===s?n/86400000:null;}
const field=(id,label,type='text',options=[],help='',rules={})=>({id,label,type,options,help,...rules});
const FACT_GROUPS={
 fuel:[field('fuel-type','Fuel profile','select',['natural-gas','gasoline','diesel','gasoline-and-diesel','propane','fuel-oil','multiple-fuels','other'],'Choose the fuel or mixed-fuel profile shown by the source records.'),field('activity-source','Activity data source','select',['supplier-invoice','meter-reading','tank-or-purchase-log','equipment-log','other'],'Choose the record that supports the quantity.'),field('source-identifier','Account, meter, tank, or equipment ID','text',[],'Use the identifier that ties the activity to its source evidence.')],
 vehicle:[field('vehicle-class','Vehicle or engine class','select',['passenger-car','light-truck-or-van','heavy-duty-road','off-road-equipment','forklift','small-engine','mixed-fleet','other'],'Describe the asset class represented by the activity records.'),field('model-year-status','Model-year information','select',['reported','unknown'],'Choose Reported when model years or ranges are available. Unknown remains an input gap.'),field('vehicle-model-years','Vehicle model years or ranges','text',[],'Use comma-separated years or ranges, for example 2018, 2020-2023. Mixed fleets may include several values.',{requiredWhen:{field:'model-year-status',values:['reported']},format:'model-years'})],
 gas:[field('substance-name','Refrigerant or gas name'),field('equipment-identifier','Equipment or system ID'),field('movement-source','Gas movement source','select',['service-record','purchase-record','inventory-log','disposal-record','other'],'Choose the record used to reconcile additions, removals, or stock.'),field('charge-status','Equipment charge or capacity','select',['reported','unknown'],'Choose Reported when a covered equipment charge or capacity is available. Unknown remains an input gap.'),field('charge-quantity','Covered charge or capacity quantity','number',[],'Enter a positive quantity for the covered equipment or systems.',{requiredWhen:{field:'charge-status',values:['reported']},format:'positive-number'}),field('charge-unit','Charge or capacity unit','select',['kg','lb'],'Use the unit shown by the equipment or service evidence.',{requiredWhen:{field:'charge-status',values:['reported']}})],
 supply:[field('supplier-name','Energy supplier'),field('meter-identifier','Meter or service account ID'),field('delivery-location','Delivery location')],
 category:[field('data-owner','Data owner or business team'),field('source-system','Source system or document set'),field('population-covered','Population represented by the records')]
};
function factualFields(method){
 const ids=new Set(arr(method&&method.requiredInputs).map(input=>input&&input.id)),groups=[];
 if(ids.has('fuel'))groups.push('fuel');
 if(ids.has('vehicle'))groups.push('vehicle');
 if(ids.has('gas'))groups.push('gas');
 if(ids.has('supply'))groups.push('supply');
 if(ids.has('category-inputs'))groups.push('category');
 return groups.flatMap(name=>FACT_GROUPS[name]).filter((candidate,index,all)=>all.findIndex(other=>other.id===candidate.id)===index);
}
function required(definition,details){return !definition.requiredWhen||definition.requiredWhen.values.includes(txt(details[definition.requiredWhen.field]).trim());}
function validModelYears(value,reportingEnd){
 const max=(Number(txt(reportingEnd).slice(0,4))||9997)+2,tokens=txt(value).split(',').map(token=>token.trim()).filter(Boolean);if(!tokens.length)return false;
 return tokens.every(token=>{const match=token.match(/^(\d{4})(?:\s*-\s*(\d{4}))?$/);if(!match)return false;const first=Number(match[1]),last=Number(match[2]||match[1]);return first>=1900&&last>=first&&last<=max;});
}
function answered(value,definition,view){const answer=txt(value).trim();if(!answer||EMPTY_FACT.test(answer)||definition.options.length&&!definition.options.includes(answer))return false;if(definition.format==='positive-number')return /^\d+(?:\.\d+)?$/.test(answer)&&Number(answer)>0;if(definition.format==='model-years')return validModelYears(answer,view.period.end);return true;}
function recordFuel(record){if(Object.prototype.hasOwnProperty.call(record||{},'fuelType'))return txt(record.fuelType);return PlanCore.inferLegacyFuelType(record&&record.recordType);}
function evaluate(onboarding,plan,catalog,methods){
 const view=PlanCore.derive(onboarding,plan,catalog),registry=arr(methods&&methods.methods);
 const globalIssues=view.issues.map(message=>({code:'plan-review',message,severity:'blocking'}));
 globalIssues.push({code:'method-release-blocked',severity:'blocking',message:'No approved released calculation methods or factors are available. Candidate inputs require method and accounting review.'});
 const items=view.items.map(item=>{
  const findings=[],add=(code,message,recordId,severity='blocking')=>findings.push({code,message,severity,...(recordId?{recordId}: {})});
  const key=item.subtypeId||item.screeningId||item.familyId,method=registry.find(m=>m.catalogId===key&&String(m.scope).replace(/^scope/,'')===item.scope),supported=method&&method.status==='candidate';
  const savedDetails=(plan&&plan.items&&plan.items[item.id]||{}).readinessDetails||{},factFields=factualFields(method),details=Object.fromEntries(factFields.map(definition=>[definition.id,txt(savedDetails[definition.id])]));
  const subtypeMissing=arr(item.subtypes).length>0&&!item.subtypeId;
  if(subtypeMissing)add('subtype-missing','Select an activity subtype before assessing a candidate approach.');
  if(!supported&&!subtypeMissing)add('unsupported-method','This activity has no supported candidate method mapping.');
  else if(supported)add('method-approval-required','Candidate approach only; method, factors and applicability remain pending reviewer release.',null,'review');
  if(supported&&!arr(method.acceptedUnits).length)add('unit-policy-unresolved','This candidate requires branch-specific unit and method review; an empty unit list does not accept arbitrary units.');
  factFields.forEach(definition=>{if(required(definition,details)&&!answered(details[definition.id],definition,view))add('fact-missing','Provide a valid '+definition.label+'.');});
  if(details['model-year-status']==='unknown')add('vehicle-model-year-unknown','Vehicle model years remain unknown; retain the gap until source records resolve it.');
  if(details['charge-status']==='unknown')add('charge-unknown','Equipment charge or capacity remains unknown; retain the gap until source records resolve it.');
  if(item.answer!=='Yes'&&item.kind!=='custom')add('source-unresolved','Confirm whether this activity occurs.');
  const companyWide=item.scope==='3'&&item.locationMode==='company-wide';
  if(!companyWide&&(item.unassigned||item.orphanLocationIds.length))add('location-unresolved','Resolve operating-site coverage and removed location references.');
  if(!companyWide&&item.locations.length>1)add('multi-site-allocation','Records cover multiple sites without record-level allocation; review site completeness and allocation.');
  if(item.needsReview)add('context-changed','Review the activity after changed onboarding or collection inputs.');
  if(!item.subtypeValid)add('subtype-invalid','Select a valid activity subtype.');
  if(item.scope==='1'&&!item.sourceNames.trim()&&item.kind!=='custom')add('source-name-missing','Identify the equipment or activity covered by these records.');
  if(item.records.length)add('record-semantic-review','Record labels, evidence sufficiency and source allocation require accounting review; customer facts are not reviewer approval.',null,'review');
  if(!item.records.length)add('records-missing','Add activity records; no records is not zero emissions.');
  const seen=new Set(),ids=new Set(),intervals=[];let zeros=0;
  item.records.forEach((record,index)=>{
   const rid=txt(record.id)||'record-'+(index+1);
   if(!record.id||ids.has(record.id))add('record-id-invalid','Record IDs must be present and unique.',rid);ids.add(record.id);
   PlanCore.validateRecord(record,onboarding).forEach(message=>add('record-invalid',message,rid));
   const q=record.quantity;
   if(q==null||q==='')add('quantity-missing','Quantity is unknown; it is not treated as zero.',rid);
   else if(typeof q==='string'&&/^0+(?:\.0+)?$/.test(q.trim())){zeros++;add('zero-quantity','Explicit zero recorded; confirm its evidence and covered period.',rid,'review');}
   if(supported&&arr(method.acceptedUnits).length&&!method.acceptedUnits.includes(record.unit))add('unit-incompatible','Unit is not accepted by this candidate approach: '+method.acceptedUnits.join(', ')+'.',rid);
   if(!txt(record.reference).trim()&&!arr(record.evidenceIds).length)add('evidence-missing','Link uploaded evidence or provide a traceable document reference.',rid);
   if(record.quality==='estimated'&&!txt(record.notes).trim())add('estimate-basis-missing','Document the estimation method, assumptions and uncertainty in record notes.',rid);
   if(record.quality==='unknown')add('quality-unknown','Confirm whether this is measured or estimated data.',rid);
   const signature=JSON.stringify([txt(record.recordType).trim().toLowerCase(),recordFuel(record),txt(q).replace(/^0+(?=\d)/,'').replace(/\.0+$/,''),txt(record.unit).trim().toLowerCase(),record.periodStart,record.periodEnd,txt(record.reference).trim().toLowerCase(),arr(record.evidenceIds).slice().sort()]);
   if(seen.has(signature))add('duplicate-record','Potential duplicate activity record; reconcile before calculating.',rid);seen.add(signature);
   const recordStart=day(record.periodStart),recordEnd=day(record.periodEnd);if(recordStart!==null&&recordEnd!==null&&recordStart<=recordEnd)intervals.push({start:recordStart,end:recordEnd,rid});
  });
  if(factFields.some(field=>field.id==='fuel-type')){
   const namedFuels=new Set(),validFuels=new Set(['natural-gas','gasoline','diesel','propane','fuel-oil','other']);let unresolved=false;
   for(const [index,record] of item.records.entries()){
    const fuel=recordFuel(record),rid=txt(record.id)||'record-'+(index+1);
    if(validFuels.has(fuel))namedFuels.add(fuel);
    else if(fuel!=='not-a-fuel-record'){unresolved=true;add('fuel-record-linkage','Select the fuel for this record, or mark it as not a fuel quantity.',rid);}
   }
   const profile=details['fuel-type'];let matches=false;
   if(profile==='gasoline-and-diesel')matches=namedFuels.size===2&&namedFuels.has('gasoline')&&namedFuels.has('diesel');
   else if(profile==='multiple-fuels')matches=namedFuels.size>=2;
   else if(validFuels.has(profile))matches=namedFuels.size===1&&namedFuels.has(profile);
   if(namedFuels.size&&!matches)add('fuel-profile-conflict','Choose a fuel profile that matches the structured fuel selected on each activity record.');
   else if(!namedFuels.size&&item.records.length&&!unresolved)add('fuel-record-linkage','At least one activity record must identify the fuel represented by this fuel profile.');
  }
  const start=day(view.period.start),end=day(view.period.end);
  if(start!==null&&end!==null&&start<=end){
   intervals.sort((a,b)=>a.start-b.start||a.end-b.end);let cursor=start,previousEnd=null;
   for(const interval of intervals){
    if(previousEnd!==null&&interval.start<=previousEnd)add('period-overlap-review','Record periods overlap. Confirm that they represent distinct fuels, meters, vehicles, or sources.',interval.rid,'review');
    previousEnd=Math.max(previousEnd===null?interval.end:previousEnd,interval.end);
    if(interval.end<start||interval.start>end)continue;
    if(interval.start>cursor)add('period-gap','Uncovered reporting dates: '+new Date(cursor*86400000).toISOString().slice(0,10)+' through '+new Date((Math.min(interval.start,end+1)-1)*86400000).toISOString().slice(0,10)+'.');
    cursor=Math.max(cursor,Math.min(interval.end,end)+1);
   }
   if(cursor<=end)add('period-gap','Activity records do not cover the reporting period through '+view.period.end+'.');
  }else add('reporting-period-invalid','Set a valid reporting period before assessing coverage.');
  return {id:item.id,title:item.title,scope:item.scope,status:subtypeMissing?'needs-input':!supported?'unsupported':findings.some(f=>f.severity==='blocking')?'needs-input':'facts-collected',readyForCalculation:false,methodId:method?method.id:null,method:method?{id:method.id,title:method.title||method.label,approach:method.approach,status:method.status}:null,factualFields:factFields,details,locationMode:item.locationMode,locationLabels:item.locations.map(l=>l.name),findings,recordCount:item.records.length,zeroQuantityCount:zeros};
 });
 view.exclusions.forEach(item=>items.push({id:item.id,title:item.title,scope:item.scope,status:'excluded-pending-review',readyForCalculation:false,recordCount:0,zeroQuantityCount:0,findings:[{code:'exclusion-review',severity:'blocking',message:item.reason?'Proposed exclusion requires boundary and completeness review: '+item.reason:'Provide a rationale for the proposed exclusion; No does not demonstrate non-applicability.'}]}));
 const activeItems=items.filter(item=>item.status!=='excluded-pending-review');
 return {schemaVersion:2,engineVersion:ENGINE_VERSION,catalogVersion:catalog.version,methodsVersion:methods&&methods.version||'unknown',readyForCalculation:false,globalIssues,items,summary:{activityCount:activeItems.length,needsInput:activeItems.filter(item=>item.findings.some(f=>f.severity==='blocking'&&f.code!=='unsupported-method')).length,factsCollected:activeItems.filter(item=>item.status==='facts-collected').length,methodReviewsComplete:0,unsupported:activeItems.filter(item=>item.status==='unsupported').length,excluded:items.filter(item=>item.status==='excluded-pending-review').length}};
}
return Object.freeze({ENGINE_VERSION,evaluate,factualFields});
});
