import {readFile} from 'node:fs/promises';
import {m74Export} from '../../packages/neuvetra-database/src/m74-validation';
import {m75Export} from '../../packages/neuvetra-database/src/m75-validation';
import {m76Export} from '../../packages/neuvetra-database/src/m76-validation';

const ARCHIVES=['.superpowers/m75-hosted-journey.jsonl','.superpowers/m76-hosted-journey.jsonl','.superpowers/m76-hosted-continuation.jsonl'] as const;
const sha=(value:string|Uint8Array)=>new Bun.CryptoHasher('sha256').update(value).digest('hex');
const encoded=(value:string)=>({sha256:sha(value),byteLength:new TextEncoder().encode(value).length});
const lines=async(path:string)=>(await readFile(path,'utf8')).trim().split('\n').map(line=>JSON.parse(line));
const check:(value:unknown,message:string)=>asserts value=(value,message)=>{if(!value)throw Error(message)};

export async function loadM78ReadonlyFailure2Fixture(){
 const continuation=await lines('.superpowers/m78-hosted-continuation4.jsonl');
 const baseline=continuation.find(row=>row.kind==='baseline')?.data;check(baseline,'missing exact continuation4 baseline');
 const candidates=new Map<string,{path:string;response:any}[]>();
 for(const path of ARCHIVES)for(const row of await lines(path)){const response=row.data?.response;if(row.kind==='post_outcome'&&typeof response?.html==='string'&&typeof response?.snapshotJson==='string'){const values=candidates.get(response.id)??[];values.push({path,response});candidates.set(response.id,values)}}
 const reports=new Map<string,{path:string;response:any}>();
 for(const family of ['fleet','equipment'] as const)for(const meta of baseline.registers[family].reports){const values=candidates.get(meta.id)??[],exact=values.filter(({response})=>sha(response.html)===meta.htmlSha256&&encoded(response.html).byteLength===meta.htmlByteLength&&sha(response.snapshotJson)===meta.snapshotSha256);check(exact.length>0,'missing exact archived full report '+meta.id);check(new Set(exact.map(({response})=>sha(response.html)+':'+sha(response.snapshotJson))).size===1,'conflicting exact archived report '+meta.id);reports.set(meta.id,exact[0]!)}
 return{baseline,reports,archives:[...ARCHIVES]};
}

/** Reconstructs only byte-backed baseline downloads. Proof payloads were not
 * archived, so their already-verified baseline digests remain opaque pins. */
export function buildM78ReadonlyFailure2FixtureDownloads(baseline:any,reports:Map<string,{path:string;response:any}>){
 const downloads:Record<string,Record<string,unknown>>={mobile:{},fleet:{},equipment:{}};
 const put=(family:string,key:string,value:unknown)=>downloads[family]![key]=value;
 for(const worksheet of baseline.registers.mobile.worksheets){for(const version of worksheet.versions){put('mobile','version_'+version.id,encoded(m74Export(version)));if(version.fuelStatement)put('mobile','fuel_'+version.fuelStatement.id,encoded(version.fuelStatement.text));if(version.mileageStatement)put('mobile','mileage_'+version.mileageStatement.id,encoded(version.mileageStatement.text))}for(const report of worksheet.reports)put('mobile','report_'+report.id,encoded(report.html))}
 for(const [family,exporter] of [['fleet',m75Export],['equipment',m76Export]] as const){for(const version of baseline.registers[family].versions){put(family,'version_'+version.id,encoded(exporter(version as never)));if(version.statement)put(family,'statement_'+version.statement.id,encoded(version.statement.text))}for(const meta of baseline.registers[family].reports){const report=reports.get(meta.id)?.response;check(report,'missing selected report '+meta.id);put(family,'report_'+meta.id,encoded(report.html));put(family,'snapshot_'+meta.id,encoded(report.snapshotJson));put(family,'proof_'+meta.id,baseline.downloads[family]['proof_'+meta.id])}}
 return downloads;
}
