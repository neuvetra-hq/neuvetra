import {expect,test} from 'bun:test'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {readMigrationManifest} from '../../packages/neuvetra-database/src/staging-migrations'
import {readBetaAccessBaselineManifest,installBetaAccess} from '../../packages/neuvetra-database/src/beta-access-migrations'

const files=['packages/neuvetra-database/src/beta-access-migrations.ts','tools/beta-access/local-rehearsal.ts']
const hashes=()=>Object.fromEntries(files.map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')]))
test('independent frozen beta baseline selection and installer refusal boundary',async()=>{
 const before=hashes(),manifest=await readMigrationManifest(),baseline=await readBetaAccessBaselineManifest()
 expect(manifest).toHaveLength(23);expect(baseline).toEqual(manifest.slice(0,22));expect(baseline.some(v=>v.name==='0023_company_setup.sql')).toBeFalse()
 // Execute the exact source function with injected manifest input, without globally mocking imports.
 const source=readFileSync(files[0]!,'utf8'),start=source.indexOf('export async function readBetaAccessBaselineManifest() {'),end=source.indexOf('\nconst safeName',start)
 expect(start).toBeGreaterThan(0);expect(end).toBeGreaterThan(start)
 const evaluate=new Function('readMigrationManifest',source.slice(start,end).replace('export async function','return async function'))
 const select=(input:any[])=>evaluate(async()=>input)()
 expect(await select(manifest.slice(0,22))).toEqual(baseline)
 expect(await select([...manifest,{name:'0024_future.sql',sql:'synthetic',sha256:'a'.repeat(64)}])).toEqual(baseline)
 for(const input of [manifest.slice(0,21),...([20,21].flatMap(index=>['name','sha256'].map(field=>manifest.map((v,i)=>i===index?{...v,[field]:field==='name'?'0099_changed.sql':'0'.repeat(64)}:v))))])await expect(select(input)).rejects.toThrow('Exact schema 22 source baseline required.')
 const approval={databaseName:'m80_beta_access_qa_ci_repair',runtimeRole:'m80_beta_access_runtime_qa_ci_repair',ownerRole:'m80_beta_access_owner_qa_ci_repair',fixtureManifestSha256:'a'.repeat(64),syntheticTargetConfirmed:true as const}
 async function installWith(receipts:any[]){let writes=0;const db:any={transaction:async(fn:any)=>fn({query:async(sql:string)=>{if(sql.includes('pg_advisory_xact_lock'))return{rows:[]};if(sql.includes('current_database()'))return{rows:[{database_name:approval.databaseName,current_user:'synthetic_qa_operator'}]};if(sql==='select name,sha256 from neuvetra.schema_migrations order by name')return{rows:receipts};throw Error('QA_REACHED_ROLE_VALIDATION')},exec:async()=>{writes++;throw Error('Unexpected DDL')}})};let result='unexpected success';try{await installBetaAccess(db,approval)}catch(error){result=(error as Error).message}expect(writes).toBe(0);return result}
 expect(await installWith(baseline)).toBe('QA_REACHED_ROLE_VALIDATION')
 for(const receipts of [manifest,baseline.slice(0,21),baseline.map((v,i)=>i===0?{...v,sha256:'0'.repeat(64)}:v),baseline.map((v,i)=>i===21?{...v,sha256:'0'.repeat(64)}:v),[...baseline].reverse()])expect(await installWith(receipts)).toBe('Unknown or changed schema 22 baseline.')
 const rehearsal=readFileSync(files[1]!,'utf8');expect(rehearsal).toContain('const expected = await readBetaAccessBaselineManifest()');expect(rehearsal).toContain('for (const migration of expected)')
 expect(hashes()).toEqual(before)
 await Bun.write('evaluations/research-qa/hosted-setup-01-beta-ci-repair-result.json',JSON.stringify({verdict:'pass_bounded_local',sourceHashes:before,sourceHashesAfter:hashes(),checks:['Actual current23 manifest yields exact22 baseline without migration23','Exact helper source rejects missing21/22 and changed21/22 names or SHA pins; later appended migrations do not enter historical baseline','Actual installer with transaction test double rejects schema23,short,reordered or altered receipts before DDL, including changed first migration; valid22 reaches role validation','Rehearsal source applies only selected expected baseline'],limitations:['Manifest selector is tested through actual import and injected exact source for negatives','Installer refusal uses a transaction test double, not native installation','Full beta rehearsal on historical port55472 not run; remote native CI remains required','No provider or Git actions']},null,2))
})
