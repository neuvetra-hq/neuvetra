let locationsAttempted=false;
const locationTouched=new Set();
const LOCATION_FIELDS={
 name:['Location name',200,'Use a recognizable site or operating-location name.'],
 country:['Country or territory',100,'Include locations outside California and the United States. Enter Not sure if unresolved.'],
 locality:['Address or identifying locality',500,'Use a business address, city/locality with a site reference, or a clear description for mobile or remote operations.'],
 region:['State / province / region',200,'Optional where it does not apply.'],
 purpose:['Site purpose and business activities',600,'Describe what happens here, such as office work, manufacturing, storage or fleet operations.'],
 entity:['Reporting entity for this location',200,'Choose the company or related entity whose operations are represented here.'],
 otherEntity:['Other entity name',200,'Name the entity, or enter Not sure.'],
 occupancy:['Property arrangement',100,'Ownership or a lease does not by itself decide the inventory boundary.'],
 control:['Who operates or controls the equipment?',100,'Consider authority over the equipment, not only ownership of the building.'],
 operator:['Operator / control details',600,'Name the operating entity or describe who controls the equipment. Enter Not sure if unresolved.'],
 included:['Include this location?',100,'This is your proposed boundary decision for review.'],
 reason:['Reason for this inclusion decision',600,'Explain inclusion, exclusion or the question that needs resolving.'],
 startMode:['When does coverage start?',100,'Coverage refers only to activity within the selected reporting period.'],
 endMode:['When does coverage end?',100,'Still active means active through the reporting-period end; it does not assign a closure date.'],
 from:['Coverage start date',10,'Choose a date within the reporting period.'],
 to:['Active through — coverage end date',10,'Choose a date within the reporting period, on or after coverage starts.'],
 opened:['Original site opening date',10,'Optional historical fact. This may be before 2025; it is not the reporting coverage start.'],
};
function locationEntities(){return [...new Set(['Reporting company',...data.entities.map(e=>e.name).filter(n=>n!==get('company.legal'))].filter(Boolean))];}
function ensureLocationIds(){
  let changed=false;data.locations.forEach(l=>{if(l.entity===get('company.legal')&&l.entity){l.originalEntity=l.entity;l.entity='Reporting company';changed=true;}if(!l.id){l.id='loc-'+crypto.randomUUID();changed=true;}});
  data.sources.forEach(source=>{const matches=data.locations.filter(l=>l.name&&l.name===source.location);if(matches.length===1){source.location=matches[0].id;changed=true;}});return changed;
}
function locationChoiceLabel(l,i){return `${l.name||'Location '+(i+1)}${l.locality?' · '+l.locality:l.country?' · '+l.country:''}`;}
function sourceLocationLabel(value){const index=data.locations.findIndex(l=>l.id===value);return index<0?value:locationChoiceLabel(data.locations[index],index);}
function locationInput(i,key,options=null,type='text',optional=false){
 const l=CompanyValidation.locationModes(data.locations[i]),[label,limit,help]=LOCATION_FIELDS[key];
 const value=l[key]||'',path=`locations.${i}.${key}`,id=`location-${i}-${key}`;
 const error=(locationsAttempted||locationTouched.has(path))?CompanyValidation.locationErrors(l,data.period,locationEntities())[key]:'';
 const bounds=CompanyValidation.locationPeriod(data.period);
 const required=!optional;
 const dateAttrs=['from','to'].includes(key)?` min="${bounds.min||'2025-01-01'}" ${bounds.max?`max="${bounds.max}"`:''} ${bounds.error?'disabled':''}`:'';
 const attrs=`id="${id}" data-path="${path}" aria-describedby="${id}-help ${id}-error" ${required?'aria-required="true"':''} ${error?'aria-invalid="true"':''} maxlength="${limit}"${dateAttrs}`;
 let input;
 if(options){const stale=value&&!options.includes(value)?`<option value="${esc(value)}" selected>Previous answer: ${esc(value)} — review</option>`:'';input=`<select ${attrs}><option value="">Select an answer</option>${stale}${options.map(v=>`<option value="${esc(v)}" ${v===value?'selected':''}>${esc(key==='entity'&&v==='Reporting company'?(get('company.legal')||'Reporting company'):v)}</option>`).join('')}</select>`;}
 else input=type==='textarea'?`<textarea ${attrs}>${esc(value)}</textarea>`:`<input ${attrs} type="${type}" value="${esc(value)}">`;
 return `<div class="field ${['locality','purpose','operator','reason'].includes(key)?'full':''}"><label for="${id}">${label}${optional?' <span class="optional">(optional)</span>':' <span aria-hidden="true" class="required-marker">*</span>'}</label>${input}<small id="${id}-help">${help}</small><span class="field-error" id="${id}-error">${esc(error)}</span></div>`;
}
function locationPageErrors(){
 const result=[];const bounds=CompanyValidation.locationPeriod(data.period);
 if(bounds.error)result.push({message:bounds.error});
 if(!data.locations.length)result.push({message:'Add the operating locations that belong in this setup. A missing location list is not treated as no operations.'});
 data.locations.forEach((l,i)=>Object.entries(CompanyValidation.locationErrors(l,data.period,locationEntities())).forEach(([key,message])=>result.push({i,key,message:`Location ${i+1} · ${LOCATION_FIELDS[key]?.[0]||'Identity'}: ${message}`})));
 return result;
}
function locationOpenItems(){
 const result=locationPageErrors().map(e=>e.message);
 data.locations.forEach((raw,i)=>{
  const l=CompanyValidation.locationModes(raw);
  Object.entries(l).forEach(([key,value])=>{if(value==='Not sure')result.push(`Location ${i+1}: ${LOCATION_FIELDS[key]?.[0]||key} remains uncertain.`);});
  if(l.country&&!['us','usa','united states','united states of america'].includes(l.country.toLowerCase())||l.region&&!['ca','california'].includes(l.region.toLowerCase()))result.push(`Location ${i+1}: geography retained for support review.`);
  if(['Leased','Shared','Other'].includes(l.occupancy)||['Landlord','Shared control','Other'].includes(l.control)||l.included?.startsWith('Exclude'))result.push(`Location ${i+1}: lease, control or exclusion needs review.`);
 });return result;
}
function locationSummary(raw){
 const l=CompanyValidation.locationModes(raw);const copy={...l};
 if(l.entity!=='Other')delete copy.otherEntity;
 if(l.startMode!==CompanyValidation.locationStartModes[1])delete copy.from;
 if(l.endMode!==CompanyValidation.locationEndModes[1])delete copy.to;
 return copy;
}
function locationSection(){
 const bounds=CompanyValidation.locationPeriod(data.period),errors=locationPageErrors();
 const summary=locationsAttempted&&errors.length?`<div id="locations-errors" class="error-summary" tabindex="-1"><strong>Check the highlighted location details before continuing.</strong><ul>${errors.map(e=>`<li>${e.key?`<a href="#location-${e.i}-${e.key}">${esc(e.message)}</a>`:esc(e.message)}</li>`).join('')}</ul></div>`:'';
 return section(3,`${summary}${bounds.error?note(esc(bounds.error)+` <button type="button" class="text" data-step="1">Edit reporting period</button>`):note(`Location coverage period: <strong>${esc(bounds.min)} – ${esc(bounds.max)}</strong>. Record original opening dates separately. Locations outside California or the U.S. remain part of the review.`)}<p class="required-note">Fields marked * need an answer. Choose or enter Not sure when a fact is unresolved.</p>${data.locations.map((raw,i)=>{
 const l=CompanyValidation.locationModes(raw);
 const linked=data.sources.map((s,n)=>s.location===l.id?families[n][0]:null).filter(Boolean);
 return `<div class="card"><div class="cardhead"><h3>Location ${i+1}${l.name?' · '+esc(l.name):''}</h3><button type="button" data-remove="locations" data-index="${i}">Remove location</button></div>${grid(locationInput(i,'name')+locationInput(i,'country')+locationInput(i,'locality',null,'textarea')+locationInput(i,'region',null,'text',true)+locationInput(i,'purpose',null,'textarea')+locationInput(i,'entity',[...locationEntities(),'Other','Not sure'])+(l.entity==='Other'?locationInput(i,'otherEntity'):'')+locationInput(i,'occupancy',['Owned','Leased','Shared','Other','Not sure'])+locationInput(i,'control',['Reporting company','Related entity','Landlord','Shared control','Other','Not sure'])+locationInput(i,'operator',null,'textarea',!['Related entity','Landlord','Shared control','Other'].includes(l.control))+locationInput(i,'included',inclusion)+locationInput(i,'reason',null,'textarea'))}<h3>Activity within the reporting period</h3>${grid(locationInput(i,'startMode',CompanyValidation.locationStartModes)+(l.startMode===CompanyValidation.locationStartModes[1]?locationInput(i,'from',null,'date'):'')+locationInput(i,'endMode',CompanyValidation.locationEndModes)+(l.endMode===CompanyValidation.locationEndModes[1]?locationInput(i,'to',null,'date'):'')+locationInput(i,'opened',null,'date',true))}${l.from&&l.startMode!==CompanyValidation.locationStartModes[1]?`<small>Earlier start entry kept for reference, not used for current coverage: ${esc(l.from)}</small>`:''}${l.to&&l.endMode!==CompanyValidation.locationEndModes[1]?`<small>Earlier end entry kept for reference, not used for current coverage: ${esc(l.to)}</small>`:''}<p class="lead">${linked.length?'Linked source activities: '+esc(linked.join(', '))+'.':'Equipment and source activities can be linked to this location in Source activities.'}</p></div>`;
 }).join('')}<button type="button" data-add="locations">+ Add a location</button><details><summary>How locations support the inventory boundary</summary><p>Locations connect the reporting entities, assets and activities to your proposed boundary. Ownership, leases and equipment control need to be considered together. <a href="https://www.epa.gov/climateleadership/determine-organizational-boundaries" target="_blank" rel="noreferrer">EPA boundary guidance ↗</a> · <a href="https://ghgprotocol.org/corporate-standard" target="_blank" rel="noreferrer">GHG Protocol Corporate Standard ↗</a></p></details>`,'Identify each operating site and the part of the reporting period it covers. These answers support boundary review; they do not approve the inventory.');
}
function refreshLocationErrors(){
 data.locations.forEach((l,i)=>{const errors=CompanyValidation.locationErrors(l,data.period,locationEntities());Object.keys(LOCATION_FIELDS).forEach(key=>{const path=`locations.${i}.${key}`,input=document.querySelector(`#location-${i}-${key}`),message=document.querySelector(`#location-${i}-${key}-error`);const show=locationsAttempted||locationTouched.has(path);if(input)input.setAttribute('aria-invalid',show&&errors[key]?'true':'false');if(message)message.textContent=show?errors[key]||'':'';});});
 const summary=document.querySelector('#locations-errors');if(summary){const errors=locationPageErrors();summary.hidden=!errors.length;summary.querySelector('ul').innerHTML=errors.map(e=>`<li>${e.key?`<a href="#location-${e.i}-${e.key}">${esc(e.message)}</a>`:esc(e.message)}</li>`).join('');}
}
document.addEventListener('focusout',event=>{const path=event.target.dataset?.path;if(path?.startsWith('locations.')){locationTouched.add(path);refreshLocationErrors();}});
