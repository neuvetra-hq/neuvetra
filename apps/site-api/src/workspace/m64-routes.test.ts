import { afterAll, beforeAll, expect, test } from "bun:test"
import { DevelopmentWorkspaceDatabase, M64_LIMITATIONS } from "@neuvetra/database"
import { createWorksheetRoutes } from "./m64-routes"
const actors={owner:crypto.randomUUID(),admin:crypto.randomUUID(),member:crypto.randomUUID(),other:crypto.randomUUID()}
let db:DevelopmentWorkspaceDatabase, company:string, handle:ReturnType<typeof createWorksheetRoutes>
const origin="http://localhost:5174"
const input=(quantityKwh="62500")=>({companyLabel:"Fictional Company",facilityLabel:"Fictional Facility",quantityKwh,period:"2023-01",geography:"CAMX",unit:"kWh",idempotencyKey:crypto.randomUUID()})
const call=(actor:keyof typeof actors|null,method="GET",body?:unknown,suffix="",target=company)=>handle(new Request(`${origin}/workspace/${target}/electricity-worksheet${suffix}`,{method,headers:{origin,...(actor?{authorization:`Bearer ${actor}`} : {}),...(body?{"content-type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})}))
beforeAll(async()=>{
 db=await DevelopmentWorkspaceDatabase.create(Object.values(actors))
 company=(await db.createWorkspaceWithSyntheticMembers(actors.owner,{companyName:"Synthetic Acme, Inc.",facilityName:"Synthetic California office",countryCode:"US",stateCode:"CA",egridSubregion:"CAMX",reportingYear:2023,approach:"operational_control"},[{userId:actors.admin,role:"admin"},{userId:actors.member,role:"member"}])).id
 handle=createWorksheetRoutes({database:db,origin,validateUser:async token=>actors[token as keyof typeof actors]?{id:actors[token as keyof typeof actors],phone:null,email:null,fullName:null}:null})
},30000)
afterAll(async()=>db?.close())
test("actual new API validates quantities, scope and roles without relaxing M63",async()=>{
 expect((await call(null)).status).toBe(401)
 expect((await call("other")).status).toBe(404)
 expect((await call("member","POST",input())).status).toBe(403)
 for(const quantity of ["",null,0,-1,"1\n","1000000.001","1.0000","-0","1e2"]){expect((await call("owner","POST",{...input(),quantityKwh:quantity})).status).toBe(422)}
 for(const change of [{unit:"MWh"},{period:"2023-02"},{geography:"AZNM"},{factor:"1"}]) expect((await call("owner","POST",{...input(),...change})).status).toBe(422)
 expect((await (await call("owner")).json()).versions).toHaveLength(0)
 const saved=await call("owner","POST",input())
 expect(saved.status).toBe(201)
 const v1=(await saved.json()).versions[0]
 expect(v1.total.display).toBe("12190.0180")
 const review={versionId:v1.id,expectedResultSha256:v1.resultSha256,decision:"accept_bounded_internal_draft",note:null,acknowledgedLimitations:[...M64_LIMITATIONS],idempotencyKey:crypto.randomUUID()}
 expect((await call("owner","POST",review,"/reviews")).status).toBe(409)
 expect((await call("admin","POST",review,"/reviews")).status).toBe(201)
 const correction={...input("187500"),expectedVersionId:v1.id,expectedResultSha256:v1.resultSha256,correctionReason:"Corrected synthetic quantity"}
 const changed=await call("owner","POST",correction,"/corrections")
 expect(changed.status).toBe(201)
 const versions=(await changed.json()).versions
 expect(versions[1].total.display).toBe("36570.0542")
 expect(versions[1].review).toBeNull()
 expect(versions[0].review.resultSha256).toBe(v1.resultSha256)
 expect((await call("owner","POST",{...correction,quantityKwh:"1",idempotencyKey:crypto.randomUUID()},"/corrections")).status).toBe(409)
 expect((await (await call("member")).json()).versions).toEqual(versions)
})

