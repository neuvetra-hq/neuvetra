import {chromium} from '../../node_modules/.bun/playwright@1.59.1/node_modules/playwright'
// Browser-driver source. Run through hosted-setup-01-ui-node-launch.ts on Windows.
import {resolve} from 'node:path'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {setup} from './hosted-setup-01-native-fixture'
const files=['apps/site-web/src/components/CompanySetup.tsx','apps/site-web/src/components/StagingWorkspace.tsx','apps/site-web/src/lib/company-setup-api.ts','apps/site-web/src/staging.css','Dockerfile.staging','Dockerfile.staging.dockerignore','apps/site-api/src/staging/server.ts','apps/site-api/src/workspace/company-setup-routes.ts','packages/neuvetra-database/src/company-setup-contract.ts']
const hashes=()=>Object.fromEntries(files.map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')]))
const sourceHashes=hashes(),checks:any[]=[],a=crypto.randomUUID(),b=crypto.randomUUID(),owner=crypto.randomUUID()
const build=await Bun.build({entrypoints:[resolve(import.meta.dir,'hosted-setup-01-ui-entry.tsx')],target:'browser',plugins:[{name:'app-alias',setup(builder){builder.onResolve({filter:/^@\//},args=>({path:resolve('apps/site-web/src',args.path.slice(2))+'.ts'}));builder.onResolve({filter:/^react(?:-dom)?(?:\/|$)/},args=>({path:Bun.resolveSync(args.path,resolve('apps/site-web'))}))}}]})
if(!build.success)throw Error(build.logs.join('\n'))
const js=await build.outputs[0]!.text()
const server=Bun.serve({hostname:'127.0.0.1',port:0,fetch:req=>new URL(req.url).pathname==='/qa.js'?new Response(js,{headers:{'content-type':'application/javascript'}}):new Response('<html><body><div id="root"></div><script type="module" src="/qa.js"></script></body></html>',{headers:{'content-type':'text/html'}})})
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),page=await browser.newPage()
const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(5000)
const versions:any[]=[];let pendingPost:any=null,holdPost=false,losePost=false
const canonical=(value:any):string=>Array.isArray(value)?'['+value.map(canonical).join(',')+']':value!==null&&typeof value==='object'?'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}':JSON.stringify(value)
const version=(s:any,revision:number,reason:string|null=null)=>({id:crypto.randomUUID(),companyId:a,revision,previousVersionId:versions.at(-1)?.id??null,correctionReason:reason,setup:s,payloadSha256:createHash('sha256').update(canonical(s)).digest('hex'),createdBy:owner,createdAt:new Date().toISOString()})
const requests=new Map<string,any>()
const summary=(v:any)=>{const {setup,...rest}=v;return rest}
const view=()=>({profile:'neuvetra.company-setup.v1',syntheticOnly:true,canManage:true,currentVersion:versions.at(-1)??null,history:versions.map(summary)})
let lastInput:any
await page.route('**/workspace-api/**',async route=>{
 const req=route.request(),path=new URL(req.url()).pathname
 if(path.includes(b)){await route.fulfill({json:{profile:'neuvetra.company-setup.v1',syntheticOnly:true,canManage:true,currentVersion:null,history:[]}});return}
 if(req.method()==='POST'){
  const input=req.postDataJSON();lastInput=input
  if(holdPost){pendingPost={route,input};return}
  const old=requests.get(input.idempotencyKey)
  const saved=old??version(input.setup,versions.length+1,input.correctionReason);if(!old){versions.push(saved);requests.set(input.idempotencyKey,saved)}
  if(losePost){losePost=false;await route.abort('failed');return}
  await route.fulfill({json:{foundation:view(),savedVersion:saved,replayed:!!old}});return
 }
 if(path.includes('/versions/')){await route.fulfill({json:versions.find(v=>path.endsWith(v.id))});return}
 await route.fulfill({json:view()})
})
const mount=async()=>{await page.goto('http://127.0.0.1:'+server.port);await page.waitForFunction(()=>typeof(window as any).qaMount==='function');await page.evaluate(({owner,a})=>(window as any).qaMount(owner,a),{owner,a});await page.getByLabel('Legal name',{exact:true}).waitFor()}
const step=async(n:number)=>page.getByRole('button',{name:new RegExp('^0'+n+' ')}).click()
try{
 await mount();await page.getByLabel('Legal name',{exact:true}).fill('Synthetic QA browser');await page.getByLabel(/^Country code/).fill('US')
 await step(2);await page.getByLabel('Period start',{exact:true}).fill('2025-01-01');await page.getByLabel('Period end (inclusive)',{exact:true}).fill('2025-12-31')
 await step(3);await page.getByRole('button',{name:'+ Add related entity',exact:true}).click();await page.getByLabel('Legal name',{exact:true}).fill('Synthetic related entity');await page.getByLabel('Ownership share (%)',{exact:true}).fill('0')
 await step(4);await page.getByRole('button',{name:'+ Add location',exact:true}).click();await page.getByLabel('Location name',{exact:true}).fill('Synthetic Nevada site');await page.getByLabel('Country code',{exact:true}).fill('US');await page.getByLabel('State / province / region',{exact:true}).fill('NV')
 await step(5);await page.getByLabel('Other changes or shared operations',{exact:true}).fill('Synthetic unknown acquisition details')
 await step(6);await page.getByLabel(/^Does this apply within your proposed boundary/).nth(0).selectOption('no');await page.getByLabel(/^Reason for this answer/).nth(0).fill('No synthetic combustion');await page.getByLabel(/^Does this apply within your proposed boundary/).nth(1).selectOption('not_applicable');await page.getByLabel(/^Reason for this answer/).nth(1).fill('No synthetic generator activity')
 for(let n=1;n<=7;n++)await step(n)
 await page.getByRole('button',{name:'Save setup',exact:true}).click();await page.getByText('Saved. The previous version remains in correction history.').waitFor();checks.push({name:'all seven sections and first save',pass:versions.length===1})
 checks.push({name:'seven-section fields preserve inclusive end, explicit zero, NV geography and no/n-a/unknown',pass:lastInput.setup.reportingPeriod.endExclusive==='2026-01-01'&&lastInput.setup.entities[0].ownershipPercent==='0'&&lastInput.setup.locations[0].regionCode==='NV'&&lastInput.setup.screening.slice(0,3).map((x:any)=>x.state).join(',')==='no,not_applicable,unknown'})
 await mount();checks.push({name:'returning saved setup mounts',pass:await page.getByLabel('Legal name',{exact:true}).inputValue()==='Synthetic QA browser'})
 await page.getByLabel('Legal name',{exact:true}).fill('Synthetic first correction');await step(7);await page.getByLabel('Reason for this correction').fill('Synthetic test correction');holdPost=true;await page.getByRole('button',{name:'Save correction',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[aria-busy=true]')!==null)
 const navigationEnabled=await page.getByRole('button',{name:/^01 /}).isEnabled();let editableDuringSave=false;if(navigationEnabled){await step(1);editableDuringSave=await page.getByLabel('Legal name',{exact:true}).isEnabled();if(editableDuringSave)await page.getByLabel('Legal name',{exact:true}).fill('Synthetic unsaved while saving')}while(!pendingPost)await new Promise(r=>setTimeout(r,10));const pendingSaved=version(pendingPost.input.setup,2,pendingPost.input.correctionReason);versions.push(pendingSaved);requests.set(pendingPost.input.idempotencyKey,pendingSaved);await pendingPost.route.fulfill({json:{foundation:view(),savedVersion:pendingSaved,replayed:false}});holdPost=false;await page.getByText('Saved. The previous version remains in correction history.').waitFor();await step(1);const actual=await page.getByLabel('Legal name',{exact:true}).inputValue();checks.push({name:'UI-F02 edit during pending save',pass:!editableDuringSave||actual==='Synthetic unsaved while saving',navigationEnabled,editableDuringSave,actual,expected:'Edits disabled or subsequent unsaved changes preserved'})
 await mount();await page.getByLabel('Legal name',{exact:true}).fill('Synthetic uncertain save');await step(7);await page.getByLabel('Reason for this correction').fill('Synthetic uncertain save');losePost=true;await page.getByRole('button',{name:'Save correction',exact:true}).click();await page.getByRole('button',{name:'Retry exact save',exact:true}).waitFor();const concurrent=structuredClone(versions.at(-1));concurrent.id=crypto.randomUUID();concurrent.revision++;concurrent.previousVersionId=versions.at(-1).id;concurrent.setup.company.legalName='Synthetic newer server correction';concurrent.payloadSha256=createHash('sha256').update(canonical(concurrent.setup)).digest('hex');versions.push(concurrent);await page.getByRole('button',{name:'Retry exact save',exact:true}).click();await page.getByText('The earlier save was confirmed.',{exact:false}).waitFor();await step(1);checks.push({name:'UI-F03 old replay must not combine newer head with older draft',pass:await page.getByLabel('Legal name',{exact:true}).inputValue()==='Synthetic newer server correction',actual:await page.getByLabel('Legal name',{exact:true}).inputValue(),headRevision:versions.at(-1).revision,expected:'Latest draft shown, or explicit old-version read-only state'})
 await page.evaluate(({owner,b})=>(window as any).qaMount(owner,b),{owner,b});await page.getByLabel('Legal name',{exact:true}).waitFor();await page.waitForFunction(()=>document.querySelector('input')?.value==='');checks.push({name:'company switch initializes empty company without prior facts',pass:await page.getByLabel('Legal name',{exact:true}).inputValue()===''})
 await page.evaluate(()=>(window as any).qaUnmount());await page.getByText('Signed out',{exact:true}).waitFor();checks.push({name:'signout unmount removes prior company form',pass:await page.getByLabel('Legal name',{exact:true}).count()===0})
}catch(e){checks.push({name:'harness execution exception',pass:false,error:String(e),body:await page.locator('body').innerText(),lastInput})}finally{await Bun.write('evaluations/research-qa/hosted-setup-01-ui-browser-result.json',JSON.stringify({sourceHashes,sourceHashesAfter:hashes(),checks,pageErrors:errors,limitations:'Actual React/Chrome with mocked API responses; no provider identity or native DB in this UI race harness'},null,2));console.log(JSON.stringify(checks,null,2));await browser.close();server.stop(true);if(checks.some(check=>!check.pass)||errors.length)process.exitCode=1}
