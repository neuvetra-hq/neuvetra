import {test,expect}from'bun:test'
import {validStationaryFixture}from'./m76-independent-valid-fixture'
import {decodeGeneratorRegister}from'../../apps/site-web/src/lib/m76-diesel-api'
import {m76DieselReportHashPayload,m76DieselCanonicalJson}from'../../packages/neuvetra-database/src/m76-diesel-validation'
test('M76 actual register decoder refuses duplicate report identity and duplicate captured state',async()=>{
 const {generatorRegister:r}=await validStationaryFixture();expect(await decodeGeneratorRegister(r,r.companyId)).toEqual(r)
 for(const kind of ['identity','captured state']){const fake=structuredClone(r),duplicate=structuredClone(fake.worksheets[0].reports[0]);if(kind==='captured state'){duplicate.id=crypto.randomUUID();duplicate.reportSha256=new Bun.CryptoHasher('sha256').update(m76DieselCanonicalJson(m76DieselReportHashPayload(duplicate))).digest('hex')}fake.worksheets[0].reports.push(duplicate);let refused=false;try{await decodeGeneratorRegister(fake,fake.companyId)}catch{refused=true}expect(refused).toBe(true)}
},15000)
