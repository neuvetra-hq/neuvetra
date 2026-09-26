# Hosted artifact publisher repair 1 — independent targeted review

Task `HOSTED-SETUP-ARTIFACT-PUBLISHER-REPAIR-QA-01`, 2026-09-26. Reviewer `/root/artifact_launcher`, qa-lead; author `/root/artifact_runner`. Requested registry route `gpt-6-astra/high`; actual inherited model/effort unknown. AGENTS, operating model, qa-lead role, improvement workflow, compute policy/registry and author/first-review evidence were refreshed. This reviewer did not author the publisher or its repair. Earlier authorship of the source verifier/materializer is disclosed: their invocation below is a publisher integration check, not a new independent review of those consumers.

**Verdict: FAIL. PUB-F01's replacement-ref mechanism and PUB-F02 are fixed in these exact bytes, but new P1 PUB-F03 accepts substituted nested-tree contents as the reviewed commit. No publication or launch is accepted.**

The original FAIL remains unchanged at `evaluations/research-qa/hosted-setup-01-artifact-publisher-independent-review1.md`, SHA-256 `ec9f86ebcc2ab68a3ba3784c63ce3f3626907d4c6f38977f95fb7288cad94c7f`. Its first failures are not rewritten as passes.

## Exact reviewed candidate

| Artifact | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-artifact-publisher.ts` | `44a0e4d55cffa07d0a30a1b1a9f39e4b9abc2df1e67ad303242d28622fa62ad9` |
| `tools/staging/hosted-setup-artifact-publisher.test.ts` | `85ea9d13b9379bb93c300cd1a1139165176374eaa6a1213ae916af88c473de2e` |
| `evaluations/research-qa/hosted-setup-01-artifact-publisher-repair1-author.md` | `8b9c8a9a99d529b00104eeb3c280ea25da258ff994bfa9c8ba6012aed85bef6f` |

Working directory: `C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra`. Candidate pins matched at entry; neither candidate file was edited. Tests/probes used only disposable synthetic local repositories, inert SQL text and temporary archives. No shared Git mutation, real publication, provider/database mutation, network installation, credentials or live service action occurred.

## PUB-F03 — P1: nested Git trees are not authenticated to the commit

Affected source: `tools/staging/hosted-setup-artifact-publisher.ts:113` hashes the root tree; lines 117–120 recursively enumerate using `ls-tree -r`; lines 122–125 validate the selected blob against the object ID returned through that enumeration and Git path resolution. No corresponding canonical hash check authenticates the nested trees connecting the root tree to those blobs.

A nested tree's stored filename can name its original object ID while its compressed payload contains a different valid tree. Stock Git's ordinary reads use those contents without reconstructing each object's hash. The publisher verifies the unchanged commit and root tree, and correctly hashes the substituted worker blob against the **new blob ID in the corrupted nested tree**, so every implemented check passes. `rev-parse commit:path` consults that same corrupted subtree and supplies no independent ancestry proof.

Independent public-boundary reproduction:

1. Create a clean synthetic repository with reviewed commit A, its pinned head/check/review documents, the fixed inert source seeds and 23 synthetic migrations.
2. Commit a second tree changing the worker marker from `reviewed-original` to `UNREVIEWED-NESTED-TREE`.
3. In this disposable fixture only, copy the second `tools/staging` tree's compressed loose-object payload over the original nested tree object's stored filename. Keep the original commit and root tree unchanged. Reset the fixture to A using stock Git; HEAD remains A and status is empty.
4. Invoke the real exported publisher with A's unchanged externally supplied test evidence pins. It succeeds, labels the publication with A, and archives the unreviewed worker.
5. Invoke the real materializer/verifier using the returned publication pin. It accepts those bytes. No injected verifier, mock Git executable or changed runtime is used.

Exact retained fixture: `C:/Users/nimab/AppData/Local/Temp/publisher-independent-jKCgaX`.

| Observed identity | Value |
| --- | --- |
| Claimed reviewed HEAD | `90c004c5a4e12146e5a305a1d4eb54da59729312` |
| Nested tree ID referenced by original graph / stored filename | `5469959c73aa5d71f8751378066e1a655a345b0a` |
| Actual canonical hash of substituted `tree 185` object | `35970de05d6499dc4ff127ffdb1f669e52d2b92b` |
| Accepted publication SHA-256 | `23118fc26e630eec0e5d1eb13e2da4474e3cde16394fea2ddd8f82a37579fefb` |

The independent probe observed `clean:""`, the original HEAD, archived `UNREVIEWED-NESTED-TREE`, and materializer acceptance. Publisher `launchAuthorized`/`productionAuthorized` and materializer `launchAuthorized` remain false; those flags correctly deny action authority but do not repair false source lineage.

Corroboration: an independent Python zlib decode/canonical SHA-1 produced the two differing IDs above. `git --no-replace-objects ... fsck --full` exited 1 and reported the hash-path mismatch, invalid cached tree pointer and missing original nested tree. A sandbox-account ownership refusal on the first fsck invocation was retained; the scoped read-only invocation as the fixture owner produced the integrity errors. No global safe-directory setting was changed.

This challenge assumes a **pre-existing corrupted or substituted local object-store entry**, not a hostile OS, malicious runtime, concurrent writer or SHA-1 collision. The publisher promises to bind emitted source to an externally reviewed commit and already reconstructs other Git object IDs for this purpose. Treating a nested object's filename as proof leaves that stated boundary incomplete. Root confirmed this source-integrity challenge is within the review contract.

Repair acceptance: authenticate every traversed tree object from the verified root down to each selected path, reconstructing its canonical Git object hash and binding each child name/mode/OID to those verified parent bytes. Preserve that verified mapping while reading blobs by ID and hashing them. A one-time fsck before later unchecked traversal does not itself bind later reads against substitution. Continue disabling replacement refs on every Git subprocess. Independently rerun nested trees at multiple depths, direct blob/commit corruption, and real archive/materializer composition; either fail closed or emit only original reviewed bytes.

## Disposition of the original findings

**PUB-F01 mechanism repaired:** the literal `--no-replace-objects` policy plus reduced Git environment applies to every read. Independent commit, blob and nested-tree replacement refs (with an original clean checkout) all published only `reviewed-original`, and all three outputs passed real materialization. The original Q1 arrangement, in which reset populates the substituted checkout, now refuses `ARTIFACT_PUBLISHER_DIRTY_CHECKOUT_REFUSED`. Overall exact-source acceptance remains withheld because of PUB-F03.

**PUB-F02 repaired within the fixed closure contract:** an absent peer marked primitive `optional:true` now publishes and materializes. Primitive false and string `"true"` refuse. Declaring a package both required and optional-as-peer does not bypass required dependency availability. The delivered repair suite additionally copied the actual installed pg8.23 dependency graph into a fresh private root without installation/scripts, accepted its absent optional pg-native peer, and exercised present optional and malformed metadata. Regular `optionalDependencies` remain mandatory in the author's explicitly fixed prepared-closure policy; that retained stricter policy is not a claim that all package-manager optional semantics are implemented.

## Checks actually run

Windows, Bun1.3.12.

- `bun test tools/staging/hosted-setup-artifact-publisher.test.ts --timeout 30000`: **9 pass, 0 fail, 40 assertions**, exit0, approximately46.46s.
- `bun node_modules/typescript/bin/tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --types bun --skipLibCheck tools/staging/hosted-setup-artifact-publisher.ts tools/staging/hosted-setup-artifact-publisher.test.ts`: **PASS**, exit0, no diagnostics.
- Independent repaired-fixture probe: **9 cases; 8 expected outcomes and PUB-F03 reproduced**. Five accepted publications were actually materialized: the three ignored-ref cases, the substituted nested-tree finding and the optional-peer positive control.
- Independent raw-object hash corroboration and real `git fsck --full`: corruption confirmed as described above.

First reviewer probe attempt is preserved as harness evidence: three original-checkout ref cases refused as dirty because the reused independent fixture inherited global line-ending conversion; a loose-object overwrite then encountered the Windows read-only file attribute before the corruption test could run. The new fixture pins `core.autocrlf=false` **inside that disposable repository** and makes only its named object file writable for the substitution. The corrected probe then produced the results above. These initial fail-closed/harness events were not product false accepts and are not hidden.

Scope limits from review1 remain: trusted operator host and independently acquired evidence pins; private prepared dependencies; at-rest/archive identity rather than a complete runtime-loaded graph; no atomic repository/dependency snapshot or hostile-host immutability; no live publication, provider binding, launch, migration or production acceptance. Original and repaired reports remain separate. Root owns immutable snapshot, repair routing and administrative run closure.

## Preserved reviewer evidence

| Local artifact under `C:/Users/nimab/AppData/Local/Temp/` | SHA-256 |
| --- | --- |
| `hosted-artifact-publisher-qa2-fixture.ts` | `d69de93fdefa43db38da715a8e3be109f82dd13b03e59fa1a938b5cfecf75f8d` |
| `hosted-artifact-publisher-qa2.ts` | `8ad2ace7c551447f8727737eacf605a5df96b14e272faa4789629dcf90f5c513` |
| `hosted-artifact-publisher-qa2-results.json` | `7da9cc1129a1a868701119837aa8c09feea30ea3b521d66f6b8d7a1b0c6a09ac` |

The helper and probe are embedded below for reproducibility. The original first-review probe/results remain untouched.

## Independent fixture helper

```typescript
import {createHash} from 'node:crypto'
import {mkdtemp,mkdir,writeFile,readFile,readdir,symlink,link} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,dirname} from 'node:path'
import {publishHostedSetupArtifact,PR_HEAD_EVIDENCE_PROFILE,PR_CHECKS_EVIDENCE_PROFILE,PR_REVIEW_EVIDENCE_PROFILE} from 'C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra/tools/staging/hosted-setup-artifact-publisher.ts'
import {ARTIFACT_CONFIG} from 'C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra/tools/staging/hosted-setup-artifact-source.ts'
import {materializeHostedSetupArtifact} from 'C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra/tools/staging/hosted-setup-artifact-materialize.ts'
const WK='C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra',GIT=Bun.which('git')!,sha=(s:string|Uint8Array)=>createHash('sha256').update(s).digest('hex')
async function put(p:string,s:string){await mkdir(dirname(p),{recursive:true});await writeFile(p,s)}
async function git(root:string,...args:string[]){const p=Bun.spawn([GIT,'-C',root,...args],{stdin:'ignore',stdout:'pipe',stderr:'pipe',windowsHide:true});const [out,err,code]=await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);if(code)throw Error('fixture git failure: '+err);return out.trim()}
async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'publisher-independent-')),repo=join(root,'repo'),deps=join(root,'deps'),output=join(root,'out');await mkdir(repo);await mkdir(deps);await mkdir(output)
 await put(join(repo,'tools/staging/hosted-setup-artifact-worker.ts'),`import './hosted-setup-artifact-bindings'; export const identity='reviewed-original';\n`)
 await put(join(repo,'tools/staging/hosted-setup-artifact-bindings.ts'),`export const binding='synthetic-inert';\n`)
 await put(join(repo,'tools/staging/hosted-setup-transactional-upgrade.ts'),`export const transaction='synthetic-inert';\n`)
 await put(join(repo,'packages/neuvetra-database/package.json'),'{"name":"@neuvetra/database","type":"module"}')
 for(const name of(await readdir(join(WK,'packages/neuvetra-database/src/migrations'))).filter(n=>/^00(0[1-9]|1[0-9]|2[0-3])_.*\.sql$/.test(n)).sort())await put(join(repo,'packages/neuvetra-database/src/migrations',name),'-- synthetic '+name+'\nselect 1;\n')
 await git(repo,'init','-q');await git(repo,'config','core.autocrlf','false');await git(repo,'-c','user.name=Independent QA','-c','user.email=qa@example.invalid','add','--all');await git(repo,'-c','user.name=Independent QA','-c','user.email=qa@example.invalid','commit','-qm','synthetic original')
 const head=await git(repo,'rev-parse','HEAD'),now=Date.now(),expires=now+600000
 await put(join(deps,'node_modules/pg/package.json'),'{"name":"pg","version":"8.23.0","main":"index.js"}');await put(join(deps,'node_modules/pg/index.js'),'module.exports={synthetic:true};\n')
 const docs=[{profile:PR_HEAD_EVIDENCE_PROFILE,repository:'neuvetra-hq/neuvetra',pullRequest:6,head,observedAtMs:now-30,expiresAtMs:expires},{profile:PR_CHECKS_EVIDENCE_PROFILE,repository:'neuvetra-hq/neuvetra',pullRequest:6,head,observedAtMs:now-20,expiresAtMs:expires,checks:[{name:'qa-required',head,conclusion:'success'}]},{profile:PR_REVIEW_EVIDENCE_PROFILE,repository:'neuvetra-hq/neuvetra',pullRequest:6,head,operatorId:'qa-operator',independentReviewerId:'qa-reviewer',verdict:'accepted',materialFindingsOpen:0,reviewedAtMs:now-10,expiresAtMs:expires}]
 const paths:any={repositoryRoot:repo,dependencyRoot:deps,gitExecutable:GIT,runtimeExecutable:process.execPath,supervisor:join(root,'supervisor.ts'),config:join(root,'fixed.toml'),headEvidence:join(root,'head.json'),checksEvidence:join(root,'checks.json'),reviewEvidence:join(root,'review.json'),sourceArchive:join(output,'source.json'),dependencyArchive:join(output,'dependency.json'),publication:join(output,'publication.json')}
 await put(paths.supervisor,'// inert synthetic supervisor\n');await put(paths.config,ARTIFACT_CONFIG)
 for(const[i,k]of ['headEvidence','checksEvidence','reviewEvidence'].entries())await put(paths[k],JSON.stringify(docs[i]))
 const policy:any={reviewedProductHead:head,requiredChecks:['qa-required'],operatorId:'qa-operator',independentReviewerId:'qa-reviewer',nowMs:now,headEvidenceSha256:sha(await readFile(paths.headEvidence)),checksEvidenceSha256:sha(await readFile(paths.checksEvidence)),reviewEvidenceSha256:sha(await readFile(paths.reviewEvidence)),gitSha256:sha(await readFile(GIT)),runtimeSha256:sha(await readFile(process.execPath)),supervisorSha256:sha(await readFile(paths.supervisor)),configSha256:sha(ARTIFACT_CONFIG)}
 return {root,repo,deps,paths,policy,head,docs}
}

export {fixture,git,put,sha};
```

## Independent probe

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
await writeFile('C:/Users/nimab/AppData/Local/Temp/hosted-artifact-publisher-qa2-results.json',JSON.stringify({runtime:Bun.version,rows},null,2)+'\n')
console.log(JSON.stringify({cases:rows.length,failures:rows.filter(r=>!r.pass).map(r=>r.name)}))
```
