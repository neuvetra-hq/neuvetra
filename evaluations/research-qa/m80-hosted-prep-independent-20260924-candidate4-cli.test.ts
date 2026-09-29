import {expect,test} from 'bun:test'
import {readFile} from 'node:fs/promises'
import * as paths from 'node:path'
import * as prep from './m80-hosted-prep-independent-20260924-candidate4-frozen-prepare'
import {input,build,seal,record,chainArgs,artifactPin,gateBundle,NOW} from './m80-hosted-prep-independent-20260924-candidate4-fixture'
import {parseM80Json} from '../../packages/neuvetra-database/src/m80-validation'
test('actual frozen CLI loads predecessor gates and review bodies before exclusive deployment intent',async()=>{
 const snapshot=JSON.parse(await readFile('operations/agent-improvement/snapshots/M80-FOUNDATION-HOSTED-PREP-20260924-CANDIDATE4.json','utf8')),frozen=snapshot.files.find((x:any)=>x.path.endsWith('once.ts')).text
 const plan=await build(input()),pp=artifactPin('.superpowers/m80-foundation-hosted-plan.json',plan),mc=record(seal(plan,pp,'migration')),ac=record(seal(plan,pp,'admission',chainArgs('migration',mc))),gate=gateBundle(plan,pp,'deployment')
 const base=new Map<string,Buffer>(),put=(p:string,v:any)=>base.set(paths.resolve(p),Buffer.from(JSON.stringify(v,null,2)+'\n'))
 put(pp.path,plan);put(gate.gatePin.path,gate.gate)
 for(const value of Object.values(gate.gateEvidence))put(value.pin.path,value.value)
 for(const chain of [mc,ac]){for(const key of ['intent','observation','outcome','gate'] as const)put(chain[`${key}Pin`].path,chain[key]);for(const value of Object.values(chain.gateEvidence))put(value.pin.path,value.value)}
 const text=frozen.replace(/^import[\s\S]*?from ["'][^"']+["']\r?\n/gm,'').replace(/^export /gm,'').replaceAll('import.meta.dir',JSON.stringify(paths.resolve('.superpowers'))).replace('if (import.meta.main)','if (true)'),compiled=new Bun.Transpiler({loader:'ts'}).transformSync(text),AsyncFunction=Object.getPrototypeOf(async()=>{}).constructor
 const scenarios:any[]=[]
 for(const missing of [gate.gateEvidence.securityReview.pin.path,mc.gatePin.path,ac.gatePin.path,null]){
  const virtual=new Map(base),reads:string[]=[],writes:string[]=[];if(missing)virtual.delete(paths.resolve(missing))
  const read=async(p:string)=>{reads.push(p);const v=virtual.get(p);if(!v)throw Error('missing evidence '+p);return v}
  const write=async(p:string,data:string,opts:any)=>{if(opts?.flag!=='wx')throw Error('nonexclusive write');if(virtual.has(p))throw Object.assign(Error('exists'),{code:'EEXIST'});writes.push(p);virtual.set(p,Buffer.from(data))}
  const FakeDate=class extends Date{constructor(value?:any){super(value===undefined?NOW.getTime():value)}}
  const bindings={...prep,readFile:read,writeFile:write,realpathSync:(p:string)=>paths.resolve(p),dirname:paths.dirname,isAbsolute:paths.isAbsolute,relative:paths.relative,resolve:paths.resolve,parseM80Json,process:{argv:['bun','frozen','seal',pp.path,gate.gatePin.path,'deployment',mc.intentPin.path,mc.observationPin.path,mc.outcomePin.path,ac.intentPin.path,ac.observationPin.path,ac.outcomePin.path]},console:{log:()=>{}},Date:FakeDate}
  let error='';try{await new AsyncFunction(...Object.keys(bindings),compiled)(...Object.values(bindings))}catch(e){error=String(e)}
  if(missing){expect(error).toContain('missing evidence');expect(writes.length).toBe(0)}else{expect(error).toBe('');expect(writes.length).toBe(1);expect(reads).toContain(paths.resolve(mc.gateEvidence.securityReview.pin.path));expect(reads).toContain(paths.resolve(ac.gateEvidence.securityReview.pin.path));let replay='';try{await new AsyncFunction(...Object.keys(bindings),compiled)(...Object.values(bindings))}catch(e){replay=String(e)}expect(replay).toContain('already exists');expect(writes.length).toBe(1)}
  scenarios.push({missing,readCount:reads.length,writeCount:writes.length,error})
 }
 await Bun.write('evaluations/research-qa/m80-hosted-prep-independent-20260924-candidate4-cli.json',JSON.stringify({boundary:'Frozen actual CLI with virtual filesystem/clock/process; no real intent or provider action',scenarios},null,2)+'\n')
})
