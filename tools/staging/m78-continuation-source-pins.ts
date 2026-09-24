/** Read-only source closure for the explicitly invoked M78 journey. No credentials or network. */
import {readFile} from 'node:fs/promises'
import {resolve,relative,dirname} from 'node:path'
export const JOURNEY_RESOLVER_ROOTS=['package.json','tsconfig.base.json','packages/neuvetra-database/package.json','packages/neuvetra-database/tsconfig.json','apps/site-api/package.json','apps/site-api/tsconfig.json','config/typescript/api.json','apps/site-web/package.json','apps/site-web/tsconfig.json','apps/site-web/tsconfig.app.json','apps/site-web/tsconfig.node.json','config/typescript/web.json','config/typescript/vite.json']as const
const roots=['tools/staging/m78-continuation-native.ts','tools/staging/m78-continuation-source-pins.test.ts','tools/staging/check-m78-continuation.ts','tools/staging/check-m78-continuation.test.ts','tools/staging/m78-continuation-plan.ts','tools/staging/m78-continuation-plan.test.ts','tools/staging/m78-continuation-source-pins.ts','bun.lock',...JOURNEY_RESOLVER_ROOTS]
export async function m78ContinuationSourcePins(){
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
if(import.meta.main)console.log(JSON.stringify(await m78ContinuationSourcePins()))

export const M78_CONTINUATION_EVIDENCE_PINS=[{path:'.superpowers/m78-hosted-journey.jsonl',sha256:'d3301eb226c0cae4428c1e20cde4e2afdcf572b622e96d690cc8c262d6e44058'},{path:'.superpowers/m78-timeout-observation.json',sha256:'995f91359f1b5ce38ad5b2f1324194c24c222a73ef2f2108944b6a4bf1797d67'},{path:'evaluations/research-qa/m78-timeout-actual-independent-result.json',sha256:'3147cea316a075ad7e114052d007efeda5202462282b678175531d4a5c056d00'}]as const
