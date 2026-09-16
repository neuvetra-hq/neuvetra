import {createRequire} from 'node:module'
const {chromium}=createRequire(new URL('../../apps/frontdesk-web/package.json',import.meta.url))('@playwright/test')
import {createHash} from 'node:crypto'
import {readFile,writeFile} from 'node:fs/promises'
const fixture=JSON.parse(await readFile(new URL('./m75-independent-ui-fixture.json',import.meta.url),'utf8'))
fixture.register.proof.boundCoverageVersion=structuredClone(fixture.register.proof.coverageVersion)
fixture.proof.proof.boundCoverageVersion=structuredClone(fixture.proof.proof.coverageVersion)
const base='http://127.0.0.1:55675/evaluations/research-qa/m75-ui.html'
const browser=await chromium.launch({headless:true,...(process.env.M75_BROWSER_EXECUTABLE?{executablePath:process.env.M75_BROWSER_EXECUTABLE}:process.platform==='win32'?{channel:'chrome'}:{})}),events:string[]=[],errors:string[]=[]
const assert=(ok:unknown,message:string)=>{if(!ok)throw Error(message)}
const page=await browser.newPage();page.setDefaultTimeout(7000);page.setDefaultNavigationTimeout(7000);page.on('pageerror',e=>{errors.push(e.message);console.error('PAGEERROR '+e.message)})
try{
 for(const change of ['company','actor']){
  let held:any,requestCount=0
  await page.route('**/workspace-api/**',async route=>{requestCount++;if(requestCount===1){held=route;return}await route.fulfill({status:503,body:'Unavailable synthetic replacement'})})
  await page.goto(base,{waitUntil:'domcontentloaded'});console.log('Loaded '+change);await page.waitForFunction(()=>typeof (window as any).qaSwitch==='function');const deadline=Date.now()+5000;while(!held&&Date.now()<deadline)await new Promise(r=>setTimeout(r,10));assert(held,'No initial request; '+errors.join('; '))
  await page.evaluate(kind=>(window as any).qaSwitch(kind),change);await page.getByRole('alert').waitFor()
  await held.fulfill({status:200,contentType:'application/json',body:JSON.stringify(fixture.register)})
  await page.waitForTimeout(150)
  assert(await page.getByRole('alert').count()===1,'Replacement error vanished after old response')
  assert(await page.getByText('Declared synthetic roster reconciled',{exact:true}).count()===0,'Old company/user result appeared after switch')
  assert(await page.getByRole('button',{name:'Correct roster or refresh its links'}).count()===0,'Old actor controls returned')
  events.push(`Actual component ignores delayed initial load after ${change} switch`);await page.unroute('**/workspace-api/**')
 }
 for(const action of ['save','report']){
  let held:any,replaced=false
  await page.route('**/workspace-api/**',async route=>{const url=route.request().url(),method=route.request().method();if((action==='save'&&method==='POST')||(action==='report'&&url.endsWith('/snapshot'))){held=route;return}if(replaced){await route.fulfill({status:503,body:'Replacement unavailable'});return}await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(fixture.register)})})
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.getByText('Declared synthetic roster reconciled',{exact:true}).waitFor()
  if(action==='save'){await page.getByRole('button',{name:'Correct roster or refresh its links'}).click();await page.getByLabel('Roster reference',{exact:true}).fill('QA-LATE-SAVE');await page.getByLabel('Reason for this correction or refreshed linkage').fill('Independent delayed save case');await page.getByLabel('I checked this synthetic declaration against its stated records and retained every disclosed vehicle.').check();await page.getByRole('button',{name:'Save roster version',exact:true}).click()}
  else await page.getByRole('button',{name:'Open report',exact:true}).click()
  const deadline=Date.now()+5000;while(!held&&Date.now()<deadline)await new Promise(r=>setTimeout(r,10));assert(held,'Expected pending '+action)
  replaced=true;await page.evaluate(()=>(window as any).qaSwitch('company'));await page.getByRole('alert').waitFor()
  await held.fulfill({status:200,contentType:'application/json',body:action==='save'?JSON.stringify(fixture.register.versions.at(-1)):fixture.report.snapshotJson});await page.waitForTimeout(150)
  assert(await page.getByRole('alert').count()===1,'Late '+action+' replaced new company status');assert(await page.getByRole('dialog').count()===0,'Late report opened under new company');assert(await page.getByText('Declared synthetic roster reconciled',{exact:true}).count()===0,'Late '+action+' restored old data')
  events.push(`Actual component ignores delayed ${action} after company switch`);await page.unroute('**/workspace-api/**')
 }
 await page.route('**/workspace-api/**',async route=>{const url=route.request().url();await route.fulfill({status:200,contentType:'application/json',body:url.endsWith('/proof')?JSON.stringify(fixture.proof):url.endsWith('/snapshot')?fixture.report.snapshotJson:url.endsWith('/download')?fixture.report.html:JSON.stringify(fixture.register)})})
 await page.goto(base);await page.getByText('Declared synthetic roster reconciled',{exact:true}).waitFor()
 assert(await page.getByText('Scope 1 incomplete',{exact:true}).count()>0,'Missing permanent incomplete label')
 await page.getByRole('button',{name:'Open report',exact:true}).click();await page.getByRole('dialog',{name:'Fleet reconciliation report'}).waitFor()
 assert(await page.locator('iframe').getAttribute('sandbox')==='allow-same-origin allow-modals','Report sandbox changed')
 await page.evaluate(()=>(window as any).qaSwitch('actor'));await page.getByText('Declared synthetic roster reconciled',{exact:true}).waitFor()
 assert(await page.getByRole('dialog').count()===0,'Old actor report dialog survived')
 assert(await page.getByRole('button',{name:'Correct roster or refresh its links'}).count()===0,'Member has roster write control')
 assert(await page.getByRole('button',{name:'Retain current fleet report'}).count()===0,'Member has report write control')
 events.push('Actual component closes existing report on actor switch and hides member writes')
 await page.evaluate(()=>(window as any).qaSwitch('close'));await page.getByText('Component closed',{exact:true}).waitFor();assert(await page.getByRole('dialog').count()===0,'Dialog survived unmount');events.push('Actual component unmount clears report surface')
 assert(errors.length===0,'Unexpected component errors: '+errors.join('; '))
 await writeFile('evaluations/research-qa/m75-independent-ui-result.json',JSON.stringify({status:'pass',events,errors,createdAt:new Date().toISOString(),scriptSha256:createHash('sha256').update(await readFile(new URL(import.meta.url),'utf8')).digest('hex'),limitations:['Local actual component with intercepted synthetic HTTP responses; not a hosted Auth or persistence exercise.','No print appearance or physical/PDF output claim.']},null,2)+'\n');console.log(JSON.stringify({status:'pass',events:events.length,errors:errors.length}))
}finally{await browser.close()}
