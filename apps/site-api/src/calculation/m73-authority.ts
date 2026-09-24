import {M73_METHOD,type M73Authority,type M73AuthorityInput,type M73Calculation} from '../../../../packages/neuvetra-database/src/m73-contract'
import {m73CanonicalJson} from '../../../../packages/neuvetra-database/src/m73-validation'
import path from 'node:path'
let active=0
const engine=path.join(import.meta.dir,'m73_stationary_natural_gas.py'),dependency=path.join(import.meta.dir,'stationary_natural_gas.py')
export function createM73Authority(options:{python?:string}={}):M73Authority{
 const execute=async(payload:unknown)=>{
  const encoded=m73CanonicalJson(payload);if(new TextEncoder().encode(encoded).length>((payload as {action:string}).action==='calculate'?131072:524288)||active>=2)throw Error('Natural-gas authority unavailable.')
  active++
  let child:ReturnType<typeof Bun.spawn>|undefined,timer:ReturnType<typeof setTimeout>|undefined
  try{
   for(const [file,hash]of [[engine,M73_METHOD.engineSha256],[dependency,M73_METHOD.dependencySha256]])if(new Bun.CryptoHasher('sha256').update(await Bun.file(file!).bytes()).digest('hex')!==hash)throw Error('Natural-gas authority unavailable.')
   child=Bun.spawn([options.python??process.env.NEUVETRA_PYTHON??'python',engine],{stdin:new Blob([encoded]),stdout:'pipe',stderr:'pipe',env:{PATH:process.env.PATH??'',SYSTEMROOT:process.env.SYSTEMROOT??'',PYTHONIOENCODING:'utf-8'}})
   timer=setTimeout(()=>child?.kill(),2000)
   const read=async(stream:ReadableStream<Uint8Array>)=>{const reader=stream.getReader();const chunks:Uint8Array[]=[];let size=0;while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>524288){child?.kill();throw Error('Natural-gas authority unavailable.')}chunks.push(r.value)}return Buffer.concat(chunks).toString('utf8')}
   const [stdout,,code]=await Promise.all([read(child.stdout as ReadableStream<Uint8Array>),read(child.stderr as ReadableStream<Uint8Array>),child.exited]);const v=JSON.parse(stdout);if(code!==0||v.status!=='ok')throw Error();return v
  }catch{throw Error('Natural-gas authority unavailable.')}finally{if(timer)clearTimeout(timer);active--}
 }
 return {async calculate(input:M73AuthorityInput){const r=await execute({action:'calculate',input});const c=r.record as M73Calculation;if(m73CanonicalJson(c.input)!==m73CanonicalJson(input)||m73CanonicalJson(c.method)!==m73CanonicalJson(M73_METHOD))throw Error('Natural-gas authority unavailable.');return c},async replayBatch(records:M73Calculation[]){if(!records.length)return;const r=await execute({action:'replay_batch',records});if(r.verified!==records.length)throw Error('Natural-gas authority unavailable.')}}
}
