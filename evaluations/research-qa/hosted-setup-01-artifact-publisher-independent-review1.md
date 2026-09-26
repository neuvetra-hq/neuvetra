# Hosted artifact publisher — independent first review

Task `HOSTED-SETUP-ARTIFACT-PUBLISHER-QA-01`, 2026-09-26. Reviewer `/root/artifact_launcher`, qa-lead; author `/root/artifact_runner`. Requested registry route `gpt-6-astra/high`; observed model/effort and resource usage unknown. This reviewer did not author either publisher candidate file. This context previously authored artifact-source/materializer components; invoking those accepted public consumers here is a publisher integration check, not a new independent acceptance of their implementation.

**Verdict: FAIL. PUB-F01 P1 breaks the exact-reviewed-commit source claim and survives materialization/verification. PUB-F02 P2 blocks the intended pure-JavaScript pg closure when an explicitly optional native peer is absent.** Preserve both first observations; no candidate repair was made.

## Frozen candidate

Working directory: `C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra`.

| File | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-artifact-publisher.ts` | `02f2ab413ccb8900b9d921d329d86968acd3de46f31d6fb1950b05434f7d04b0` |
| `tools/staging/hosted-setup-artifact-publisher.test.ts` | `5ee8f874c9a36822702d74bea942562babee5d5804f34bddfe7ddd73fdc614b1` |
| Author report `hosted-setup-01-artifact-publisher-author.md` | `2ab6d4b91cdf40a2e06117688378203dc4c529ae787cc0b1218d646a4f80f09f` |

These matched the assignment and were unchanged after reviewer testing. Context refreshed: role, workflow and lessons L02/L04/L06; current continuation; candidate/report; actual verifier/materializer interfaces. Only the new review/run record and synthetic temporary probe artifacts were written. Root explicitly authorized disposable fresh Git fixtures for replacement-ref/object-substitution challenges. No shared Git metadata, candidate source, provider, database, credentials or live service was changed.

## PUB-F01 — P1: local replacement refs substitute source under the reviewed HEAD

Affected source: `tools/staging/hosted-setup-artifact-publisher.ts:98` (Git launch policy), lines 105–117 (clean/head/tree/blob reads), and the resulting publication identity. The Git subprocess disables system/global config but does not disable object replacement. `rev-parse HEAD` returns the original pinned commit while `ls-tree` and `show` honor repository replacement refs. Repeated clean/head checks do not establish that the returned tree/blob bytes belong to the original object.

Independent minimal scenario, entirely in `C:/Users/nimab/AppData/Local/Temp/publisher-independent-LbxrZi`:

1. Commit the inert synthetic source and 23 migrations as reviewed commit A. Pin all head/check/review documents to A through the normal public policy.
2. Commit a different worker marker as B.
3. Create `git replace A B`, then reset the disposable fixture to A. Git now reports `HEAD=A` and a clean checkout, while ordinary tree/blob reads use B.
4. Call the actual exported publisher with the unchanged A evidence pins. It succeeds and returns the A identity. Decode the emitted source archive: its worker contains `UNREVIEWED-REPLACEMENT`.
5. Read the original A object with replacement disabled: its worker contains `reviewed-original`. Pass the emitted publication/archive through the real materializer/verifier with the publisher's returned publication pin: it succeeds as well.

Observed original head: `e43aca21b4e41a21b847e2c8549cf678bff66f35`.

Observed accepted publication SHA-256: `e102bf59808160a99a3508639dfdb649c70fc7a4645d36f0deef8330af960fa1`.

The returned authority flags remained false. That bounds action authority but does not repair the false source provenance: the archive can be independently pinned and subsequently verified while containing bytes outside the reviewed commit. The trusted-host model does not make two different Git object interpretations equal. This reproduction used stock Git behavior and static local repository metadata, with no hostile OS, runtime patching, race timing or changed evidence pins.

Repair acceptance: force original-object semantics on **every** Git invocation, including head/clean checks, tree enumeration and blob reads, using a fixed no-replacement policy (for example the literal `--no-replace-objects` option). Reject repository interpretations that cannot establish original commit/tree/blob identity. Independently repeat commit and blob/tree replacement variants; either refuse the fixture or produce only original reviewed bytes. Keep the archive/materializer round-trip in that negative regression. Do not merely inspect a replacement-ref list once, because metadata can change between later subprocesses.

## PUB-F02 — P2: absent optional peer is treated as required

Affected source: `tools/staging/hosted-setup-artifact-publisher.ts:151`. The closure enqueues all `peerDependencies` entries without inspecting `peerDependenciesMeta[name].optional`. A fixture with pg8.23-style `peerDependencies:{"pg-native":">=3.0.1"}` and `peerDependenciesMeta:{"pg-native":{"optional":true}}`, with no native package, fails `ARTIFACT_PUBLISHER_DEPENDENCY_MISSING`.

The current installed `packages/neuvetra-database/node_modules/pg/package.json` reports pg8.23.0 and contains exactly this optional-peer declaration. `pg-native` was absent from both database-package and repository-root node_modules locations inspected. This is a fail-closed compatibility failure, not an unauthorized-source acceptance. The author suite used a simpler synthetic dependency graph and did not exercise this actual package declaration.

Repair acceptance: define optional dependency/peer handling explicitly. Required dependencies remain mandatory; an explicitly optional absent peer must not force native-package installation merely to publish the intended pure-JavaScript client. Present optional packages still need the same complete private file inventory/link/path/pin checks. Exercise a real prepared pg8.23 private closure without installing packages or running lifecycle scripts, and retain the missing-required-dependency negative control. If the intended artifact contract deliberately mandates a native peer instead, root must explicitly review that changed runtime scope; this review does not authorize it.

## Checks and independent evidence

Windows, Bun1.3.12. First delivered-suite reviewer invocation: **6 pass, 0 fail, 24 assertions**, exit0:

`bun test tools/staging/hosted-setup-artifact-publisher.test.ts --timeout 30000`

Strict TypeScript: **PASS**, exit0, no diagnostics:

`bun node_modules/typescript/bin/tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --types bun --skipLibCheck tools/staging/hosted-setup-artifact-publisher.ts tools/staging/hosted-setup-artifact-publisher.test.ts`

Independent probes: **16 cases**, with 14 expected behaviors observed and the two findings above reproduced. Fixtures were independently constructed, not imported from the author's tests. They cover:

- An ordinary clean synthetic commit successfully round-trips through the real archive materializer/verifier, with both publisher authority flags false.
- Source substitution via replacement refs succeeds unexpectedly, including the real round-trip (PUB-F01).
- Dependency package junction, hard-linked payload and output-parent junction all refuse.
- Changed evidence without repinning, wrong exact head, self-review, missing required check, wrong supervisor pin and expired policy time all refuse.
- Existing publication and colliding output paths refuse; two concurrent calls using the same fresh paths yield exactly one successful publication, with the other receiving EEXIST.
- Changing archive bytes after publication causes the real materializer to refuse `Pinned archive mismatch`.
- Explicitly optional absent native peer refuses unexpectedly (PUB-F02).

The delivered tests additionally exercise tracked/untracked checkout dirt, missing required dependency, undeclared dependency bytes, import aliases, unresolved imports and absent binding. Static review confirms selected Git symlink/non-blob modes are refused before source reading and dependency names reject traversal. These static observations are not claimed as independently executed source-symlink/ADS cases.

## TOCTOU, immutability and unproved boundaries

Input arguments are synchronously copied before awaits; archive bytes, hashes and the receipt are constructed from private in-memory snapshots. Exclusive output creation and digest verification provide checked artifact identity, not filesystem immutability or a hostile-host lease. A trusted operator must retain private roots and distribute the exact publication pin independently. The successful archive-tamper refusal supports this limited statement.

There is no atomic filesystem snapshot for dependency/package-metadata reads and no lock spanning the separate Git subprocesses. PUB-F01 shows why original-object resolution must be invariant throughout those reads. Arbitrary hostile-host replacement, runtime/DLL immutability and complete runtime-loaded module resolution remain outside scope. The source scanner sees static/literal imports; this review does not certify computed dynamic import closure. The Git helper has no subprocess deadline and applies its output-size limit after buffering; hostile/hanging Git repository behavior is not independently tested or accepted here.

The producer validates supplied evidence pins, not their authenticated acquisition. Synthetic evidence is not authentic PR publication. The supervisor/config/runtime pins and false `launchAuthorized`/`productionAuthorized` flags are preserved, but no actual clean integrated publication, real private dependency artifact, worker launch, source-authentication chain or hosted readiness is established by this review. Do not publish or launch from this candidate pending repair and fresh QA.

## Preserved reproduction artifacts

| Local artifact under `C:/Users/nimab/AppData/Local/Temp/` | SHA-256 |
| --- | --- |
| `hosted-artifact-publisher-qa-01.ts` | `d41e360b813cc7f725bec1959c2370820ffe5ff37a0ca7b6e2bda02423a89190` |
| `hosted-artifact-publisher-qa-01-results.json` | `3e7f114dff15662d33c6a0629d10e27ae38dd0595ab628bd7525b3b050a61158` |
| `hosted-artifact-publisher-qa-extra.ts` | `6a79582fc290cdecc18f28913ba70a57465c275c71f4fed494a9360357947bf9` |
| `hosted-artifact-publisher-qa-extra-results.json` | `258eae136c9426d52af346b35f5cffc0a9843f1f5508f471ec0bdcb556fa278b` |

The initial failure outputs and fixtures remain retained. Source is embedded below so the reproduction survives temporary-directory cleanup. The supplementary probe targets the first preserved normal fixture and uses its original trusted test clock; this is not a fresh-publication-clock assertion. Root owns immutable snapshot/run closure and repair dispatch. Preserve this first FAIL after any later PASS.

## Independent main probe

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
 await git(repo,'init','-q');await git(repo,'-c','user.name=Independent QA','-c','user.email=qa@example.invalid','add','--all');await git(repo,'-c','user.name=Independent QA','-c','user.email=qa@example.invalid','commit','-qm','synthetic original')
 const head=await git(repo,'rev-parse','HEAD'),now=Date.now(),expires=now+600000
 await put(join(deps,'node_modules/pg/package.json'),'{"name":"pg","version":"8.23.0","main":"index.js"}');await put(join(deps,'node_modules/pg/index.js'),'module.exports={synthetic:true};\n')
 const docs=[{profile:PR_HEAD_EVIDENCE_PROFILE,repository:'neuvetra-hq/neuvetra',pullRequest:6,head,observedAtMs:now-30,expiresAtMs:expires},{profile:PR_CHECKS_EVIDENCE_PROFILE,repository:'neuvetra-hq/neuvetra',pullRequest:6,head,observedAtMs:now-20,expiresAtMs:expires,checks:[{name:'qa-required',head,conclusion:'success'}]},{profile:PR_REVIEW_EVIDENCE_PROFILE,repository:'neuvetra-hq/neuvetra',pullRequest:6,head,operatorId:'qa-operator',independentReviewerId:'qa-reviewer',verdict:'accepted',materialFindingsOpen:0,reviewedAtMs:now-10,expiresAtMs:expires}]
 const paths:any={repositoryRoot:repo,dependencyRoot:deps,gitExecutable:GIT,runtimeExecutable:process.execPath,supervisor:join(root,'supervisor.ts'),config:join(root,'fixed.toml'),headEvidence:join(root,'head.json'),checksEvidence:join(root,'checks.json'),reviewEvidence:join(root,'review.json'),sourceArchive:join(output,'source.json'),dependencyArchive:join(output,'dependency.json'),publication:join(output,'publication.json')}
 await put(paths.supervisor,'// inert synthetic supervisor\n');await put(paths.config,ARTIFACT_CONFIG)
 for(const[i,k]of ['headEvidence','checksEvidence','reviewEvidence'].entries())await put(paths[k],JSON.stringify(docs[i]))
 const policy:any={reviewedProductHead:head,requiredChecks:['qa-required'],operatorId:'qa-operator',independentReviewerId:'qa-reviewer',nowMs:now,headEvidenceSha256:sha(await readFile(paths.headEvidence)),checksEvidenceSha256:sha(await readFile(paths.checksEvidence)),reviewEvidenceSha256:sha(await readFile(paths.reviewEvidence)),gitSha256:sha(await readFile(GIT)),runtimeSha256:sha(await readFile(process.execPath)),supervisorSha256:sha(await readFile(paths.supervisor)),configSha256:sha(ARTIFACT_CONFIG)}
 return {root,repo,deps,paths,policy,head,docs}
}
const rows:any[]=[]
async function probe(name:string,edit:(f:any)=>Promise<void>,expected:string,roundtrip=false){const f=await fixture();await edit(f);let result:any,err:string|null=null;try{result=await publishHostedSetupArtifact(f.paths,f.policy)}catch(e){err=(e as Error).message}
 const row:any={name,expected,actual:result?'accept':'reject',error:err,fixture:f.root};if(result){row.flags={launchAuthorized:result.launchAuthorized,productionAuthorized:result.productionAuthorized};row.head=result.reviewedProductHead;row.publicationSha256=result.publicationSha256
 const archive=JSON.parse(await readFile(f.paths.sourceArchive,'utf8'));row.worker=Buffer.from(archive.files.find((r:any)=>r.path==='tools/staging/hosted-setup-artifact-worker.ts').contentBase64,'base64').toString();row.originalObject=await git(f.repo,'--no-replace-objects','show',f.head+':tools/staging/hosted-setup-artifact-worker.ts');row.clean=await git(f.repo,'status','--porcelain=v1','--untracked-files=all')
 if(roundtrip){try{const material=await materializeHostedSetupArtifact({publication:f.paths.publication,sourceArchive:f.paths.sourceArchive,dependencyArchive:f.paths.dependencyArchive,sourceRoot:join(f.root,'source-materialized'),dependencyRoot:join(f.root,'dependency-materialized'),runtimeExecutable:f.paths.runtimeExecutable,supervisor:f.paths.supervisor,config:f.paths.config},{publicationSha256:result.publicationSha256,reviewedProductHead:f.head,operatorId:f.policy.operatorId,independentReviewerId:f.policy.independentReviewerId,requiredChecks:f.policy.requiredChecks,activeCheckoutRoots:[f.repo]});row.roundtrip={accepted:true,launchAuthorized:material.launchAuthorized}}catch(e){row.roundtrip={accepted:false,error:(e as Error).message}}}}
 row.pass=row.actual===expected;rows.push(row);console.log(JSON.stringify(row))
}
await probe('independent normal publication',async()=>{},'accept',true)
await probe('commit replacement object misbinds pinned HEAD',async f=>{await put(join(f.repo,'tools/staging/hosted-setup-artifact-worker.ts'),`import './hosted-setup-artifact-bindings'; export const identity='UNREVIEWED-REPLACEMENT';\n`);await git(f.repo,'add','--all');await git(f.repo,'-c','user.name=Independent QA','-c','user.email=qa@example.invalid','commit','-qm','unreviewed substitute');const substitute=await git(f.repo,'rev-parse','HEAD');await git(f.repo,'replace',f.head,substitute);await git(f.repo,'reset','--hard',f.head)},'reject',true)
await probe('junction dependency package escape',async f=>{const external=join(f.root,'external');await mkdir(external);await put(join(external,'file.js'),'inert');await symlink(external,join(f.deps,'node_modules/pg/escape'),'junction')},'reject')
await probe('hardlinked dependency payload',async f=>{await link(join(f.deps,'node_modules/pg/index.js'),join(f.deps,'node_modules/pg/duplicate.js'))},'reject')
await probe('junction output parent',async f=>{const external=join(f.root,'alternate-output');await mkdir(external);const alias=join(f.root,'alias-output');await symlink(external,alias,'junction');f.paths.publication=join(alias,'publication.json')},'reject')
await probe('evidence changes without new pin',async f=>{f.docs[2].verdict='rejected';await put(f.paths.reviewEvidence,JSON.stringify(f.docs[2]))},'reject')
await probe('existing publication refuses overwrite',async f=>{await put(f.paths.publication,'preserve-me')},'reject')
await probe('output destinations collide',async f=>{f.paths.dependencyArchive=f.paths.sourceArchive},'reject')
await probe('optional absent pg-native peer',async f=>{await put(join(f.deps,'node_modules/pg/package.json'),JSON.stringify({name:'pg',version:'8.23.0',main:'index.js',peerDependencies:{'pg-native':'>=3.0.1'},peerDependenciesMeta:{'pg-native':{optional:true}}}))},'accept')
await Bun.write('C:/Users/nimab/AppData/Local/Temp/hosted-artifact-publisher-qa-01-results.json',JSON.stringify({runtime:Bun.version,rows},null,2)+'\n')
console.log(JSON.stringify({cases:rows.length,failed:rows.filter(r=>!r.pass).map(r=>r.name)}))
```

## Independent supplementary probe

```typescript
import {readFile,writeFile,mkdtemp,mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {createHash} from 'node:crypto'
import {publishHostedSetupArtifact} from 'C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra/tools/staging/hosted-setup-artifact-publisher.ts'
import {materializeHostedSetupArtifact} from 'C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra/tools/staging/hosted-setup-artifact-materialize.ts'
const root='C:/Users/nimab/AppData/Local/Temp/publisher-independent-0NnKa2',sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex'),GIT=Bun.which('git')!
const headDoc=JSON.parse(await readFile(join(root,'head.json'),'utf8')),head=headDoc.head
const base:any={repositoryRoot:join(root,'repo'),dependencyRoot:join(root,'deps'),gitExecutable:GIT,runtimeExecutable:process.execPath,supervisor:join(root,'supervisor.ts'),config:join(root,'fixed.toml'),headEvidence:join(root,'head.json'),checksEvidence:join(root,'checks.json'),reviewEvidence:join(root,'review.json')}
const policy:any={reviewedProductHead:head,requiredChecks:['qa-required'],operatorId:'qa-operator',independentReviewerId:'qa-reviewer',nowMs:headDoc.observedAtMs+30,headEvidenceSha256:sha(await readFile(base.headEvidence)),checksEvidenceSha256:sha(await readFile(base.checksEvidence)),reviewEvidenceSha256:sha(await readFile(base.reviewEvidence)),gitSha256:sha(await readFile(GIT)),runtimeSha256:sha(await readFile(process.execPath)),supervisorSha256:sha(await readFile(base.supervisor)),configSha256:sha(await readFile(base.config))}
const rows:any[]=[]
async function fresh(){const out=await mkdtemp(join(tmpdir(),'publisher-independent-extra-'));return{...base,sourceArchive:join(out,'source.json'),dependencyArchive:join(out,'deps.json'),publication:join(out,'publication.json')}}
for(const[name,change]of [['wrong reviewed head',{reviewedProductHead:'a'.repeat(40)}],['self review',{independentReviewerId:'qa-operator'}],['wrong required checks',{requiredChecks:['absent']}],['wrong supervisor pin',{supervisorSha256:'0'.repeat(64)}],['expired trusted time',{nowMs:headDoc.expiresAtMs}]]as const){let error=null;try{await publishHostedSetupArtifact(await fresh(),{...policy,...change})}catch(e){error=(e as Error).message}rows.push({name,rejected:!!error,error})}
{
 const paths=await fresh(),results=await Promise.allSettled([publishHostedSetupArtifact(paths,policy),publishHostedSetupArtifact(paths,policy)]),successes=results.filter(r=>r.status==='fulfilled')
 rows.push({name:'concurrent same destinations',successes:successes.length,results:results.map(r=>r.status==='fulfilled'?'published':r.reason.message)})
 if(successes.length===1){const result=(successes[0] as PromiseFulfilledResult<any>).value,materialized={publication:paths.publication,sourceArchive:paths.sourceArchive,dependencyArchive:paths.dependencyArchive,sourceRoot:join(join(paths.publication,'..'),'materialized-source'),dependencyRoot:join(join(paths.publication,'..'),'materialized-deps'),runtimeExecutable:paths.runtimeExecutable,supervisor:paths.supervisor,config:paths.config}
 await writeFile(paths.sourceArchive,'tampered')
 let error=null;try{await materializeHostedSetupArtifact(materialized,{publicationSha256:result.publicationSha256,reviewedProductHead:head,operatorId:'qa-operator',independentReviewerId:'qa-reviewer',requiredChecks:['qa-required'],activeCheckoutRoots:[base.repositoryRoot]})}catch(e){error=(e as Error).message}
 rows.push({name:'archive changes after publication pin',rejected:!!error,error})}
}
await writeFile('C:/Users/nimab/AppData/Local/Temp/hosted-artifact-publisher-qa-extra-results.json',JSON.stringify(rows,null,2)+'\n');console.log(JSON.stringify(rows,null,2))
```
