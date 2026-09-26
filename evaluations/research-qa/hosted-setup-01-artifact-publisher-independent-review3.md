# Hosted artifact publisher repair 2 — independent targeted review

Task `HOSTED-SETUP-ARTIFACT-PUBLISHER-REPAIR2-QA-01`, 2026-09-26. Reviewer `/root/artifact_launcher`, qa-lead; candidate author `/root/artifact_runner`. Requested registered critical route `gpt-6-astra/high`; actual follow-up model/effort unknown. Role, registry and workflow/compute guidance were refreshed. This reviewer authored no publisher candidate code. Earlier consumer authorship is disclosed: real materializer/verifier calls assess publisher integration, not independent reacceptance of those consumers.

**Verdict: FAIL for publisher/materializer compatibility, new PUB-F04 P2. PUB-F03 is closed for this exact repair; PUB-F01/PUB-F02 repairs continue to pass.** The new finding produces an unusable artifact and is refused downstream; it is not a renewed source-substitution or launch-authority bypass.

## Frozen bytes and preserved history

| Artifact | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-artifact-publisher.ts` | `17f2f324b965ab84f2b562de96ba91fb9385fce5560bc4c7194bd292604ccf7a` |
| `tools/staging/hosted-setup-artifact-publisher.test.ts` | `9f44b49c119c1505291cd849990fb63e0c9cb08618abdd705c192915ec1c995d` |
| `evaluations/research-qa/hosted-setup-01-artifact-publisher-repair2-author.md` | `8acdc8a900ce32a4ea5ec3a8f4aa620172a8d02e12090e7b700b77967d5f07d7` |

Candidate hashes matched at entry and after testing. The two prior FAIL reports remain unchanged: review1 `ec9f86ebcc2ab68a3ba3784c63ce3f3626907d4c6f38977f95fb7288cad94c7f`; review2 `0f9977a48fe3166159015bcada3ceea37396ff7db9d0db79e670dfdb0bbaa6e8`. Workdir: `C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra`. Only reviewer report/run record and local synthetic probe artifacts were written. No candidate/shared Git change, real publication, push, provider, database, installation, credential or live-service action occurred.

## PUB-F04 — P2: directory-prefix case aliases publish but cannot materialize

The `archive()` path collision check in `tools/staging/hosted-setup-artifact-publisher.ts` lowercases **complete file paths**. Recursive tree parsing checks duplicate raw child names case-sensitively. Neither rejects two differently cased directory prefixes when their leaf names differ. The accepted materializer deliberately rejects that layout using its per-component alias map.

Independent exact fixture: `C:/Users/nimab/AppData/Local/Temp/publisher-independent-TtxGwL`.

- Reviewed synthetic commit: `8dcd76486f537cc8644bb5a7da258267f9618473`.
- Source imports `./A/one` and `./a/two` from the fixed worker.
- Git's committed tree contains `tools/staging/A/one.ts` and `tools/staging/a/two.ts`, with separately hashed regular blobs. The Windows fixture uses a synthetic index entry for the lowercase sibling so both valid Git paths exist in the commit. Git status is empty; all publication evidence is pinned to this exact commit.
- The public publisher succeeds and returns publication SHA-256 `f32c73f78f2c0910831d74195e5def1dbd5396e82e5034939255a14ad57893b4`. Decoding its archive confirms both committed paths and their correct bytes.
- The real materializer, using the publisher's returned pin and exact reviewed head, refuses **`Case alias archive path refused`**.

Thus the source tree/blob identity is correct, but the successful publisher result violates the promised materializer-compatible archive contract. It consumes exclusive output paths and leaves a fully formed receipt/archive pair that cannot be used; the materializer's refusal prevents launch. No malformed evidence, Git corruption or replacement ref is needed for this case.

Repair acceptance: apply materializer-equivalent component/prefix collision validation before any output creation, for both source and dependency archives. Preserve spelling consistency for every directory prefix and reject file-versus-directory aliases as well as complete-path collisions. Retain a positive control with distinct sibling directories and repeated basenames. Do not weaken the materializer to accept the ambiguous archive.

## PUB-F03 closure and original regression checks

The repair authenticates each raw child tree against the parent-pinned object ID and preserves the verified name/mode/blob mapping. Selected files are read directly by that mapping's OID and independently hashed; they no longer depend on a second mutable path lookup. Static review found the requested recursive ancestry binding implemented.

The independent QA2 nested-tree substitution was rebuilt unchanged in a fresh fixture `publisher-independent-iPOieQ`: stock Git still reported the original HEAD and clean status, but the publisher now refused `ARTIFACT_PUBLISHER_GIT_TREE_IDENTITY_REFUSED`. Its original reviewed head was `e1c25bf22084ffdae0635b5fc60675f0a8871d44`. This confirms PUB-F03 repaired rather than merely hidden by the cleanliness check.

Independent commit, blob and nested-tree replacement refs all emitted only original reviewed bytes and passed actual materialization. The first-review arrangement with a replaced checkout refused as dirty. An absent peer with primitive optional true still published/materialized; false, string-valued true and a required-dependency/optional-peer overlap still refused. The delivered actual pg8.23 private-copy test also passed without package installation/scripts. PUB-F01's mechanism and PUB-F02 remain repaired.

## Recursive path and parser challenges

An independently committed positive fixture imported `alpha/shared.ts` and `beta/shared.ts`, each with a distinct blob. The archive preserved both exact paths and contents, and the real materializer accepted it; sibling basenames do not alias one another.

Five independently assembled, canonically hashed malformed Git trees were challenged through the public publisher:

| Variant | Observed refusal |
| --- | --- |
| Duplicate exact child name | `ARTIFACT_PUBLISHER_GIT_TREE_REFUSED` |
| Slash in raw child name | `ARTIFACT_PUBLISHER_GIT_TREE_REFUSED` |
| Unsupported mode `100600` | `ARTIFACT_PUBLISHER_GIT_TREE_REFUSED` |
| Truncated 18-byte child OID | `ARTIFACT_PUBLISHER_GIT_COMMAND_REFUSED` (Git also refused fixture checkout) |
| Invalid UTF-8 child name | `ARTIFACT_PUBLISHER_DIRTY_CHECKOUT_REFUSED` |

The last two are early fail-closed observations, not proof that the publisher's deeper parser branch was reached. The first three directly exercised its tree-parse refusal. These inputs and results are retained separately from QA1/QA2 evidence.

## Executed checks

Windows, Bun1.3.12.

- `bun test tools/staging/hosted-setup-artifact-publisher.test.ts --timeout 30000`: **11 pass, 0 fail, 54 assertions**, exit0, approximately43.46s. Includes actual dependency closure, two nested corruption depths, direct loose commit/blob corruption and archive composition.
- `bun node_modules/typescript/bin/tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --types bun --skipLibCheck tools/staging/hosted-setup-artifact-publisher.ts tools/staging/hosted-setup-artifact-publisher.test.ts`: **PASS**, exit0, no diagnostics.
- Independent preserved-failure probe: **9/9 expected outcomes**.
- Independent sibling/parser probe: **6/7 expected outcomes; PUB-F04 reproduced**. Overall independent cases: 16, with 15 expected results and one finding.

The first delivered-suite run passed. No earlier review/harness failure was overwritten; QA3 uses new probe/result paths. Root owns snapshot, run closure and repair dispatch. Original false authority flags remain unchanged; this review supplies no live authorization.

## Evidence and remaining bounds

The shared fixture helper retained from QA2 has SHA-256 `d69de93fdefa43db38da715a8e3be109f82dd13b03e59fa1a938b5cfecf75f8d`; its source is embedded in review2. New artifacts under `C:/Users/nimab/AppData/Local/Temp/`:

| Artifact | SHA-256 |
| --- | --- |
| `hosted-artifact-publisher-qa3.ts` | `60d3b5f380e42dd512d05a68624c261917fba10b8b1ff9bc9ba1e68d4432351b` |
| `hosted-artifact-publisher-qa3-results.json` | `d7c2728cb8bf2dd6d52d5e98a8068bcf70bef182a3fc17dfc26bb3b7f726db20` |
| `hosted-artifact-publisher-qa3-paths.ts` | `7c58ded6340aacd6343ed9b98d543e3b095d03d5fafd3e30f3f6efc9a20cc7a8` |
| `hosted-artifact-publisher-qa3-paths-results.json` | `ef7ca4d1f7858b90af24ec7cd9ed8b6543ae08bd5ea5549225036c38e0bcd0ef` |

The tested exact-tree identity is an at-rest byte/ancestry claim on the trusted operator host. SHA-1 collision limits, runtime/DLL trust, atomic dependency snapshots, full runtime-loaded graphs, externally authenticated publication evidence and real launch readiness remain outside this bounded review. Downstream fail-closed behavior is preserved, but publisher/materializer compatibility is not accepted until PUB-F04 is repaired and independently retested.

## Independent preserved-failure probe

```typescript
import {fixture,git,put} from './hosted-artifact-publisher-qa2-fixture'
import {chmod,copyFile,readFile,writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {publishHostedSetupArtifact} from 'C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra/tools/staging/hosted-setup-artifact-publisher.ts'
import {materializeHostedSetupArtifact} from 'C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra/tools/staging/hosted-setup-artifact-materialize.ts'
const rows:any[]=[],worker='tools/staging/hosted-setup-artifact-worker.ts'
async function observe(name:string,alter:(f:any)=>Promise<any>,expected:'accept-original'|'reject'|'accept'){
 const f=await fixture(),metadata=await alter(f);let result:any,error=null
 try{result=await publishHostedSetupArtifact(f.paths,f.policy)}catch(e){error=(e as Error).message}
 const row:any={name,expected,fixture:f.root,head:f.head,metadata,error,actual:result?'accept':'reject'}
 if(result){row.publicationSha256=result.publicationSha256;const archive=JSON.parse(await readFile(f.paths.sourceArchive,'utf8'));row.worker=Buffer.from(archive.files.find((r:any)=>r.path===worker).contentBase64,'base64').toString();row.originalRetained=row.worker.includes('reviewed-original');row.authority={launchAuthorized:result.launchAuthorized,productionAuthorized:result.productionAuthorized}
  try{const material=await materializeHostedSetupArtifact({publication:f.paths.publication,sourceArchive:f.paths.sourceArchive,dependencyArchive:f.paths.dependencyArchive,sourceRoot:join(f.root,'materialized-source'),dependencyRoot:join(f.root,'materialized-deps'),runtimeExecutable:f.paths.runtimeExecutable,supervisor:f.paths.supervisor,config:f.paths.config},{publicationSha256:result.publicationSha256,reviewedProductHead:f.head,operatorId:f.policy.operatorId,independentReviewerId:f.policy.independentReviewerId,requiredChecks:f.policy.requiredChecks,activeCheckoutRoots:[f.repo]});row.materializerAccepted=true;row.materializerLaunchAuthorized=material.launchAuthorized}catch(e){row.materializerAccepted=false;row.materializerError=(e as Error).message}}
 row.pass=expected==='reject'?!result:!!result&&(expected==='accept'||row.originalRetained);rows.push(row);console.log(JSON.stringify(row))
}
for(const kind of ['commit','blob','tree'])await observe(kind+' replacement ignored',async f=>{
 const original=kind==='commit'?f.head:await git(f.repo,'--no-replace-objects','rev-parse',f.head+':'+(kind==='blob'?worker:'tools/staging'))
 await put(join(f.repo,worker),`import './hosted-setup-artifact-bindings';export const identity='UNREVIEWED-'+${JSON.stringify(kind)};\n`);await git(f.repo,'add','--all');await git(f.repo,'-c','user.name=QA','-c','user.email=qa@example.invalid','commit','-qm','substitute')
 const newer=await git(f.repo,'rev-parse','HEAD'),replacement=kind==='commit'?newer:await git(f.repo,'rev-parse',newer+':'+(kind==='blob'?worker:'tools/staging'));await git(f.repo,'replace',original,replacement);await git(f.repo,'--no-replace-objects','reset','--hard',f.head)
 return {original,replacement}
},'accept-original')
await observe('original first-FAIL replaced checkout refuses',async f=>{await put(join(f.repo,worker),`export const identity='UNREVIEWED-REPLACED-CHECKOUT';\n`);await git(f.repo,'add','--all');await git(f.repo,'-c','user.name=QA','-c','user.email=qa@example.invalid','commit','-qm','substitute');const replacement=await git(f.repo,'rev-parse','HEAD');await git(f.repo,'replace',f.head,replacement);await git(f.repo,'reset','--hard',f.head);return {replacement}},'reject')
await observe('nested tree loose-object substitution',async f=>{
 const oldTree=await git(f.repo,'--no-replace-objects','rev-parse',f.head+':tools/staging')
 await put(join(f.repo,worker),`import './hosted-setup-artifact-bindings';export const identity='UNREVIEWED-NESTED-TREE';\n`);await git(f.repo,'add','--all');await git(f.repo,'-c','user.name=QA','-c','user.email=qa@example.invalid','commit','-qm','substitute subtree');const next=await git(f.repo,'rev-parse','HEAD'),newTree=await git(f.repo,'rev-parse',next+':tools/staging')
 const objectPath=(id:string)=>join(f.repo,'.git/objects',id.slice(0,2),id.slice(2));await chmod(objectPath(oldTree),0o600);await copyFile(objectPath(newTree),objectPath(oldTree));await git(f.repo,'reset','--hard',f.head)
 return {oldTree,newTree,clean:await git(f.repo,'status','--porcelain=v1'),head:await git(f.repo,'rev-parse','HEAD')}
},'reject')
for(const optional of [true,false,'true'])await observe('absent peer optional='+JSON.stringify(optional),async f=>{await put(join(f.deps,'node_modules/pg/package.json'),JSON.stringify({name:'pg',version:'8.23.0',main:'index.js',peerDependencies:{'pg-native':'>=3.0.1'},peerDependenciesMeta:{'pg-native':{optional}}}))},optional===true?'accept':'reject')
await observe('missing required package with optional peer declaration refuses',async f=>{await put(join(f.deps,'node_modules/pg/package.json'),JSON.stringify({name:'pg',version:'8.23.0',main:'index.js',dependencies:{'pg-native':'>=3.0.1'},peerDependencies:{'pg-native':'>=3.0.1'},peerDependenciesMeta:{'pg-native':{optional:true}}}))},'reject')
await writeFile('C:/Users/nimab/AppData/Local/Temp/hosted-artifact-publisher-qa3-results.json',JSON.stringify({runtime:Bun.version,rows},null,2)+'\n')
console.log(JSON.stringify({cases:rows.length,failures:rows.filter(r=>!r.pass).map(r=>r.name)}))
```

## Independent sibling/parser probe

```typescript
import {fixture,git,put,sha} from './hosted-artifact-publisher-qa2-fixture'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {join,dirname} from 'node:path'
import {deflateSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {publishHostedSetupArtifact} from 'C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra/tools/staging/hosted-setup-artifact-publisher.ts'
import {materializeHostedSetupArtifact} from 'C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra/tools/staging/hosted-setup-artifact-materialize.ts'
const rows:any[]=[],worker='tools/staging/hosted-setup-artifact-worker.ts'
async function repin(f:any){f.head=await git(f.repo,'rev-parse','HEAD');f.policy.reviewedProductHead=f.head;for(const d of f.docs)d.head=f.head;f.docs[1].checks[0].head=f.head;for(const[i,k]of ['headEvidence','checksEvidence','reviewEvidence'].entries()){await put(f.paths[k],JSON.stringify(f.docs[i]));f.policy[k+'Sha256']=sha(await readFile(f.paths[k]))}}
async function observe(name:string,alter:(f:any)=>Promise<any>,expected:'accept'|'reject'){
 const f=await fixture();let metadata,error=null,result:any;try{metadata=await alter(f);await repin(f);result=await publishHostedSetupArtifact(f.paths,f.policy)}catch(e){error=(e as Error).message}
 const row:any={name,fixture:f.root,head:f.head,metadata,error,actual:result?'accept':'reject',expected};if(result){row.publicationSha256=result.publicationSha256;const archive=JSON.parse(await readFile(f.paths.sourceArchive,'utf8'));row.siblings=archive.files.filter((r:any)=>/\/(?:A|a|alpha|beta)\//.test(r.path)).map((r:any)=>({path:r.path,text:Buffer.from(r.contentBase64,'base64').toString()}));try{await materializeHostedSetupArtifact({publication:f.paths.publication,sourceArchive:f.paths.sourceArchive,dependencyArchive:f.paths.dependencyArchive,sourceRoot:join(f.root,'materialized-source'),dependencyRoot:join(f.root,'materialized-deps'),runtimeExecutable:f.paths.runtimeExecutable,supervisor:f.paths.supervisor,config:f.paths.config},{publicationSha256:result.publicationSha256,reviewedProductHead:f.head,operatorId:f.policy.operatorId,independentReviewerId:f.policy.independentReviewerId,requiredChecks:f.policy.requiredChecks,activeCheckoutRoots:[f.repo]});row.materializerAccepted=true}catch(e){row.materializerAccepted=false;row.materializerError=(e as Error).message}}
 row.pass=row.actual===expected;rows.push(row);console.log(JSON.stringify(row))
}
await observe('distinct sibling shared basenames retain their own OID',async f=>{await put(join(f.repo,worker),`import './hosted-setup-artifact-bindings';import './alpha/shared';import './beta/shared';\n`);await put(join(f.repo,'tools/staging/alpha/shared.ts'),`export const alpha='first';\n`);await put(join(f.repo,'tools/staging/beta/shared.ts'),`export const beta='second';\n`);await git(f.repo,'add','--all');await git(f.repo,'-c','user.name=QA','-c','user.email=qa@example.invalid','commit','-qm','distinct sibling source');return {clean:await git(f.repo,'status','--porcelain=v1')}},'accept')
await observe('case-alias sibling directories refuse before publication',async f=>{await put(join(f.repo,worker),`import './hosted-setup-artifact-bindings';import './A/one';import './a/two';\n`);await put(join(f.repo,'tools/staging/A/one.ts'),`export const first=true;\n`);await put(join(f.repo,'tools/staging/A/two.ts'),`export const second=true;\n`);await git(f.repo,'add','--all');const oid=await git(f.repo,'hash-object','tools/staging/A/two.ts');await git(f.repo,'update-index','--force-remove','tools/staging/A/two.ts');await git(f.repo,'update-index','--add','--cacheinfo','100644',oid,'tools/staging/a/two.ts');await git(f.repo,'-c','user.name=QA','-c','user.email=qa@example.invalid','commit','-qm','case siblings');return{clean:await git(f.repo,'status','--porcelain=v1')}},'reject')
async function storeObject(f:any,type:string,payload:Buffer){const full=Buffer.concat([Buffer.from(type+' '+payload.length+'\0'),payload]),oid=createHash('sha1').update(full).digest('hex'),path=join(f.repo,'.git/objects',oid.slice(0,2),oid.slice(2));await mkdir(dirname(path),{recursive:true});await writeFile(path,deflateSync(full));return oid}
for(const variant of ['duplicate-name','slash-name','bad-mode','short-oid','invalid-utf8'])await observe('raw tree ambiguity '+variant,async f=>{
 const oid=await git(f.repo,'rev-parse',f.head+':'+worker),entry=(mode:string,name:Buffer,id=Buffer.from(oid,'hex'))=>Buffer.concat([Buffer.from(mode+' '),name,Buffer.from([0]),id])
 let payload=variant==='duplicate-name'?Buffer.concat([entry('100644',Buffer.from('same')),entry('100644',Buffer.from('same'))]):variant==='slash-name'?entry('100644',Buffer.from('a/b')):variant==='bad-mode'?entry('100600',Buffer.from('file')):variant==='short-oid'?entry('100644',Buffer.from('file'),Buffer.from(oid.slice(0,36),'hex')):entry('100644',Buffer.from([0xff]))
 const malformed=await storeObject(f,'tree',payload),treeEntry=Buffer.concat([Buffer.from('40000 invalid\0'),Buffer.from(malformed,'hex')]),root=await storeObject(f,'tree',treeEntry),commit=await storeObject(f,'commit',Buffer.from(`tree ${root}\nparent ${f.head}\nauthor QA <qa@example.invalid> 1 +0000\ncommitter QA <qa@example.invalid> 1 +0000\n\nmalformed synthetic tree\n`))
 await git(f.repo,'update-ref','HEAD',commit);let setupError=null;try{await git(f.repo,'reset','--hard',commit)}catch(e){setupError=(e as Error).message}return{malformed,setupError}
},'reject')
await writeFile('C:/Users/nimab/AppData/Local/Temp/hosted-artifact-publisher-qa3-paths-results.json',JSON.stringify(rows,null,2)+'\n');console.log(JSON.stringify({cases:rows.length,failed:rows.filter(r=>!r.pass).map(r=>r.name)}))
```
