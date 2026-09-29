/** Offline regular-file archive materialization; no installation or migration. */
import {createHash} from 'node:crypto'
import {lstat,mkdir,mkdtemp,open,readFile,realpath} from 'node:fs/promises'
import {dirname,isAbsolute,join,relative,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {PUBLICATION_PROFILE,verifyHostedSetupArtifact,type ArtifactInspection,type ArtifactPaths,type ArtifactTrustPolicy} from './hosted-setup-artifact-source'

export const MATERIALIZATION_PROFILE='neuvetra.hosted-setup.materialization.v1' as const
export const FILE_ARCHIVE_PROFILE='neuvetra.hosted-setup.regular-file-archive.v1' as const
export const ARCHIVE_LIMITS=Object.freeze({archiveBytes:128*1024*1024,totalDecodedBytes:80*1024*1024,fileBytes:16*1024*1024,files:100000,pathBytes:1024})
const sha=(v:string|Uint8Array)=>createHash('sha256').update(v).digest('hex')
const utf8=new TextDecoder('utf-8',{fatal:true})
function check(v:unknown,message:string):asserts v{if(!v)throw Error(message)}
function object(v:unknown){check(v!==null&&typeof v==='object'&&!Array.isArray(v),'Archive object required');return v as Record<string,unknown>}
function exact(v:object,keys:string[]){check(Object.keys(v).sort().join('|')===keys.sort().join('|'),'Unexpected archive fields')}
function digest(v:unknown):string{check(typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),'Archive SHA-256 required');return v}
function canonicalPath(v:unknown):string{
 check(typeof v==='string'&&Buffer.byteLength(v)<=ARCHIVE_LIMITS.pathBytes&&v.length>0&&!/[\\:\x00-\x1f\x7f<>"|?*]/.test(v),'Unsafe archive path')
 check(v.split('/').every(p=>p.length>0&&p!=='.'&&p!=='..'&&p.toLowerCase()!=='.git'&&!/[. ]$/.test(p)&&!/^(con|prn|aux|nul|clock\$|conin\$|conout\$|com[0-9¹²³]|lpt[0-9¹²³])(?:\.|$)/i.test(p)),'Unsafe archive path')
 return v
}
function cmp(p:string){return process.platform==='win32'?resolve(p).toLowerCase():resolve(p)}
function inside(root:string,p:string){const r=relative(cmp(root),cmp(p));return r===''||(!r.startsWith('..')&&!isAbsolute(r))}
async function regular(path:string,directory:boolean){
 check(typeof path==='string'&&isAbsolute(path),'Absolute materialization path required')
 const s=await lstat(path)
 check(!s.isSymbolicLink()&&(directory?s.isDirectory():s.isFile()),'Nonregular or aliased path refused')
 check(cmp(await realpath(path))===cmp(path),'Symlink/junction ancestor refused')
 return s
}
async function bytes(path:string,max:number){const s=await regular(path,false);check(s.size<=max,'Artifact exceeds size limit');const b=new Uint8Array(await readFile(path));check(b.length<=max,'Artifact exceeds size limit');return b}
interface Entry {path:string;content:Uint8Array;sha256:string}
function parseArchive(raw:Uint8Array,expected:unknown,kind:'source'|'dependency'):Entry[]{
 const archive=object(JSON.parse(utf8.decode(raw)));exact(archive,['profile','files'])
 check(archive.profile===FILE_ARCHIVE_PROFILE,'Unsupported regular-file archive profile')
 check(Array.isArray(archive.files)&&archive.files.length>0&&archive.files.length<=ARCHIVE_LIMITS.files,'Bounded nonempty archive required')
 check(Array.isArray(expected)&&expected.length===archive.files.length,'Archive inventory length mismatch')
 let prior='',total=0;const names=new Map<string,string>(),fileNames=new Set<string>()
 const entries:Entry[]=[]
 for(const [index,value] of archive.files.entries()){
  const row=object(value);exact(row,['path','kind','contentBase64'])
  check(row.kind==='file','Only regular file archive entries are permitted')
  const path=canonicalPath(row.path)
  check(path>prior,'Archive paths must be sorted and unique');prior=path
  const segments=path.split('/');let prefix=''
  for(const [i,segment] of segments.entries()){
   prefix=prefix?prefix+'/'+segment:segment;const folded=prefix.toLowerCase(),priorName=names.get(folded)
   check(priorName===undefined||priorName===prefix,'Case alias archive path refused')
   check(!fileNames.has(folded),'File/directory archive collision refused');names.set(folded,prefix)
   if(i===segments.length-1){check(priorName===undefined,'File/directory archive collision refused');fileNames.add(folded)}
  }
  check(kind==='source'?!segments.some(s=>s.toLowerCase()==='node_modules'):segments[0]==='node_modules','Source shadow or dependency layout refused')
  check(typeof row.contentBase64==='string'&&row.contentBase64.length<=Math.ceil(ARCHIVE_LIMITS.fileBytes/3)*4,'Bounded base64 file required')
  // A repeated-group regex falsely refuses large canonical inputs on Bun
  // 1.3.12. Bound allocation first, then require exact native re-encoding:
  // tolerant decoder behavior (padding bits, whitespace, URL alphabet, junk)
  // cannot pass this equality check against canonical base64 output.
  check(row.contentBase64.length%4===0,'Canonical base64 required')
  const content=Buffer.from(row.contentBase64,'base64')
  check(content.length<=ARCHIVE_LIMITS.fileBytes&&content.toString('base64')===row.contentBase64,'Canonical bounded base64 required')
  total+=content.length;check(total<=ARCHIVE_LIMITS.totalDecodedBytes,'Archive decoded size limit exceeded')
  const pin=object(expected[index]);exact(pin,['path','sha256'])
  check(pin.path===path&&digest(pin.sha256)===sha(content),'Archive inventory digest mismatch')
  entries.push({path,content,sha256:sha(content)})
 }
 return entries
}
async function freshRoot(root:string,checkouts:readonly string[]){
 canonicalPath(root.replaceAll('\\','/').split('/').at(-1))
 await regular(dirname(root),true)
 check(!checkouts.some(c=>inside(c,root)||inside(root,c)),'Materialization must be outside active checkouts')
 try{await lstat(root)}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw error}
 throw Error('Materialization destination already exists')
}
async function extract(root:string,entries:Entry[]){
 const created=new Set<string>([cmp(root)])
 for(const entry of entries){
  let directory=root
  for(const segment of entry.path.split('/').slice(0,-1)){
   directory=join(directory,segment)
   if(!created.has(cmp(directory))){await mkdir(directory,{mode:0o700});created.add(cmp(directory))}
   await regular(directory,true)
  }
  await regular(root,true)
  const target=resolve(root,entry.path);check(inside(root,target),'Archive destination escape refused')
  const handle=await open(target,'wx',0o600)
  try{await handle.writeFile(entry.content);await handle.sync()}finally{await handle.close()}
 }
}
export interface MaterializedArtifact {
 profile:typeof MATERIALIZATION_PROFILE;archiveProfile:typeof FILE_ARCHIVE_PROFILE
 inspection:ArtifactInspection;sourceFileCount:number;dependencyFileCount:number;nodePath:string;launchAuthorized:false
}
const capabilities=new WeakMap<MaterializedArtifact,{paths:ArtifactPaths;policy:ArtifactTrustPolicy;dependencyPins:ReadonlyMap<string,string>}>()
/** Existing/partial destinations are never reused or removed, including on error. */
export async function materializeHostedSetupArtifact(paths:ArtifactPaths,policy:ArtifactTrustPolicy):Promise<MaterializedArtifact>{
 const p=JSON.parse(JSON.stringify(paths)) as ArtifactPaths,q=JSON.parse(JSON.stringify(policy)) as ArtifactTrustPolicy
 exact(p,['publication','sourceArchive','dependencyArchive','sourceRoot','dependencyRoot','runtimeExecutable','supervisor','config'])
 for(const path of Object.values(p))check(typeof path==='string'&&isAbsolute(path),'Absolute materialization path required')
 check(Array.isArray(q.activeCheckoutRoots)&&q.activeCheckoutRoots.length>0,'Checkout exclusions required')
 for(const checkout of q.activeCheckoutRoots)await regular(checkout,true)
 check(!inside(p.sourceRoot,p.dependencyRoot)&&!inside(p.dependencyRoot,p.sourceRoot),'Separate private roots required')
 await freshRoot(p.sourceRoot,q.activeCheckoutRoots);await freshRoot(p.dependencyRoot,q.activeCheckoutRoots)
 const publication=await bytes(p.publication,32*1024*1024)
 check(sha(publication)===digest(q.publicationSha256),'Publication trust pin mismatch')
 const receipt=object(JSON.parse(utf8.decode(publication))),artifact=object(receipt.artifact)
 check(receipt.profile===PUBLICATION_PROFILE&&receipt.reviewedProductHead===q.reviewedProductHead,'Publication identity mismatch')
 const sourceBytes=await bytes(p.sourceArchive,ARCHIVE_LIMITS.archiveBytes),dependencyBytes=await bytes(p.dependencyArchive,ARCHIVE_LIMITS.archiveBytes)
 check(sha(sourceBytes)===digest(artifact.sourceArchiveSha256)&&sha(dependencyBytes)===digest(artifact.dependencyArchiveSha256),'Pinned archive mismatch')
 const source=parseArchive(sourceBytes,receipt.sourceFiles,'source'),dependency=parseArchive(dependencyBytes,receipt.dependencyFiles,'dependency')
 // No archive entry can create links, modes, devices or execute scripts. All
 // bytes and names are validated before the first exclusive directory write.
 await mkdir(p.sourceRoot,{mode:0o700});await mkdir(p.dependencyRoot,{mode:0o700})
 await extract(p.sourceRoot,source);await extract(p.dependencyRoot,dependency)
 const inspection=await verifyHostedSetupArtifact(p,q)
 const result=Object.freeze({profile:MATERIALIZATION_PROFILE,archiveProfile:FILE_ARCHIVE_PROFILE,inspection,sourceFileCount:source.length,dependencyFileCount:dependency.length,nodePath:join(resolve(p.dependencyRoot),'node_modules'),launchAuthorized:false as const})
 capabilities.set(result,{paths:p,policy:q,dependencyPins:new Map(dependency.map(e=>[e.path,e.sha256]))})
 return result
}
/** Resolution only: does not import pg, connect, authenticate publication or launch maintenance. */
export async function probeHostedSetupArtifactPgResolution(materialization:MaterializedArtifact){
 const capability=capabilities.get(materialization);check(capability,'Genuine materialization capability required')
 const {paths:p,policy:q,dependencyPins}=capability
 await verifyHostedSetupArtifact(p,q)
 const home=await mkdtemp(join(dirname(p.sourceRoot),'hosted-pg-resolution-'))
 const script=`import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';
 const require=createRequire(pathToFileURL(${JSON.stringify(join(p.sourceRoot,'packages/neuvetra-database/package.json'))}));
 console.log(JSON.stringify({runtime:Bun.version,cjs:require.resolve('pg'),esm:import.meta.resolve('pg')}));`
 const args=[p.runtimeExecutable,'--no-env-file','--no-install','--config='+p.config,'--eval',script]
 const child=Bun.spawn(args,{cwd:p.sourceRoot,env:{SystemRoot:process.env.SystemRoot??'C:\\Windows',HOME:home,USERPROFILE:home,XDG_CONFIG_HOME:home,TEMP:home,TMP:home,NODE_PATH:materialization.nodePath},stdin:'ignore',stdout:'pipe',stderr:'pipe',windowsHide:true})
 let expired=false;const timer=setTimeout(()=>{expired=true;child.kill()},5000)
 const code=await child.exited;clearTimeout(timer)
 const output=await new Response(child.stdout).text();await new Response(child.stderr).text()
 check(!expired&&code===0,'Fixed pg resolution probe failed or timed out')
 const observed=object(JSON.parse(output));check(observed.runtime==='1.3.12','Pinned Bun resolution version mismatch')
 const resolved:string[]=[]
 for(const value of [observed.cjs,observed.esm]){
  check(typeof value==='string','Resolution path required');const path=value.startsWith('file:')?fileURLToPath(value):value
  await regular(path,false);check(inside(p.dependencyRoot,path),'pg resolution escaped private dependency root')
  const name=relative(p.dependencyRoot,path).replaceAll('\\','/'),pin=dependencyPins.get(name)
  check(pin&&sha(await readFile(path))===pin,'Resolved pg entry is not pinned');resolved.push(path)
 }
 return Object.freeze({profile:'neuvetra.hosted-setup.pg-entry-resolution.v1' as const,runtimeVersion:'1.3.12' as const,requirePath:resolved[0]!,esmPath:resolved[1]!,nodePath:materialization.nodePath,loadedPg:false as const,launchAuthorized:false as const})
}
