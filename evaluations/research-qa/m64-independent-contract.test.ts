import {describe,expect,test} from "bun:test"
import {calculateWorksheetQuantity,validateWorksheetInput,validateWorksheetReview,M64_LIMITATIONS,M64_METHOD} from "../../packages/neuvetra-database/src/m64"

const cases=await Bun.file(new URL("./m64-accounting-cases.json",import.meta.url)).json()
const input=(quantity:unknown)=>({companyLabel:"Synthetic independent QA",facilityLabel:"Synthetic QA office",quantityKwh:quantity,period:"2023-01",geography:"CAMX",unit:"kWh",idempotencyKey:crypto.randomUUID()})

// Independent rational oracle. Numerator is activity milli-kWh times the pinned integer factor;
// rounding compares distances to adjacent displayed values, separate from product modulo logic.
function oracle(raw:string){
 const [whole,frac=""]=raw.split(".")
 const q=BigInt(whole!)*1000n+BigInt((frac+"000").slice(0,3))
 const n=q*1950402888n
 const digits=n.toString().padStart(14,"0")
 const unrounded=(digits.slice(0,-13)+"."+digits.slice(-13)).replace(/0+$/," ").trim().replace(/\.$/,"")
 const lower=n/1000000000n,upper=lower+1n
 const distanceDown=n-lower*1000000000n,distanceUp=upper*1000000000n-n
 const nearest=distanceDown<distanceUp?lower:distanceUp<distanceDown?upper:lower%2n===0n?lower:upper
 const display=nearest.toString().padStart(5,"0")
 return {unrounded,display:display.slice(0,-4)+"."+display.slice(-4)}
}

describe("M64 independent accounting/shape challenge",()=>{
 test("all public accounting cases agree with independently reconstructed integer totals and ties",()=>{
  for(const c of cases.accepted_cases){
   const expected=oracle(c.input_quantity)
   expect(expected).toEqual({unrounded:c.expected.total_unrounded_kg_co2e,display:c.expected.total_display_kg_co2e})
   expect(calculateWorksheetQuantity(c.input_quantity)).toEqual({quantityKwh:c.expected.quantity_kwh,quantityMwh:c.expected.quantity_mwh,...expected})
  }
  expect(calculateWorksheetQuantity("62500").display).toBe("12190.0180")
  expect(calculateWorksheetQuantity("187500").display).toBe("36570.0542")
 })
 test("novel interior and boundary quantities agree without binary floating-point arithmetic",()=>{
  const quantities=["0.003","0.007","0.999","3.141","17.019","765432.109","999999.997","1000000.000"]
  let seed=84131n
  for(let i=0;i<150;i++){seed=(seed*48271n)%2147483647n;const q=seed%1000000001n;quantities.push(`${q/1000n}.${(q%1000n).toString().padStart(3,"0")}`)}
  for(const raw of quantities) expect(calculateWorksheetQuantity(raw)).toMatchObject(oracle(raw))
 })
 test("missing, non-string, malformed, Unicode, terminal-line and out-of-range quantity input never coerces to zero",()=>{
  for(const c of cases.rejected_quantity_cases ?? cases.rejected_cases ?? []){
   const body=input(c.input_quantity) as Record<string,unknown>
   if(c.quantity_field_present===false)delete body.quantityKwh
   expect(()=>validateWorksheetInput(body,false)).toThrow()
  }
  for(const bad of [undefined,null,false,0,[],{},""," ","0\n","1\r\n","1\u2028","1\u2029","１２","٠","-0","+1","01","1e3","1,000","1.0000","1000000.001","10000000",".5","1.","1 kWh"]){
   expect(()=>validateWorksheetInput(input(bad),false)).toThrow()
  }
  expect(calculateWorksheetQuantity("0")).toEqual({quantityKwh:"0.000",quantityMwh:"0.000000",unrounded:"0",display:"0.0000"})
  expect(calculateWorksheetQuantity("1")).toEqual(calculateWorksheetQuantity("1.000"))
 })
 test("server profile refuses conflicting context and injected actor/result fields",()=>{
  for(const patch of [{unit:"MWh"},{unit:"kwh"},{period:"2024-01"},{period:"2023-02"},{geography:"NWPP"},{geography:null},{synthetic:false},{releaseEligible:true},{factorValue:"195.0294024"},{createdBy:crypto.randomUUID()},{total:{display:"0.0000"}},{quantityKwh:1}]) expect(()=>validateWorksheetInput({...input("1"),...patch},false)).toThrow()
  expect(M64_METHOD.factorValue).toBe("195.0402888")
  expect(M64_METHOD.factorCandidateSha256).toBe(cases.authority.factor_candidate_sha256)
  expect(M64_METHOD.sourceSha256).toBe(cases.authority.workbook_sha256)
  expect(M64_LIMITATIONS).toContain("no_assurance")
 })
 test("review requires the exact limitation set, safe note and explicit saved hash",()=>{
  const review={versionId:crypto.randomUUID(),expectedResultSha256:"a".repeat(64),decision:"accept_bounded_internal_draft",note:null,acknowledgedLimitations:[...M64_LIMITATIONS],idempotencyKey:crypto.randomUUID()}
  expect(()=>validateWorksheetReview(review)).not.toThrow()
  for(const patch of [{acknowledgedLimitations:[]},{acknowledgedLimitations:[...M64_LIMITATIONS,"extra"]},{note:"yes"},{decision:"approve"},{expectedResultSha256:"0"},{reviewerId:crypto.randomUUID()}])expect(()=>validateWorksheetReview({...review,...patch})).toThrow()
  for(const note of ["","  "," unsafe","line\nbreak",null])expect(()=>validateWorksheetReview({...review,decision:"changes_requested",acknowledgedLimitations:[],note})).toThrow()
 })
})
