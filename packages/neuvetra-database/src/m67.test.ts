import { expect, test } from "bun:test"
import { DevelopmentWorkspaceDatabase } from "./workspace"
import { calculateAnnualMonths, M67_MONTHS, M67_LIMITATIONS, validateAnnualWorksheetInput } from "./m67"
import { buildAnnualWorksheetReport } from "./m67-report"

test("M67 exact annual aggregation keeps missingness and never sums monthly rounded displays",()=>{
 const months=M67_MONTHS.map(month=>({month,quantityKwh:"0.001"}))
 const v=calculateAnnualMonths(months)
 expect(v.total).toEqual({unrounded:"0.0023404834656",display:"0.0023",unit:"kg CO2e",rounding:"half_even_4dp"})
 expect(v.months.every(m=>m.total?.display==="0.0002")).toBe(true)
 expect(v.coverage.electricityComplete).toBe(true)
 const partial=calculateAnnualMonths(months.map((m,i)=>({...m,quantityKwh:i?null:"0"})))
 expect(partial.total.unrounded).toBe("0");expect(partial.coverage.knownMonths).toBe(1);expect(partial.coverage.electricityComplete).toBe(false)
 expect(()=>calculateAnnualMonths(months.map(m=>({...m,quantityKwh:null})))).toThrow()
 const max=calculateAnnualMonths(months.map(m=>({...m,quantityKwh:"999999.999"})))
 expect(max.quantityKwh).toBe("11999999.988");expect(max.total.unrounded).toBe("2340483.4632595165344")
})

test("M67 independent cases persist with identical SQL and runtime hashes and complete script-free reports",async()=>{
 const owner=crypto.randomUUID(),manager=crypto.randomUUID(),db=await DevelopmentWorkspaceDatabase.create([owner,manager])
 try{
  const company=await db.createWorkspaceWithSyntheticMembers(owner,{companyName:"Synthetic Acme, Inc.",facilityName:"Synthetic California office",countryCode:"US",stateCode:"CA",egridSubregion:"CAMX",approach:"operational_control",reportingYear:2023},[{userId:manager,role:"admin"}])
  const cases=await Bun.file(new URL("../../../evaluations/research-qa/m67-accounting-cases.json",import.meta.url)).json()
  let previous:any
  for(const c of cases.accepted_cases){
   const input={companyLabel:"Synthetic <script>alert(1)</script>",facilityLabel:"Synthetic office",year:2023 as const,geography:"CAMX" as const,unit:"kWh" as const,months:c.months,idempotencyKey:crypto.randomUUID(),...(previous?{expectedVersionId:previous.id,expectedResultSha256:previous.resultSha256,correctionReason:c.id}:{})}
   previous=(await db.saveAnnualElectricityWorksheet(owner,company.id,input,!!previous)).versions.slice(-1)[0]!
   expect(previous.quantityKwh).toBe(c.expected.quantity_kwh);expect(previous.quantityMwh).toBe(c.expected.quantity_mwh)
   expect(previous.total.unrounded).toBe(c.expected.total_unrounded_kg_co2e);expect(previous.total.display).toBe(c.expected.total_display_kg_co2e);expect(previous.coverage).toEqual(c.expected.coverage)
   const report=await db.createAnnualWorksheetReport(owner,company.id,{sourceVersionId:previous.id,expectedInputSha256:previous.inputSha256,expectedResultSha256:previous.resultSha256,expectedReviewId:null,expectedReviewSha256:null,idempotencyKey:crypto.randomUUID()})
   const built=buildAnnualWorksheetReport({id:report.id,companyId:company.id,source:report.source,createdAt:report.createdAt,createdBy:report.createdBy}),html=new TextDecoder().decode(built.bytes)
   expect(built.reportSha256).toBe(report.reportSha256);expect(html).not.toContain("<script>");expect(html).toContain("&lt;script&gt;");expect(html).not.toMatch(/\{\{[a-zA-Z0-9]+\}\}/)
   expect(report.complete).toBe(false);expect(report.releaseEligible).toBe(false)
  }
  const review=await db.reviewAnnualElectricityWorksheet(manager,company.id,{versionId:previous.id,expectedResultSha256:previous.resultSha256,decision:"accept_bounded_internal_draft",note:null,acknowledgedLimitations:[...M67_LIMITATIONS],idempotencyKey:crypto.randomUUID()})
  expect(review.versions.slice(-1)[0]!.review?.reviewerId).toBe(manager)
  expect((await db.findAnnualWorksheetReports(owner,company.id))!.reports).toHaveLength(12)
 }finally{await db.close()}
},30000)

test("M67 API input refuses inherited bill identity, incomplete month arrays and all-null drafts",()=>{
 const base={companyLabel:"Synthetic",facilityLabel:"Office",year:2023,geography:"CAMX",unit:"kWh",months:M67_MONTHS.map((month,i)=>({month,quantityKwh:i?null:"0"})),idempotencyKey:crypto.randomUUID()}
 expect(()=>validateAnnualWorksheetInput(base,false)).not.toThrow()
 for(const changed of [{...base,sourceId:crypto.randomUUID()},{...base,review:{}},{...base,months:base.months.slice(1)},{...base,months:base.months.map(m=>({...m,quantityKwh:null}))},{...base,months:base.months.map((m,i)=>i?m:{...m,quantityKwh:"1e3"})}])expect(()=>validateAnnualWorksheetInput(changed,false)).toThrow()
})
