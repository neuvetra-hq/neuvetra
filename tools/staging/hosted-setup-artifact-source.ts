/**
 * Offline, trusted-operator-host artifact verification. NOT a launcher or a
 * publication observer. The operator must obtain the publication digest from
 * an independently authenticated channel, outside the artifact being checked.
 * No runtime-loaded graph or hostile-host immutability claim is made.
 */
import {createHash} from 'node:crypto'
import {lstat,readFile,readdir,realpath} from 'node:fs/promises'
import {isAbsolute,relative,resolve} from 'node:path'
import type {WorkspaceConnection} from '../../packages/neuvetra-database/src/workspace'

export const ARTIFACT_PROFILE='neuvetra.hosted-setup.execution-artifact.v1' as const
export const PUBLICATION_PROFILE='neuvetra.hosted-setup.operator-pinned-publication.v1' as const
export const ARTIFACT_SOURCE_PROFILE='neuvetra.hosted-setup.private-artifact-sql.v1' as const
export const ARTIFACT_CONFIG='logLevel = "error"\n' as const
const DIGEST=/^[0-9a-f]{64}$/
const HEAD=/^[0-9a-f]{40}$/
const decoder=new TextDecoder('utf-8',{fatal:true})
const digest=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex')
function check(value:unknown,message:string):asserts value{if(!value)throw Error(message)}
function record(value:unknown):Record<string,unknown>{check(!!value&&typeof value==='object'&&!Array.isArray(value),'Object required');return value as Record<string,unknown>}
function text(value:unknown):string{check(typeof value==='string','String required');return value}
function pin(value:unknown):string{check(typeof value==='string'&&DIGEST.test(value),'SHA-256 required');return value}
function identity(value:unknown):string{const s=text(value);check(s.trim()===s&&s.length>=3&&s.length<=200,'Identity required');return s}
function exactKeys(value:object,keys:string[]){check(Object.keys(value).sort().join('|')===keys.sort().join('|'),'Unexpected or missing artifact input fields')}
function canonical(value:unknown):string{
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']'
 if(value!==null&&typeof value==='object')return '{'+Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}'
 return JSON.stringify(value)
}
function pathName(value:unknown):string{
 const s=text(value)
 check(s.length>0&&!s.includes('\\')&&!s.includes(':')&&!/[\x00-\x1f\x7f]/.test(s)&&s.split('/').every(p=>p!==''&&p!=='.'&&p!=='..'&&!/[. ]$/.test(p)&&!/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(p)),'Canonical artifact path required')
 return s
}
function comparable(p:string){const s=resolve(p);return process.platform==='win32'?s.toLowerCase():s}
function inside(root:string,p:string){const r=relative(comparable(root),comparable(p));return r===''||(!r.startsWith('..')&&!isAbsolute(r))}
async function regular(path:string,directory=false){
 check(isAbsolute(path),'Absolute path required')
 const expected=resolve(path),s=await lstat(expected)
 check(!s.isSymbolicLink()&&(directory?s.isDirectory():s.isFile()),'Regular artifact path required')
 check(comparable(await realpath(expected))===comparable(expected),'Symlink/junction path refused')
 return expected
}
export interface ArtifactFilePin {path:string;sha256:string}
export interface ArtifactMigrationPin extends ArtifactFilePin {name:string;normalizedSha256:string}
/** This policy is an operator trust input, never read from a release archive. */
export interface ArtifactTrustPolicy {
 publicationSha256:string;reviewedProductHead:string;operatorId:string;independentReviewerId:string
 requiredChecks:readonly string[];activeCheckoutRoots:readonly string[]
}
export interface ArtifactPaths {
 publication:string;sourceArchive:string;dependencyArchive:string;sourceRoot:string;dependencyRoot:string
 runtimeExecutable:string;supervisor:string;config:string
}
export interface ArtifactInspection {
 profile:typeof ARTIFACT_PROFILE;trustBoundary:'trusted-operator-host';claim:'verified-at-rest-artifact-and-private-sql-only'
 reviewedProductHead:string;publicationSha256:string;executionArtifactSha256:string;migrationManifestSha256:string
 sourceRoot:string;dependencyRoot:string;runtimeExecutable:string;operatorId:string;independentReviewerId:string
 launchAuthorized:false
}
type Migration={name:string;sha256:string;sql:string}
const verified=new WeakMap<ArtifactInspection,{manifest:readonly Readonly<Migration>[];claimed:boolean}>()
function files(value:unknown):ArtifactFilePin[]{
 check(Array.isArray(value)&&value.length>0&&value.length<=100000,'Complete nonempty file manifest required')
 let prior='';const aliases=new Set<string>()
 return value.map(v=>{const row=record(v),path=pathName(row.path),sha256=pin(row.sha256)
  check(path>prior&&!aliases.has(path.toLowerCase()),'Sorted unique case-unambiguous paths required');prior=path;aliases.add(path.toLowerCase())
  return {path,sha256}
 })
}
async function inventory(root:string,expected:ArtifactFilePin[]):Promise<Map<string,Uint8Array>>{
 await regular(root,true)
 const actual=new Map<string,Uint8Array>()
 async function walk(dir:string,prefix:string){
  for(const name of (await readdir(dir)).sort()){
   const path=pathName(prefix+name),absolute=resolve(root,path),s=await lstat(absolute)
   check(!s.isSymbolicLink()&&comparable(await realpath(absolute))===comparable(absolute),'Symlink/junction in artifact refused')
   check(name!=='.git','Development checkout refused')
   if(s.isDirectory())await walk(absolute,path+'/')
   else{check(s.isFile(),'Nonregular artifact entry refused');actual.set(path,new Uint8Array(await readFile(absolute)))}
  }
 }
 await walk(root,'')
 check(actual.size===expected.length,'Artifact inventory differs from publication')
 for(const file of expected)check(actual.has(file.path)&&digest(actual.get(file.path)!)===file.sha256,'Artifact file differs from publication: '+file.path)
 return actual
}
/** No injected readers, verifiers, executable flags, credentials or callbacks. */
export async function verifyHostedSetupArtifact(paths:ArtifactPaths,policy:ArtifactTrustPolicy):Promise<ArtifactInspection>{
 // Synchronous private snapshots precede every await; caller mutation cannot alter a pending check.
 const p=JSON.parse(JSON.stringify(paths)) as ArtifactPaths
 const q=JSON.parse(JSON.stringify(policy)) as ArtifactTrustPolicy
 exactKeys(p,['publication','sourceArchive','dependencyArchive','sourceRoot','dependencyRoot','runtimeExecutable','supervisor','config'])
 exactKeys(q,['publicationSha256','reviewedProductHead','operatorId','independentReviewerId','requiredChecks','activeCheckoutRoots'])
 pin(q.publicationSha256);check(typeof q.reviewedProductHead==='string'&&HEAD.test(q.reviewedProductHead),'Reviewed head required')
 identity(q.operatorId);identity(q.independentReviewerId);check(q.operatorId!==q.independentReviewerId,'Independent identities required')
 check(Array.isArray(q.requiredChecks)&&q.requiredChecks.length>0&&q.requiredChecks.every(c=>typeof c==='string'&&c.length>0)&&new Set(q.requiredChecks).size===q.requiredChecks.length,'Required checks policy required')
 check(Array.isArray(q.activeCheckoutRoots)&&q.activeCheckoutRoots.length>0&&q.activeCheckoutRoots.every(isAbsolute),'Active checkout exclusions required')
 for(const [key,value] of Object.entries(p))check(typeof value==='string'&&isAbsolute(value),'Absolute artifact input required: '+key)
 // Exclusions are filesystem identities too: lexical names alone can conceal
 // a checkout behind a junction. Refuse unavailable roots and every alias.
 const checkoutRoots:string[]=[]
 for(const checkout of q.activeCheckoutRoots)checkoutRoots.push(await regular(checkout,true))
 for(const root of [p.sourceRoot,p.dependencyRoot]){
  check(!checkoutRoots.some(checkout=>inside(checkout,root)||inside(root,checkout)),'Artifact must be outside active checkouts')
 }
 check(!inside(p.sourceRoot,p.dependencyRoot)&&!inside(p.dependencyRoot,p.sourceRoot),'Separate source and dependency roots required')
 const publicationBytes=new Uint8Array(await readFile(await regular(p.publication)))
 check(digest(publicationBytes)===q.publicationSha256,'Publication trust pin mismatch')
 const receipt=record(JSON.parse(decoder.decode(publicationBytes)))
 check(receipt.profile===PUBLICATION_PROFILE&&receipt.trustBoundary==='trusted-operator-host','Publication profile mismatch')
 check(receipt.reviewedProductHead===q.reviewedProductHead&&receipt.repository==='neuvetra-hq/neuvetra'&&receipt.pullRequest===6,'Publication target/head mismatch')
 check(receipt.operatorId===q.operatorId&&receipt.independentReviewerId===q.independentReviewerId&&receipt.materialFindingsOpen===0,'Publication review mismatch')
 check(Number.isSafeInteger(receipt.observedAtMs)&&Number.isSafeInteger(receipt.expiresAtMs),'Publication time required')
 const now=Date.now();check((receipt.observedAtMs as number)<=now&&(receipt.expiresAtMs as number)>now&&(receipt.expiresAtMs as number)-(receipt.observedAtMs as number)<=24*60*60*1000,'Publication expired or future-dated')
 check(Array.isArray(receipt.checks),'Publication checks required')
 const checks=receipt.checks.map(c=>record(c));check(checks.length===q.requiredChecks.length,'Publication checks mismatch')
 for(const name of q.requiredChecks)check(checks.filter(c=>c.name===name&&c.head===q.reviewedProductHead&&c.conclusion==='success').length===1,'Required exact-head check absent')
 const sourceFiles=files(receipt.sourceFiles),dependencyFiles=files(receipt.dependencyFiles)
 const artifact=record(receipt.artifact)
 exactKeys(artifact,['sourceArchiveSha256','dependencyArchiveSha256','runtimeSha256','supervisorSha256','configSha256','entrypoint','launchPolicy'])
 for(const [pathKey,pinKey] of [['sourceArchive','sourceArchiveSha256'],['dependencyArchive','dependencyArchiveSha256'],['runtimeExecutable','runtimeSha256'],['supervisor','supervisorSha256'],['config','configSha256']] as const){
  const bytes=new Uint8Array(await readFile(await regular(p[pathKey])))
  check(bytes.length>0&&digest(bytes)===pin(artifact[pinKey]),'Artifact digest mismatch: '+pathKey)
  if(pathKey==='config')check(decoder.decode(bytes)===ARTIFACT_CONFIG,'Uncontrolled runtime configuration refused')
 }
 check(artifact.entrypoint==='tools/staging/hosted-setup-artifact-worker.ts'&&artifact.launchPolicy==='neuvetra.hosted-setup.fixed-bun-worker.v1','Fixed entrypoint/launch policy required')
 const source=await inventory(p.sourceRoot,sourceFiles)
 await inventory(p.dependencyRoot,dependencyFiles)
 check(source.has(text(artifact.entrypoint)),'Fixed entrypoint absent')
 check(dependencyFiles.some(f=>f.path==='node_modules/pg/package.json'),'Private pg dependency package absent')
 check(Array.isArray(receipt.migrations)&&receipt.migrations.length===23,'Complete migration manifest required')
 const manifest:Readonly<Migration>[]=[]
 for(const [index,item] of receipt.migrations.entries()){
  const row=record(item),name=text(row.name),path=pathName(row.path)
  check(/^\d{4}_[a-z0-9_]+\.sql$/.test(name)&&Number(name.slice(0,4))===index+1&&path==='packages/neuvetra-database/src/migrations/'+name,'Ordered migration path required')
  const bytes=source.get(path);check(bytes&&bytes.length>0,'Migration bytes missing')
  check(digest(bytes)===pin(row.sha256),'Migration raw bytes changed')
  const sql=decoder.decode(bytes).replace(/\r\n/g,'\n'),sha256=digest(sql)
  check(sha256===pin(row.normalizedSha256),'Normalized SQL mismatch')
  manifest.push(Object.freeze({name,sha256,sql}))
 }
 const migrationManifestSha256=digest(canonical(manifest))
 check(migrationManifestSha256===pin(receipt.migrationManifestSha256),'Migration manifest mismatch')
 check((receipt.expiresAtMs as number)>Date.now(),'Publication expired during artifact verification')
 const result=Object.freeze({profile:ARTIFACT_PROFILE,trustBoundary:'trusted-operator-host' as const,claim:'verified-at-rest-artifact-and-private-sql-only' as const,
  reviewedProductHead:q.reviewedProductHead,publicationSha256:q.publicationSha256,executionArtifactSha256:digest(canonical({profile:ARTIFACT_PROFILE,publicationSha256:q.publicationSha256,artifact,sourceFiles,dependencyFiles})),
  migrationManifestSha256,sourceRoot:resolve(p.sourceRoot),dependencyRoot:resolve(p.dependencyRoot),runtimeExecutable:resolve(p.runtimeExecutable),operatorId:q.operatorId,independentReviewerId:q.independentReviewerId,launchAuthorized:false as const})
 verified.set(result,{manifest:Object.freeze(manifest),claimed:false})
 return result
}
export interface ArtifactSourceBinding {profile:typeof ARTIFACT_SOURCE_PROFILE;reviewedProductHead:string;executionArtifactSha256:string;migrationManifestSha256:string}
/** Worker-side component only. Does not authenticate the currently loaded JS. */
export async function lockHostedSetupArtifactSql(artifact:ArtifactInspection){
 const state=verified.get(artifact);check(state&&!state.claimed,'Authentic unconsumed in-process artifact capability required')
 state.claimed=true
 // Deliberately deferred: offline verification imports no application modules.
 const {pinStagingMigrationManifest,migratePrivateStagingFromManifest}=await import('../../packages/neuvetra-database/src/staging-migrations')
 const manifest=pinStagingMigrationManifest(state.manifest)
 const binding=Object.freeze({profile:ARTIFACT_SOURCE_PROFILE,reviewedProductHead:artifact.reviewedProductHead,executionArtifactSha256:artifact.executionArtifactSha256,migrationManifestSha256:artifact.migrationManifestSha256})
 let phase:'ready'|'validating'|'active'|'consumed'='ready',entered=false
 return Object.freeze({binding,
  migrationManifest:()=>manifest.map(({name,sha256,sql})=>({name,sha256,sql})),
  withArtifactSource:async<T>(candidate:ArtifactSourceBinding,operation:()=>Promise<T>)=>{
   check(phase==='ready','Artifact SQL lock is single-use')
   // Claim before Object.entries/serialization can invoke caller getters.
   // Validation must not grant migrate() its active-operation capability.
   phase='validating'
   try{
    check(canonical(candidate)===canonical(binding),'Artifact source binding mismatch')
    check(typeof operation==='function','Artifact source operation required')
    phase='active'
    const value=await operation();check(entered,'Pinned migration was not entered');return value
   }finally{phase='consumed'}
  },
  migrate:async(db:WorkspaceConnection,projectRef:string)=>{
   check(phase==='active'&&!entered,'Pinned migration requires a single active invocation');entered=true
   return migratePrivateStagingFromManifest(db,{expectedProjectRef:projectRef,syntheticTargetConfirmed:true,reuseExistingProject:true},manifest)
  },
 })
}
