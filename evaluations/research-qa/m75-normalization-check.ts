import {createHash} from 'node:crypto'
const sha=(v:string|Uint8Array)=>createHash('sha256').update(v).digest('hex')
const snapshot=await Bun.file('operations/agent-improvement/snapshots/M75-IMPLEMENTATION-ACCEPTED1.json').json()
const old=await Bun.file('evaluations/research-qa/m75-independent-candidate2-pins.json').json()
const integration=await Bun.file('evaluations/research-qa/m75-integration-pins.json').json()
const changes=[]
for(const path of ['apps/site-web/src/lib/m75-api.ts','packages/neuvetra-database/src/migrations/0018_controlled_fleet.sql','tools/staging/m75-backend-fixture.ts']){
 const original=snapshot.files.find((x:any)=>x.path===path),current=await Bun.file(path).text()
 if(!original||sha(original.text)!==old.after[path]||original.text.replace(/\r\n/g,'\n')!==current)throw Error('Normalization mismatch '+path)
 changes.push({path,before:sha(original.text),after:sha(current),onlyCrLfToLf:true})
}
const workflow='.github/workflows/verify.yml',text=await Bun.file(workflow).text()
if(text.includes('\r'))throw Error('Workflow contains CR')
changes.push({path:workflow,before:integration[workflow],after:sha(text),onlyCrLfToLf:null,review:'Current source independently reinspected; original mixed-ending bytes unavailable, so no cryptographic normalization equality claim.'})
const files={...old.after,...integration}
for(const p of [...Object.keys(files),'.gitattributes'])files[p]=sha(await Bun.file(p).bytes())
const result={createdAt:new Date().toISOString(),reviewerId:'/root/m74_accounting',snapshotSha256:sha(await Bun.file('operations/agent-improvement/snapshots/M75-IMPLEMENTATION-ACCEPTED1.json').bytes()),changes,files}
await Bun.write('evaluations/research-qa/m75-normalized-final-pins.json',JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify({changed:changes.length,fileCount:Object.keys(files).length,pinsSha256:sha(await Bun.file('evaluations/research-qa/m75-normalized-final-pins.json').bytes())}))
