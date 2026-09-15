import {PGlite} from '../../packages/neuvetra-database/node_modules/@electric-sql/pglite'
import assert from 'node:assert/strict'
import {readFileSync,writeFileSync} from 'node:fs'
const cases=JSON.parse(readFileSync('evaluations/research-qa/m67-accounting-cases.json','utf8'))
const path='packages/neuvetra-database/src/migrations/0013_annual_electricity_worksheet.sql',sql=readFileSync(path,'utf8'),helpers=sql.split('revoke all on function neuvetra.m67_canonical')[0]!
const db=new PGlite();await db.exec('create schema neuvetra;'+helpers)
const results=[]
try{for(const c of cases.accepted_cases){const actual:any=(await db.query('select neuvetra.m67_calculate_months($1::jsonb) result',[JSON.stringify(c.months)])).rows[0];const e=c.expected;assert.deepEqual(actual.result,{quantityKwh:e.quantity_kwh,quantityMwh:e.quantity_mwh,total:{unrounded:e.total_unrounded_kg_co2e,display:e.total_display_kg_co2e,unit:'kg CO2e',rounding:'half_even_4dp'},coverage:e.coverage,months:e.months.map((m:any)=>({month:m.month,quantityKwh:m.quantity_kwh,quantityMwh:m.quantity_mwh,total:m.unrounded_kg_co2e===null?null:{unrounded:m.unrounded_kg_co2e,display:m.display_kg_co2e,unit:'kg CO2e',rounding:'half_even_4dp'}}))},c.id);results.push({id:c.id,exact:actual.result.total.unrounded,display:actual.result.total.display})}}finally{await db.close()}
const hash=(v:string|Uint8Array)=>new Bun.CryptoHasher('sha256').update(v).digest('hex')
const receipt={observedAt:new Date().toISOString(),scope:'Actual migration helper functions loaded into separate in-memory PGlite; no full migration, native driver, persisted lifecycle, role, cloud or browser verification.',results,helperSha256:hash(helpers),migrationSha256:hash(sql),migrationUnchangedDuringRun:hash(readFileSync(path))===hash(sql),casesSha256:hash(readFileSync('evaluations/research-qa/m67-accounting-cases.json'))}
writeFileSync(process.argv[2]??'evaluations/research-qa/m67-accounting-sql-receipt.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt))
