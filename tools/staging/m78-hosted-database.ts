/** Explicit hosted operator controls. Importing this module performs no I/O. */
import {open,readFile} from 'node:fs/promises'
import {resolve,dirname,relative} from 'node:path'
import type {WorkspaceConnection,WorkspaceSql} from '../../packages/neuvetra-database/src/workspace'
import {auditLegacyStagingExposure} from '../../packages/neuvetra-database/src/staging-audit'
import {connectOperator,operatorUrl} from './m77-common'
import {canonicalReceipts,inventory,content,sameExactInventory,sameUpgradeInventory,sameContent,validateInventory,validateContent,runtimeSafe,lockedTables,check,digest,sha,hash,PROJECT,REVIEWED_MIGRATION_SHA256,PATH_FUNCTIONS,NEW_TABLES,type Inventory,type Content} from './m78-inventory'
import {verifyNewPrivileges} from './m78-upgrade'
import {restoreLocalBundle} from './m78-restore'
import type {Bundle} from './m78-backup'

export const HOSTED_PROFILE='neuvetra.m78.hosted-application-snapshot.v1' as const
export const EXCLUSION='Application recovery only; Auth UUID stubs and auth.uid definition are dependencies. Provider Auth accounts, credentials, sessions, configuration, storage and provider-wide recovery are excluded.'
/** Snapshot archives can exceed the browser parser's10MB limit; duplicate keys remain forbidden. */
export function parseOperatorJson(text:string,maxBytes:number):unknown{
 check(Number.isInteger(maxBytes)&&maxBytes>0&&maxBytes<=256*1024*1024&&new TextEncoder().encode(text).length<=maxBytes,'Operator JSON capacity exceeded');let i=0;
 const whitespace=()=>{while(i<text.length&&/[ \t\r\n]/.test(text[i]!))i++};
 const string=()=>{const begin=i++;while(i<text.length){if(text[i]==='\\'){i+=2;continue}if(text[i++]==='"')return JSON.parse(text.slice(begin,i))as string}throw Error('Invalid operator JSON')};
 const scan=(depth:number)=>{check(depth<=80,'Operator JSON depth exceeded');whitespace();if(text[i]==='{'){i++;const keys=new Set<string>();whitespace();if(text[i]==='}'){i++;return}while(i<text.length){whitespace();check(text[i]==='"','Invalid operator JSON');const key=string();check(!keys.has(key),'Duplicate operator JSON key');keys.add(key);whitespace();check(text[i++]===':','Invalid operator JSON');scan(depth+1);whitespace();const end=text[i++];if(end==='}')return;check(end===',','Invalid operator JSON')}}else if(text[i]==='['){i++;whitespace();if(text[i]===']'){i++;return}while(i<text.length){scan(depth+1);whitespace();const end=text[i++];if(end===']')return;check(end===',','Invalid operator JSON')}}else if(text[i]==='"'){string()}else{const begin=i;while(i<text.length&&!/[ \t\r\n,}\]]/.test(text[i]!))i++;check(i>begin,'Invalid operator JSON');JSON.parse(text.slice(begin,i))}};
 scan(0);whitespace();check(i===text.length,'Invalid operator JSON');return JSON.parse(text);
}
export interface HostedSnapshot extends Omit<Bundle,'profile'> {profile:typeof HOSTED_PROFILE;source:{transport:'fixed-project-operator-verify-full';database:'postgres';providerRecoveryExcluded:true}}
export interface ArtifactPin {path:string;sha256:string}
export interface HostedGate {
 profile:'neuvetra.m78.hosted-database-gate.v1';project:string;createdAt:string;operatorId:string;independentReviewerId:string;
 reviewedCommit:string;headObservedCommit:string;headObservedAt:string;requiredChecksCommit:string;requiredChecksPassed:true;requiredCheckNames:string[];checksObservedAt:string;
 maintenanceConfirmed:true;maintenanceObservedAt:string;providerRecoveryExclusionAccepted:true;migrationSha256:string;
 sourcePins:ArtifactPin[];codeReview:ArtifactPin;checksReceipt:ArtifactPin;backup:ArtifactPin;restore:ArtifactPin;recovery:ArtifactPin;forwardRecovery:ArtifactPin;
}
export type HostedArtifacts=Record<'codeReview'|'checksReceipt'|'backup'|'restore'|'recovery'|'forwardRecovery',any>
export const REQUIRED_SOURCE_ROOTS=['tools/staging/m78-hosted-database.ts','tools/staging/m78-hosted-database.test.ts','tools/staging/m78-inventory.ts','tools/staging/m78-upgrade.ts','tools/staging/m78-restore.ts','tools/staging/m77-seal-backup.ps1','tools/cloud/fixtures/supabase-prod-ca-2021.crt','bun.lock']as const;
/** Pin every relative project import, the encryption/CA inputs and the full migration corpus. */
export async function hostedSourcePins():Promise<ArtifactPin[]>{
 const root=resolve('.'),paths=new Set<string>(REQUIRED_SOURCE_ROOTS),todo:string[]=[...REQUIRED_SOURCE_ROOTS].filter(p=>p.endsWith('.ts'));
 while(todo.length){const current=todo.pop()!,text=await readFile(current,'utf8'),imports=[...text.matchAll(/\b(?:from\s*|import\s*\(\s*|import\s*)['"]([^'"]+)['"]/g)].map(m=>m[1]!).filter(p=>p.startsWith('.'));
  for(const dependency of imports){const base=resolve(dirname(current),dependency);let found:string|undefined;for(const candidate of [base,base+'.ts',base+'.tsx',resolve(base,'index.ts')]){try{await readFile(candidate);found=candidate;break}catch{}}
   check(found,'Relative operator dependency unresolved');const path=relative(root,found).replaceAll('\\','/');check(!path.startsWith('../')&&!path.startsWith('/'),'Operator dependency outside project');if(!paths.has(path)){paths.add(path);if(/\.tsx?$/.test(path))todo.push(path)}
  }
 }
 const manifest=await canonicalMigrationPaths();for(const path of manifest)paths.add(path);
 return Promise.all([...paths].sort().map(async path=>({path,sha256:sha(new Uint8Array(await readFile(path)))})));
}
async function canonicalMigrationPaths(){const {manifest21}=await import('./m78-inventory');return(await manifest21()).map(m=>'packages/neuvetra-database/src/migrations/'+m.name)}
function boundedReplay(value:any,families:readonly string[]){
 check(value&&value.fullHistoricalSemanticReplay===false&&Array.isArray(value.families)&&value.families.length===families.length&&new Set(value.families.map((f:any)=>f.family)).size===families.length,'Bounded semantic replay scope required');
 for(const family of families){const f=value.families.find((f:any)=>f.family===family);check(f&&Array.isArray(f.versionIds)&&f.versionIds.length>0&&f.versionIds.length<=200&&Array.isArray(f.reportIds)&&f.reportIds.length>0&&f.reportIds.length<=200&&[...f.versionIds,...f.reportIds].every(id=>typeof id==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id))&&new Set(f.versionIds).size===f.versionIds.length&&new Set(f.reportIds).size===f.reportIds.length&&Number.isSafeInteger(f.authorizedGetRequests)&&f.authorizedGetRequests>=f.versionIds.length+f.reportIds.length&&Number.isSafeInteger(f.exactDownloadRequests)&&f.exactDownloadRequests>=f.reportIds.length&&f.semanticAndDownloadVerification===true,'Missing bounded family replay IDs/counters');}
}
const timestamp=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(v)?Date.parse(v):NaN
const identity=(v:unknown)=>typeof v==='string'&&v.trim()===v&&v.length>0&&v.length<=160&&!/[\x00-\x1f\x7f]/.test(v)
const fresh=(v:unknown,now:number,age:number)=>Number.isFinite(timestamp(v))&&timestamp(v)<=now&&now-timestamp(v)<age
export function validateHostedGate(g:HostedGate,a:HostedArtifacts,now=Date.now()){
 check(g?.profile==='neuvetra.m78.hosted-database-gate.v1'&&g.project===PROJECT&&digest(REVIEWED_MIGRATION_SHA256)&&g.migrationSha256===REVIEWED_MIGRATION_SHA256,'Unreviewed hosted migration');
 check(identity(g.operatorId)&&identity(g.independentReviewerId)&&g.operatorId!==g.independentReviewerId,'Distinct operator and reviewer required');
 check(/^[a-f0-9]{40}$/.test(g.reviewedCommit)&&g.headObservedCommit===g.reviewedCommit&&g.requiredChecksCommit===g.reviewedCommit&&g.requiredChecksPassed===true,'Exact reviewed commit and checks required');
 check(fresh(g.createdAt,now,4*3600000)&&fresh(g.headObservedAt,now,900000)&&fresh(g.checksObservedAt,now,4*3600000)&&g.maintenanceConfirmed===true&&fresh(g.maintenanceObservedAt,now,900000)&&g.providerRecoveryExclusionAccepted===true,'Fresh maintenance/head/checks gate required');
 check(timestamp(g.createdAt)>=timestamp(g.maintenanceObservedAt)&&timestamp(g.createdAt)>=timestamp(g.headObservedAt)&&timestamp(g.createdAt)>=timestamp(g.checksObservedAt),'Gate predates observations');
 for(const key of ['codeReview','checksReceipt','backup','restore','recovery','forwardRecovery']as const){check(g[key]&&typeof g[key].path==='string'&&digest(g[key].sha256));check(a[key]&&fresh(a[key].createdAt,now,4*3600000)&&timestamp(g.createdAt)>=timestamp(a[key].createdAt),'Artifact missing, future or stale');}
 check(Array.isArray(g.sourcePins)&&g.sourcePins.length>=4&&new Set(g.sourcePins.map(p=>p.path)).size===g.sourcePins.length&&g.sourcePins.every(p=>typeof p.path==='string'&&digest(p.sha256)),'Exact source pin map required');
 for(const path of [...REQUIRED_SOURCE_ROOTS,'packages/neuvetra-database/src/migrations/0021_scope1_inventory.sql'])check(g.sourcePins.some(p=>p.path===path),'Missing consequential source pin');
 const {codeReview:c,checksReceipt:k,backup:b,restore:r,recovery:v,forwardRecovery:f}=a;
 check(c.status==='m78_independent_hosted_database_review_passed'&&c.project===PROJECT&&c.reviewerId===g.independentReviewerId&&c.operatorId===g.operatorId&&c.reviewedCommit===g.reviewedCommit&&c.migrationSha256===g.migrationSha256&&hash(c.sourcePins)===hash(g.sourcePins)&&hash(c.requiredCheckNames)===hash(g.requiredCheckNames),'Independent exact code review required');
 check(Array.isArray(g.requiredCheckNames)&&g.requiredCheckNames.length>0&&g.requiredCheckNames.every(identity)&&new Set(g.requiredCheckNames).size===g.requiredCheckNames.length,'Required check names missing');
 check(k.status==='m78_required_checks_passed'&&k.project===PROJECT&&k.commit===g.reviewedCommit&&k.allRequiredChecksPassed===true&&Array.isArray(k.checks)&&k.checks.every((x:any)=>typeof x.name==='string'&&x.conclusion==='success')&&new Set(k.checks.map((x:any)=>x.name)).size===k.checks.length&&hash([...g.requiredCheckNames].sort())===hash(k.checks.map((x:any)=>x.name).sort()),'Required checks receipt required');
 check(b.status==='m78_hosted_encrypted_application_backup'&&b.profile===HOSTED_PROFILE&&b.project===PROJECT&&b.schemaVersion===20&&[b.archiveSha256,b.snapshotSha256,b.dumpSha256].every(digest),'Hosted encrypted schema20 backup required');
 check(r.status==='m78_hosted_snapshot_restored_locally'&&r.sourceProfile===HOSTED_PROFILE&&r.project===PROJECT&&r.schemaVersion===20&&r.port===55472&&/^m78_(ops|qa)_[a-z0-9_]+$/.test(r.database)&&r.archiveSha256===b.archiveSha256&&r.snapshotSha256===b.snapshotSha256&&r.dumpSha256===b.dumpSha256&&r.sourceBackupCreatedAt===b.createdAt&&r.exactApplicationVerified===true&&r.globalRolesUnchanged===true&&r.runtimeNoClaimDenied===true&&r.runtimeActorRead===true&&r.providerRecoveryExcluded===true,'Exact actual archive restore required');
 sameExactInventory(b.inventory,r.inventory);sameContent(b.content,r.content);check(b.inventory.tables.length===113&&b.inventory.tables.find((t:any)=>t.name==='schema_migrations')?.count===20&&b.content.schemaVersion===20);
 check(v.status==='m78_independent_actual_backup_recovery_passed'&&v.reviewerId===g.independentReviewerId&&v.project===PROJECT&&v.database===r.database&&v.schemaVersion===20&&v.archiveSha256===b.archiveSha256&&v.snapshotSha256===b.snapshotSha256&&v.restoreReceiptSha256===g.restore.sha256&&v.actualArchiveRestoreVerified===true&&v.completeApplicationBytesAndCatalogVerified===true&&v.boundedSemanticReplayVerified===true&&v.noMutationVerified===true&&v.providerRecoveryExcluded===true,'Independent actual backup recovery required');
 boundedReplay(v.semanticReplay,['legacy_electricity','corporate','natural_gas','mobile_diesel','fleet','stationary_diesel','stationary','fugitive']);
 check(v.priorAcceptedClosure&&typeof v.priorAcceptedClosure.artifact?.path==='string'&&digest(v.priorAcceptedClosure.artifact.sha256)&&v.priorAcceptedClosure.currentCompleteContentSha256===b.content.sha256&&v.priorAcceptedClosure.preservationVerified===true,'Prior accepted closure and current complete-byte binding required');
 sameExactInventory(r.inventory,v.inventory);sameContent(r.content,v.content);
 check(f.status==='m78_independent_occupied21_forward_recovery_passed'&&f.reviewerId===g.independentReviewerId&&f.project===PROJECT&&f.schemaVersion===21&&f.migrationSha256===g.migrationSha256&&f.hostedEvidence===false&&f.occupiedTargetRefused===true&&f.freshCloneRestored===true&&f.processAndInventoryHistoryVerified===true&&f.capturedNullReviewsVerified===true&&f.correctionsAndContributorsVerified===true&&f.completeApplicationBytesAndCatalogVerified===true&&f.noMutationVerified===true&&f.providerRecoveryExcluded===true,'Independent occupied21 forward recovery required');
 boundedReplay(f.semanticReplay,['process_screen','inventory']);
 sameExactInventory(f.sourceInventory,f.restoredInventory);sameContent(f.sourceContent,f.restoredContent);check(f.sourceContent.schemaVersion===21);
 check(f.sourceInventory.tables.length===121&&f.sourceInventory.tables.find((t:any)=>t.name==='schema_migrations')?.count===21,'Schema21 forward inventory required');for(const table of NEW_TABLES)check(f.sourceInventory.tables.some((t:any)=>t.name===table),'Forward table inventory missing');
 for(const table of NEW_TABLES.filter(t=>t!=='scope1_process_discoveries'))check(f.sourceInventory.tables.find((t:any)=>t.name===table)?.count>0,'Occupied forward table empty');
 for(const table of ['scope1_versions','scope1_reviews','scope1_reports','scope1_statements','scope1_requests','scope1_audit'])check(f.sourceContent.entries.some((e:any)=>e.table===table),'Populated forward history missing');
 check(timestamp(r.createdAt)>=timestamp(b.createdAt)&&timestamp(v.createdAt)>=timestamp(r.createdAt),'Recovery precedes backup');
 return {inventory:b.inventory as Inventory,content:b.content as Content};
}
export function pinnedReceipt(bytes:string,key:keyof HostedArtifacts){
 if(key!=='backup'&&key!=='restore')return parseOperatorJson(bytes,32*1024*1024);
 const lines=bytes.trimEnd().split('\n');
 // Backup/restore receipts are the original durable two-event files, not rewritten terminal copies.
 check((key==='backup'||key==='restore')&&lines.length===2,'Unclosed or unexpected artifact journal');
 const start=parseOperatorJson(lines[0]!,32*1024*1024)as any,outcome=parseOperatorJson(lines[1]!,32*1024*1024)as any;
 check(start.status===(key==='backup'?'m78_hosted_backup_started':'m78_hosted_restore_started')&&start.project===PROJECT&&outcome.project===PROJECT&&timestamp(start.createdAt)<=timestamp(outcome.createdAt),'Artifact attempt ordering changed');
 if(key==='restore')check(start.archiveSha256===outcome.archiveSha256&&start.snapshotSha256===outcome.snapshotSha256&&start.database===outcome.database,'Restore attempt identity changed');
 return outcome;
}
export async function loadHostedArtifacts(g:HostedGate,read:(path:string)=>Promise<Uint8Array>=readFile){
 const a={}as HostedArtifacts;
 for(const key of ['codeReview','checksReceipt','backup','restore','recovery','forwardRecovery']as const){const bytes=await read(g[key].path);check(sha(bytes)===g[key].sha256,'Artifact bytes changed');a[key]=pinnedReceipt(new TextDecoder('utf-8',{fatal:true}).decode(bytes),key)}
 for(const p of g.sourcePins)check(sha(await read(p.path))===p.sha256,'Reviewed source bytes changed');
 const prior=a.recovery.priorAcceptedClosure?.artifact;if(prior)check(typeof prior.path==='string'&&digest(prior.sha256)&&sha(await read(prior.path))===prior.sha256,'Prior accepted closure bytes changed');
 return a;
}
/** pg_dump receives the explicit stdin credential only in its child environment. */
export function hostedOperatorUrl(raw:string){check(typeof raw==='string'&&raw===raw.trim()&&!new URL(raw).search,'Operator URL options forbidden');return operatorUrl(raw)}
export function hostedDumpEnvironment(raw:string){const u=hostedOperatorUrl(raw);return {PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,TEMP:process.env.TEMP,TMP:process.env.TMP,PGHOST:u.hostname,PGPORT:u.port,PGDATABASE:'postgres',PGUSER:decodeURIComponent(u.username),PGPASSWORD:decodeURIComponent(u.password),PGSSLMODE:'verify-full',PGSSLROOTCERT:resolve('tools/cloud/fixtures/supabase-prod-ca-2021.crt'),PGCONNECT_TIMEOUT:'15'}}
async function assertHosted(tx:WorkspaceSql){check((await tx.query<{name:string;actor:string}>('select current_database() name,current_user actor')).rows.some(r=>r.name==='postgres'&&r.actor==='postgres'),'Hosted operator database required')}
export async function createHostedSnapshot(db:WorkspaceConnection,pgDump:string,rawOperatorUrl:string):Promise<HostedSnapshot>{
 const env=hostedDumpEnvironment(rawOperatorUrl);
 return db.transaction(async tx=>{
  await tx.exec('set transaction isolation level repeatable read read only');await assertHosted(tx);await canonicalReceipts(tx,20);await runtimeSafe(tx);
  const snapshot=(await tx.query<{snapshot:string}>('select pg_export_snapshot() snapshot')).rows[0]!.snapshot,before=await inventory(tx),bytes=await content(tx,20);
  check(before.dependencies.every(d=>d.schema==='auth'&&d.relation==='users'),'External dependency unsupported');
  const refs=(await tx.query<{table_name:string;column_name:string}>("select c.relname table_name,a.attname column_name from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attnum=k.conkey[1] where n.nspname='neuvetra'and k.contype='f'and k.confrelid='auth.users'::regclass and cardinality(k.conkey)=1 order by 1,2")).rows;
  check(refs.length>0&&refs.every(r=>/^[a-z][a-z0-9_]*$/.test(r.table_name)&&/^[a-z][a-z0-9_]*$/.test(r.column_name)));
  const subjects=(await tx.query<{id:string}>('select distinct id from ('+refs.map(r=>`select ${r.column_name} id from neuvetra.${r.table_name}`).join(' union all ')+')u where id is not null order by id')).rows.map(r=>r.id),uid=(await tx.query<{definition:string}>("select pg_get_functiondef('auth.uid()'::regprocedure) definition")).rows[0]!.definition;
  const child=Bun.spawn([pgDump,'--format=custom','--no-password','--schema=neuvetra','--snapshot='+snapshot],{env,stdout:'pipe',stderr:'pipe'});
  const [dump,,code]=await Promise.all([new Response(child.stdout).arrayBuffer(),new Response(child.stderr).text(),child.exited]);check(code===0&&dump.byteLength>16,'Application dump failed');sameExactInventory(before,await inventory(tx));
  return {profile:HOSTED_PROFILE,source:{transport:'fixed-project-operator-verify-full',database:'postgres',providerRecoveryExcluded:true},project:PROJECT,createdAt:new Date().toISOString(),schemaVersion:20,migrationSha256:null,inventory:before,content:bytes,dependencies:{authUserIds:subjects,authUidDefinition:uid,providerRecovery:EXCLUSION},dumpSha256:sha(new Uint8Array(dump)),dumpBase64:Buffer.from(dump).toString('base64')};
 });
}
export function localRestorePayload(snapshot:HostedSnapshot,expectedSnapshotSha256:string):Bundle{
 check(sha(JSON.stringify(snapshot))===expectedSnapshotSha256&&snapshot.profile===HOSTED_PROFILE&&snapshot.project===PROJECT&&snapshot.schemaVersion===20&&snapshot.migrationSha256===null&&snapshot.source.transport==='fixed-project-operator-verify-full'&&snapshot.source.database==='postgres'&&snapshot.source.providerRecoveryExcluded===true,'Hosted snapshot provenance changed');
 validateInventory(snapshot.inventory);validateContent(snapshot.content);check(snapshot.content.schemaVersion===20&&snapshot.inventory.tables.length===113);
 check(snapshot.dependencies.providerRecovery===EXCLUSION&&sha(Buffer.from(snapshot.dumpBase64,'base64'))===snapshot.dumpSha256,'Snapshot dump or exclusion changed');
 const {source:_source,profile:_profile,...application}=snapshot;return {...application,profile:'neuvetra.m78.local-application-bundle.v1'};
}
export async function restoreHostedSnapshot(snapshot:HostedSnapshot,expectedSnapshotSha256:string,archiveSha256:string,pgRestore:string,database:string,localReceiptPath:string){
 check(digest(archiveSha256));const payload=localRestorePayload(snapshot,expectedSnapshotSha256),transferBundleSha256=sha(JSON.stringify(payload)),r=await restoreLocalBundle(payload,transferBundleSha256,pgRestore,database,localReceiptPath);
 return {...r,status:'m78_hosted_snapshot_restored_locally',sourceProfile:HOSTED_PROFILE,archiveSha256,snapshotSha256:expectedSnapshotSha256,transferBundleSha256,providerRecoveryExcluded:true};
}
async function literalOutputs(tx:WorkspaceSql){const values:Record<string,string>={};for(const f of PATH_FUNCTIONS.filter(s=>!s.includes('reject_inventory_history_mutation')))values[f]=(await tx.query<{value:string}>(`select ${f}::text value`)).rows[0]!.value;return values}
export async function applyHosted21(tx:WorkspaceSql,g:HostedGate,a:HostedArtifacts){
 const baseline=validateHostedGate(g,a);check(hash(g.sourcePins)===hash(await hostedSourcePins()),'Complete transitive source pin closure changed');await assertHosted(tx);await tx.query('select pg_advisory_xact_lock(630010)');await lockedTables(tx);
 // A receipt for21 is never treated as permission to repeat this20→21 operation.
 const manifest=await canonicalReceipts(tx,20);check(manifest[20]!.sha256===g.migrationSha256);await runtimeSafe(tx);check((await auditLegacyStagingExposure(tx)).legacyContainmentVerified);
 const before=await inventory(tx),beforeContent=await content(tx,20),outputs=await literalOutputs(tx);sameExactInventory(baseline.inventory,before);sameContent(baseline.content,beforeContent);
 await tx.exec(manifest[20]!.sql);await tx.query('insert into neuvetra.schema_migrations(name,sha256)values($1,$2)',[manifest[20]!.name,manifest[20]!.sha256]);
 await canonicalReceipts(tx,21);await runtimeSafe(tx);await verifyNewPrivileges(tx);check(hash(outputs)===hash(await literalOutputs(tx)));check((await auditLegacyStagingExposure(tx)).legacyContainmentVerified);
 const after=await inventory(tx),afterContent=await content(tx,21);sameUpgradeInventory(before,after);sameContent(beforeContent,afterContent,true);return {before,after,beforeContent,afterContent};
}
export interface DurableWriter {append(value:unknown):Promise<void>;close():Promise<void>}
export async function exclusiveJournal(path:string):Promise<DurableWriter>{const f=await open(path,'wx',0o600);return {append:async value=>{await f.writeFile(JSON.stringify(value)+'\n');await f.sync()},close:()=>f.close()}}
/** Injectable journal/transaction boundaries exercise unknown COMMIT and durable receipt failures. */
export async function upgradeHosted(db:WorkspaceConnection,g:HostedGate,a:HostedArtifacts,journal:DurableWriter,apply=applyHosted21){
 validateHostedGate(g,a);let commitAttempted=false,committed=false;
 try{
  await journal.append({status:'m78_hosted_upgrade_started_verify_before_retry',createdAt:new Date().toISOString(),project:PROJECT,migrationSha256:g.migrationSha256,reviewedCommit:g.reviewedCommit,gateSha256:hash(g)});
  const result=await db.transaction(async tx=>{const result=await apply(tx,g,a);commitAttempted=true;return result});committed=true;
  const receipt={status:'m78_hosted_migration_committed',createdAt:new Date().toISOString(),project:PROJECT,schemaVersion:21,migrationSha256:g.migrationSha256,reviewedCommit:g.reviewedCommit,gateSha256:hash(g),archiveSha256:a.backup.archiveSha256,oldRowsAndContentPreserved:true,oldCatalogPreservedExceptSixSearchPaths:true,globalRolesUnchanged:true,providerRecoveryExcluded:true,...result};await journal.append(receipt);return receipt;
 }catch{
  const status=committed?'m78_hosted_committed_receipt_failed_do_not_reapply':commitAttempted?'m78_hosted_commit_unknown_verify_before_retry':'m78_hosted_upgrade_refused_verify_before_retry';try{await journal.append({status,project:PROJECT})}catch{/* Durable started record is preserved. */}throw Error(status);
 }finally{await journal.close()}
}
async function decryptArchive(path:string){const command="Add-Type -AssemblyName System.Security; $p=[Console]::In.ReadToEnd(); $b=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($p),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Text.Encoding]::UTF8.GetString($b))";const child=Bun.spawn(['powershell.exe','-NoProfile','-NonInteractive','-Command',command],{stdin:'pipe',stdout:'pipe',stderr:'pipe'});await child.stdin.write(resolve(path));await child.stdin.end();const [text,,code]=await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text(),child.exited]);check(code===0,'Archive unprotect failed');return parseOperatorJson(text,256*1024*1024)as HostedSnapshot}
async function main(){let db:WorkspaceConnection|undefined,journal:DurableWriter|undefined,stage='configuration';try{
 const [mode,...args]=process.argv.slice(2);
 if(mode==='pins'){console.log(JSON.stringify(await hostedSourcePins(),null,2));return}
 if(mode==='upgrade'){
  const [gatePath,journalPath]=args;check(gatePath&&journalPath);const gate=parseOperatorJson(await readFile(gatePath,'utf8'),2*1024*1024)as HostedGate;check(hash(gate.sourcePins)===hash(await hostedSourcePins()),'Complete transitive source pin closure changed');const artifacts=await loadHostedArtifacts(gate);validateHostedGate(gate,artifacts);
  const input=parseOperatorJson(await Bun.stdin.text(),65536)as any;check(Object.keys(input).sort().join(',')==='operatorDatabaseUrl,operatorId'&&input.operatorId===gate.operatorId);hostedDumpEnvironment(input.operatorDatabaseUrl);
  stage='connect';db=await connectOperator(input.operatorDatabaseUrl);journal=await exclusiveJournal(journalPath);stage='locked_upgrade';const upgradeJournal=journal;journal=undefined;await upgradeHosted(db,gate,artifacts,upgradeJournal);
 }else if(mode==='backup'){
  const [pgDump,archive,journalPath]=args;check(pgDump&&archive&&journalPath&&!await Bun.file(archive).exists());const input=parseOperatorJson(await Bun.stdin.text(),65536)as any;check(Object.keys(input).sort().join(',')==='operatorDatabaseUrl,operatorId'&&identity(input.operatorId));hostedDumpEnvironment(input.operatorDatabaseUrl);
  journal=await exclusiveJournal(journalPath);await journal.append({status:'m78_hosted_backup_started',project:PROJECT,createdAt:new Date().toISOString(),operatorId:input.operatorId});stage='connect';db=await connectOperator(input.operatorDatabaseUrl);stage='snapshot_dump';const snapshot=await createHostedSnapshot(db,pgDump,input.operatorDatabaseUrl),snapshotBytes=JSON.stringify(snapshot);
  stage='encrypt';const child=Bun.spawn(['powershell.exe','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',resolve('tools/staging/m77-seal-backup.ps1'),'-ArchivePath',resolve(archive)],{stdin:'pipe',stdout:'pipe',stderr:'pipe'});await child.stdin.write(snapshotBytes);await child.stdin.end();const [sealed,,code]=await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text(),child.exited]);check(code===0&&JSON.parse(sealed).status==='m77_bundle_sealed');
  await journal.append({status:'m78_hosted_encrypted_application_backup',profile:HOSTED_PROFILE,createdAt:snapshot.createdAt,project:PROJECT,schemaVersion:20,archiveSha256:sha(new Uint8Array(await Bun.file(archive).arrayBuffer())),snapshotSha256:sha(snapshotBytes),dumpSha256:snapshot.dumpSha256,inventory:snapshot.inventory,content:snapshot.content,protection:'DPAPI CurrentUser',providerRecoveryExcluded:true});
 }else if(mode==='restore'){
  const [archive,archiveHash,snapshotHash,pgRestore,database,localReceipt,journalPath]=args;check(archive&&digest(archiveHash)&&digest(snapshotHash)&&pgRestore&&database&&localReceipt&&journalPath);check(sha(new Uint8Array(await Bun.file(archive).arrayBuffer()))===archiveHash,'Encrypted archive bytes changed');
  journal=await exclusiveJournal(journalPath);await journal.append({status:'m78_hosted_restore_started',createdAt:new Date().toISOString(),project:PROJECT,archiveSha256:archiveHash,snapshotSha256:snapshotHash,database});stage='unprotect';const snapshot=await decryptArchive(archive);stage='fresh_local_restore';await journal.append(await restoreHostedSnapshot(snapshot,snapshotHash,archiveHash,pgRestore,database,localReceipt));
 }else throw Error('Explicit backup, restore or upgrade mode required');
 console.log(JSON.stringify({status:'m78_hosted_database_operation_completed',mode}));
 }catch{try{await journal?.append({status:'m78_hosted_database_operation_failed_verify_before_retry',stage,project:PROJECT})}catch{}console.error(JSON.stringify({status:'m78_hosted_database_operation_failed_verify_before_retry',stage}));process.exitCode=1}finally{await journal?.close();await db?.close()}}
if(import.meta.main)await main()
