import {expect,test} from 'bun:test'
import {readFileSync} from 'node:fs'
import {readMigrationManifest} from '../../packages/neuvetra-database/src/staging-migrations'

const source=readFileSync('evaluations/research-qa/m78-integrated-fixture.ts','utf8')
const body=source.slice(source.indexOf('export const M78_QA_MIGRATION'),source.indexOf('export function m78QaProcessInput')).replaceAll('export ','')
const javascript=new Bun.Transpiler({loader:'ts'}).transformSync(body)
const baseline='postgres://m63_test_admin@127.0.0.1:55463/m63_integration'
async function probe(receipts:unknown[],occupied=false){
 const manifest=await readMigrationManifest(),events:string[]=[]
 const createPostgresConnection=(url:string)=>{
  const db=new URL(url).pathname
  if(db==='/m78_qa_independent')throw Error('QA_STOP_AFTER_CLONE')
  return {query:async()=>{events.push(db==='/'+'postgres'?'occupied':'receipts');return {rows:db==='/postgres'?(occupied?[{}]:[]):receipts}},exec:async(sql:string)=>{events.push(sql)},close:async()=>{events.push('close:'+db)}}
 }
 const factory=new Function('createPostgresConnection','readMigrationManifest',javascript+';return {createM78QaFixture,m78QaBaseline,validateM78QaManifest}')
 const api=factory(createPostgresConnection,async()=>manifest)
 let error='';try{await api.createM78QaFixture(baseline,'m78_qa_independent')}catch(e){error=String(e)}
 return {events,error,api}
}
test('actual fixture clones only exact reviewed historical prefixes before the clone statement',async()=>{
 const manifest=await readMigrationManifest(),good=manifest.slice(0,23).map(({name,sha256})=>({name,sha256}))
 const bad:any[][]=[good.slice(0,20),[...good,{name:'0024_unknown.sql',sha256:'0'.repeat(64)}],[...good].reverse(),[]]
 for(const index of [0,9,19,20,21,22])for(const field of ['name','sha256']){const rows=structuredClone(good);(rows[index] as any)[field]='altered';bad.push(rows)}
 for(const rows of bad){const result=await probe(rows);expect(result.error).toMatch(/(?:[Ee]xact reviewed|Unreviewed)/);expect(result.events.some(v=>v.startsWith('create database'))).toBe(false);expect(result.events).not.toContain('occupied')}
 for(const length of [21,22,23]){const success=await probe(good.slice(0,length));expect(success.error).toContain('QA_STOP_AFTER_CLONE');expect(success.events.filter(v=>v.startsWith('create database'))).toEqual(['create database m78_qa_independent template m63_integration']);expect(success.events.indexOf('close:/m63_integration')).toBeLessThan(success.events.indexOf('occupied'))}
 const occupied=await probe(good,true);expect(occupied.error).toContain('Occupied QA database');expect(occupied.events.some(v=>v.startsWith('create database'))).toBe(false)
})
test('current manifest gate and local target gate retain narrow refusals',async()=>{
 const manifest=await readMigrationManifest(),{api}=await probe([])
 for(const index of [20,21])for(const field of ['name','sha256']){const rows=structuredClone(manifest);(rows[index] as any)[field]=['wrong'];expect(()=>api.validateM78QaManifest(rows)).toThrow()}
 for(const url of [baseline.replace('127.0.0.1','localhost'),baseline.replace('55463','5432'),baseline+'?sslmode=disable',baseline+'#x',baseline.replace('m63_test_admin@','neuvetra_runtime@'),baseline.replace('m63_test_admin@','m63_test_admin:secret@'),baseline.replace('/m63_integration','/postgres')])expect(()=>api.m78QaBaseline(url)).toThrow()
})
