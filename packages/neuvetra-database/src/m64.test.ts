import { afterAll, beforeAll, expect, test } from "bun:test"
import { DevelopmentWorkspaceDatabase } from "./workspace"
import { calculateWorksheetQuantity, M64_LIMITATIONS, type WorksheetInput, type WorksheetCorrection } from "./m64"
const cases = await Bun.file(new URL("../../../evaluations/research-qa/m64-accounting-cases.json",import.meta.url)).json()
const owner=crypto.randomUUID(),admin=crypto.randomUUID(),member=crypto.randomUUID(),other=crypto.randomUUID()
let db:DevelopmentWorkspaceDatabase, company:string
const input = (quantityKwh="12345"):WorksheetInput => ({ companyLabel:"Fictional Cedar Ltd",facilityLabel:"Fictional Oakland office",quantityKwh,period:"2023-01",geography:"CAMX",unit:"kWh",idempotencyKey:crypto.randomUUID() })
beforeAll(async()=>{
 db=await DevelopmentWorkspaceDatabase.create([owner,admin,member,other])
 const workspace=await db.createWorkspaceWithSyntheticMembers(owner,{companyName:"Synthetic Acme, Inc.",facilityName:"Synthetic California office",countryCode:"US",stateCode:"CA",egridSubregion:"CAMX",reportingYear:2023,approach:"operational_control"},[{userId:admin,role:"admin"},{userId:member,role:"member"}])
 company=workspace.id
},30000)
afterAll(async()=>db?.close())
test("approved exact arithmetic, full-string input rejection and half-even ties",()=>{
 expect(calculateWorksheetQuantity("62500").display).toBe("12190.0180")
 expect(calculateWorksheetQuantity("187500").display).toBe("36570.0542")
 expect(calculateWorksheetQuantity("1000000").unrounded).toBe("195040.2888")
 for(const raw of ["", "-0", "00", "1.0000", "1\n", "1e2", "1000000.001", "١", " 1", "1 "]) expect(()=>calculateWorksheetQuantity(raw)).toThrow()
 for(const c of cases.accepted_cases) {
  const actual=calculateWorksheetQuantity(c.input_quantity)
  expect(actual).toEqual({quantityKwh:c.expected.quantity_kwh,quantityMwh:c.expected.quantity_mwh,unrounded:c.expected.total_unrounded_kg_co2e,display:c.expected.total_display_kg_co2e})
 }
})
test("immutable versions, exact review, changed canonical quantity, duplicate convergence and tenant refusal",async()=>{
 const initial=input()
 const first=await db.saveElectricityWorksheet(owner,company,initial)
 const v1=first.versions[0]!
 expect(v1.total.unrounded).toBe("2407.772365236")
 expect((await db.saveElectricityWorksheet(owner,company,{...initial,quantityKwh:"12345.000"})).versions.length).toBe(1)
 await expect(db.saveElectricityWorksheet(member,company,input("1"))).rejects.toThrow()
 expect(await db.findElectricityWorksheet(other,company)).toBeNull()
 expect((await db.findElectricityWorksheet(member,company))?.versions).toEqual(first.versions)
 const review={versionId:v1.id,expectedResultSha256:v1.resultSha256,decision:"accept_bounded_internal_draft" as const,note:null,acknowledgedLimitations:[...M64_LIMITATIONS],idempotencyKey:crypto.randomUUID()}
 await expect(db.reviewElectricityWorksheet(owner,company,review)).rejects.toThrow()
 const accepted=await db.reviewElectricityWorksheet(admin,company,review)
 expect(accepted.versions[0]!.review?.reviewerId).toBe(admin)
 const correction:WorksheetCorrection={...input("12346"),expectedVersionId:v1.id,expectedResultSha256:v1.resultSha256,correctionReason:"Corrected fictional meter transcription"}
 const results=await Promise.all([db.saveElectricityWorksheet(owner,company,correction,true),db.saveElectricityWorksheet(owner,company,{...correction,idempotencyKey:crypto.randomUUID()},true)])
 expect(results[0]!.versions[1]!.id).toBe(results[1]!.versions[1]!.id)
 expect(results[0]!.versions[1]!.review).toBeNull()
 expect(results[0]!.versions[0]!.review).toEqual(accepted.versions[0]!.review)
 expect(results[0]!.versions[1]!.total.unrounded).toBe("2407.9674055248")
 await expect(db.saveElectricityWorksheet(owner,company,{...correction,quantityKwh:"0",idempotencyKey:crypto.randomUUID()},true)).rejects.toThrow()
 const v2=results[0]!.versions[1]!
 await expect(db.saveElectricityWorksheet(owner,company,{...correction,expectedVersionId:v2.id,expectedResultSha256:v2.resultSha256,quantityKwh:"12346.000",idempotencyKey:crypto.randomUUID()},true)).rejects.toThrow()
 const zero=await db.saveElectricityWorksheet(owner,company,{...correction,expectedVersionId:v2.id,expectedResultSha256:v2.resultSha256,quantityKwh:"0",idempotencyKey:crypto.randomUUID()},true)
 expect(zero.versions[2]!.total).toEqual({unrounded:"0",display:"0.0000",unit:"kg CO2e",rounding:"half_even_4dp"})
})


test("every independent accounting quantity survives SQL persistence and exact readback",async()=>{
 const target=(await db.createWorkspace(other,{companyName:"Synthetic Acme, Inc.",facilityName:"Synthetic California office",countryCode:"US",stateCode:"CA",egridSubregion:"CAMX",reportingYear:2023,approach:"operational_control"})).id
 let current:Awaited<ReturnType<typeof db.saveElectricityWorksheet>>|undefined
 for(const c of cases.accepted_cases) {
  const prior=current?.versions[current.versions.length-1]
  if(!prior) current=await db.saveElectricityWorksheet(other,target,input(c.input_quantity))
  else if(prior.quantityKwh!==c.expected.quantity_kwh) current=await db.saveElectricityWorksheet(other,target,{...input(c.input_quantity),expectedVersionId:prior.id,expectedResultSha256:prior.resultSha256,correctionReason:"Independent accounting case"},true)
  const actual=current!.versions[current!.versions.length-1]!
  expect({quantityKwh:actual.quantityKwh,quantityMwh:actual.quantityMwh,unrounded:actual.total.unrounded,display:actual.total.display}).toEqual({quantityKwh:c.expected.quantity_kwh,quantityMwh:c.expected.quantity_mwh,unrounded:c.expected.total_unrounded_kg_co2e,display:c.expected.total_display_kg_co2e})
 }
})
