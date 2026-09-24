import {expect,test} from 'bun:test'
import {createPostgresConnection,HostedWorkspaceDatabase} from '../../packages/neuvetra-database/src/hosted'
import {M71_ARTIFACT} from '../../packages/neuvetra-database/src/m71-contract'
import {decodeCorporateRegister} from '../../apps/site-web/src/lib/m71-api'
import type {WorkspaceConnection} from '../../packages/neuvetra-database/src/workspace'
const runtimeUrl=process.env.M71_QA_PIN_DATABASE_URL
if(runtimeUrl!=='postgres://neuvetra_runtime@127.0.0.1:55463/m71_qa_parity_restore')throw Error('Explicit isolated restored QA database required')
const fixture=await Bun.file(new URL('./m71-qa-native-fixture.json',import.meta.url)).json()
test('restored native reader checks bundled synthetic evidence bytes and recovers after in-process fixture tamper',async()=>{
 const connection=createPostgresConnection(runtimeUrl,{tls:false}),db=new(HostedWorkspaceDatabase as unknown as new(c:WorkspaceConnection,r:string)=>HostedWorkspaceDatabase)(connection,'abcdefghijklmnopqrst')
 const original=M71_ARTIFACT.text
 try{
  const valid=await db.findCorporateInventory(fixture.actorIds.owner,fixture.company);expect(valid).toEqual(fixture.register);await decodeCorporateRegister(valid,fixture.company)
  ;(M71_ARTIFACT as unknown as {text:string}).text=original+' tampered fixture text'
  let failed=false;try{await db.findCorporateInventory(fixture.actorIds.owner,fixture.company)}catch{failed=true}expect(failed).toBe(true)
  ;(M71_ARTIFACT as unknown as {text:string}).text=original
  expect(await db.findCorporateInventory(fixture.actorIds.owner,fixture.company)).toEqual(valid)
 }finally{(M71_ARTIFACT as unknown as {text:string}).text=original;await db.close()}
})
