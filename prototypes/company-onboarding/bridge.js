/* Database handoff for the existing seven-step intake. Local drafts remain recoverable. */
(function(){
let baseRevision=null,dbOnboarding=null,loading=true;
const box=document.createElement('p');box.id='database-status';box.className='notice';box.setAttribute('role','status');document.querySelector('.topline').after(box);
box.textContent='Connecting to saved workspace…';
const headers={'X-Neuvetra-Local':'1'};
fetch('/api/workspace',{headers,cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('The saved workspace could not be loaded.');const w=await r.json();baseRevision=w.revision;dbOnboarding=w.onboarding;window.inventoryWorkspace=w;
 const local=localStorage.getItem(KEY);let localData=null;try{localData=JSON.parse(local)?.data}catch{}
 if(dbOnboarding&&!validDraft(dbOnboarding))throw Error('Saved setup has an unsupported format. Your browser draft has been kept.');
 if(dbOnboarding&&!localData){data=dbOnboarding;save();render();}
 box.replaceChildren();const text=document.createElement('span');text.textContent=dbOnboarding?'A saved workspace is available. Acknowledge your latest answers to update its inventory plan.':'Your answers will create a saved inventory plan when you acknowledge the review.';box.append(text);
 if(dbOnboarding){const link=document.createElement('a');link.href='/plan.html';link.textContent=' Open saved plan →';box.append(link);if(localData&&JSON.stringify(localData)!==JSON.stringify(dbOnboarding)){const b=document.createElement('button');b.type='button';b.textContent='Use saved setup instead';b.onclick=()=>{if(confirm('Replace this browser’s draft with the saved setup? The saved inventory plan will be kept.')){data=structuredClone(dbOnboarding);save();render();box.textContent='Saved setup loaded. Edit and acknowledge to update the plan.'}};box.append(b);}}
 }).catch(e=>{box.textContent=e.message+' You can keep editing this browser draft.'}).finally(()=>loading=false);
const previous=document.querySelector('#next').onclick;
document.querySelector('#next').onclick=async()=>{const reviewStep=all||step===6;previous();if(!reviewStep||!data.review.complete||!data.review.needed||!String(data.review.role||'').trim())return;
 const result=document.querySelector('#review-result');if(loading||baseRevision===null){result.textContent='The workspace is not connected yet. Your browser draft is kept; retry once the connection is available.';return;}
 const button=document.querySelector('#next');button.disabled=true;result.textContent='Saving your setup and opening the inventory plan…';
 try{const w=window.inventoryWorkspace;const r=await fetch('/api/workspace',{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({expectedRevision:baseRevision,onboarding:data,plan:w.plan})});if(r.status===409)throw Error('Another tab updated this workspace. Your draft is kept. Reload to review the latest saved version before trying again.');if(!r.ok){let err=await r.json().catch(()=>({}));throw Error(err.error||'The database could not save your setup. Your browser draft is kept.');}location.assign('/plan.html');}catch(e){result.textContent=e.message;button.disabled=false;}
};
})();
