import {expect,test} from "bun:test"
import {createM71Seed} from "../../packages/neuvetra-database/src/m71-contract"
import {parseM71Json,validateM71Snapshot} from "../../packages/neuvetra-database/src/m71-validation"

test("COV06 duplicate keys cannot hide behind JSON escapes or nested records",()=>{
 for(const text of ['{"actor":1,"actor":2}','{"actor":1,"\\u0061ctor":2}','{"nested":{"id":"a","id":"b"}}','[{"x":null,"x":false}]'])expect(()=>parseM71Json(text)).toThrow()
 expect(parseM71Json('{"value":"literal \\\"id\\\": ","id":1}')).toEqual({value:'literal "id": ',id:1})
})
test("COV06 primitive types remain exact through the snapshot validation boundary",()=>{
 for(const collection of ["entities","facilities"] as const)for(const field of ["countryCode","regionCode"] as const){
  const seed:any=createM71Seed();seed[collection][0][field]=[field==="countryCode"?"US":"CA"]
  expect(()=>{validateM71Snapshot(seed)},collection+"."+field).toThrow()
 }
})
test("COV06 valid Unicode normalizes while lone surrogates and control characters are refused",()=>{
 const valid=createM71Seed();valid.companyLabel="  Cafe\u0301 \u{1f331}  ";expect(validateM71Snapshot(valid).companyLabel).toBe("Café 🌱")
 for(const value of ["bad\ud800","bad\udfff","bad\u0000","bad\u001f"]){const invalid=createM71Seed();invalid.companyLabel=value;expect(()=>validateM71Snapshot(invalid)).toThrow()}
})
