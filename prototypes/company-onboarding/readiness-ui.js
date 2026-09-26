'use strict';
const $ = selector => document.querySelector(selector);
const E = value => PlanCore.escapeHtml(value);
let workspace, assessment, history = [], filter = 'all', historical = false, busy = false, lastFocus;
const labels = {'needs-input':'Information needed','candidate-for-method-review':'Inputs prepared for review','unsupported':'Specialist method needed','excluded-pending-review':'Exclusion needs review'};
async function request(path, options = {}) {
  const response = await fetch(path, {...options, cache:'no-store', headers:{'X-Neuvetra-Local':'1', ...options.headers}});
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(response.status === 409 ? 'Your saved inventory changed. Refresh this review before saving again.' : body.error || 'The review could not be loaded. Please try again.');
  return body;
}
function status(message, error = false) { $('#globalStatus').textContent = message; $('#globalStatus').className = error ? 'error' : ''; }
function notifyFailure(error) { status(error.message, true); }
function dateLabel(value) { const d = new Date(value); return Number.isNaN(d.valueOf()) ? 'Date unavailable' : d.toLocaleString(); }
async function consistentReview() {
  for (let attempt=0;attempt<2;attempt++) {
    const current=await request('/api/workspace');
    const review=await request('/api/readiness');
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
function render() {
  const o = historical ? (assessment.inputs?.onboarding || {}) : workspace.onboarding, c = o.company || {}, p = o.period || {}, r = assessment.result, s = r.summary;
  $('#companySide').textContent = c.trading || c.legal || 'Company not named';
  $('#periodSide').textContent = `${p.start || 'Start unresolved'} — ${p.end || 'End unresolved'}`;
  $('#geography').textContent = [c.region,c.country].filter(Boolean).join(' · ');
  $('#revision').textContent = `Review of revision ${assessment.workspaceRevision}`;
  $('#page').innerHTML = `<section class="intro"><div class="eyebrow">BEFORE YOU CALCULATE</div><h1>${historical?'Your saved readiness review.':'Make every input count.'}</h1><p>${historical?'This assessment belongs to its saved inventory revision.':'Review the information collected for '+E(c.legal || 'your company')+'. Resolve gaps, prepare the right method and keep the supporting evidence together.'}</p></section>
  ${historical ? `<div class="historic-note"><b>Saved historical review · ${E(dateLabel(assessment.createdAt))}</b><p>This records the assessment of revision ${E(assessment.workspaceRevision)}. It does not certify the current inventory. Company details and findings belong to the saved revision.</p><button id="returnCurrent">Return to current review</button></div>` : ''}
  <div class="readiness-summary"><article><span class="label">ACTIVITIES TO REVIEW</span><strong>${E(s.activityCount)}</strong><p>Drawn from your saved collection</p></article><article><span class="label">INFORMATION NEEDED</span><strong>${E(s.needsInput)}</strong><p>Follow the questions below</p></article><article><span class="label">INPUTS PREPARED</span><strong>${E(s.candidates)}</strong><p>Still require method and factor review</p></article></div>
  <section class="readiness-banner"><div class="eyebrow">CALCULATION STATUS</div><h2>Method approval is still required.</h2><p>Completing inputs does not approve a calculation. Applicable methods, emission factors and their sources must be released for the reporting period before results can be generated. Specialized activities remain visible for review.</p><a class="inline-link" href="/plan.html">Continue collecting information →</a></section>
  <div class="readiness-actions"><button class="primary" id="saveSnapshot" ${historical?'disabled':''}>Save this readiness review</button><button id="refresh">Refresh saved information</button><button id="exportReview">Download review data</button></div>
  <section class="readiness-card"><div class="eyebrow">INVENTORY-WIDE QUESTIONS</div><h2>Boundary, coverage & approval</h2><p>These questions apply to the inventory as a whole. A fully populated record cannot resolve them by itself.</p><details ${r.globalIssues.length < 8?'open':''}><summary>${E(r.globalIssues.length)} questions and release conditions</summary><ul class="issue-list">${r.globalIssues.map(i=>`<li>${E(i.message)}</li>`).join('')}</ul></details><a class="inline-link" href="/">Review business setup →</a></section>
  <div class="sectionhead"><h2>Activity readiness</h2><select id="filter" aria-label="Filter readiness"><option value="all">All activities</option><option value="needs-input">Information needed</option><option value="candidate-for-method-review">Inputs prepared for review</option><option value="unsupported">Specialist method needed</option><option value="excluded-pending-review">Exclusions</option></select></div><div id="activityReadiness"></div>
  <section class="readiness-card"><div class="eyebrow">REVIEW HISTORY</div><h2>A record of what you checked.</h2><p>Saved reviews preserve their input revision and the checks used. New information requires a new review.</p><div id="history"></div></section>
  <footer><span>Local workspace · Readiness review, not a final emissions report</span><span>Source and method approval remain separate</span></footer>`;
  $('#filter').value = filter; $('#filter').onchange = event => {filter = event.target.value; renderItems();};
  $('#refresh').onclick = load; if ($('#returnCurrent')) $('#returnCurrent').onclick = load;
  $('#saveSnapshot').onclick = saveSnapshot; $('#exportReview').onclick = exportReview;
  renderItems(); renderHistory();
}
function renderItems() {
  const items = assessment.result.items.filter(i=>filter==='all'||i.status===filter);
  $('#activityReadiness').innerHTML = items.length ? items.map(item=>`<article class="readiness-card"><div class="cardhead"><div><span class="scopebadge">${item.scope && item.scope!=='unknown'?'SCOPE '+E(item.scope):'SCOPE NEEDS REVIEW'}</span><h3>${E(item.title)}</h3></div><span class="status-chip ${item.status==='candidate-for-method-review'?'candidate':item.status==='unsupported'?'unsupported':''}">${E(labels[item.status]||'Review needed')}</span></div><p class="method-caption">${E(item.recordCount)} records · ${E(item.zeroQuantityCount)} explicit zero quantities</p>${item.method?`<p><b>Candidate approach:</b> ${E(item.method.approach||item.method.title||item.method.id)}</p>`:''}
  <ul>${item.findings.slice(0,5).map(f=>`<li>${E(f.message)}</li>`).join('')}</ul>${item.findings.length>5?`<details><summary>Show ${item.findings.length-5} more findings</summary><ul>${item.findings.slice(5).map(f=>`<li>${E(f.message)}</li>`).join('')}</ul></details>`:''}
  <div class="toolbar"><a class="button" href="/plan.html?activity=${encodeURIComponent(item.id)}">Review collection →</a>${item.method?.requiredFields?.length?`<button data-details="${E(item.id)}">${historical?'View method details':'Prepare method details'}</button>`:''}</div></article>`).join('') : '<div class="readiness-empty">No activities match this view. This does not establish zero emissions or a complete inventory.</div>';
  $('#activityReadiness').querySelectorAll('[data-details]').forEach(button=>button.onclick=()=>openDetails(button.dataset.details));
}
function renderHistory() {
  $('#history').innerHTML = history.length ? history.map(h=>`<div class="history-row"><div><b>Revision ${E(h.workspaceRevision)}</b><small>${E(dateLabel(h.createdAt))}</small></div><button data-history="${E(h.id)}">View saved review</button></div>`).join('') : '<p>No readiness reviews saved yet.</p>';
  $('#history').querySelectorAll('[data-history]').forEach(button=>button.onclick=async()=>{try{assessment=await request('/api/readiness/'+encodeURIComponent(button.dataset.history));historical=true;render();status('Viewing a historical review. Refresh to check the latest saved inventory.');window.scrollTo({top:0,behavior:'smooth'});}catch(error){notifyFailure(error);}});
}
async function saveSnapshot() {
  if (busy || historical) return; busy=true; $('#saveSnapshot').disabled=true;
  try {
    assessment=await request('/api/readiness',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedRevision:assessment.workspaceRevision})});
    ({snapshots:history}=await request('/api/readiness/history')); render(); status('Readiness review saved. It preserves this revision; it is not approval to calculate.');
  } catch(error) {notifyFailure(error);} finally {busy=false;if($('#saveSnapshot'))$('#saveSnapshot').disabled=historical;}
}
function exportReview() {
  const blob = new Blob([JSON.stringify(assessment,null,2)],{type:'application/json'}), url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url;a.download=`neuvetra-readiness-revision-${assessment.workspaceRevision}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function openDetails(id) {
  const item=assessment.result.items.find(i=>i.id===id);if(!item)return;
  lastFocus=document.activeElement;$('#detailsTitle').textContent=item.title;
  const fields=item.method.requiredFields, details=item.details||{};
  $('#detailBody').innerHTML=`<p>${E(item.method.approach||'Describe the information needed to assess this candidate method.')}</p><p>These answers remain subject to evidence and method review. Keep an answer blank when you do not know; a written explanation is not technical validation.</p><div id="detailError" role="alert"></div><form id="methodForm">${fields.map((f,i)=>`<label class="field" for="method-${i}">${E(f.label)}<textarea id="method-${i}" data-field="${E(f.id)}" rows="2" maxlength="4000" ${historical?'readonly':''}>${E(details[f.id]||'')}</textarea>${f.help?`<small>${E(f.help)}</small>`:''}</label>`).join('')}${historical?'<p>This is a saved historical review; its answers cannot be changed.</p>':'<button class="primary" type="submit">Save details & check again</button>'}</form>`;
  $('#methodForm').onsubmit=async event=>{
    event.preventDefault();if(busy||historical)return;busy=true;const submit=event.currentTarget.querySelector('button');submit.disabled=true;
    try {
      const current=await request('/api/workspace');
      if(current.revision!==assessment.workspaceRevision)throw Error('The inventory changed. Close this panel and refresh before editing method details.');
      if(!current.plan.items[id])throw Error('This activity is no longer in the saved plan. Refresh to review the current inventory.');
      const values={};$('#methodForm').querySelectorAll('[data-field]').forEach(el=>values[el.dataset.field]=el.value.trim());
      current.plan.items[id].readinessDetails=values;
      workspace=await request('/api/workspace',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedRevision:current.revision,onboarding:current.onboarding,plan:current.plan})});
      const pair=await consistentReview();workspace=pair.current;assessment=pair.review;$('#details').close();render();status('Method details saved and readiness checked against the new revision.');
    }catch(error){$('#detailError').textContent=error.message;}finally{busy=false;submit.disabled=false;}
  };
  $('#details').showModal();
}
$('#closeDetails').onclick=()=>$('#details').close();$('#details').addEventListener('close',()=>lastFocus?.focus());
load();
