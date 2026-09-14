import { M64_UUID, m64Hash } from "./m64"
import { M66_SOURCE_PROFILE, M66_MAX_SOURCE_BYTES, type ElectricitySource, type ElectricitySourceList } from "./m66-contract"
import { M66_SOURCE_FIXTURES } from "./m66-fixtures"
interface Sql { query<T=Record<string,unknown>>(sql:string,params?:unknown[]):Promise<{rows:T[]}> }
export class ElectricitySourceValidationError extends Error {}
export function validateElectricitySourceUpload(name:string,type:string,bytes:Uint8Array,key:string) {
 const sha256=new Bun.CryptoHasher("sha256").update(bytes).digest("hex")
 const fixture=M66_SOURCE_FIXTURES.find(f=>f.sha256===sha256&&f.originalName===name&&f.byteLength===bytes.byteLength)
 if(!M64_UUID.test(key)||type!=="application/pdf"||bytes.byteLength>M66_MAX_SOURCE_BYTES||!fixture)throw new ElectricitySourceValidationError("Choose a supported fictional bill PDF.")
 return fixture
}
export function electricitySourceIdentity(s:ElectricitySource) { return m64Hash([M66_SOURCE_PROFILE,s.id,s.companyId,s.fixtureId,s.originalName,s.mediaType,String(s.byteLength),s.sha256,s.printedQuantityKwh,s.uploadedBy,s.uploadedAt].join("\n")) }
export async function readElectricitySources(tx:Sql,companyId:string):Promise<{list:ElectricitySourceList;bytes:Map<string,Uint8Array>}|null> {
 const gate=await tx.query<{allowed:boolean}>("select neuvetra.lock_source_worksheet_report_read($1) allowed",[companyId]);if(!gate.rows[0]?.allowed)return null
 const rows=await tx.query<{id:string;company_id:string;fixture_id:string;original_name:string;media_type:"application/pdf";byte_length:number;sha256:string;printed_quantity_kwh:string;uploaded_by:string;uploaded_at:string;original_bytes:Uint8Array;identity_sha256:string}>("select * from neuvetra.electricity_sources where company_id=$1 order by uploaded_at,id",[companyId])
 const audits=await tx.query<{source_id:string;actor_id:string;identity_sha256:string;created_at:string}>("select * from neuvetra.electricity_source_audit where company_id=$1",[companyId])
 const sources:ElectricitySource[]=[],bytes=new Map<string,Uint8Array>(),fail=()=>{throw new Error("Retained source could not be verified.")}
 if(rows.rows.length!==audits.rows.length)return fail()
 for(const row of rows.rows){
  const source:ElectricitySource={id:row.id,companyId:row.company_id,fixtureId:row.fixture_id,originalName:row.original_name,mediaType:row.media_type,byteLength:row.byte_length,sha256:row.sha256,printedQuantityKwh:row.printed_quantity_kwh,uploadedBy:row.uploaded_by,uploadedAt:new Date(row.uploaded_at).toISOString()}
  let fixture;try{fixture=validateElectricitySourceUpload(source.originalName,source.mediaType,row.original_bytes,source.id)}catch{return fail()}
  if(!M64_UUID.test(source.uploadedBy)||source.companyId!==companyId||source.fixtureId!==fixture.fixtureId||source.sha256!==fixture.sha256||source.byteLength!==fixture.byteLength||source.printedQuantityKwh!==fixture.printedQuantityKwh||row.identity_sha256!==electricitySourceIdentity(source))return fail()
  const audit=audits.rows.filter(a=>a.source_id===source.id)
  if(audit.length!==1||audit[0]!.actor_id!==source.uploadedBy||audit[0]!.identity_sha256!==row.identity_sha256||new Date(audit[0]!.created_at).toISOString()!==source.uploadedAt)return fail()
  sources.push(source);bytes.set(source.id,row.original_bytes)
 }
 return {list:{profile:M66_SOURCE_PROFILE,companyId,sources},bytes}
}
