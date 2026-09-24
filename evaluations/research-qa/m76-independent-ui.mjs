import {createRequire} from 'node:module'
import {readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
const {chromium}=createRequire(new URL('../../apps/frontdesk-web/package.json',import.meta.url))('@playwright/test')
const fixture=JSON.parse(await readFile(new URL('./m76-independent-ui-fixture.json',import.meta.url),'utf8'))
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'chrome'}:{})}),page=await browser.newPage(),events=[],errors=[]
page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message))
const assert=(ok,message)=>{if(!ok)throw Error(message)}
let stage='initial'
const payload=(kind,url)=>kind==='equipment'?(url.endsWith('/proof')?JSON.stringify(fixture.proof):url.endsWith('/snapshot')?fixture.report.snapshotJson:url.endsWith('/download')?fixture.report.html:JSON.stringify(fixture.register)):(url.endsWith(`/versions/${fixture.generatorRegister.worksheets[0].headVersionId}`)?JSON.stringify(fixture.generatorRegister.worksheets[0].versions[0]):url.endsWith('/download')?fixture.generatorReport.html:JSON.stringify(fixture.generatorRegister))
const ready=async(kind)=>{await (kind==='equipment'?page.getByText('Declared synthetic roster reconciled',{exact:true}):page.getByRole('heading',{name:/Generator QA-GEN-17.*Version 1/})).waitFor()}
const absent=async(kind)=>assert(await(kind==='equipment'?page.getByText('Declared synthetic roster reconciled',{exact:true}):page.getByRole('heading',{name:/Generator QA-GEN-17.*Version 1/})).count()===0,'Old '+kind+' data visible after scope changed')
const heldReady=async(get)=>{const until=Date.now()+5000;while(!get()&&Date.now()<until)await new Promise(r=>setTimeout(r,15));assert(get(),'Expected pending request missing at '+stage)}
try{
 for(const kind of ['equipment','generator']){
  const url='http://127.0.0.1:55676/?kind='+kind
  for(const switchKind of ['company','actor']){
   stage=kind+' delayed initial '+switchKind;let held,requests=0
   await page.route('**/workspace-api/**',async route=>{if(++requests===1){held=route;return}await route.fulfill({status:503,body:'Replacement unavailable'})})
   await page.goto(url);await page.waitForFunction(()=>typeof window.qaSwitch==='function');await heldReady(()=>held)
   await page.evaluate(k=>window.qaSwitch(k),switchKind);await page.getByRole('alert').waitFor();await held.fulfill({status:200,body:payload(kind,held.request().url())});await page.waitForTimeout(120)
   await absent(kind);assert(await page.getByRole('alert').count()===1,'Old response replaced new error');events.push(stage);await page.unroute('**/workspace-api/**')
  }
  for(const action of ['save','report']){
   stage=kind+' delayed '+action+' company change';let held,replaced=false
   await page.route('**/workspace-api/**',async route=>{const u=route.request().url();if(!held&&((action==='save'&&route.request().method()==='POST')||(action==='report'&&(kind==='equipment'?u.endsWith('/snapshot'):u.endsWith(`/versions/${fixture.generatorRegister.worksheets[0].headVersionId}`))))){held=route;return}if(replaced){await route.fulfill({status:503,body:'Replacement unavailable'});return}await route.fulfill({status:200,body:payload(kind,u)})})
   await page.goto(url);await ready(kind)
   if(action==='save'){
    await page.getByRole('button',{name:kind==='equipment'?'Correct roster or refresh its links':'Make a correction',exact:true}).click()
    if(kind==='equipment'){await page.getByLabel('Statement reference',{exact:true}).fill('QA-LATE-SAVE');await page.getByLabel('Reason for this correction or refreshed linkage').fill('Independent delayed save');await page.getByLabel('I checked this synthetic declaration against its stated records and retained every disclosed device.').check();await page.getByRole('button',{name:'Save roster version',exact:true}).click()}
    else{await page.getByRole('textbox',{name:/^Statement reference/}).fill('QA-LATE-GENERATOR');await page.getByLabel('Correction reason',{exact:true}).fill('Independent delayed generator save');for(const checkbox of await page.getByRole('checkbox').all())await checkbox.check();await page.getByRole('button',{name:'Save generator version',exact:true}).click()}
   }else await page.getByRole('button',{name:'Open report',exact:true}).click()
   await heldReady(()=>held);replaced=true;await page.evaluate(()=>window.qaSwitch('company'));await page.getByRole('alert').waitFor()
   const response=action==='save'?JSON.stringify(kind==='equipment'?fixture.register.versions[0]:fixture.generatorRegister.worksheets[0].versions[0]):payload(kind,held.request().url())
   await held.fulfill({status:200,body:response});await page.waitForTimeout(150);await absent(kind);assert(await page.getByRole('dialog').count()===0,'Late report opened under another company');events.push(stage);await page.unroute('**/workspace-api/**')
  }
  stage=kind+' report and role cleanup'
  await page.route('**/workspace-api/**',route=>route.fulfill({status:200,body:payload(kind,route.request().url())}))
  await page.goto(url);await ready(kind)
  if(kind==='equipment'){const text=await page.locator('body').innerText();assert(!/mobile source|Vehicle \/ source|of 3 workpaper/.test(text),'Copied mobile terminology or wrong capacity');assert(text.includes('three gas workpapers and one generator workpaper'),'Missing family-specific capacities');events.push('Actual stationary DOM names equipment/stationary and separate gas/generator capacities')}
  await page.getByRole('button',{name:'Open report',exact:true}).click();await page.getByRole('dialog').waitFor();assert(await page.locator('iframe').getAttribute('sandbox')==='allow-same-origin allow-modals','Unexpected report sandbox')
  await page.evaluate(()=>window.qaSwitch('actor'));await ready(kind);assert(await page.getByRole('dialog').count()===0,'Report dialog survived actor switch')
  for(const button of kind==='equipment'?['Correct roster or refresh its links','Retain current stationary report']:['Make a correction','Create generator draft','Retain source report'])assert(await page.getByRole('button',{name:button,exact:true}).count()===0,'Member has '+button)
  events.push(stage);await page.evaluate(()=>window.qaSwitch('close'));await page.getByText('Component closed',{exact:true}).waitFor();assert(await page.getByRole('dialog').count()===0,'Dialog survived unmount');events.push(kind+' unmount cleanup');await page.unroute('**/workspace-api/**')
 }
 assert(errors.length===0,'Unexpected actual component errors: '+errors.join('; '))
 await writeFile('evaluations/research-qa/m76-independent-ui-result.json',JSON.stringify({status:'pass',createdAt:new Date().toISOString(),events,errors,scriptSha256:createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex'),limitations:['Actual React components and browser decoders with intercepted reviewer-built synthetic HTTP; no hosted Auth or database persistence claim.','No visual-layout, print-preview, PDF or physical-print claim.']},null,2)+'\n')
 console.log(JSON.stringify({status:'pass',events:events.length,errors:errors.length}))
}catch(error){await writeFile('evaluations/research-qa/m76-independent-ui-failure.json',JSON.stringify({status:'failed',stage,events,errors,bodyText:await page.locator('body').innerText(),error:String(error)},null,2)+'\n');throw error}finally{await browser.close()}
