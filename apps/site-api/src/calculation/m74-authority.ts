import {M74_METHOD,type M74Authority,type M74AuthorityInput,type M74Calculation} from '../../../../packages/neuvetra-database/src/m74-contract'
import {m74CanonicalJson} from '../../../../packages/neuvetra-database/src/m74-validation'
import path from 'node:path'

let active=0
const engine=path.join(import.meta.dir,'m74_mobile_diesel.py')

export function createM74Authority(options:{python?:string}={}):M74Authority{
 const execute=async(payload:unknown)=>{
  const encoded=m74CanonicalJson(payload),limit=(payload as {action:string}).action==='calculate'?131072:524288
  if(new TextEncoder().encode(encoded).length>limit||active>=2)throw Error('Mobile-diesel authority unavailable.')
  active++
  let child:ReturnType<typeof Bun.spawn>|undefined,timer:ReturnType<typeof setTimeout>|undefined
  try{
   if(new Bun.CryptoHasher('sha256').update(await Bun.file(engine).bytes()).digest('hex')!==M74_METHOD.engineSha256)throw Error()
   child=Bun.spawn([options.python??process.env.NEUVETRA_PYTHON??'python',engine],{stdin:new Blob([encoded]),stdout:'pipe',stderr:'pipe',env:{PATH:process.env.PATH??'',SYSTEMROOT:process.env.SYSTEMROOT??'',PYTHONIOENCODING:'utf-8'}})
   timer=setTimeout(()=>child?.kill(),2000)
   const read=async(stream:ReadableStream<Uint8Array>)=>{const reader=stream.getReader(),chunks:Uint8Array[]=[];let size=0;while(true){const result=await reader.read();if(result.done)break;size+=result.value.length;if(size>524288){child?.kill();throw Error()}chunks.push(result.value)}return Buffer.concat(chunks).toString('utf8')}
   const [stdout,,code]=await Promise.all([read(child.stdout as ReadableStream<Uint8Array>),read(child.stderr as ReadableStream<Uint8Array>),child.exited]),value=JSON.parse(stdout)
   if(code!==0||value.status!=='ok')throw Error()
   return value
  }catch{throw Error('Mobile-diesel authority unavailable.')}finally{if(timer)clearTimeout(timer);active--}
 }
 return {
  async calculate(input:M74AuthorityInput){const result=await execute({action:'calculate',input}),calculation=result.record as M74Calculation;if(m74CanonicalJson(calculation.input)!==m74CanonicalJson(input)||m74CanonicalJson(calculation.method)!==m74CanonicalJson(M74_METHOD))throw Error('Mobile-diesel authority unavailable.');return calculation},
  async replayBatch(records:M74Calculation[]){if(!records.length)return;const result=await execute({action:'replay_batch',records});if(result.verified!==records.length)throw Error('Mobile-diesel authority unavailable.')},
 }
}
