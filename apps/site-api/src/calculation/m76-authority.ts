import {M76_DIESEL_METHOD,type M76DieselAuthority,type M76DieselAuthorityInput,type M76DieselCalculation} from '../../../../packages/neuvetra-database/src/m76-diesel-contract'
import {m76DieselCanonicalJson} from '../../../../packages/neuvetra-database/src/m76-diesel-validation'
import path from 'node:path'

let active=0
const engine=path.join(import.meta.dir,'m76_stationary_diesel.py')

export function createM76DieselAuthority(options:{python?:string}={}):M76DieselAuthority{
 const execute=async(payload:unknown)=>{
  const encoded=m76DieselCanonicalJson(payload),limit=(payload as {action:string}).action==='calculate'?131072:524288
  if(new TextEncoder().encode(encoded).length>limit||active>=2)throw Error('Stationary-generator authority unavailable.')
  active++
  let child:ReturnType<typeof Bun.spawn>|undefined,timer:ReturnType<typeof setTimeout>|undefined
  try{
   if(new Bun.CryptoHasher('sha256').update(await Bun.file(engine).bytes()).digest('hex')!==M76_DIESEL_METHOD.engineSha256)throw Error()
   child=Bun.spawn([options.python??process.env.NEUVETRA_PYTHON??'python',engine],{stdin:new Blob([encoded]),stdout:'pipe',stderr:'pipe',env:{PATH:process.env.PATH??'',SYSTEMROOT:process.env.SYSTEMROOT??'',PYTHONIOENCODING:'utf-8'}})
   timer=setTimeout(()=>child?.kill(),2000)
   const read=async(stream:ReadableStream<Uint8Array>)=>{const reader=stream.getReader(),chunks:Uint8Array[]=[];let size=0;while(true){const result=await reader.read();if(result.done)break;size+=result.value.length;if(size>524288){child?.kill();throw Error()}chunks.push(result.value)}return Buffer.concat(chunks).toString('utf8')}
   const [stdout,,code]=await Promise.all([read(child.stdout as ReadableStream<Uint8Array>),read(child.stderr as ReadableStream<Uint8Array>),child.exited]),value=JSON.parse(stdout)
   if(code!==0||value.status!=='ok')throw Error()
   return value
  }catch{throw Error('Stationary-generator authority unavailable.')}finally{if(timer)clearTimeout(timer);active--}
 }
 return {
  async calculate(input:M76DieselAuthorityInput){const result=await execute({action:'calculate',input}),calculation=result.record as M76DieselCalculation;if(m76DieselCanonicalJson(calculation.input)!==m76DieselCanonicalJson(input)||m76DieselCanonicalJson(calculation.method)!==m76DieselCanonicalJson(M76_DIESEL_METHOD))throw Error('Stationary-generator authority unavailable.');return calculation},
  async replayBatch(records:M76DieselCalculation[]){if(!records.length)return;const result=await execute({action:'replay_batch',records});if(result.verified!==records.length)throw Error('Stationary-generator authority unavailable.')},
 }
}
export const createM76Authority=createM76DieselAuthority
