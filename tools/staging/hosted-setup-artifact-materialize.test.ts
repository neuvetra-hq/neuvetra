import {expect,test} from 'bun:test'
import {lstat,mkdir,mkdtemp,readFile,readdir,realpath,symlink,writeFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {tmpdir} from 'node:os'
import {dirname,join,relative,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {readMigrationManifest} from '../../packages/neuvetra-database/src/staging-migrations'
import {hash,sha256} from './hosted-setup-upgrade'
import {ARTIFACT_CONFIG,PUBLICATION_PROFILE,type ArtifactPaths,type ArtifactTrustPolicy} from './hosted-setup-artifact-source'
import {ARCHIVE_LIMITS,FILE_ARCHIVE_PROFILE,materializeHostedSetupArtifact,probeHostedSetupArtifactPgResolution} from './hosted-setup-artifact-materialize'

const HEAD='a'.repeat(40)
const archive=(map:Map<string,Uint8Array>)=>({profile:FILE_ARCHIVE_PROFILE,files:[...map].sort(([a],[b])=>a<b?-1:1).map(([path,content])=>({path,kind:'file',contentBase64:Buffer.from(content).toString('base64')}))})
const pins=(value:ReturnType<typeof archive>)=>value.files.map(f=>({path:f.path,sha256:sha256(Buffer.from(f.contentBase64,'base64'))}))
const utf8=(s:string)=>new TextEncoder().encode(s)
async function put(path:string,data:string|Uint8Array){await mkdir(dirname(path),{recursive:true});await writeFile(path,data)}
let runtimeHash:Promise<string>|undefined
async function fixture(dependencyFiles:Map<string,Uint8Array>=new Map([['node_modules/pg/package.json',utf8('{"name":"pg","main":"index.js"}')],['node_modules/pg/index.js',utf8('module.exports={Client:class SyntheticClient{}}')]])){
 const root=await mkdtemp(join(tmpdir(),'hosted-artifact-materialize-')),checkout=join(root,'checkout');await mkdir(checkout)
 const paths:ArtifactPaths={publication:join(root,'publication.json'),sourceArchive:join(root,'source.archive.json'),dependencyArchive:join(root,'dependencies.archive.json'),sourceRoot:join(root,'private-source'),dependencyRoot:join(root,'private-dependencies'),runtimeExecutable:process.execPath,supervisor:join(root,'synthetic-supervisor.ts'),config:join(root,'controlled.toml')}
 const manifest=await readMigrationManifest(),sourceFiles=new Map<string,Uint8Array>()
 for(const row of manifest)sourceFiles.set('packages/neuvetra-database/src/migrations/'+row.name,utf8(row.sql))
 sourceFiles.set('packages/neuvetra-database/package.json',utf8('{"name":"synthetic-source-anchor"}'))
 sourceFiles.set('tools/staging/hosted-setup-artifact-worker.ts',utf8('throw Error("not a maintenance worker")'))
 const source=archive(sourceFiles),dependency=archive(dependencyFiles)
 const receipt:any={profile:PUBLICATION_PROFILE,trustBoundary:'trusted-operator-host',reviewedProductHead:HEAD,repository:'neuvetra-hq/neuvetra',pullRequest:6,operatorId:'fixture-operator',independentReviewerId:'fixture-reviewer',materialFindingsOpen:0,observedAtMs:Date.now()-1000,expiresAtMs:Date.now()+600000,checks:[{name:'synthetic',head:HEAD,conclusion:'success'}],sourceFiles:[],dependencyFiles:[],migrations:manifest.map(row=>({name:row.name,path:'packages/neuvetra-database/src/migrations/'+row.name,sha256:sha256(row.sql),normalizedSha256:row.sha256})),migrationManifestSha256:hash(manifest),artifact:{sourceArchiveSha256:'',dependencyArchiveSha256:'',runtimeSha256:await(runtimeHash??=readFile(process.execPath).then(sha256)),supervisorSha256:sha256('synthetic supervisor'),configSha256:sha256(ARTIFACT_CONFIG),entrypoint:'tools/staging/hosted-setup-artifact-worker.ts',launchPolicy:'neuvetra.hosted-setup.fixed-bun-worker.v1'}}
 const policy:ArtifactTrustPolicy={publicationSha256:'',reviewedProductHead:HEAD,operatorId:'fixture-operator',independentReviewerId:'fixture-reviewer',requiredChecks:['synthetic'],activeCheckoutRoots:[checkout]}
 await put(paths.supervisor,'synthetic supervisor');await put(paths.config,ARTIFACT_CONFIG)
 const publish=async(syncInventories=true)=>{
  const src=JSON.stringify(source),dep=JSON.stringify(dependency);await put(paths.sourceArchive,src);await put(paths.dependencyArchive,dep)
  receipt.artifact.sourceArchiveSha256=sha256(src);receipt.artifact.dependencyArchiveSha256=sha256(dep)
  if(syncInventories){receipt.sourceFiles=pins(source);receipt.dependencyFiles=pins(dependency)}
  const pub=JSON.stringify(receipt);await put(paths.publication,pub);policy.publicationSha256=sha256(pub)
 }
 await publish();return{root,paths,policy,source,dependency,receipt,publish,sourceFiles,dependencyFiles}
}
async function absent(path:string){try{await lstat(path);return false}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return true;throw e}}

test('extracts exactly pinned regular bytes into exclusive roots and returns only offline capability',async()=>{
 const f=await fixture(),result=await materializeHostedSetupArtifact(f.paths,f.policy)
 expect(result.archiveProfile).toBe(FILE_ARCHIVE_PROFILE);expect(result.launchAuthorized).toBe(false);expect(result.inspection.launchAuthorized).toBe(false)
 expect(result.nodePath).toBe(join(f.paths.dependencyRoot,'node_modules'))
 for(const [path,expected] of [...f.sourceFiles,...f.dependencyFiles])expect(sha256(await readFile(join(path.startsWith('node_modules/')?f.paths.dependencyRoot:f.paths.sourceRoot,path)))).toBe(sha256(expected))
 await expect(materializeHostedSetupArtifact(f.paths,f.policy)).rejects.toThrow('already exists')
 await expect(probeHostedSetupArtifactPgResolution({...result})).rejects.toThrow('capability')
})
test('bad archive pins, unsupported formats and manifest mismatch refuse before extraction',async()=>{
 for(const kind of ['pin','profile','manifest'] as const){
  const f=await fixture()
  if(kind==='pin')await put(f.paths.sourceArchive,'changed')
  if(kind==='profile'){f.source.profile='unreviewed-format' as any;await f.publish()}
  if(kind==='manifest'){f.receipt.sourceFiles[0].sha256='0'.repeat(64);await f.publish(false)}
  await expect(materializeHostedSetupArtifact(f.paths,f.policy)).rejects.toThrow()
  expect(await absent(f.paths.sourceRoot)).toBe(true);expect(await absent(f.paths.dependencyRoot)).toBe(true)
 }
})
test('traversal, rooted drive/ADS, Windows devices and ambiguous archive paths refuse',async()=>{
 for(const path of ['../outside','/absolute','C:/absolute','a:stream','a\\escape','a//empty','a/./dot','a/../escape','a./tail','a /tail','NUL.txt','COM¹.txt','CONIN$','CONOUT$','CLOCK$','.git/config','a?b']){
  const f=await fixture();f.source.files[0]!.path=path;await f.publish()
  await expect(materializeHostedSetupArtifact(f.paths,f.policy)).rejects.toThrow('Unsafe archive path')
  expect(await absent(f.paths.sourceRoot)).toBe(true)
 }
})
test('links, devices, metadata tricks, duplicate names and file/directory collisions refuse',async()=>{
 for(const kind of ['symlink','junction','hardlink','device','directory']){
  const f=await fixture();f.source.files[0]!.kind=kind;await f.publish()
  await expect(materializeHostedSetupArtifact(f.paths,f.policy)).rejects.toThrow('Only regular file');expect(await absent(f.paths.sourceRoot)).toBe(true)
 }
 for(const extra of [{linkTarget:'outside'},{mode:0o777},{type:'symlink'}]){
  const f=await fixture();Object.assign(f.source.files[0]!,extra);await f.publish()
  await expect(materializeHostedSetupArtifact(f.paths,f.policy)).rejects.toThrow('Unexpected archive fields')
 }
 for(const paths of [['a','a'],['a','a/child'],['A/one','a/two']]){
  const f=await fixture();f.source.files=paths.map(path=>({path,kind:'file',contentBase64:''}));await f.publish()
  await expect(materializeHostedSetupArtifact(f.paths,f.policy)).rejects.toThrow();expect(await absent(f.paths.sourceRoot)).toBe(true)
 }
})
test('source dependency shadowing, invalid base64 and unmanifested bytes refuse before writes',async()=>{
 for(const mutate of [(f:Awaited<ReturnType<typeof fixture>>)=>f.source.files[0]!.path='node_modules/pg/index.js',(f:Awaited<ReturnType<typeof fixture>>)=>f.dependency.files[0]!.path='outside/pg.js',(f:Awaited<ReturnType<typeof fixture>>)=>f.source.files[0]!.contentBase64='%%%']){
  const f=await fixture();mutate(f);await f.publish();await expect(materializeHostedSetupArtifact(f.paths,f.policy)).rejects.toThrow();expect(await absent(f.paths.sourceRoot)).toBe(true)
 }
})
for(const size of [4_128_764,4_128_765,16*1024*1024])test('public materializer accepts canonical binary file of '+size+' bytes',async()=>{
 const f=await fixture(),content=Buffer.alloc(size,0x61),path='zz-boundary.bin'
 f.source.files.push({path,kind:'file',contentBase64:content.toString('base64')});await f.publish()
 const result=await materializeHostedSetupArtifact(f.paths,f.policy),extracted=await readFile(join(f.paths.sourceRoot,path))
 expect(extracted.length).toBe(size);expect(sha256(extracted)).toBe(sha256(content));expect(result.launchAuthorized).toBe(false)
},30000)
test('public materializer rejects exact-limit overflow and malformed/noncanonical base64 before writes',async()=>{
 expect(ARCHIVE_LIMITS.fileBytes).toBe(16*1024*1024)
 const oversized=await fixture();oversized.source.files.push({path:'zz-overflow.bin',kind:'file',contentBase64:Buffer.alloc(ARCHIVE_LIMITS.fileBytes+1,0x61).toString('base64')});await oversized.publish()
 await expect(materializeHostedSetupArtifact(oversized.paths,oversized.policy)).rejects.toThrow('Canonical bounded base64')
 expect(await absent(oversized.paths.sourceRoot)).toBe(true)
 for(const encoding of ['Zg','Zg=','Zg===','Zg==\n','Z g==','Zg==AAAA','=AAA','Zh==','Zm9=','-w==','_w==','!!!!','éAAA']){
  const f=await fixture();f.source.files[0]!.contentBase64=encoding;await f.publish()
  await expect(materializeHostedSetupArtifact(f.paths,f.policy)).rejects.toThrow('base64')
  expect(await absent(f.paths.sourceRoot)).toBe(true)
 }
},30000)
test('public materializer retains aggregate decoded limit after canonical large-file repair',async()=>{
 const f=await fixture(),encoded=Buffer.alloc(2*1024*1024,0xa5).toString('base64')
 for(let index=0;index<40;index++)f.source.files.push({path:'zz-aggregate-'+String(index).padStart(2,'0')+'.bin',kind:'file',contentBase64:encoded})
 await f.publish()
 await expect(materializeHostedSetupArtifact(f.paths,f.policy)).rejects.toThrow('Archive decoded size limit exceeded')
 expect(await absent(f.paths.sourceRoot)).toBe(true)
},30000)
test('existing roots, missing/excluded checkouts and aliased parents cannot become destinations',async()=>{
 const f=await fixture();await mkdir(f.paths.sourceRoot);await put(join(f.paths.sourceRoot,'sentinel'),'keep')
 await expect(materializeHostedSetupArtifact(f.paths,f.policy)).rejects.toThrow('already exists');expect(await readFile(join(f.paths.sourceRoot,'sentinel'),'utf8')).toBe('keep')
 const g=await fixture();await expect(materializeHostedSetupArtifact(g.paths,{...g.policy,activeCheckoutRoots:[g.root]})).rejects.toThrow('outside active')
 await expect(materializeHostedSetupArtifact(g.paths,{...g.policy,activeCheckoutRoots:[join(g.root,'missing')]})).rejects.toThrow()
 const alias=join(g.root,'alias');await symlink(g.root,alias,process.platform==='win32'?'junction':'dir')
 await expect(materializeHostedSetupArtifact({...g.paths,sourceRoot:join(alias,'new-source')},g.policy)).rejects.toThrow('aliased')
 expect(await absent(join(g.root,'new-source'))).toBe(true)
})
test('two concurrent materializations cannot overwrite or share the same destinations',async()=>{
 const f=await fixture(),outcomes=await Promise.allSettled([materializeHostedSetupArtifact(f.paths,f.policy),materializeHostedSetupArtifact(f.paths,f.policy)])
 expect(outcomes.filter(o=>o.status==='fulfilled')).toHaveLength(1);expect(outcomes.filter(o=>o.status==='rejected')).toHaveLength(1)
 expect(sha256(await readFile(join(f.paths.sourceRoot,f.source.files[0]!.path)))).toBe(f.receipt.sourceFiles[0].sha256)
})
test('final verifier refusal preserves failed roots and returns no reusable materialization',async()=>{
 const f=await fixture();f.receipt.checks[0].conclusion='failure';await f.publish()
 await expect(materializeHostedSetupArtifact(f.paths,f.policy)).rejects.toThrow('Required exact-head check')
 expect(await absent(f.paths.sourceRoot)).toBe(false);expect(await absent(f.paths.dependencyRoot)).toBe(false)
 await expect(materializeHostedSetupArtifact(f.paths,f.policy)).rejects.toThrow('already exists')
})
test('materialization and resolution-only probe never execute package code or lifecycle scripts',async()=>{
 const f=await fixture(),marker=join(f.root,'PACKAGE_EXECUTED')
 const source='require("node:fs").writeFileSync('+JSON.stringify(marker)+',"BAD");module.exports={};'
 f.dependency.files.find(e=>e.path.endsWith('/index.js'))!.contentBase64=Buffer.from(source).toString('base64')
 f.dependency.files.find(e=>e.path.endsWith('/package.json'))!.contentBase64=Buffer.from(JSON.stringify({name:'pg',main:'index.js',scripts:{postinstall:'create unwanted marker'}})).toString('base64')
 await f.publish();const result=await materializeHostedSetupArtifact(f.paths,f.policy)
 expect(await absent(marker)).toBe(true)
 const probe=await probeHostedSetupArtifactPgResolution(result)
 expect(probe.loadedPg).toBe(false);expect(await absent(marker)).toBe(true)
})

// Read existing installed packages only. Flatten their regular files and declared
// production/optional dependencies into a synthetic private archive. No install.
async function installedPgClosure(){
 const output=new Map<string,Uint8Array>(),seen=new Map<string,string>()
 const initial=createRequire(new URL('../../packages/neuvetra-database/package.json',import.meta.url))
 async function collect(name:string,from:ReturnType<typeof createRequire>){
  const packageFile=await realpath(from.resolve(name+'/package.json')),metadata=JSON.parse(await readFile(packageFile,'utf8'))
  if(seen.has(name)){if(seen.get(name)!==metadata.version)throw Error('Synthetic flattening version conflict');return}
  seen.set(name,metadata.version);const root=dirname(packageFile)
  async function walk(dir:string,prefix:string){for(const item of await readdir(dir)){
   if(item==='node_modules')continue
   const full=join(dir,item),s=await lstat(full);if(s.isSymbolicLink())throw Error('Unexpected package-internal link')
   if(s.isDirectory())await walk(full,prefix+item+'/');else if(s.isFile())output.set('node_modules/'+name+'/'+prefix+item,new Uint8Array(await readFile(full)));else throw Error('Nonregular installed package')
  }}
  await walk(root,'');const req=createRequire(packageFile)
  for(const dependency of Object.keys({...metadata.dependencies,...metadata.optionalDependencies}).sort())await collect(dependency,req)
 }
 await collect('pg',initial);return{files:output,versions:Object.fromEntries(seen)}
}
test('actual Bun resolves and loads real private pg through fixed NODE_PATH; ancestor escape is refused without import',async()=>{
 const closure=await installedPgClosure(),f=await fixture(closure.files),result=await materializeHostedSetupArtifact(f.paths,f.policy)
 const previous=process.env.NODE_PATH;process.env.NODE_PATH=join(f.root,'wrong-ambient-dependencies')
 let resolution:Awaited<ReturnType<typeof probeHostedSetupArtifactPgResolution>>
 try{resolution=await probeHostedSetupArtifactPgResolution(result)}finally{if(previous===undefined)delete process.env.NODE_PATH;else process.env.NODE_PATH=previous}
 expect(resolution.runtimeVersion).toBe('1.3.12');expect(resolution.loadedPg).toBe(false);expect(resolution.requirePath.startsWith(f.paths.dependencyRoot)).toBe(true);expect(resolution.esmPath.startsWith(f.paths.dependencyRoot)).toBe(true)
 const home=join(f.root,'load-probe-home');await mkdir(home)
 const anchor=pathToFileURL(join(f.paths.sourceRoot,'packages/neuvetra-database/package.json')).href
 const script=`import {createRequire} from 'node:module';const req=createRequire(${JSON.stringify(anchor)});const cjs=req.resolve('pg'),esm=import.meta.resolve('pg');if(cjs!==${JSON.stringify(resolution.requirePath)}||esm!==${JSON.stringify(pathToFileURL(resolution.esmPath).href)})throw Error('resolution changed');const pg=req('pg'),module=await import('pg');console.log(JSON.stringify({client:typeof pg.Client,esmClient:typeof module.Client,loaded:Object.keys(req.cache)}));`
 const child=Bun.spawn([process.execPath,'--no-env-file','--no-install','--config='+f.paths.config,'--eval',script],{cwd:f.paths.sourceRoot,env:{SystemRoot:process.env.SystemRoot??'C:\\Windows',HOME:home,USERPROFILE:home,XDG_CONFIG_HOME:home,NODE_PATH:result.nodePath},stdin:'ignore',stdout:'pipe',stderr:'pipe',windowsHide:true})
 const timer=setTimeout(()=>child.kill(),5000),exit=await child.exited;clearTimeout(timer)
 const stdout=await new Response(child.stdout).text(),stderr=await new Response(child.stderr).text()
 expect({exit,stderr}).toEqual({exit:0,stderr:''})
 const loaded=JSON.parse(stdout);expect(loaded.client).toBe('function');expect(loaded.esmClient).toBe('function');expect(loaded.loaded.length).toBeGreaterThan(10)
 await put(join(f.root,'first-load-observation.json'),JSON.stringify({root:f.root,loaded}))
 const runtimeEntries=new Set(['bun:main','node:module',join(f.paths.sourceRoot,'[eval]')])
 for(const path of loaded.loaded){if(runtimeEntries.has(path))continue;expect(path.startsWith(f.paths.dependencyRoot)).toBe(true);expect(closure.files.has(relative(f.paths.dependencyRoot,path).replaceAll('\\','/'))).toBe(true)}
 const marker=join(f.root,'ESCAPE_EXECUTED')
 await put(join(f.root,'node_modules/pg/package.json'),'{"name":"pg","main":"index.js"}')
 await put(join(f.root,'node_modules/pg/index.js'),'require("node:fs").writeFileSync('+JSON.stringify(marker)+',"BAD");module.exports={};')
 await expect(probeHostedSetupArtifactPgResolution(result)).rejects.toThrow('escaped private')
 expect(await absent(marker)).toBe(true)
 await put(join(f.root,'observation.json'),JSON.stringify({runtime:Bun.version,versions:closure.versions,dependencyFiles:closure.files.size,resolution,loaded,escapeRefusedBeforeImport:true}))
 console.log('ARTIFACT_MATERIALIZE_PG_PROBE '+f.root)
},30000)
