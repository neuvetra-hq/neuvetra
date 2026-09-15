import {describe,expect,test} from 'bun:test'
// Execute the actual component's pre-JSX action closure with injected hook/browser boundaries.
// This is not a React DOM renderer or a claim about native popup/print UI behavior.
const source=await Bun.file(new URL('../../apps/site-web/src/components/AnnualEvidenceReports.tsx',import.meta.url)).text()
const cut=source.indexOf('  return <section')
if(cut<0)throw Error('Component instrumentation anchor changed')
const instrumented=source.slice(0,cut).replace(/^import [^\n]+\n/gm,'').replace('export function AnnualEvidenceReports','function AnnualEvidenceReports')+'  return {run,pendingPrint,lock}\n}\nreturn AnnualEvidenceReports\n'
const script=new Bun.Transpiler({loader:'tsx'}).transformSync(instrumented)
function harness(){
 const states:unknown[]=[],cleanup:Array<()=>void>=[],events:string[]=[],timers:Array<()=>void>=[],revoked:string[]=[]
 let read:()=>Promise<string>=async()=>'<html>verified & exact</html>',popupBlocked=false
 const popup={opener:{} as unknown,closed:false,document:{title:'',body:{textContent:''}},location:{replace:(url:string)=>{events.push('navigate:'+url)}},close(){this.closed=true;events.push('close')}}
 const blobs:Blob[]=[],controller=new AbortController()
 const factory=new Function('useEffect','useRef','useState','readAnnualEvidenceReportHtml','listAnnualEvidenceReports','createAnnualEvidenceReport','window','URL','Blob','setTimeout',script)
 const component=factory((effect:()=>()=>void)=>cleanup.push(effect()),(value:unknown)=>({current:value}),(value:unknown)=>[value,(next:unknown)=>states.push(next)],async()=>{events.push('verify');return read()},async()=>[],async()=>null,{open(){events.push('open');return popupBlocked?null:popup}},{createObjectURL(blob:Blob){blobs.push(blob);events.push('blob');return 'blob:verified'},revokeObjectURL(url:string){revoked.push(url)}},Blob,(fn:()=>void,delay:number)=>{expect(delay).toBe(300000);timers.push(fn)})
 const state=component({actor:{signal:controller.signal,role:'owner'},worksheet:{},version:{version:4}})
 return {state,states,cleanup,events,timers,revoked,popup,blobs,controller,setRead(fn:()=>Promise<string>){read=fn},block(){popupBlocked=true},unblock(){popupBlocked=false}}
}
const deferred=()=>{let resolve!:(s:string)=>void,reject!:(e:Error)=>void;const promise=new Promise<string>((a,b)=>{resolve=a;reject=b});return {resolve,reject,promise}}
describe('M68 actual annual evidence report action closure lifecycle',()=>{
 test('sync blank popup is disowned before verification and receives only exact verified HTML',async()=>{
  const h=harness(),d=deferred();h.setRead(()=>d.promise)
  const pending=h.state.run('print',{});expect(h.events).toEqual(['open','verify']);expect(h.popup.opener).toBeNull();expect(h.blobs).toHaveLength(0);expect(h.popup.document.body.textContent).toContain('Ctrl+P')
  const exact='<html>exact &amp; verified \u00b7</html>';d.resolve(exact);await pending
  expect(h.events).toEqual(['open','verify','blob','navigate:blob:verified']);expect(await h.blobs[0]!.text()).toBe(exact);expect(h.popup.closed).toBe(false);expect(h.state.lock.current).toBe(false);expect(h.states.at(-1)).toBe(false)
  expect(h.timers).toHaveLength(1);h.timers[0]!();expect(h.revoked).toEqual(['blob:verified']);expect(source).not.toContain('.print()')
 })
 test('blocked popup does not fetch, clears busy lock and permits a later action',async()=>{
  const h=harness();h.block();await h.state.run('print',{});expect(h.events).toEqual(['open']);expect(h.states.some(s=>typeof s==='string'&&s.includes('blocked'))).toBe(true);expect(h.state.lock.current).toBe(false)
  h.unblock();await h.state.run('print',{});expect(h.events).toContain('navigate:blob:verified')
 })
 test('authorization or integrity refusal closes the blank popup with no Blob',async()=>{
  for(const message of ['Your access changed.','The report could not be verified.']){const h=harness();h.setRead(async()=>{throw Error(message)});await h.state.run('print',{});expect(h.popup.closed).toBe(true);expect(h.blobs).toHaveLength(0);expect(h.state.pendingPrint.current).toBeNull();expect(h.state.lock.current).toBe(false);expect(h.states).toContain(message)}
 })
 test('user closes popup during verification: no navigation or Blob allocation',async()=>{
  const h=harness(),d=deferred();h.setRead(()=>d.promise);const pending=h.state.run('print',{});h.popup.close();d.resolve('verified');await pending;expect(h.blobs).toHaveLength(0);expect(h.states.some(s=>typeof s==='string'&&s.includes('was closed'))).toBe(true);expect(h.state.lock.current).toBe(false)
 })
 test('actor abort before click does nothing; abort while verifying prevents navigation and closes popup',async()=>{
  const before=harness();before.controller.abort();await before.state.run('print',{});expect(before.events).toHaveLength(0)
  const h=harness(),d=deferred();h.setRead(()=>d.promise);const pending=h.state.run('print',{});h.controller.abort();d.resolve('verified');await pending;expect(h.blobs).toHaveLength(0);expect(h.popup.closed).toBe(true);expect(h.state.pendingPrint.current).toBeNull()
 })
 test('unmount closes pending popup immediately and late verified resolution cannot navigate',async()=>{
  const h=harness(),d=deferred();h.setRead(()=>d.promise);const pending=h.state.run('print',{});h.cleanup[0]!();expect(h.popup.closed).toBe(true);expect(h.state.pendingPrint.current).toBeNull();d.resolve('verified');await pending;expect(h.blobs).toHaveLength(0);expect(h.state.lock.current).toBe(false)
 })
 test('navigation failure closes popup and still schedules Blob cleanup',async()=>{
  const h=harness();h.popup.location.replace=()=>{throw Error('navigation refused')};await h.state.run('print',{});expect(h.popup.closed).toBe(true);expect(h.timers).toHaveLength(1);h.timers[0]!();expect(h.revoked).toEqual(['blob:verified']);expect(h.states).toContain('navigation refused')
 })
})
