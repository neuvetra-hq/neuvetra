# Hosted artifact publisher repair 3 — independent review 4

Task `HOSTED-SETUP-ARTIFACT-PUBLISHER-REPAIR3-QA-01`, 2026-09-26. Reviewer `/root/artifact_launcher`; candidate author `/root/artifact_runner`. **PASS within the offline publisher contract. PUB-F01–PUB-F04 are closed for these exact bytes.** This preserves the original FAIL findings and does not authorize publication, deployment, migration, or production use.

The reviewer did not author the publisher or its tests. Earlier authorship of the source verifier/materializer is disclosed: invoking those existing consumers here checks publisher compatibility, not independent reacceptance of the consumers. Requested critical qa-lead route: `gpt-6-astra/high`. Actual inherited model/effort is unavailable; follow-up dispatch does not expose an override. AGENTS, operating model, QA role, current continuation, registry, compute policy and improvement workflow were refreshed. Applied lessons L02/L04: preserve byte lineage and invoke actual public boundaries.

## Exact candidate

| Artifact | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-artifact-publisher.ts` | `22a1b40a03ae8981d30586757f08abeea1441502bebd94144e063b9fb1e28dbf` |
| `tools/staging/hosted-setup-artifact-publisher.test.ts` | `5012e505cb783c47af91cf379a12975a74af259de1ebe943cd35593bc262d691` |
| `evaluations/research-qa/hosted-setup-01-artifact-publisher-repair3-author.md` | `083f2ffe077cfa76929ead62ccf49944de7d20f33d2cdf840d48727e0a05a3e8` |

All supplied hashes matched before testing. Candidate files were read-only throughout. All Git mutations below were confined to new disposable synthetic fixtures in the local temporary directory; no shared Git, provider, database, credentials, or real publication was touched.

## PUB-F04 closure

The changed `archive()` now validates accumulated path prefixes using the same spelling and file/directory collision semantics as the actual materializer. Source and dependency archives pass through this same gate before `outputPath()` or any exclusive output write. Case-insensitive source `node_modules` shadow refusal also matches the consumer. No consumer was weakened.

Independent public-API fixtures, created with real Git and exact freshly pinned synthetic evidence:

| Case | Evidence | Observed result |
| --- | --- | --- |
| Clean committed `tools/staging/A/one.ts` plus `tools/staging/a/two.ts` | Fixture `publisher-independent-UZ2iKj`; HEAD `0c7123f2b8e58d00d272fe8c28ca3f625eefada8`; status empty | `ARTIFACT_PUBLISHER_ARCHIVE_PATH_COLLISION`; source archive, dependency archive and publication receipt all absent |
| Clean committed `tools/staging/Mix.ts` plus `tools/staging/mix.ts/inside.ts` | Fixture `publisher-independent-9MpNNe`; HEAD `a8506ee921a6976e6d6d2eedad95256585b455c0`; status empty | Same refusal; all three outputs absent |
| Valid `alpha/shared.ts` and `beta/shared.ts` | Fixture `publisher-independent-XP3PrV`; HEAD `86440fee7d9a0056d759f045d416d33d5a6c6164` | Publication succeeds, distinct original content retained, actual materializer accepts; publication SHA `126787fcb0e07f3cdf75c35d2a8d027f38c82bca71df98974e30e7112b539313` |

All fixture names resolve under `C:/Users/nimab/AppData/Local/Temp/`. The case-prefix fixture uses an index entry for the second spelling because Windows aliases those directory names. The file/directory fixture uses committed index entries and `skip-worktree` for those two synthetic entries because Windows cannot represent both on disk. The publisher reads authenticated committed objects; it refuses their incompatible paths before output. This is a committed-object/path check, not a claim that skip-worktree detects all working-tree drift.

## Earlier findings remain closed

- **PUB-F01:** Fresh commit, blob and tree replacement references cannot substitute content. All three publications contain `reviewed-original`, pass the actual materializer and return `launchAuthorized:false` and `productionAuthorized:false`. The original replaced-checkout arrangement refuses `ARTIFACT_PUBLISHER_DIRTY_CHECKOUT_REFUSED`.
- **PUB-F03:** Fresh nested loose-tree corruption reproduces old tree OID `5469959c73aa5d71f8751378066e1a655a345b0a` with payload from tree `35970de05d6499dc4ff127ffdb1f669e52d2b92b`. Fixture `publisher-independent-o1vggU` retains clean HEAD `9c614c7834709ebfd02b78a5dbca440a8cb97503` and now refuses `ARTIFACT_PUBLISHER_GIT_TREE_IDENTITY_REFUSED`. Recursive tree OID validation and parent-derived path/OID mapping remain in place.
- **PUB-F02:** Explicit boolean `optional:true` with absent `pg-native` publishes and materializes; `false`, string `"true"`, and required-dependency plus optional-peer overlap refuse. The delivered suite also copies and tests the actual installed pg 8.23 closure and its absent optional native peer.
- Parser controls independently refuse duplicate child names, slash-containing names and mode `100600` at `GIT_TREE_REFUSED`; truncated 18-byte OID fails `GIT_COMMAND_REFUSED` after Git also refuses the malformed checkout. Invalid UTF-8 fails earlier at `DIRTY_CHECKOUT_REFUSED`; no deeper parser coverage is claimed for that case. All eight path/parser probe cases verify the three output files are absent on refusal.

## Executed checks and first results

- `bun test tools/staging/hosted-setup-artifact-publisher.test.ts --timeout 30000`: **14 pass, 0 fail, 67 assertions**, Bun 1.3.12 (700fc117), approximately 49.29 seconds.
- `bun node_modules/typescript/bin/tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --types bun --skipLibCheck tools/staging/hosted-setup-artifact-publisher.ts tools/staging/hosted-setup-artifact-publisher.test.ts`: **PASS**, exit 0, no diagnostics.
- Independent regression probe: **9/9** expected outcomes. Independent path/parser probe: **8/8** expected outcomes. Total **17/17**, with actual materializer acceptance required for all positive cases.
- First execution attempt was interrupted with `TurnAborted`. Unescalated test and TypeScript invocations then failed to read the managed worktree/dependency paths with `EPERM` (test report: 0 pass, 1 loader failure). Scoped escalated invocations completed above. These are preserved environment failures, not failed candidate assertions.

No additional combined-suite rerun was necessary: this review reran the focused changed suite, strict compilation and real publisher-to-materializer integration in independent probes. The author's combined-suite result is not represented as reviewer execution.

## Preserved failures and limits

QA1–QA3 were rehashed and remain unchanged:

| Report | SHA-256 |
| --- | --- |
| `hosted-setup-01-artifact-publisher-independent-review1.md` | `ec9f86ebcc2ab68a3ba3784c63ce3f3626907d4c6f38977f95fb7288cad94c7f` |
| `hosted-setup-01-artifact-publisher-independent-review2.md` | `0f9977a48fe3166159015bcada3ceea37396ff7db9d0db79e670dfdb0bbaa6e8` |
| `hosted-setup-01-artifact-publisher-independent-review3.md` | `d796cfd6c83e5d2d631d7985e490364ead6f18f9ccae9033336a2a0dc2e62dbf` |

No material issue remains in the assigned repair scope. This bounded acceptance relies on the declared trusted operator host and authentic external evidence/pins. It does not establish evidence acquisition authenticity, hostile-host immutability, atomic filesystem snapshots, complete loaded-module closure, executable/OS provenance, arbitrary concurrent mutation safety or immunity to Git SHA-1 collision properties. Dependency prefix collision coverage here includes source inspection of the shared gate; the Windows filesystem cannot independently materialize two directory spellings for a dependency fixture. Real launch bindings, publication authorization and integration acceptance belong to the coordinator.

The independent reproduction sources and machine results follow. Their shared helper is preserved in QA2 (`hosted-artifact-publisher-qa2-fixture.ts`, SHA `d69de93fdefa43db38da715a8e3be109f82dd13b03e59fa1a938b5cfecf75f8d`). Synthetic accepted review documents are test inputs only, not authentic PR review evidence.


### hosted-artifact-publisher-qa4.ts

SHA-256: 77f2f13ab7e5c2cd794ec2771f532ce86e60cd11fef5aa159b705f1318b29cce

```
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
 row.pass=expected==='reject'?!result:!!result&&row.materializerAccepted&&(expected==='accept'||row.originalRetained);rows.push(row);console.log(JSON.stringify(row))
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
await writeFile('C:/Users/nimab/AppData/Local/Temp/hosted-artifact-publisher-qa4-results.json',JSON.stringify({runtime:Bun.version,rows},null,2)+'\n')
console.log(JSON.stringify({cases:rows.length,failures:rows.filter(r=>!r.pass).map(r=>r.name)}))

```


### hosted-artifact-publisher-qa4-results.json

SHA-256: 431875e0c532b700c84bd6cd61e297edb7b930c778f0383e04a9c77ce8830fdb

```
{
  "runtime": "1.3.12",
  "rows": [
    {
      "name": "commit replacement ignored",
      "expected": "accept-original",
      "fixture": "C:\\Users\\nimab\\AppData\\Local\\Temp\\publisher-independent-E59lLY",
      "head": "c973341c0a62e9dcd303716f5c67ea072a99b1fb",
      "metadata": {
        "original": "c973341c0a62e9dcd303716f5c67ea072a99b1fb",
        "replacement": "45a0865e7ed8af8e35460653e81ddb558f8622cd"
      },
      "error": null,
      "actual": "accept",
      "publicationSha256": "cf41e5706adc592a49c43410a25b624733ed2e8031841ce64a0feec200042f7e",
      "worker": "import './hosted-setup-artifact-bindings'; export const identity='reviewed-original';\n",
      "originalRetained": true,
      "authority": {
        "launchAuthorized": false,
        "productionAuthorized": false
      },
      "materializerAccepted": true,
      "materializerLaunchAuthorized": false,
      "pass": true
    },
    {
      "name": "blob replacement ignored",
      "expected": "accept-original",
      "fixture": "C:\\Users\\nimab\\AppData\\Local\\Temp\\publisher-independent-KuSCAs",
      "head": "7aa83f17192e58c5f750e4991806a992dc7ef4b0",
      "metadata": {
        "original": "3ec52788362a7f99e19672bfad69cd3cbcf0e953",
        "replacement": "dd84bd86014ecf1008e8c29effb81b292900d731"
      },
      "error": null,
      "actual": "accept",
      "publicationSha256": "ed7882c7e92c3fca9e5f4f2ecfb5e1febee5bde7d11e1ed3ca53c01b7c3f4f2f",
      "worker": "import './hosted-setup-artifact-bindings'; export const identity='reviewed-original';\n",
      "originalRetained": true,
      "authority": {
        "launchAuthorized": false,
        "productionAuthorized": false
      },
      "materializerAccepted": true,
      "materializerLaunchAuthorized": false,
      "pass": true
    },
    {
      "name": "tree replacement ignored",
      "expected": "accept-original",
      "fixture": "C:\\Users\\nimab\\AppData\\Local\\Temp\\publisher-independent-6CDEW7",
      "head": "b15010fa9251ea4c1004f7f4fcd691d5b462bebd",
      "metadata": {
        "original": "5469959c73aa5d71f8751378066e1a655a345b0a",
        "replacement": "39a9623df21b97784a350b767a1de937705e813f"
      },
      "error": null,
      "actual": "accept",
      "publicationSha256": "e3e99db4613bb2d2a5223d779f2bc3f9cb1bad542447704b11baf6726ce9e525",
      "worker": "import './hosted-setup-artifact-bindings'; export const identity='reviewed-original';\n",
      "originalRetained": true,
      "authority": {
        "launchAuthorized": false,
        "productionAuthorized": false
      },
      "materializerAccepted": true,
      "materializerLaunchAuthorized": false,
      "pass": true
    },
    {
      "name": "original first-FAIL replaced checkout refuses",
      "expected": "reject",
      "fixture": "C:\\Users\\nimab\\AppData\\Local\\Temp\\publisher-independent-9niLjA",
      "head": "fb84971b88c61b79e5665e492a1fdb2c7e56f488",
      "metadata": {
        "replacement": "49c325c25f7cb6740f7ac42eda13293e358ce26a"
      },
      "error": "ARTIFACT_PUBLISHER_DIRTY_CHECKOUT_REFUSED",
      "actual": "reject",
      "pass": true
    },
    {
      "name": "nested tree loose-object substitution",
      "expected": "reject",
      "fixture": "C:\\Users\\nimab\\AppData\\Local\\Temp\\publisher-independent-o1vggU",
      "head": "9c614c7834709ebfd02b78a5dbca440a8cb97503",
      "metadata": {
        "oldTree": "5469959c73aa5d71f8751378066e1a655a345b0a",
        "newTree": "35970de05d6499dc4ff127ffdb1f669e52d2b92b",
        "clean": "",
        "head": "9c614c7834709ebfd02b78a5dbca440a8cb97503"
      },
      "error": "ARTIFACT_PUBLISHER_GIT_TREE_IDENTITY_REFUSED",
      "actual": "reject",
      "pass": true
    },
    {
      "name": "absent peer optional=true",
      "expected": "accept",
      "fixture": "C:\\Users\\nimab\\AppData\\Local\\Temp\\publisher-independent-KRWEg6",
      "head": "b7f6478c50c75810bf8315f9c37a5e30a12b7229",
      "error": null,
      "actual": "accept",
      "publicationSha256": "87b8e7efd8c0b1f84ea7400e04b0144b5c55d765a1e2629639af2cdc405e0594",
      "worker": "import './hosted-setup-artifact-bindings'; export const identity='reviewed-original';\n",
      "originalRetained": true,
      "authority": {
        "launchAuthorized": false,
        "productionAuthorized": false
      },
      "materializerAccepted": true,
      "materializerLaunchAuthorized": false,
      "pass": true
    },
    {
      "name": "absent peer optional=false",
      "expected": "reject",
      "fixture": "C:\\Users\\nimab\\AppData\\Local\\Temp\\publisher-independent-HXmfjb",
      "head": "e9b38321e41d36cd8df72a4a67971c24ca789939",
      "error": "ARTIFACT_PUBLISHER_DEPENDENCY_MISSING",
      "actual": "reject",
      "pass": true
    },
    {
      "name": "absent peer optional=\"true\"",
      "expected": "reject",
      "fixture": "C:\\Users\\nimab\\AppData\\Local\\Temp\\publisher-independent-RxnI53",
      "head": "6f679fd8201bfc0ed1f4baf754d6da96465823d7",
      "error": "ARTIFACT_PUBLISHER_PEER_METADATA_REFUSED",
      "actual": "reject",
      "pass": true
    },
    {
      "name": "missing required package with optional peer declaration refuses",
      "expected": "reject",
      "fixture": "C:\\Users\\nimab\\AppData\\Local\\Temp\\publisher-independent-WnMg8B",
      "head": "3ab58494a8a224fa53e78183e8715cbd2aec4cd3",
      "error": "ARTIFACT_PUBLISHER_DEPENDENCY_MISSING",
      "actual": "reject",
      "pass": true
    }
  ]
}

```


### hosted-artifact-publisher-qa4-paths.ts

SHA-256: 0cb190054031a68bd83dd5f587c45a7bf73f5e42d36dff96ef9aab07af153b5f

```
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
 row.outputs=await Promise.all([f.paths.sourceArchive,f.paths.dependencyArchive,f.paths.publication].map(p=>Bun.file(p).exists()));row.pass=row.actual===expected&&(expected==='accept'?row.materializerAccepted:row.outputs.every((v:boolean)=>!v));rows.push(row);console.log(JSON.stringify(row))
}
await observe('distinct sibling shared basenames retain their own OID',async f=>{await put(join(f.repo,worker),`import './hosted-setup-artifact-bindings';import './alpha/shared';import './beta/shared';\n`);await put(join(f.repo,'tools/staging/alpha/shared.ts'),`export const alpha='first';\n`);await put(join(f.repo,'tools/staging/beta/shared.ts'),`export const beta='second';\n`);await git(f.repo,'add','--all');await git(f.repo,'-c','user.name=QA','-c','user.email=qa@example.invalid','commit','-qm','distinct sibling source');return {clean:await git(f.repo,'status','--porcelain=v1')}},'accept')
await observe('case-alias sibling directories refuse before publication',async f=>{await put(join(f.repo,worker),`import './hosted-setup-artifact-bindings';import './A/one';import './a/two';\n`);await put(join(f.repo,'tools/staging/A/one.ts'),`export const first=true;\n`);await put(join(f.repo,'tools/staging/A/two.ts'),`export const second=true;\n`);await git(f.repo,'add','--all');const oid=await git(f.repo,'hash-object','tools/staging/A/two.ts');await git(f.repo,'update-index','--force-remove','tools/staging/A/two.ts');await git(f.repo,'update-index','--add','--cacheinfo','100644',oid,'tools/staging/a/two.ts');await git(f.repo,'-c','user.name=QA','-c','user.email=qa@example.invalid','commit','-qm','case siblings');return{clean:await git(f.repo,'status','--porcelain=v1')}},'reject')
await observe('file versus directory case alias refuses before outputs',async f=>{await put(join(f.repo,worker),`import './hosted-setup-artifact-bindings';import './Mix.ts';import './mix.ts/inside';\n`);await put(join(f.root,'file-source.ts'),'export const file=true;\n');await put(join(f.root,'inner-source.ts'),'export const inner=true;\n');await git(f.repo,'add',worker);const fileOid=await git(f.repo,'hash-object','-w',join(f.root,'file-source.ts')),innerOid=await git(f.repo,'hash-object','-w',join(f.root,'inner-source.ts'));await git(f.repo,'update-index','--add','--cacheinfo','100644',fileOid,'tools/staging/Mix.ts');await git(f.repo,'update-index','--add','--cacheinfo','100644',innerOid,'tools/staging/mix.ts/inside.ts');await git(f.repo,'-c','user.name=QA','-c','user.email=qa@example.invalid','commit','-qm','file directory alias');await git(f.repo,'update-index','--skip-worktree','tools/staging/Mix.ts','tools/staging/mix.ts/inside.ts');return{fileOid,innerOid,skipWorktree:true,clean:await git(f.repo,'status','--porcelain=v1')}},'reject')
async function storeObject(f:any,type:string,payload:Buffer){const full=Buffer.concat([Buffer.from(type+' '+payload.length+'\0'),payload]),oid=createHash('sha1').update(full).digest('hex'),path=join(f.repo,'.git/objects',oid.slice(0,2),oid.slice(2));await mkdir(dirname(path),{recursive:true});await writeFile(path,deflateSync(full));return oid}
for(const variant of ['duplicate-name','slash-name','bad-mode','short-oid','invalid-utf8'])await observe('raw tree ambiguity '+variant,async f=>{
 const oid=await git(f.repo,'rev-parse',f.head+':'+worker),entry=(mode:string,name:Buffer,id=Buffer.from(oid,'hex'))=>Buffer.concat([Buffer.from(mode+' '),name,Buffer.from([0]),id])
 let payload=variant==='duplicate-name'?Buffer.concat([entry('100644',Buffer.from('same')),entry('100644',Buffer.from('same'))]):variant==='slash-name'?entry('100644',Buffer.from('a/b')):variant==='bad-mode'?entry('100600',Buffer.from('file')):variant==='short-oid'?entry('100644',Buffer.from('file'),Buffer.from(oid.slice(0,36),'hex')):entry('100644',Buffer.from([0xff]))
 const malformed=await storeObject(f,'tree',payload),treeEntry=Buffer.concat([Buffer.from('40000 invalid\0'),Buffer.from(malformed,'hex')]),root=await storeObject(f,'tree',treeEntry),commit=await storeObject(f,'commit',Buffer.from(`tree ${root}\nparent ${f.head}\nauthor QA <qa@example.invalid> 1 +0000\ncommitter QA <qa@example.invalid> 1 +0000\n\nmalformed synthetic tree\n`))
 await git(f.repo,'update-ref','HEAD',commit);let setupError=null;try{await git(f.repo,'reset','--hard',commit)}catch(e){setupError=(e as Error).message}return{malformed,setupError}
},'reject')
await writeFile('C:/Users/nimab/AppData/Local/Temp/hosted-artifact-publisher-qa4-paths-results.json',JSON.stringify(rows,null,2)+'\n');console.log(JSON.stringify({cases:rows.length,failed:rows.filter(r=>!r.pass).map(r=>r.name)}))

```


### hosted-artifact-publisher-qa4-paths-results.json

SHA-256: 4c421e34ef0c6d158653aa7559ef1c40829ecb797fa4d2e7e28466315b612266

```
[
  {
    "name": "distinct sibling shared basenames retain their own OID",
    "fixture": "C:\\Users\\nimab\\AppData\\Local\\Temp\\publisher-independent-XP3PrV",
    "head": "86440fee7d9a0056d759f045d416d33d5a6c6164",
    "metadata": {
      "clean": ""
    },
    "error": null,
    "actual": "accept",
    "expected": "accept",
    "publicationSha256": "126787fcb0e07f3cdf75c35d2a8d027f38c82bca71df98974e30e7112b539313",
    "siblings": [
      {
        "path": "tools/staging/alpha/shared.ts",
        "text": "export const alpha='first';\n"
      },
      {
        "path": "tools/staging/beta/shared.ts",
        "text": "export const beta='second';\n"
      }
    ],
    "materializerAccepted": true,
    "outputs": [
      true,
      true,
      true
    ],
    "pass": true
  },
  {
    "name": "case-alias sibling directories refuse before publication",
    "fixture": "C:\\Users\\nimab\\AppData\\Local\\Temp\\publisher-independent-UZ2iKj",
    "head": "0c7123f2b8e58d00d272fe8c28ca3f625eefada8",
    "metadata": {
      "clean": ""
    },
    "error": "ARTIFACT_PUBLISHER_ARCHIVE_PATH_COLLISION",
    "actual": "reject",
    "expected": "reject",
    "outputs": [
      false,
      false,
      false
    ],
    "pass": true
  },
  {
    "name": "file versus directory case alias refuses before outputs",
    "fixture": "C:\\Users\\nimab\\AppData\\Local\\Temp\\publisher-independent-9MpNNe",
    "head": "a8506ee921a6976e6d6d2eedad95256585b455c0",
    "metadata": {
      "fileOid": "9ebac96b032e9a993aef433c86d107070c0f9f2f",
      "innerOid": "a954f70ed04f55241a6d7b88d572c7b263a96c4c",
      "skipWorktree": true,
      "clean": ""
    },
    "error": "ARTIFACT_PUBLISHER_ARCHIVE_PATH_COLLISION",
    "actual": "reject",
    "expected": "reject",
    "outputs": [
      false,
      false,
      false
    ],
    "pass": true
  },
  {
    "name": "raw tree ambiguity duplicate-name",
    "fixture": "C:\\Users\\nimab\\AppData\\Local\\Temp\\publisher-independent-UcEtKO",
    "head": "abf6a25cbc81459c3aa30407893de5dfcb3556bd",
    "metadata": {
      "malformed": "e388956fce8a647981b2d76138106d7c6469393a",
      "setupError": null
    },
    "error": "ARTIFACT_PUBLISHER_GIT_TREE_REFUSED",
    "actual": "reject",
    "expected": "reject",
    "outputs": [
      false,
      false,
      false
    ],
    "pass": true
  },
  {
    "name": "raw tree ambiguity slash-name",
    "fixture": "C:\\Users\\nimab\\AppData\\Local\\Temp\\publisher-independent-vYNj0C",
    "head": "5f87076a37461d10124b328f51bb7e5c39b8c665",
    "metadata": {
      "malformed": "9b2c055bcb231fd9ff566fa08f27035caf75de33",
      "setupError": null
    },
    "error": "ARTIFACT_PUBLISHER_GIT_TREE_REFUSED",
    "actual": "reject",
    "expected": "reject",
    "outputs": [
      false,
      false,
      false
    ],
    "pass": true
  },
  {
    "name": "raw tree ambiguity bad-mode",
    "fixture": "C:\\Users\\nimab\\AppData\\Local\\Temp\\publisher-independent-KPC6ZE",
    "head": "d42d5df4be5f8ff489350c042d01538dee79d2d0",
    "metadata": {
      "malformed": "04b9f17f6df6b20532925df7e4fb55002791dd41",
      "setupError": null
    },
    "error": "ARTIFACT_PUBLISHER_GIT_TREE_REFUSED",
    "actual": "reject",
    "expected": "reject",
    "outputs": [
      false,
      false,
      false
    ],
    "pass": true
  },
  {
    "name": "raw tree ambiguity short-oid",
    "fixture": "C:\\Users\\nimab\\AppData\\Local\\Temp\\publisher-independent-YvwjHK",
    "head": "9db9519f8d2ebbc4f4e949fdf638def047d68fd8",
    "metadata": {
      "malformed": "a5eeee7ca2237c30be7914baf8afdb2cb56d39a2",
      "setupError": "fixture git failure: fatal: too-short tree object\n"
    },
    "error": "ARTIFACT_PUBLISHER_GIT_COMMAND_REFUSED",
    "actual": "reject",
    "expected": "reject",
    "outputs": [
      false,
      false,
      false
    ],
    "pass": true
  },
  {
    "name": "raw tree ambiguity invalid-utf8",
    "fixture": "C:\\Users\\nimab\\AppData\\Local\\Temp\\publisher-independent-As5T7C",
    "head": "430ce6231ebfcba087e5a0c37db4b44c179a04c4",
    "metadata": {
      "malformed": "bf76b469759547feaf55ab6f67b6aa49f7f57cf3",
      "setupError": null
    },
    "error": "ARTIFACT_PUBLISHER_DIRTY_CHECKOUT_REFUSED",
    "actual": "reject",
    "expected": "reject",
    "outputs": [
      false,
      false,
      false
    ],
    "pass": true
  }
]

```
