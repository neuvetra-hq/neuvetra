/**
 * One-time schema-22 to schema-23 hosted upgrade boundary.
 *
 * Importing this module performs no I/O. The paired restore workstream must
 * supply independently reviewed artifact verifiers before this runner can run.
 */
import {open,realpath} from 'node:fs/promises'
import {dirname,isAbsolute,relative,resolve,sep} from 'node:path'
import {fileURLToPath} from 'node:url'
import type {WorkspaceConnection,WorkspaceSql} from '../../packages/neuvetra-database/src/workspace'
import {migratePrivateStaging,pinStagingMigrationManifest} from '../../packages/neuvetra-database/src/staging-migrations'

export const HOSTED_SETUP_PROJECT='icockcoguyadhryzydvl'
export const HOSTED_SETUP_PROFILE='neuvetra.private-synthetic-staging.v1'
export const HOSTED_SETUP_PUBLISHED_BASE='f8bde80515ce69830add7ac543bca96cd49c27ff'
export const HOSTED_SETUP_PRIOR_DEPLOYMENT='75d8ec4b'
export const HOSTED_SETUP_MIGRATION='0023_company_setup.sql'
export const HOSTED_SETUP_FROM_SCHEMA=22
export const HOSTED_SETUP_TO_SCHEMA=23
export const NEW_SETUP_TABLES=[
 'company_setup_changes','company_setup_entities','company_setup_heads','company_setup_locations',
 'company_setup_relationships','company_setup_requests','company_setup_screening','company_setup_versions',
]as const
export const CHANGED_GEOGRAPHY_CONSTRAINTS=[
 'companies.companies_country_code_check','companies.companies_state_code_check',
 'facilities.facilities_country_code_check','facilities.facilities_state_code_check',
]as const
export const EXPECTED_GEOGRAPHY_CONSTRAINT_DEFINITIONS={
 'companies.companies_country_code_check':"CHECK ((country_code ~ '^[A-Z]{2}$'::text))",
 'companies.companies_state_code_check':'CHECK (((length(btrim(state_code)) >= 1) AND (length(btrim(state_code)) <= 100)))',
 'facilities.facilities_country_code_check':"CHECK ((country_code ~ '^[A-Z]{2}$'::text))",
 'facilities.facilities_state_code_check':'CHECK (((length(btrim(state_code)) >= 1) AND (length(btrim(state_code)) <= 100)))',
}as const

const DIGEST=/^[0-9a-f]{64}$/
const NAME=/^[a-z][a-z0-9_]*$/
const REPOSITORY_ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..')
const isDigest=(value:unknown):value is string=>typeof value==='string'&&DIGEST.test(value)
export function check(value:unknown,message='Hosted setup upgrade refused'):asserts value {if(!value)throw Error(message)}
export function canonical(value:unknown):string{
 if(value===null||typeof value!=='object'){const encoded=JSON.stringify(value);check(encoded!==undefined,'Non-JSON value');return encoded}
 if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`
 const object=value as Record<string,unknown>
 return `{${Object.keys(object).sort().map(key=>JSON.stringify(key)+':'+canonical(object[key])).join(',')}}`
}
export const sha256=(value:string|Uint8Array)=>new Bun.CryptoHasher('sha256').update(value).digest('hex')
export const hash=(value:unknown)=>sha256(canonical(value))
/** PostgreSQL jsonb text is hashed as UTF-8 text; never parse numeric values through JavaScript. */
export function hashDatabaseJsonText(value:string){check(typeof value==='string','Database JSON text required');return sha256(value)}

export interface PinnedArtifact {bytes:string;sha256:string}
export interface AcceptedRestoreBinding {
 profile:'neuvetra.hosted-setup.accepted-restore-binding.v1'
 projectRef:typeof HOSTED_SETUP_PROJECT;targetProfile:typeof HOSTED_SETUP_PROFILE;schemaVersion:22
 restoreReceiptSha256:string;restoreReviewSha256:string;fingerprintDerivationSha256:string;fingerprintDerivationReviewSha256:string
 sourceSnapshotSha256:string;sourceArchiveSha256:string;sourceStateSha256:string;restoredStateSha256:string
 expectedDatabaseFingerprintSha256:string;databaseFingerprintIndependentlyDerived:true;exactApplicationPreserved:true;tenantControlsVerified:true
 operatorId:string;independentReviewerId:string;materialFindingsOpen:0
}
export interface ReviewedProductHeadBinding {
 profile:'neuvetra.hosted-setup.reviewed-product-head-binding.v1';projectRef:typeof HOSTED_SETUP_PROJECT
 reviewedProductHead:string;remoteHead:string;requiredChecksPassed:true;publicationReceiptSha256:string;publicationReviewSha256:string
 migrationManifestSha256:string;sourceClosureSha256:string;independentReviewerId:string;materialFindingsOpen:0
}
export interface HeldApplicationWriteGate {
 profile:'neuvetra.hosted-setup.held-write-gate.v1'
 projectRef:typeof HOSTED_SETUP_PROJECT;targetProfile:typeof HOSTED_SETUP_PROFILE
 deployedApplicationCommit:typeof HOSTED_SETUP_PRIOR_DEPLOYMENT;applicationStopped:true;writeGateHeld:true
 stopReceiptSha256:string;stopReviewSha256:string;operatorId:string;independentReviewerId:string;materialFindingsOpen:0
}
export interface HostedSetupUpgradeInput {
 profile:'neuvetra.hosted-setup.upgrade-input.v1';projectRef:typeof HOSTED_SETUP_PROJECT
 targetProfile:typeof HOSTED_SETUP_PROFILE;reviewedProductHead:string
 operatorId:string;restoreReviewerId:string;publicationReviewerId:string;stopReviewerId:string;journalPath:string
 restoreReceipt:PinnedArtifact;restoreReview:PinnedArtifact;fingerprintDerivation:PinnedArtifact;fingerprintDerivationReview:PinnedArtifact
 publicationReceipt:PinnedArtifact;publicationReview:PinnedArtifact;stopReceipt:PinnedArtifact;stopReview:PinnedArtifact
}
export interface DurableJournal {append(value:unknown):Promise<void>;close():Promise<void>}
export interface UpgradeMigration {name:string;sha256:string;sql:string}
export interface UpgradeMigrationResult {schemaVersion:number;migrations:Array<{name:string;sha256:string}>}
export interface ImmutableMigrationSourceBinding {reviewedProductHead:string;migrationManifestSha256:string;sourceClosureSha256:string}
export interface HeldWriteGateCheck {binding:HeldApplicationWriteGate;observeHeld(binding:HeldApplicationWriteGate):Promise<true>|true}
export interface HostedSetupUpgradeDependencies {
 /** No default exists. Integration must validate the concrete paired restore receipt and its independent review. */
 verifyAcceptedRestore(receipt:PinnedArtifact,review:PinnedArtifact,derivation:PinnedArtifact,derivationReview:PinnedArtifact):AcceptedRestoreBinding
 /** No default exists. Integration must validate an exact remote head and its required checks/review. */
 verifyReviewedProductHead(receipt:PinnedArtifact,review:PinnedArtifact):ReviewedProductHeadBinding
 /** Must observe the exact source checkout used at execution, rather than trusting the requested head. */
 currentProductHead():Promise<string>|string
 /** No default exists. Integration must prove the prior deployment is stopped and its write gate stays held. */
 verifyHeldWriteGate(receipt:PinnedArtifact,review:PinnedArtifact):HeldWriteGateCheck
 /**
  * No default exists. Integration must hold executable source bytes immutable
  * while the existing helper rereads and executes the migration manifest.
  */
 withImmutableMigrationSource<T>(binding:ImmutableMigrationSourceBinding,operation:()=>Promise<T>):Promise<T>
 openJournal?(path:string):Promise<DurableJournal>
 /** Must return the source lock's private, complete manifest synchronously. */
 migrationManifest?:()=>UpgradeMigration[]
 /** Return serialized JSON before resolving, so async handoff cannot mutate a shared object. */
 snapshot?:(db:WorkspaceConnection)=>Promise<string>
 /** Must be the source lock's pinned migration, serialized before resolving. */
 migrate?:(db:WorkspaceConnection,projectRef:string)=>Promise<string>
 now?:()=>string
}

type RowFingerprint={name:string;count:number;rowHashes:string[];sha256:string}
type NamedDefinition={table_name:string;name:string;definition:string}
export interface HostedSetupFingerprint {
 profile:'neuvetra.hosted-setup.database-fingerprint.v1';projectRef:string;targetProfile:string;schemaVersion:number
 receipts:Array<{name:string;sha256:string}>;tables:RowFingerprint[]
 catalog:{tables:unknown[];columns:unknown[];constraints:NamedDefinition[];indexes:unknown[];policies:unknown[];triggers:unknown[];functions:unknown[];sequences:unknown[];schema:unknown[];roles:unknown[];memberships:unknown[];defaultAcls:unknown[];dependencies:unknown[]}
}

const SQL={
 tables:"select c.relname name,pg_get_userbyid(c.relowner) owner,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text acl from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra' and c.relkind='r' order by c.relname",
 columns:"select table_name,column_name,ordinal_position,data_type,udt_name,is_nullable,column_default,character_maximum_length,numeric_precision,numeric_scale,datetime_precision from information_schema.columns where table_schema='neuvetra' order by table_name,ordinal_position",
 constraints:"select c.relname table_name,k.conname name,pg_get_constraintdef(k.oid) definition from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra' order by 1,2",
 indexes:"select tablename table_name,indexname name,indexdef definition from pg_indexes where schemaname='neuvetra' order by tablename,indexname",
 policies:"select tablename table_name,policyname name,permissive,roles,cmd,qual,with_check from pg_policies where schemaname='neuvetra' order by tablename,policyname",
 triggers:"select c.relname table_name,t.tgname name,pg_get_triggerdef(t.oid) definition,t.tgenabled enabled from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra' and not t.tgisinternal order by 1,2",
 functions:"select p.oid::regprocedure::text signature,pg_get_userbyid(p.proowner) owner,p.prosecdef,p.proconfig,p.proacl::text acl,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='neuvetra' order by signature",
 sequences:"select c.relname name,pg_get_userbyid(c.relowner) owner,c.relacl::text acl,format_type(s.seqtypid,null) type,s.seqstart::text start,s.seqincrement::text increment,s.seqmax::text maximum,s.seqmin::text minimum,s.seqcache::text cache,s.seqcycle cycle from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_sequence s on s.seqrelid=c.oid where n.nspname='neuvetra' order by c.relname",
 schema:"select nspname,pg_get_userbyid(nspowner) owner,nspacl::text acl from pg_namespace where nspname='neuvetra'",
 roles:"select rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls from pg_roles where rolname !~ '^pg_' order by rolname",
 memberships:"select pg_get_userbyid(roleid) role,pg_get_userbyid(member) member,pg_get_userbyid(grantor) grantor,admin_option,inherit_option,set_option from pg_auth_members order by 1,2,3",
 defaultAcls:"select pg_get_userbyid(d.defaclrole) owner,coalesce(n.nspname,'*') schema,d.defaclobjtype kind,d.defaclacl::text acl from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace order by 1,2,3",
 dependencies:"select distinct rn.nspname schema,rc.relname relation from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace join pg_class rc on rc.oid=k.confrelid join pg_namespace rn on rn.oid=rc.relnamespace where n.nspname='neuvetra' and rn.nspname<>'neuvetra' order by 1,2",
}as const

export async function snapshotHostedSetupDatabase(db:WorkspaceConnection):Promise<HostedSetupFingerprint>{
 return db.transaction(async tx=>{
  await tx.exec('set transaction isolation level repeatable read read only')
  return snapshotHostedSetupDatabaseInTransaction(tx)
 })
}

/** Snapshot an already-open transaction without changing its isolation or read/write mode. */
export async function snapshotHostedSetupDatabaseInTransaction(tx:WorkspaceSql):Promise<HostedSetupFingerprint>{
  await tx.exec("set local timezone='UTC'; set local row_security=off")
  const privilege=(await tx.query<{safe:boolean}>("select (r.rolsuper or r.rolbypassrls) safe from pg_roles r where r.rolname=current_user")).rows
  check(privilege.length===1&&privilege[0]?.safe===true,'Privileged operator snapshot required')
  const target=(await tx.query<{project_ref:string;profile:string}>('select project_ref,profile from neuvetra.staging_target')).rows
  check(target.length===1,'Single staging target required')
  // Match the accepted recovery v2 boundary. Owner-security views, materialized
  // views, foreign/partitioned/inherited relations need a separate access and
  // preservation contract; silently fingerprinting a subset is unsafe.
  const unsupported=(await tx.query<{name:string}>("select c.relname name from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra' and (c.relkind not in ('r','i','S') or c.relispartition or exists(select 1 from pg_inherits h where h.inhrelid=c.oid or h.inhparent=c.oid)) order by c.relname")).rows
  check(unsupported.length===0,'Unsupported view, partition, inheritance or foreign relation')
  const receipts=(await tx.query<{name:string;sha256:string}>('select name,sha256 from neuvetra.schema_migrations order by name')).rows
  const names=(await tx.query<{name:string}>("select c.relname name from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='neuvetra' and c.relkind='r' order by 1")).rows
  check(names.length>0&&names.every(row=>NAME.test(row.name))&&new Set(names.map(row=>row.name)).size===names.length,'Unexpected table name')
  const tables:RowFingerprint[]=[]
  for(const {name}of names){
   const rowHashes=(await tx.query<{value:string}>(`select to_jsonb(t)::text value from neuvetra.${name} t`)).rows.map(row=>hashDatabaseJsonText(row.value)).sort()
   tables.push({name,count:rowHashes.length,rowHashes,sha256:hash(rowHashes)})
  }
  const catalog={}as HostedSetupFingerprint['catalog']
  for(const [key,sql]of Object.entries(SQL)){
   if(key==='sequences')continue
   catalog[key as keyof typeof catalog]=(await tx.query(sql)).rows as never
  }
  const sequenceDefinitions=(await tx.query<{name:string}>(SQL.sequences)).rows
  catalog.sequences=[]
  for(const definition of sequenceDefinitions){
   check(NAME.test(definition.name),'Unexpected sequence name')
   const state=(await tx.query<{last_value:string;is_called:boolean}>(`select last_value::text last_value,is_called from neuvetra.${definition.name}`)).rows
   check(state.length===1&&/^-?[0-9]+$/.test(state[0]!.last_value)&&typeof state[0]!.is_called==='boolean','Unexpected sequence state')
   catalog.sequences.push({...definition,last_value:state[0]!.last_value,is_called:state[0]!.is_called})
  }
  return {profile:'neuvetra.hosted-setup.database-fingerprint.v1',projectRef:target[0]!.project_ref,targetProfile:target[0]!.profile,schemaVersion:receipts.length,receipts,tables,catalog}
}
export const fingerprintSha256=(value:HostedSetupFingerprint)=>hash(value)

function validateArtifact(value:PinnedArtifact,label:string){
 check(value&&typeof value.bytes==='string'&&Buffer.byteLength(value.bytes)>0&&Buffer.byteLength(value.bytes)<=128*1024*1024,label+' bytes')
 check(typeof value.sha256==='string'&&DIGEST.test(value.sha256)&&sha256(value.bytes)===value.sha256,label+' digest')
}
/** Caller-owned objects are captured before the first asynchronous boundary. */
function privateArtifact(value:PinnedArtifact):PinnedArtifact{
 const bytes=value.bytes,claimedSha256=value.sha256
 return Object.freeze({bytes,sha256:claimedSha256})
}
function privateInput(source:HostedSetupUpgradeInput):HostedSetupUpgradeInput{
 const profile=source.profile,projectRef=source.projectRef,targetProfile=source.targetProfile
 const reviewedProductHead=source.reviewedProductHead,operatorId=source.operatorId
 const restoreReviewerId=source.restoreReviewerId,publicationReviewerId=source.publicationReviewerId,stopReviewerId=source.stopReviewerId,journalPath=resolve(source.journalPath)
 const restoreReceipt=privateArtifact(source.restoreReceipt),restoreReview=privateArtifact(source.restoreReview)
 const fingerprintDerivation=privateArtifact(source.fingerprintDerivation),fingerprintDerivationReview=privateArtifact(source.fingerprintDerivationReview)
 const publicationReceipt=privateArtifact(source.publicationReceipt),publicationReview=privateArtifact(source.publicationReview)
 const stopReceipt=privateArtifact(source.stopReceipt),stopReview=privateArtifact(source.stopReview)
 return Object.freeze({profile,projectRef,targetProfile,reviewedProductHead,operatorId,restoreReviewerId,publicationReviewerId,stopReviewerId,journalPath,
  restoreReceipt,restoreReview,fingerprintDerivation,fingerprintDerivationReview,publicationReceipt,publicationReview,stopReceipt,stopReview})
}
function outsideRepository(path:string){
 const child=relative(REPOSITORY_ROOT,path)
 return child==='..'||child.startsWith('..'+sep)||isAbsolute(child)
}
/** Copy every required verifier field before any later callback can alter its result. */
function privateScalars<T extends object>(value:T,fields:ReadonlyArray<keyof T>):T{
 check(value!==null&&typeof value==='object'&&!Array.isArray(value),'Verifier result object required')
 const copy:Record<string,unknown>={}
 for(const field of fields){
  check(Object.prototype.hasOwnProperty.call(value,field),'Verifier result field missing')
  const scalar=value[field]
  check(typeof scalar==='string'||typeof scalar==='number'||typeof scalar==='boolean','Verifier result scalar required')
  copy[String(field)]=scalar
 }
 return Object.freeze(copy) as T
}
const privateRestore=(value:AcceptedRestoreBinding)=>privateScalars(value,[
 'profile','projectRef','targetProfile','schemaVersion','restoreReceiptSha256','restoreReviewSha256',
 'fingerprintDerivationSha256','fingerprintDerivationReviewSha256','sourceSnapshotSha256','sourceArchiveSha256',
 'sourceStateSha256','restoredStateSha256','expectedDatabaseFingerprintSha256','databaseFingerprintIndependentlyDerived',
 'exactApplicationPreserved','tenantControlsVerified','operatorId','independentReviewerId','materialFindingsOpen',
])
const privateProduct=(value:ReviewedProductHeadBinding)=>privateScalars(value,[
 'profile','projectRef','reviewedProductHead','remoteHead','requiredChecksPassed','publicationReceiptSha256',
 'publicationReviewSha256','migrationManifestSha256','sourceClosureSha256','independentReviewerId','materialFindingsOpen',
])
const privateStop=(value:HeldApplicationWriteGate)=>privateScalars(value,[
 'profile','projectRef','targetProfile','deployedApplicationCommit','applicationStopped','writeGateHeld',
 'stopReceiptSha256','stopReviewSha256','operatorId','independentReviewerId','materialFindingsOpen',
])
function privateManifest(value:UpgradeMigration[]):ReadonlyArray<Readonly<UpgradeMigration>>{
 return pinStagingMigrationManifest(value)
}
function privateFingerprint(value:HostedSetupFingerprint):HostedSetupFingerprint{
 return JSON.parse(canonical(value)) as HostedSetupFingerprint
}
function isThenable(value:unknown){return value!==null&&(typeof value==='object'||typeof value==='function')&&typeof (value as Promise<unknown>).then==='function'}
function synchronous<T,R>(value:T,copy:(candidate:T)=>R):R{
 check(!isThenable(value),'Synchronous verifier binding required')
 return copy(value)
}
function parseFingerprint(value:unknown):HostedSetupFingerprint{
 check(typeof value==='string','Serialized database fingerprint required')
 return privateFingerprint(JSON.parse(value) as HostedSetupFingerprint)
}
function parseMigrationResult(value:unknown):UpgradeMigrationResult{
 check(typeof value==='string','Serialized migration result required')
 return JSON.parse(value) as UpgradeMigrationResult
}
async function heldGate(deps:HostedSetupUpgradeDependencies,input:HostedSetupUpgradeInput):Promise<HeldApplicationWriteGate>{
 const candidate=deps.verifyHeldWriteGate(input.stopReceipt,input.stopReview)
 check(candidate!==null&&typeof candidate==='object'&&!isThenable(candidate),'Synchronous write-gate binding required')
 const observeHeld=candidate.observeHeld
 check(typeof observeHeld==='function','Fresh write-gate observer required')
 const binding=synchronous(candidate.binding,privateStop)
 validateWriteGate(binding,input)
 check((await observeHeld(binding))===true,'Fresh write-gate observation refused')
 return binding
}
function validateInput(input:HostedSetupUpgradeInput){
 check(input?.profile==='neuvetra.hosted-setup.upgrade-input.v1'&&input.projectRef===HOSTED_SETUP_PROJECT&&input.targetProfile===HOSTED_SETUP_PROFILE,'Fixed target required')
 check(/^[0-9a-f]{40}$/.test(input.reviewedProductHead),'Exact reviewed product head required')
 check(typeof input.operatorId==='string'&&input.operatorId.trim().length>0,'Operator required')
 check([input.restoreReviewerId,input.publicationReviewerId,input.stopReviewerId].every(id=>typeof id==='string'&&id.trim().length>0&&id!==input.operatorId),'Separate actual reviewer identities required')
 check(isAbsolute(input.journalPath)&&outsideRepository(input.journalPath),'Journal must be outside the repository')
 validateArtifact(input.restoreReceipt,'Restore receipt');validateArtifact(input.restoreReview,'Restore review');validateArtifact(input.fingerprintDerivation,'Fingerprint derivation');validateArtifact(input.fingerprintDerivationReview,'Fingerprint derivation review')
 validateArtifact(input.publicationReceipt,'Publication receipt');validateArtifact(input.publicationReview,'Publication review');validateArtifact(input.stopReceipt,'Stop receipt');validateArtifact(input.stopReview,'Stop review')
}
function validateRestoreBinding(value:AcceptedRestoreBinding,input:HostedSetupUpgradeInput){
 check(value?.profile==='neuvetra.hosted-setup.accepted-restore-binding.v1'&&value.projectRef===HOSTED_SETUP_PROJECT&&value.targetProfile===HOSTED_SETUP_PROFILE&&value.schemaVersion===22,'Accepted schema-22 restore required')
 check(value.restoreReceiptSha256===input.restoreReceipt.sha256&&value.restoreReviewSha256===input.restoreReview.sha256,'Restore artifacts not bound')
 check(value.fingerprintDerivationSha256===input.fingerprintDerivation.sha256&&value.fingerprintDerivationReviewSha256===input.fingerprintDerivationReview.sha256,'Fingerprint derivation not bound')
 check([value.sourceSnapshotSha256,value.sourceArchiveSha256,value.sourceStateSha256,value.restoredStateSha256,value.expectedDatabaseFingerprintSha256].every(isDigest),'Restore source digests required')
 check(value.databaseFingerprintIndependentlyDerived===true&&value.exactApplicationPreserved===true&&value.tenantControlsVerified===true&&value.materialFindingsOpen===0,'Accepted restore preservation required')
 check(value.operatorId===input.operatorId&&value.independentReviewerId===input.restoreReviewerId&&value.operatorId!==value.independentReviewerId,'Restore review identities differ')
}
function validateProductHead(value:ReviewedProductHeadBinding,input:HostedSetupUpgradeInput,currentHead:string){
 check(value?.profile==='neuvetra.hosted-setup.reviewed-product-head-binding.v1'&&value.projectRef===HOSTED_SETUP_PROJECT,'Reviewed publication required')
 check(value.reviewedProductHead===input.reviewedProductHead&&value.remoteHead===input.reviewedProductHead&&currentHead===input.reviewedProductHead,'Current, reviewed and remote heads differ')
 check(value.publicationReceiptSha256===input.publicationReceipt.sha256&&value.publicationReviewSha256===input.publicationReview.sha256&&value.requiredChecksPassed===true,'Publication artifacts not bound')
 check(isDigest(value.migrationManifestSha256)&&isDigest(value.sourceClosureSha256),'Reviewed executable source closure required')
 check(value.independentReviewerId===input.publicationReviewerId&&value.materialFindingsOpen===0,'Publication review not accepted')
}
function validateWriteGate(value:HeldApplicationWriteGate,input:HostedSetupUpgradeInput){
 check(value?.profile==='neuvetra.hosted-setup.held-write-gate.v1'&&value.projectRef===HOSTED_SETUP_PROJECT&&value.targetProfile===HOSTED_SETUP_PROFILE,'Fixed write gate required')
 check(value.deployedApplicationCommit===HOSTED_SETUP_PRIOR_DEPLOYMENT&&value.applicationStopped===true&&value.writeGateHeld===true,'Prior deployment must remain stopped')
 check(value.stopReceiptSha256===input.stopReceipt.sha256&&value.stopReviewSha256===input.stopReview.sha256,'Stop artifacts not bound')
 check(value.operatorId===input.operatorId&&value.independentReviewerId===input.stopReviewerId&&value.materialFindingsOpen===0,'Stop review identities differ')
}
async function validateSchema22(value:HostedSetupFingerprint,manifest:ReadonlyArray<Readonly<UpgradeMigration>>){
 check(manifest.length===HOSTED_SETUP_TO_SCHEMA&&manifest[22]?.name===HOSTED_SETUP_MIGRATION&&isDigest(manifest[22]!.sha256),'Exact schema-23 manifest required')
 check(value.schemaVersion===HOSTED_SETUP_FROM_SCHEMA&&value.projectRef===HOSTED_SETUP_PROJECT&&value.targetProfile===HOSTED_SETUP_PROFILE,'Exact schema-22 target required')
 check(value.receipts.length===22&&value.receipts.every((row,index)=>row.name===manifest[index]?.name&&row.sha256===manifest[index]?.sha256),'Exact schema-22 receipts required')
}

const same=(a:unknown,b:unknown)=>hash(a)===hash(b)
const oldRows=(table:RowFingerprint,after:RowFingerprint)=>{
 const remaining=[...after.rowHashes]
 for(const row of table.rowHashes){const index=remaining.indexOf(row);check(index>=0,'Legacy row missing: '+table.name);remaining.splice(index,1)}
 return remaining
}
const tableName=(value:unknown)=>String((value as Record<string,unknown>).table_name??(value as Record<string,unknown>).tablename??(value as Record<string,unknown>).name??'')
const signature=(value:unknown)=>String((value as Record<string,unknown>).signature??'')
export function verifyPostcommitPreservation(before:HostedSetupFingerprint,after:HostedSetupFingerprint,manifest:ReadonlyArray<Readonly<UpgradeMigration>>){
 check(after.projectRef===before.projectRef&&after.targetProfile===before.targetProfile&&after.schemaVersion===23,'Schema-23 target observation required')
 check(after.receipts.length===23&&after.receipts.every((row,index)=>row.name===manifest[index]?.name&&row.sha256===manifest[index]?.sha256),'Exact schema-23 receipts required')
 const oldNames=new Set(before.tables.map(table=>table.name)),newNames=after.tables.filter(table=>!oldNames.has(table.name)).map(table=>table.name).sort()
 check(same(newNames,[...NEW_SETUP_TABLES].sort()),'Unexpected additive tables')
 for(const table of before.tables){
  const current=after.tables.find(candidate=>candidate.name===table.name);check(current,'Legacy table missing: '+table.name)
  const additions=oldRows(table,current)
  check(table.name==='schema_migrations'?current.count===table.count+1&&additions.length===1:current.count===table.count&&additions.length===0,'Legacy rows changed: '+table.name)
 }
 for(const name of NEW_SETUP_TABLES){const table=after.tables.find(candidate=>candidate.name===name);check(table?.count===0,'New setup table not empty: '+name)}
 for(const key of ['tables','columns','indexes','policies','triggers']as const){
  const retained=after.catalog[key].filter(row=>oldNames.has(tableName(row)))
  check(same(before.catalog[key],retained),'Legacy '+key+' changed')
 }
 const allowed=new Set<string>(CHANGED_GEOGRAPHY_CONSTRAINTS)
 const beforeConstraints=before.catalog.constraints.filter(row=>!allowed.has(`${row.table_name}.${row.name}`))
 const afterConstraints=after.catalog.constraints.filter(row=>oldNames.has(row.table_name)&&!allowed.has(`${row.table_name}.${row.name}`))
 check(same(beforeConstraints,afterConstraints),'Legacy constraints changed outside geography allowance')
 for(const key of CHANGED_GEOGRAPHY_CONSTRAINTS){
  const [table,name]=key.split('.')as[string,string],previous=before.catalog.constraints.find(row=>row.table_name===table&&row.name===name),current=after.catalog.constraints.find(row=>row.table_name===table&&row.name===name)
  check(previous&&current&&!same(previous,current)&&current.definition===EXPECTED_GEOGRAPHY_CONSTRAINT_DEFINITIONS[key],'Expected geography constraint delta missing: '+key)
 }
 const oldFunctions=new Set(before.catalog.functions.map(signature));check(same(before.catalog.functions,after.catalog.functions.filter(row=>oldFunctions.has(signature(row)))),'Legacy functions changed')
 const oldSequences=new Set(before.catalog.sequences.map(row=>String((row as Record<string,unknown>).name)));check(same(before.catalog.sequences,after.catalog.sequences.filter(row=>oldSequences.has(String((row as Record<string,unknown>).name)))),'Legacy sequences changed')
 for(const key of ['schema','roles','memberships','defaultAcls','dependencies']as const)check(same(before.catalog[key],after.catalog[key]),key+' changed')
}

export async function migrateHostedSetupDatabase(db:WorkspaceConnection,projectRef:string){
 return migratePrivateStaging(db,{expectedProjectRef:projectRef,syntheticTargetConfirmed:true,reuseExistingProject:true})
}
export async function exclusiveUpgradeJournal(path:string):Promise<DurableJournal>{
 check(isAbsolute(path)&&outsideRepository(path),'Journal must be outside the repository')
 const parent=await realpath(dirname(path))
 check(outsideRepository(parent),'Journal parent resolves inside the repository')
 const file=await open(path,'wx',0o600);let sequence=0,previousSha256:string|null=null
 return {append:async data=>{const body={profile:'neuvetra.hosted-setup.upgrade-journal.v1',sequence:++sequence,previousSha256,data},sha=hash(body);await file.writeFile(JSON.stringify({...body,sha256:sha})+'\n');await file.sync();previousSha256=sha},close:()=>file.close()}
}

export async function runHostedSetupUpgrade(db:WorkspaceConnection,sourceInput:HostedSetupUpgradeInput,sourceDeps:HostedSetupUpgradeDependencies){
 const input=privateInput(sourceInput),deps=Object.freeze({...sourceDeps})
 validateInput(input)
 const restore=synchronous(deps.verifyAcceptedRestore(input.restoreReceipt,input.restoreReview,input.fingerprintDerivation,input.fingerprintDerivationReview),privateRestore);validateRestoreBinding(restore,input)
 const product=synchronous(deps.verifyReviewedProductHead(input.publicationReceipt,input.publicationReview),privateProduct),currentHead=await deps.currentProductHead();validateProductHead(product,input,currentHead)
 const stop=await heldGate(deps,input)
 check(typeof deps.migrationManifest==='function'&&typeof deps.migrate==='function','Pinned migration source integration required')
 const manifest=synchronous(deps.migrationManifest(),privateManifest),manifestSha256=hash(manifest),snapshot=deps.snapshot??(async(connection:WorkspaceConnection)=>canonical(await snapshotHostedSetupDatabase(connection))),migrate=deps.migrate
 check(product.migrationManifestSha256===manifestSha256,'Reviewed migration manifest bytes changed')
 const journal=await(deps.openJournal??exclusiveUpgradeJournal)(input.journalPath);let migrationAttempted=false,migrationReturned=false
 const now=deps.now??(()=>new Date().toISOString())
 try{
  await journal.append({status:'hosted_setup_upgrade_reserved',createdAt:now(),projectRef:HOSTED_SETUP_PROJECT,reviewedProductHead:input.reviewedProductHead,priorDeployment:HOSTED_SETUP_PRIOR_DEPLOYMENT,migrationManifestSha256:manifestSha256,sourceClosureSha256:product.sourceClosureSha256,publicationReceiptSha256:product.publicationReceiptSha256,publicationReviewSha256:product.publicationReviewSha256,restoreReceiptSha256:restore.restoreReceiptSha256,restoreReviewSha256:restore.restoreReviewSha256,fingerprintDerivationSha256:restore.fingerprintDerivationSha256,fingerprintDerivationReviewSha256:restore.fingerprintDerivationReviewSha256,sourceSnapshotSha256:restore.sourceSnapshotSha256,sourceArchiveSha256:restore.sourceArchiveSha256,sourceStateSha256:restore.sourceStateSha256,restoredStateSha256:restore.restoredStateSha256,stopReceiptSha256:stop.stopReceiptSha256,stopReviewSha256:stop.stopReviewSha256})
  const before=parseFingerprint(await snapshot(db));await validateSchema22(before,manifest)
  check(fingerprintSha256(before)===restore.expectedDatabaseFingerprintSha256,'Restored schema-22 fingerprint changed')
  await journal.append({status:'hosted_setup_schema22_preflight_passed',createdAt:now(),databaseFingerprintSha256:fingerprintSha256(before),migrationSha256:manifest[22]!.sha256,writeGateHeld:true})
  const beforeMigrationStop=await heldGate(deps,input);check(hash(beforeMigrationStop)===hash(stop),'Write gate binding changed before migration')
  const sourceBinding={reviewedProductHead:input.reviewedProductHead,migrationManifestSha256:manifestSha256,sourceClosureSha256:product.sourceClosureSha256}
  let immutableOperationEntered=false
  const encodedResult=await deps.withImmutableMigrationSource(sourceBinding,()=>{check(!immutableOperationEntered,'Migration operation may run once');immutableOperationEntered=true;migrationAttempted=true;return migrate(db,HOSTED_SETUP_PROJECT)});migrationReturned=true
  const result=parseMigrationResult(encodedResult)
  check(result.schemaVersion===23&&result.migrations.length===23&&result.migrations[22]?.name===HOSTED_SETUP_MIGRATION&&result.migrations[22]?.sha256===manifest[22]!.sha256,'Migration result mismatch')
  const after=parseFingerprint(await snapshot(db));verifyPostcommitPreservation(before,after,manifest)
  const postcommitStop=await heldGate(deps,input);check(hash(postcommitStop)===hash(stop),'Write gate binding changed during migration')
  const receipt={status:'hosted_setup_schema23_committed_and_observed' as const,createdAt:now(),projectRef:HOSTED_SETUP_PROJECT,reviewedProductHead:input.reviewedProductHead,priorDeployment:HOSTED_SETUP_PRIOR_DEPLOYMENT,schemaVersion:23,migrationSha256:manifest[22]!.sha256,sourceSnapshotSha256:restore.sourceSnapshotSha256,sourceArchiveSha256:restore.sourceArchiveSha256,sourceStateSha256:restore.sourceStateSha256,restoredStateSha256:restore.restoredStateSha256,beforeFingerprintSha256:fingerprintSha256(before),afterFingerprintSha256:fingerprintSha256(after),legacyRowsPreserved:true,legacyCatalogPreservedExceptFourGeographyConstraints:true,newSetupTablesEmpty:true,writeGateHeld:true}
  await journal.append(receipt);return receipt
 }catch{
  const status=migrationReturned?'hosted_setup_postcommit_reconciliation_required_do_not_retry':migrationAttempted?'hosted_setup_commit_outcome_unknown_do_not_retry':'hosted_setup_upgrade_refused_no_retry_on_this_journal'
  try{await journal.append({status,createdAt:now(),projectRef:HOSTED_SETUP_PROJECT,writeGateMustRemainHeld:true})}catch{/* The already-synced reservation/preflight remains durable evidence. */}
  throw Error(status)
 }finally{try{await journal.close()}catch{/* Every event is synced before append returns; close cannot authorize replay. */}}
}
