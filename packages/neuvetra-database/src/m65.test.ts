import { afterAll, beforeAll, expect, test } from "bun:test"
import { DevelopmentWorkspaceDatabase } from "./workspace"
import { M64_LIMITATIONS, type WorksheetVersion } from "./m64-contract"
import { M65_TEMPLATE_SHA256, validateWorksheetReportInput } from "./m65"
const owner=crypto.randomUUID(),admin=crypto.randomUUID(),member=crypto.randomUUID(),other=crypto.randomUUID()
let db:DevelopmentWorkspaceDatabase,company:string,source:WorksheetVersion
const request=(v:WorksheetVersion)=>({sourceVersionId:v.id,expectedInputSha256:v.inputSha256,expectedResultSha256:v.resultSha256,expectedReviewId:v.review?.id??null,expectedReviewSha256:v.review?.decisionSha256??null,idempotencyKey:crypto.randomUUID()})
beforeAll(async()=>{
 db=await DevelopmentWorkspaceDatabase.create([owner,admin,member,other])
 company=(await db.createWorkspaceWithSyntheticMembers(owner,{companyName:"Synthetic Acme, Inc.",facilityName:"Synthetic California office",countryCode:"US",stateCode:"CA",egridSubregion:"CAMX",reportingYear:2023,approach:"operational_control"},[{userId:admin,role:"admin"},{userId:member,role:"member"}])).id
 source=(await db.saveElectricityWorksheet(owner,company,{companyLabel:'Fictional <script>alert("x")</script> & {{display}}',facilityLabel:"Fictional 'Oakland' office",quantityKwh:"25000",period:"2023-01",geography:"CAMX",unit:"kWh",idempotencyKey:crypto.randomUUID()})).versions[0]!
},30000)
afterAll(async()=>db?.close())
test("strict report request refuses missing or forged snapshot context",()=>{
 const valid=request(source)
 expect(validateWorksheetReportInput(valid)).toEqual(valid)
 for(const mutation of [{expectedReviewId:crypto.randomUUID()},{sourceVersionId:null},{expectedInputSha256:"x"},{expectedReviewSha256:42},{profile:"override"}])expect(()=>validateWorksheetReportInput({...valid,...mutation})).toThrow()
})
test("SQL renders escaped reproducible HTML, distinct review snapshots and recoverable historical identity",async()=>{
 const input=request(source)
 const original=await db.createWorksheetReport(owner,company,input)
 expect(original.source).toEqual(source)
 expect(original.reviewState).toBe("unreviewed")
 expect(original.templateSha256).toBe(M65_TEMPLATE_SHA256)
 const download=await db.downloadWorksheetReport(member,company,original.id)
 const html=new TextDecoder().decode(download!.bytes)
 expect(html).toContain("4876.00722 kg CO2e")
 expect(html).toContain("4876.0072 kg CO2e")
 expect(html).toContain("&lt;script&gt;")
 expect(html).not.toContain("<script>")
 expect(html).toContain("&#123;&#123;display&#125;&#125;")
 expect(html).toContain(source.inputSha256)
 expect(html).toContain(source.method.sourceSha256)
 expect(html).not.toMatch(/\{\{[a-zA-Z0-9]+\}\}/)
 expect((await db.createWorksheetReport(admin,company,{...input,idempotencyKey:crypto.randomUUID()})).id).toBe(original.id)
 await expect(db.createWorksheetReport(member,company,input)).rejects.toThrow()
 expect(await db.findWorksheetReport(other,company,original.id)).toBeNull()
 const reviewed=(await db.reviewElectricityWorksheet(admin,company,{versionId:source.id,expectedResultSha256:source.resultSha256,decision:"accept_bounded_internal_draft",note:null,acknowledgedLimitations:[...M64_LIMITATIONS],idempotencyKey:crypto.randomUUID()})).versions[0]!
 const after=await db.createWorksheetReport(owner,company,request(reviewed))
 expect(after.id).not.toBe(original.id)
 expect(after.reviewState).toBe("accepted_bounded_internal_draft")
 expect((await db.downloadWorksheetReport(owner,company,original.id))!.bytes).toEqual(download!.bytes)
 expect((await db.createWorksheetReport(admin,company,{...input,idempotencyKey:crypto.randomUUID()})).id).toBe(original.id)
 await expect(db.createWorksheetReport(owner,company,{...request(reviewed),idempotencyKey:input.idempotencyKey})).rejects.toThrow()
 const correction={companyLabel:source.companyLabel,facilityLabel:source.facilityLabel,quantityKwh:"0",period:"2023-01" as const,geography:"CAMX" as const,unit:"kWh" as const,idempotencyKey:crypto.randomUUID(),expectedVersionId:source.id,expectedResultSha256:source.resultSha256,correctionReason:"Fictional correction <&>"}
 const v2=(await db.saveElectricityWorksheet(owner,company,correction,true)).versions[1]!
 const requested=(await db.reviewElectricityWorksheet(admin,company,{versionId:v2.id,expectedResultSha256:v2.resultSha256,decision:"changes_requested",note:'Please inspect "quantity" <&>',acknowledgedLimitations:[],idempotencyKey:crypto.randomUUID()})).versions[1]!
 await expect(db.createWorksheetReport(owner,company,request(v2))).rejects.toThrow()
 const pending=await db.createWorksheetReport(admin,company,request(requested))
 expect(pending.reviewState).toBe("changes_requested")
 expect(pending.source.total.unrounded).toBe("0")
 expect((await db.findWorksheetReports(member,company))!.reports).toHaveLength(3)
 expect((await db.createWorksheetReport(owner,company,request(reviewed))).id).toBe(after.id)
})
