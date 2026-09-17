/** Read-only source closure for the explicitly invoked M78 journey. No credentials or network. */
import {readFile} from 'node:fs/promises'
import {resolve,relative,dirname} from 'node:path'
const roots=['tools/staging/check-m78-hosted.ts','tools/staging/check-m78-hosted.test.ts','tools/staging/m78-hosted-plan.ts','tools/staging/m78-journey-source-pins.ts','bun.lock']
export async function m78JourneySourcePins(){
 const workspace=resolve('.'),files=new Set(roots),pending=roots.filter(p=>p.endsWith('.ts'))
 while(pending.length){
  const file=pending.pop()!,text=await readFile(file,'utf8')
  const imports=[...text.matchAll(/\b(?:from\s*|import\s*\(\s*|import\s*)['"]([^'"]+)['"]/g)].map(m=>m[1]!).filter(p=>p.startsWith('.'))
  for(const imported of imports){
   const base=resolve(dirname(file),imported);let target:string|undefined
   for(const candidate of [base,base+'.ts',base+'.tsx',resolve(base,'index.ts')]){try{await readFile(candidate);target=candidate;break}catch{}}
   if(!target)throw Error('Unresolved journey dependency')
   const local=relative(workspace,target).replaceAll('\\','/')
   if(local.startsWith('../')||local.startsWith('/')||local.includes(':'))throw Error('Journey dependency outside workspace')
   if(!files.has(local)){files.add(local);if(/\.tsx?$/.test(local))pending.push(local)}
  }
 }
 const {readMigrationManifest}=await import('../../packages/neuvetra-database/src/staging-migrations')
 for(const migration of await readMigrationManifest())files.add('packages/neuvetra-database/src/migrations/'+migration.name)
 return Promise.all([...files].sort().map(async path=>({path,sha256:new Bun.CryptoHasher('sha256').update(await readFile(path)).digest('hex')})))
}
if(import.meta.main)console.log(JSON.stringify(await m78JourneySourcePins()))
