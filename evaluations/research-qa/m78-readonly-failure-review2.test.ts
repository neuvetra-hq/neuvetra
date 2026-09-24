import {describe,expect,test} from 'bun:test';
import {readFile} from 'node:fs/promises';
import {m71CanonicalJson as canonical} from '../../packages/neuvetra-database/src/m71-validation';
import {m75CanonicalJson} from '../../packages/neuvetra-database/src/m75-validation';
import {m75RenderReport} from '../../packages/neuvetra-database/src/m75-report';
import {m76CanonicalJson} from '../../packages/neuvetra-database/src/m76-validation';
import {m76RenderReport} from '../../packages/neuvetra-database/src/m76-report';
import {reconstructM78ReadonlyRecoveryArtifacts} from '../../tools/staging/check-m78-continuation4-readonly-recovery';
import {buildM78ReadonlyFailure2FixtureDownloads,loadM78ReadonlyFailure2Fixture} from './m78-readonly-failure-review2-fixture';

const sha=(value:string|Uint8Array)=>new Bun.CryptoHasher('sha256').update(value).digest('hex');
const lines=async(path:string)=>(await readFile(path,'utf8')).trim().split('\n').map(line=>JSON.parse(line));
const encoded=(value:string)=>({sha256:sha(value),byteLength:new TextEncoder().encode(value).length});
const check:(value:unknown,message:string)=>asserts value=(value,message)=>{if(!value)throw Error(message)};

describe('M78 read-only recovery failure 2',()=>{
 test('immutable failed journals are exact, chained, GET-only and closed by role evidence',async()=>{
  const failure=JSON.parse(await readFile('evaluations/research-qa/m78-readonly-recovery-failure.json','utf8'));
  const mainText=await readFile('.superpowers/m78-continuation4-readonly-recovery.jsonl','utf8'),diagnosticText=await readFile('.superpowers/m78-continuation4-readonly-recovery-diagnostics.jsonl','utf8');
  expect(sha(mainText)).toBe(failure.main.sha256);expect(sha(diagnosticText)).toBe(failure.diagnostics.sha256);
  const main=await lines('.superpowers/m78-continuation4-readonly-recovery.jsonl'),diagnostics=await lines('.superpowers/m78-continuation4-readonly-recovery-diagnostics.jsonl');
  const chain=(rows:any[])=>rows.forEach((event,index)=>{const{sha256,...body}=event;expect(event.sequence).toBe(index+1);expect(event.previousSha256).toBe(index?rows[index-1].sha256:null);expect(sha(canonical(body))).toBe(sha256)});chain(main);chain(diagnostics);
  expect(main).toHaveLength(18);expect(diagnostics).toHaveLength(49);expect(main.at(-1)?.sha256).toBe(failure.main.head);expect(diagnostics.at(-1)?.sha256).toBe(failure.diagnostics.head);
  const intents=diagnostics.filter(x=>x.kind==='request_intent'),responses=diagnostics.filter(x=>x.kind==='response_headers');expect(intents).toHaveLength(24);expect(responses).toHaveLength(24);expect(diagnostics.some(x=>x.kind==='request_error')).toBeFalse();
  const application=intents.filter(x=>x.data.route.startsWith('application:'));expect(application.length).toBe(16);expect(application.every(x=>x.data.method==='GET')).toBeTrue();expect(application.map(x=>responses.find(y=>y.data.ordinal===x.data.ordinal)?.data.status)).toEqual([403,401,...Array(14).fill(200)]);
  expect(main.filter(x=>x.kind==='logout_outcome').map(x=>[x.data.role,x.data.status])).toEqual([['manager1',204],['manager2',204],['member',204],['outsider',204]]);expect(failure.legacyAttempted).toBeFalse();expect(failure.observationCreated).toBeFalse();expect(failure.applicationPostRequests).toBe(0);
 });

 test('frozen reconstruction fails on metadata-only fleet/equipment reports',async()=>{
  const{baseline}=await loadM78ReadonlyFailure2Fixture();expect(()=>reconstructM78ReadonlyRecoveryArtifacts(baseline.scope1,baseline.registers,{})).toThrow();
 });

 test('archived full report strings are exact fixtures without normalization',async()=>{
  const{baseline,reports}=await loadM78ReadonlyFailure2Fixture();let count=0;
  for(const [family,canon,render] of [['fleet',m75CanonicalJson,m75RenderReport],['equipment',m76CanonicalJson,m76RenderReport]] as const)for(const meta of baseline.registers[family].reports){const report=reports.get(meta.id)?.response;check(report,'archived '+family+' report '+meta.id);count++;expect(sha(report.html)).toBe(meta.htmlSha256);expect(encoded(report.html).byteLength).toBe(meta.htmlByteLength);expect(sha(report.snapshotJson)).toBe(meta.snapshotSha256);const snapshot=JSON.parse(report.snapshotJson);expect(canon(snapshot)).toBe(report.snapshotJson);expect(render(snapshot as never)).toBe(report.html);expect('proof' in snapshot).toBeFalse();expect(baseline.downloads[family]['proof_'+meta.id]).toMatch(/^[a-f0-9]{64}$/)}
  expect(count).toBe(8);
 });

 test('verified fixture reconstruction preserves exact keys and bytes',async()=>{
  const{baseline,reports}=await loadM78ReadonlyFailure2Fixture(),actual=buildM78ReadonlyFailure2FixtureDownloads(baseline,reports);expect(actual.mobile).toEqual(baseline.downloads.mobile);expect(actual.fleet).toEqual(baseline.downloads.fleet);expect(actual.equipment).toEqual(baseline.downloads.equipment);
  expect(Object.keys(actual.mobile).some(key=>key.startsWith('statement_'))).toBeFalse();expect(Object.keys(actual.mobile).filter(key=>key.startsWith('fuel_')).length).toBe(5);expect(Object.keys(actual.mobile).filter(key=>key.startsWith('mileage_')).length).toBe(5);
 });
});
