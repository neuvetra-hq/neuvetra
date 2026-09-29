'use strict';
const $ = selector => document.querySelector(selector);
const E = value => PlanCore.escapeHtml(value);
let workspace, assessment, history = [], filter = 'all', historical = false, busy = false, lastFocus;
const labels = {'needs-input':'Information needed','facts-collected':'Customer facts collected','unsupported':'Specialist method needed','excluded-pending-review':'Exclusion needs review'};
const optionLabel=value=>{const words=String(value).replaceAll('-',' ');return words.charAt(0).toUpperCase()+words.slice(1);};
const sentence=name=>/[.!?]$/.test(name)?name:name+'.';
async function request(path, options = {}) {
  const response = await fetch(path, {...options, cache:'no-store', headers:{'X-Neuvetra-Local':'1', ...options.headers}});
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(response.status === 409 ? 'Your saved inventory changed. Refresh this review before saving again.' : body.error || 'The review could not be loaded. Please try again.');
  return body;
}
function status(message, error = false) { $('#globalStatus').textContent = message; $('#globalStatus').className = error ? 'error' : ''; }
function notifyFailure(error) { status(error.message, true); }
function dateLabel(value) { const d = new Date(value); return Number.isNaN(d.valueOf()) ? 'Date unavailable' : d.toLocaleString(); }
function localDateStamp(value) { const parsed=value?new Date(value):new Date(),d=Number.isNaN(parsed.valueOf())?new Date():parsed;return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'); }
async function consistentReview() {
  for (let attempt=0;attempt<2;attempt++) {
    const current=await request('/api/workspace'),review=await request('/api/readiness');
    if(current.revision===review.workspaceRevision)return {current,review};
  }
  throw Error('The inventory is changing in another tab. Finish those edits, then refresh this review.');
}
async function load() {
  if (busy) return;
  busy = true;
  try {
    workspace = await request('/api/workspace');
    if (!workspace.onboarding) {
      $('#page').innerHTML = '<section class="blank"><h1>Start with your business.</h1><p>Save and acknowledge your business setup before reviewing calculation readiness.</p><a class="button primary" href="/">Open business setup →</a></section>';
      return;
    }
    const pair=await consistentReview();workspace=pair.current;assessment=pair.review;
    ({snapshots:history}=await request('/api/readiness/history'));
    historical = false;
    render(); status('Review based on saved information. Unsaved edits in other tabs are not included.');
  } catch (error) { notifyFailure(error); if (!assessment) $('#page').innerHTML = '<div class="errorbox">The readiness review is unavailable. Your collection data is unchanged. <a href="/plan.html">Return to collection</a></div>'; }
  finally { busy = false; }
}
const actionPriority={
 'subtype-invalid':10,'subtype-missing':11,'record-id-invalid':20,'duplicate-record':21,'record-invalid':22,'quantity-missing':23,'records-missing':24,
 'unit-incompatible':30,'unit-policy-unresolved':31,'evidence-missing':40,'estimate-basis-missing':41,'quality-unknown':42,'period-gap':50,
 'location-unresolved':60,'source-name-missing':61,'source-unresolved':62,'fuel-record-linkage':63,'fuel-profile-conflict':64,'vehicle-model-year-unknown':65,'charge-unknown':66,'fact-missing':70,'context-changed':80
};
function nextActions(items) {
  const actions=[];
  for(const [itemIndex,item] of items.entries()){
    if(item.status==='excluded-pending-review')continue;
    for(const [findingIndex,finding] of item.findings.entries()){
      if(finding.severity!=='blocking'||finding.code==='unsupported-method')continue;
      actions.push({item,finding,itemIndex,findingIndex,priority:actionPriority[finding.code]||90});
    }
  }
  return actions.sort((a,b)=>a.priority-b.priority||a.itemIndex-b.itemIndex||a.findingIndex-b.findingIndex).slice(0,5);
}
function renderNextActions(items) {
  const actions=nextActions(items),groups=[];
  for(const action of actions){let group=groups.find(entry=>entry.item.id===action.item.id);if(!group){group={item:action.item,findings:[]};groups.push(group);}group.findings.push(action.finding);}
  return `<section class="readiness-card next-actions"><div class="eyebrow">NEXT FIVE ACTIONS</div><h2>Start with the highest-risk input gaps.</h2>${groups.length?groups.map(group=>{const hasFacts=group.findings.some(finding=>['fact-missing','vehicle-model-year-unknown','charge-unknown'].includes(finding.code));return `<div class="action-group"><h3>${E(group.item.title)}</h3><ul>${group.findings.map(finding=>`<li>${E(finding.message)}</li>`).join('')}</ul><div class="toolbar">${hasFacts?`<button data-action-details="${E(group.item.id)}">Add customer facts</button>`:''}<a class="inline-link" href="/plan.html?activity=${encodeURIComponent(group.item.id)}">Open activity records →</a></div></div>`;}).join(''):'<p>No customer input gaps are currently queued. Method, factor, applicability, and reviewer release are still pending.</p>'}</section>`;
}
function render() {
  const o = historical ? (assessment.inputs?.onboarding || {}) : workspace.onboarding, c = o.company || {}, p = o.period || {}, r = assessment.result, s = r.summary;
  $('#companySide').textContent = c.trading || c.legal || 'Company not named';
  $('#periodSide').textContent = `${p.start || 'Start unresolved'} — ${p.end || 'End unresolved'}`;
  $('#geography').textContent = [c.region,c.country].filter(Boolean).join(' · ');
  $('#revision').textContent = historical ? 'Saved historical review' : 'Current saved inventory review';
  const companyName=E(c.legal || 'your company');
  $('#page').innerHTML = `<section class="intro"><div class="eyebrow">BEFORE YOU CALCULATE</div><h1>${historical?'Your saved readiness review.':'Make every input count.'}</h1><p>${historical?'This assessment belongs to the saved inventory at that time.':'Review the information collected for '+sentence(companyName)+' Resolve gaps, record customer facts, and keep supporting evidence together.'}</p></section>
  ${historical ? `<div class="historic-note"><b>Saved historical review · ${E(dateLabel(assessment.createdAt))}</b><p>This record does not certify the current inventory. Company details and findings belong to the saved review.</p><button id="returnCurrent">Return to current review</button></div>` : ''}
  <div class="readiness-summary"><article><span class="label">ACTIVITIES TO REVIEW</span><strong>${E(s.activityCount)}</strong><p>Activities needing collection or specialist attention</p></article><article><span class="label">INFORMATION NEEDED</span><strong>${E(s.needsInput)}</strong><p>Follow the prioritized questions below</p></article><article><span class="label">REVIEWED METHODS</span><strong>${E(s.methodReviewsComplete||0)}</strong><p>Method and factor approval pending</p></article></div>
  <section class="readiness-banner"><div class="eyebrow">CALCULATION STATUS</div><h2>Method review is still pending.</h2><p>Neuvetra shows a catalog candidate approach to guide collection. Customer-entered facts do not select or release a method, emission factor, or applicability decision. A qualified reviewer workflow is still required before results can be generated.</p><a class="inline-link" href="/plan.html">Continue collecting information →</a></section>
  ${renderNextActions(r.items)}
  <div class="readiness-actions"><button class="primary" id="saveSnapshot" ${historical?'disabled':''}>Save this readiness review</button><button id="refresh">Refresh saved information</button><button id="exportReview">Download review data</button></div>
  <section class="readiness-card"><div class="eyebrow">INVENTORY-WIDE CONDITIONS</div><h2>Boundary, coverage, and release</h2><p>These conditions apply to the inventory as a whole. Activity facts cannot resolve them by themselves.</p><details><summary>Show ${E(r.globalIssues.length)} inventory-wide conditions</summary><ul class="issue-list">${r.globalIssues.map(i=>`<li>${E(i.message)}</li>`).join('')}</ul></details><a class="inline-link" href="/">Review business setup →</a></section>
  <details class="activity-register"><summary>View all activities and exclusions</summary><div class="sectionhead"><h2>Activity readiness</h2><select id="filter" aria-label="Filter readiness"><option value="all">All activities</option><option value="needs-input">Information needed</option><option value="facts-collected">Customer facts collected</option><option value="unsupported">Specialist method needed</option><option value="excluded-pending-review">Exclusions</option></select></div><div id="activityReadiness"></div></details>
  <section class="readiness-card"><div class="eyebrow">REVIEW HISTORY</div><h2>A record of what you checked.</h2><p>Saved reviews preserve exact inputs and evaluation artifacts. New information requires a new review.</p><div id="history"></div></section>
  <footer><span>Local workspace · Readiness review, not a final emissions report</span><span>Source and method approval remain separate</span></footer>`;
  $('#filter').value = filter; $('#filter').onchange = event => {filter = event.target.value; renderItems();};
  $('#refresh').onclick = load; if ($('#returnCurrent')) $('#returnCurrent').onclick = load;
  $('#saveSnapshot').onclick = saveSnapshot; $('#exportReview').onclick = exportReview;
  renderItems(); renderHistory();
  $('#page').querySelectorAll('[data-action-details]').forEach(button=>button.onclick=()=>openDetails(button.dataset.actionDetails));
}
function renderItems() {
  const items = assessment.result.items.filter(i=>filter==='all'||i.status===filter);
  $('#activityReadiness').innerHTML = items.length ? items.map(item=>`<article class="readiness-card"><div class="cardhead"><div><span class="scopebadge">${item.scope && item.scope!=='unknown'?'SCOPE '+E(item.scope):'SCOPE NEEDS REVIEW'}</span><h3>${E(item.title)}</h3></div><span class="status-chip ${item.status==='facts-collected'?'candidate':item.status==='unsupported'?'unsupported':''}">${E(labels[item.status]||'Review needed')}</span></div><p class="method-caption">${E(item.recordCount)} records · ${E(item.zeroQuantityCount)} explicit zero quantities</p>${item.method?`<p><b>Catalog candidate approach:</b> ${E(item.method.approach||item.method.title||item.method.id)}</p>`:''}
  <details class="activity-findings"><summary>${E(item.findings.length)} findings and pending reviews</summary><ul>${item.findings.map(f=>`<li>${E(f.message)}</li>`).join('')}</ul></details>
  <div class="toolbar"><a class="button" href="/plan.html?activity=${encodeURIComponent(item.id)}">Review collection →</a>${item.factualFields?.length?`<button data-details="${E(item.id)}">${historical?'View customer facts':'Add customer facts'}</button>`:''}</div></article>`).join('') : '<div class="readiness-empty">No activities match this view. This does not establish zero emissions or a complete inventory.</div>';
  $('#activityReadiness').querySelectorAll('[data-details]').forEach(button=>button.onclick=()=>openDetails(button.dataset.details));
}
function renderHistory() {
  $('#history').innerHTML = history.length ? history.map(h=>`<div class="history-row"><div><b>Saved readiness review</b><small>${E(dateLabel(h.createdAt))}</small></div><button data-history="${E(h.id)}">View saved review</button></div>`).join('') : '<p>No readiness reviews saved yet.</p>';
  $('#history').querySelectorAll('[data-history]').forEach(button=>button.onclick=async()=>{try{assessment=await request('/api/readiness/'+encodeURIComponent(button.dataset.history));historical=true;render();status('Viewing a historical review. Refresh to check the latest saved inventory.');window.scrollTo({top:0,behavior:'smooth'});}catch(error){notifyFailure(error);}});
}
async function saveSnapshot() {
  if (busy || historical) return; busy=true; $('#saveSnapshot').disabled=true;
  try {
    assessment=await request('/api/readiness',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedRevision:assessment.workspaceRevision})});
    ({snapshots:history}=await request('/api/readiness/history')); render(); status('Readiness review saved. It preserves the current saved inventory; it is not approval to calculate.');
  } catch(error) {notifyFailure(error);} finally {busy=false;if($('#saveSnapshot'))$('#saveSnapshot').disabled=historical;}
}
function exportReview() {
  const blob = new Blob([JSON.stringify(assessment,null,2)],{type:'application/json'}), url=URL.createObjectURL(blob), a=document.createElement('a');
  const savedDate=localDateStamp(assessment.createdAt);
  a.href=url;a.download=`neuvetra-readiness-review-${savedDate}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function fieldControl(definition,value,index){
  if(definition.type==='select')return `<select id="fact-${index}" data-field="${E(definition.id)}" ${historical?'disabled':''}><option value="">Choose one</option>${definition.options.map(option=>`<option value="${E(option)}" ${value===option?'selected':''}>${E(optionLabel(option))}</option>`).join('')}</select>`;
  return `<input id="fact-${index}" data-field="${E(definition.id)}" type="${definition.type==='number'?'number':'text'}" ${definition.type==='number'?'min="0" step="any"':''} maxlength="240" value="${E(value)}" ${historical?'readonly':''}>`;
}
function openDetails(id) {
  const item=assessment.result.items.find(i=>i.id===id);if(!item)return;
  lastFocus=document.activeElement;$('#detailsTitle').textContent=item.title;
  const fields=item.factualFields||[], details=item.details||{};
  $('#detailBody').innerHTML=`<p>Record customer facts that identify the activity data and its source. Neuvetra's catalog candidate remains separate from reviewer method, factor, and applicability decisions.</p><p>Leave a field blank when it is unknown. “N/A”, “unknown”, and similar placeholders do not count as collected facts.</p><div id="detailError" role="alert"></div><form id="methodForm">${fields.map((f,i)=>`<label class="field" for="fact-${i}">${E(f.label)}${fieldControl(f,details[f.id]||'',i)}${f.help?`<small>${E(f.help)}</small>`:''}</label>`).join('')}${historical?'<p>This is a saved historical review; its facts cannot be changed.</p>':'<button class="primary" type="submit">Save customer facts and check again</button>'}</form>`;
  $('#methodForm').onsubmit=async event=>{
    event.preventDefault();if(busy||historical)return;busy=true;const submit=event.currentTarget.querySelector('button');submit.disabled=true;
    try {
      const current=await request('/api/workspace');
      if(current.revision!==assessment.workspaceRevision)throw Error('The inventory changed. Close this panel and refresh before editing customer facts.');
      if(!current.plan.items[id])throw Error('This activity is no longer in the saved plan. Refresh to review the current inventory.');
      const values={};$('#methodForm').querySelectorAll('[data-field]').forEach(el=>values[el.dataset.field]=el.value.trim());
      current.plan.items[id].readinessDetails=values;
      workspace=await request('/api/workspace',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedRevision:current.revision,onboarding:current.onboarding,plan:current.plan})});
      const pair=await consistentReview();workspace=pair.current;assessment=pair.review;$('#details').close();render();status('Customer facts saved and input gaps checked again. Method review remains pending.');
    }catch(error){$('#detailError').textContent=error.message;}finally{busy=false;submit.disabled=false;}
  };
  $('#details').showModal();
}
$('#closeDetails').onclick=()=>$('#details').close();$('#details').addEventListener('close',()=>lastFocus?.focus());
load();
