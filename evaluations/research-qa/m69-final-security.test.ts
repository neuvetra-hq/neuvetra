import { expect, test } from 'bun:test';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { hash } from '../../apps/site-api/src/research-passages/release';
import { executeCanary, validateClosure, reservationNanoUsd } from '../../tools/research/m69-canary-runtime';
import { validateAdmission } from '../../tools/research/m69-canary-launcher';
import { question, runId } from '../../tools/research/m69-canary';
const root = path.resolve(import.meta.dir, '../..');
const source = path.join(root,'.superpowers/m69-rehearsal-final');
test('pure admission rejects expiry and exact-scope drift without issuing authority',()=>{
  const now=Date.parse('2026-09-15T04:00:00Z'),h='a'.repeat(64),e='b'.repeat(64);
  const a={kind:'m69_exact_paid_authorization',run_id:runId,one_use:true,candidate_sha256:h,executable_sha256:e,
    question_sha256:hash(question),reservation_nano_usd:reservationNanoUsd,board_authorized:true,maximum_stages:5,retry:false,carry:false,
    source_mode:'verified_local_corpus_no_cloud_index',customer_data:false,internal_estimate_not_provider_cap_acknowledged:true,
    board_decision_sha256:h,independent_review_sha256:h,source_review_sha256:h,account_evidence_sha256:h,endpoint_evidence_sha256:h,
    nonce:'s'.repeat(43),issued_at:new Date(now-1000).toISOString(),expires_at:new Date(now+240000).toISOString()};
  expect(validateAdmission(a,h,e,now)).toBe(true);
  for(const change of [{issued_at:new Date(now+1).toISOString()},{issued_at:new Date(now-60001).toISOString()},
    {expires_at:new Date(now).toISOString()},{maximum_stages:6},{retry:true},{carry:true},{one_use:false},{board_authorized:false},
    {question_sha256:e},{reservation_nano_usd:reservationNanoUsd+1},{candidate_sha256:e},{customer_data:true}]) {
    expect(()=>validateAdmission({...a,...change},h,e,now)).toThrow();
  }
});
function challenge(mutate: (c: any, read: (f: string)=>any, write: (f:string,v:any)=>void, remove: (f:string)=>void) => void, inputDirectory = source) {
  const dir = mkdtempSync(path.join(tmpdir(),'m69-final-security-'));
  try {
    cpSync(inputDirectory,dir,{recursive:true});
    const read = (f:string) => JSON.parse(readFileSync(path.join(dir,f),'utf8'));
    const write = (f:string,v:any) => writeFileSync(path.join(dir,f),JSON.stringify(v)+'\n');
    const c = read('closure.json'); mutate(c,read,write,f=>unlinkSync(path.join(dir,f))); write('closure.json',c);
    expect(() => validateClosure(dir)).toThrow();
  } finally { if (!path.resolve(dir).startsWith(path.resolve(tmpdir()) + path.sep) || !path.basename(dir).startsWith('m69-final-security-')) throw Error('cleanup_refused'); rmSync(dir,{recursive:true}); }
}
test('unchanged compiled fixture closure validates',()=>expect(validateClosure(source).answer_status).toBe('qualified'));
test('rebound live zero-provider count refuses',()=>challenge(c=>{c.execution_mode='live_provider';c.provider_requests=0;}));
test('rebound settled cost must agree with native stage evidence',()=>challenge((c,read,write)=>{
  c.receipts[0].settled=0; const s=read('attempt-1-settled.json');s.cost_nano_usd=0;write('attempt-1-settled.json',s);
  c.known_settled_nano_usd-=1000000;c.exact_total_nano_usd-=1000000;
}));
test('rebound stage identity cannot disagree with receipt',()=>challenge((c,read,write)=>{
  const e=c.stage_events.find((v:any)=>v.path==='stage-1-completed.json');const s=read(e.path);s.stage='verify';write(e.path,s);e.sha256=hash(JSON.stringify(s)+'\n');
}));
test('false controlled exit refuses success acceptance',()=>challenge(c=>{c.controlled_exit=false;}));
test('a final failed stage cannot coexist with successful answer eligibility',()=>challenge((c,r,w,remove)=>{
  const e=c.stage_events.find((v:any)=>v.path==='stage-3-completed.json');const s=r(e.path);remove(e.path);
  e.path='stage-3-failed.json';s.phase='failed';s.output_sha256=null;s.code='provider_failure';w(e.path,s);e.sha256=hash(JSON.stringify(s)+'\n');
}));
function changeRequest(c:any,read:(f:string)=>any,write:(f:string,v:any)=>void,mutate:(body:any)=>void) {
  const file='attempt-1-request.json',r=read(file),body=JSON.parse(r.body_utf8); mutate(body);r.body_utf8=JSON.stringify(body);write(file,r);
  const a=read('attempt-1-reserved.json');a.request_body_sha256=hash(r.body_utf8);a.request_body_bytes=Buffer.byteLength(r.body_utf8);write('attempt-1-reserved.json',a);
}
test('rebound wrong request model refuses',()=>challenge((c,r,w)=>changeRequest(c,r,w,b=>{b.model='anthropic/claude-fake-5';})));
test('enabled request plugin refuses',()=>challenge((c,r,w)=>changeRequest(c,r,w,b=>{b.plugins[0].enabled=true;})));
test('unlisted extra paid-attempt record refuses',()=>challenge((_c,_r,w)=>w('attempt-4-dispatch-intent.json',{attempt:4})));
test('nonboolean uncertainty refuses',()=>challenge(c=>{c.receipts[0].uncertain=0;}));
test('unbound uncertainty file refuses',()=>challenge((_c,_r,w)=>w('attempt-3-uncertain.json',{attempt:3,native_settled_nano_usd:1000000,dispatched:true})));
test('settlement source must agree with native cost source',()=>challenge((_c,r,w)=>{const s=r('attempt-1-settled.json');s.cost_source='generation';w('attempt-1-settled.json',s);}));
test('request output token limit cannot be rebound above reviewed maximum',()=>challenge((c,r,w)=>changeRequest(c,r,w,b=>{b.max_tokens=8193;})));
test('source-blind analyze input must remain exact frozen question',()=>challenge((c,r,w)=>changeRequest(c,r,w,b=>{const prior=b.messages[0].content;expect(prior).toContain('yearly');b.messages[0].content=prior.replace('yearly','annual');expect(b.messages[0].content).not.toBe(prior);})));
test('failed response native cost cannot be contradicted by rebound settlement',async()=>{
  const directory=mkdtempSync(path.join(tmpdir(),'m69-final-security-'));
  try {
    await executeCanary({root,directory,apiKey:'synthetic-no-network',transport:async(_url,init)=>{
      const model=JSON.parse(String(init.body)).model;
      return Response.json({model,provider:'Anthropic',stop_reason:'end_turn',content:[{type:'text',text:'invalid'}],usage:{cost:0.001},
        openrouter_metadata:{requested:model,strategy:'direct',attempt:1,is_byok:false,endpoints:{total:1,available:[{provider:'Anthropic',model,selected:true}]}}});
    }});
    challenge((c,r,w)=>{c.receipts[0].settled=0;const s=r('attempt-1-settled.json');s.cost_nano_usd=0;w('attempt-1-settled.json',s);c.known_settled_nano_usd=0;c.exact_total_nano_usd=0;},directory);
  } finally {if(!path.resolve(directory).startsWith(path.resolve(tmpdir())+path.sep)||!path.basename(directory).startsWith('m69-final-security-'))throw Error('cleanup_refused');rmSync(directory,{recursive:true});}
});
test('compiled launcher refuses missing authority and replayed rehearsal without consuming live run', async()=>{
  const executable=path.join(root,'.superpowers/m69-build/m69-canary.exe');
  const candidate=path.join(root,'docs/research/m69-live-candidate.json');
  const live=path.join(root,'.superpowers',runId);
  expect(existsSync(live)).toBe(false);
  const dir=mkdtempSync(path.join(tmpdir(),'m69-final-security-'));
  try {
    const a=path.join(dir,'synthetic-invalid-authority.json');writeFileSync(a,'{}');
    for(const args of [[root,candidate,a],[dir,candidate,a],['--rehearse',root,a,source]]) {
      const process=Bun.spawn([executable,...args],{stdin:'ignore',stdout:'pipe',stderr:'pipe',env:{SystemRoot:Bun.env.SystemRoot ?? 'C:\\Windows'}});
      expect(await process.exited).toBe(1);expect(await new Response(process.stdout).text()).toBe('');
      expect(await new Response(process.stderr).text()).toContain('m69_launch_refused');
    }
    expect(existsSync(live)).toBe(false);
  } finally { if (!path.resolve(dir).startsWith(path.resolve(tmpdir()) + path.sep) || !path.basename(dir).startsWith('m69-final-security-')) throw Error('cleanup_refused');rmSync(dir,{recursive:true}); }
});
