/** Offline publisher for a reviewed, clean Git commit and a private pg closure.
 * It does not obtain PR evidence, authorize launch, or read source bytes from
 * the checkout. Evidence and executable pins must arrive through a separate
 * authenticated channel.
 */
import {createHash} from 'node:crypto'
import {lstat,open,readFile,readdir,realpath} from 'node:fs/promises'
import {dirname,isAbsolute,join,posix,relative,resolve} from 'node:path'
import {ARCHIVE_LIMITS,FILE_ARCHIVE_PROFILE} from './hosted-setup-artifact-materialize'
import {ARTIFACT_CONFIG,PUBLICATION_PROFILE} from './hosted-setup-artifact-source'

export const ARTIFACT_PUBLISHER_PROFILE='neuvetra.hosted-setup.offline-artifact-publisher.v1' as const
export const PR_HEAD_EVIDENCE_PROFILE='neuvetra.hosted-setup.authenticated-pr-head.v1' as const
export const PR_CHECKS_EVIDENCE_PROFILE='neuvetra.hosted-setup.authenticated-pr-checks.v1' as const
export const PR_REVIEW_EVIDENCE_PROFILE='neuvetra.hosted-setup.authenticated-pr-review.v1' as const
const REPOSITORY='neuvetra-hq/neuvetra',PULL_REQUEST=6,RUNTIME_VERSION='1.3.12'
const SHA=/^[a-f0-9]{64}$/,HEAD=/^[a-f0-9]{40}$/
const MIGRATIONS=Object.freeze([
 '0001_company_workspace.sql','0002_synthetic_bill_intake.sql','0003_synthetic_bill_calculation.sql',
 '0004_inventory_review.sql','0005_annual_electricity_register.sql','0006_inventory_evidence_pack.sql',
 '0007_inventory_draft_report.sql','0008_inventory_draft_report_review.sql','0009_private_staging.sql',
 '0010_manual_electricity_worksheet.sql','0011_worksheet_reports.sql','0012_source_electricity_worksheet.sql',
 '0013_annual_electricity_worksheet.sql','0014_annual_electricity_evidence.sql','0015_corporate_coverage.sql',
 '0016_stationary_natural_gas.sql','0017_mobile_diesel.sql','0018_controlled_fleet.sql',
 '0019_stationary_sources.sql','0020_fugitive_sources.sql','0021_scope1_inventory.sql',
 '0022_scope1_beta_foundation.sql','0023_company_setup.sql',
] as const)
const SOURCE_SEEDS=Object.freeze([
 'tools/staging/hosted-setup-artifact-worker.ts',
 'tools/staging/hosted-setup-artifact-bindings.ts',
 'tools/staging/hosted-setup-transactional-upgrade.ts',
])
const SOURCE_EXTRAS=Object.freeze(['packages/neuvetra-database/package.json'])
// Exact byte-reviewed exceptions to the relative-import rule. `pg` is the
// packaged runtime driver. The other two are lazy alternatives in shared
// source and must remain absent from this artifact's private dependency tree.
const EXTERNAL_IMPORT_RULES=Object.freeze([
 {importer:'packages/neuvetra-database/src/hosted.ts',kind:'import-statement',specifier:'pg',resolution:'packaged-runtime'},
 {importer:'packages/neuvetra-database/src/workspace.ts',kind:'dynamic-import',specifier:'@electric-sql/pglite',resolution:'inert-unavailable'},
 {importer:'tools/cloud/database-inventory.ts',kind:'require-call',specifier:'postgres',resolution:'inert-unavailable'},
] as const)
const decoder=new TextDecoder('utf-8',{fatal:true})
const sha=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex')
function check(value:unknown,message:string):asserts value{if(!value)throw Error('ARTIFACT_PUBLISHER_'+message)}
function object(value:unknown){check(value!==null&&typeof value==='object'&&!Array.isArray(value),'OBJECT_REQUIRED');return value as Record<string,unknown>}
function exact(value:object,fields:readonly string[]){check(Object.keys(value).sort().join('|')===[...fields].sort().join('|'),'SHAPE_REFUSED')}
function text(value:unknown){check(typeof value==='string'&&value.trim()===value&&value.length>0&&value.length<=300,'TEXT_REQUIRED');return value}
function digest(value:unknown){const result=text(value);check(SHA.test(result),'SHA256_REQUIRED');return result}
function head(value:unknown){const result=text(value);check(HEAD.test(result),'HEAD_REQUIRED');return result}
function integer(value:unknown){check(Number.isSafeInteger(value),'INTEGER_REQUIRED');return value as number}
function canonical(value:unknown):string{
 if(Array.isArray(value))return'['+value.map(canonical).join(',')+']'
 if(value!==null&&typeof value==='object')return'{'+Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,item])=>JSON.stringify(key)+':'+canonical(item)).join(',')+'}'
 return JSON.stringify(value)
}
function canonicalPath(value:unknown){
 const path=text(value)
 check(Buffer.byteLength(path)<=ARCHIVE_LIMITS.pathBytes&&!isAbsolute(path)&&!/[\\:\x00-\x1f\x7f<>"|?*]/.test(path),'PATH_REFUSED')
 check(path.split('/').every(part=>part!==''&&part!=='.'&&part!=='..'&&part.toLowerCase()!=='.git'&&!/[. ]$/.test(part)&&!/^(con|prn|aux|nul|clock\$|conin\$|conout\$|com[0-9¹²³]|lpt[0-9¹²³])(?:\.|$)/i.test(part)),'PATH_REFUSED')
 return path
}
function comparable(path:string){const result=resolve(path);return process.platform==='win32'?result.toLowerCase():result}
function inside(root:string,path:string){const r=relative(comparable(root),comparable(path));return r===''||(!r.startsWith('..')&&!isAbsolute(r))}
async function regular(path:string,directory=false){
 check(typeof path==='string'&&isAbsolute(path),'ABSOLUTE_PATH_REQUIRED');const target=resolve(path),stat=await lstat(target)
 check(!stat.isSymbolicLink()&&(directory?stat.isDirectory():stat.isFile()),'REGULAR_PATH_REQUIRED')
 check(comparable(await realpath(target))===comparable(target),'ALIASED_PATH_REFUSED')
 return target
}
function parseJson(raw:Uint8Array){
 const source=decoder.decode(raw);let index=0
 const whitespace=()=>{while(index<source.length&&/\s/.test(source[index]!))index++}
 const string=()=>{const start=index++;while(index<source.length){if(source[index]==='\\'){index+=2;continue}if(source[index++]==='"')break}return JSON.parse(source.slice(start,index))as string}
 const value=(depth:number)=>{check(depth<64,'JSON_DEPTH_REFUSED');whitespace();const token=source[index]
  if(token==='{'){index++;whitespace();const seen=new Set<string>();if(source[index]==='}'){index++;return}while(true){whitespace();check(source[index]==='"','JSON_REFUSED');const key=string();check(!seen.has(key),'DUPLICATE_JSON_KEY');seen.add(key);whitespace();check(source[index++]===':','JSON_REFUSED');value(depth+1);whitespace();const delimiter=source[index++];if(delimiter==='}')break;check(delimiter===',','JSON_REFUSED')}}
  else if(token==='['){index++;whitespace();if(source[index]===']'){index++;return}while(true){value(depth+1);whitespace();const delimiter=source[index++];if(delimiter===']')break;check(delimiter===',','JSON_REFUSED')}}
  else if(token==='"')string();else{const start=index;while(index<source.length&&!/[\s,}\]]/.test(source[index]!))index++;check(index>start,'JSON_REFUSED')}
 }
 let parsed:unknown;try{parsed=JSON.parse(source)}catch{throw Error('ARTIFACT_PUBLISHER_JSON_REFUSED')}
 value(0);whitespace();check(index===source.length,'JSON_REFUSED');return parsed
}
async function fileBytes(path:string,max=ARCHIVE_LIMITS.fileBytes){const target=await regular(path),stat=await lstat(target);check(stat.size>0&&stat.size<=max,'FILE_SIZE_REFUSED');const bytes=new Uint8Array(await readFile(target));check(bytes.length<=max,'FILE_SIZE_REFUSED');return bytes}

export interface ArtifactPublisherPaths{
 repositoryRoot:string;dependencyRoot:string;gitExecutable:string;runtimeExecutable:string;supervisor:string;config:string
 headEvidence:string;checksEvidence:string;reviewEvidence:string
 sourceArchive:string;dependencyArchive:string;publication:string
}
export interface ArtifactPublisherPolicy{
 reviewedProductHead:string;requiredChecks:readonly string[];operatorId:string;independentReviewerId:string;nowMs:number
 headEvidenceSha256:string;checksEvidenceSha256:string;reviewEvidenceSha256:string
 gitSha256:string;runtimeSha256:string;supervisorSha256:string;configSha256:string
}
export interface ArtifactPublication{
 profile:typeof ARTIFACT_PUBLISHER_PROFILE;reviewedProductHead:string
 publicationSha256:string;sourceArchiveSha256:string;dependencyArchiveSha256:string
 sourceFileCount:number;dependencyFileCount:number;migrationManifestSha256:string
 gitSha256:string;runtimeSha256:string;supervisorSha256:string;configSha256:string
 launchAuthorized:false;productionAuthorized:false
}
type FileEntry={path:string;content:Uint8Array}
type TreeEntry={mode:string;type:string;oid:string}

async function evidence(path:string,expected:string){const bytes=await fileBytes(path,8*1024*1024);check(sha(bytes)===expected,'EVIDENCE_PIN_MISMATCH');return object(parseJson(bytes))}
function evidenceTime(observed:unknown,expires:unknown,now:number){const start=integer(observed),end=integer(expires);check(start<=now&&end>now&&end-start<=24*60*60*1000,'EVIDENCE_TIME_REFUSED');return{start,end}}
async function git(gitExecutable:string,root:string,args:string[],binary=false){
 const child=Bun.spawn([gitExecutable,'--no-replace-objects','-c','core.fsmonitor=false','-c','core.untrackedCache=false','-c','core.preloadIndex=false','-C',root,...args],{stdin:'ignore',stdout:'pipe',stderr:'pipe',windowsHide:true,env:{SystemRoot:process.env.SystemRoot??'C:\\Windows',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:process.platform==='win32'?'NUL':'/dev/null',GIT_NO_REPLACE_OBJECTS:'1',GIT_OPTIONAL_LOCKS:'0'}})
 const stdout=new Uint8Array(await new Response(child.stdout).arrayBuffer()),stderr=new Uint8Array(await new Response(child.stderr).arrayBuffer()),code=await child.exited
 check(code===0&&stderr.length===0,'GIT_COMMAND_REFUSED');check(stdout.length<=128*1024*1024,'GIT_OUTPUT_REFUSED')
 return binary?stdout:decoder.decode(stdout).trim()
}
function gitOid(type:'commit'|'tree'|'blob',bytes:Uint8Array){return createHash('sha1').update(type+' '+bytes.length+'\0').update(bytes).digest('hex')}
async function assertCleanHead(gitExecutable:string,root:string,expectedHead:string){
 const top=await git(gitExecutable,root,['rev-parse','--show-toplevel'])as string
 check(comparable(top)===comparable(root),'GIT_ROOT_REFUSED')
 check(await git(gitExecutable,root,['rev-parse','--verify','HEAD^{commit}'])===expectedHead,'GIT_HEAD_MISMATCH')
 check(await git(gitExecutable,root,['cat-file','-t',expectedHead])==='commit','GIT_COMMIT_OBJECT_REFUSED')
 const commit=await git(gitExecutable,root,['cat-file','commit',expectedHead],true)as Uint8Array;check(gitOid('commit',commit)===expectedHead,'GIT_COMMIT_IDENTITY_REFUSED')
 const treeLine=/^tree ([a-f0-9]{40})$/m.exec(decoder.decode(commit));check(treeLine,'GIT_COMMIT_TREE_REFUSED')
 const treeOid=treeLine[1]!,resolvedTree=await git(gitExecutable,root,['rev-parse','--verify',expectedHead+'^{tree}'])as string;check(resolvedTree===treeOid,'GIT_COMMIT_TREE_REFUSED')
 const treeBytes=await git(gitExecutable,root,['cat-file','tree',treeOid],true)as Uint8Array;check(gitOid('tree',treeBytes)===treeOid,'GIT_TREE_IDENTITY_REFUSED')
 check(await git(gitExecutable,root,['status','--porcelain=v1','--untracked-files=all'])==='','DIRTY_CHECKOUT_REFUSED')
 return treeOid
}
async function tree(gitExecutable:string,root:string,treeOid:string){
 const map=new Map<string,TreeEntry>()
 const walk=async(oid:string,prefix:string,depth:number):Promise<void>=>{
  check(HEAD.test(oid)&&depth<64,'GIT_TREE_REFUSED')
  const raw=await git(gitExecutable,root,['cat-file','tree',oid],true)as Uint8Array;check(gitOid('tree',raw)===oid,'GIT_TREE_IDENTITY_REFUSED')
  let cursor=0,names=new Set<string>()
  while(cursor<raw.length){
   const modeStart=cursor;while(cursor<raw.length&&raw[cursor]!==0x20)cursor++;check(cursor>modeStart&&cursor<raw.length,'GIT_TREE_REFUSED');const mode=decoder.decode(raw.subarray(modeStart,cursor++))
   const nameStart=cursor;while(cursor<raw.length&&raw[cursor]!==0)cursor++;check(cursor>nameStart&&cursor<raw.length,'GIT_TREE_REFUSED');const name=decoder.decode(raw.subarray(nameStart,cursor++));check(!name.includes('/')&&name!=='.'&&name!=='..'&&!names.has(name),'GIT_TREE_REFUSED');names.add(name)
   check(cursor+20<=raw.length,'GIT_TREE_REFUSED');const childOid=Buffer.from(raw.subarray(cursor,cursor+20)).toString('hex');cursor+=20
   const path=canonicalPath(prefix?prefix+'/'+name:name)
   if(mode==='40000')await walk(childOid,path,depth+1)
   else{check(mode==='100644'||mode==='100755'||mode==='120000'||mode==='160000','GIT_TREE_REFUSED');check(!map.has(path),'GIT_TREE_REFUSED');map.set(path,{mode,type:mode==='160000'?'commit':'blob',oid:childOid})}
  }
 }
 await walk(treeOid,'',0)
 return map
}
async function blob(gitExecutable:string,root:string,path:string,entries:Map<string,TreeEntry>){
 const item=entries.get(path);check(item&&item.type==='blob'&&(item.mode==='100644'||item.mode==='100755'),'COMMIT_REGULAR_FILE_REQUIRED')
 const bytes=await git(gitExecutable,root,['cat-file','blob',item.oid],true)as Uint8Array;check(bytes.length<=ARCHIVE_LIMITS.fileBytes&&gitOid('blob',bytes)===item.oid,'GIT_BLOB_IDENTITY_REFUSED');return bytes
}
function resolveImport(importer:string,specifier:string,entries:Map<string,TreeEntry>){
 if(specifier.startsWith('node:'))return null
 check(specifier.startsWith('.'),'PATH_ALIAS_OR_EXTERNAL_IMPORT_REFUSED')
 const base=posix.normalize(posix.join(posix.dirname(importer),specifier));canonicalPath(base)
 const candidates=[base,base+'.ts',base+'.tsx',base+'.js',base+'.json',base+'/index.ts',base+'/index.tsx',base+'/index.js'].filter(candidate=>entries.has(candidate))
 check(candidates.length===1,'IMPORT_RESOLUTION_REFUSED');return candidates[0]!
}
async function sourceClosure(gitExecutable:string,root:string,entries:Map<string,TreeEntry>){
 const selected=new Map<string,Uint8Array>(),queue=[...SOURCE_SEEDS],transpiler=new Bun.Transpiler({loader:'ts'}),externals=new Set<string>()
 const rule=(importer:string,kind:string,specifier:string)=>EXTERNAL_IMPORT_RULES.find(item=>item.importer===importer&&item.kind===kind&&item.specifier===specifier)
 for(const path of SOURCE_EXTRAS)selected.set(path,await blob(gitExecutable,root,path,entries))
 for(const name of MIGRATIONS){const path='packages/neuvetra-database/src/migrations/'+name;selected.set(path,await blob(gitExecutable,root,path,entries))}
 while(queue.length){const path=canonicalPath(queue.shift()!);if(selected.has(path))continue
  const bytes=await blob(gitExecutable,root,path,entries);selected.set(path,bytes)
  check(path.endsWith('.ts')||path.endsWith('.tsx')||path.endsWith('.js'),'EXECUTABLE_SOURCE_TYPE_REFUSED')
  let imports:ReturnType<typeof transpiler.scanImports>;try{imports=transpiler.scanImports(decoder.decode(bytes))}catch{throw Error('ARTIFACT_PUBLISHER_SOURCE_PARSE_REFUSED')}
  for(const item of imports){
   if(!item.path.startsWith('.')&&!item.path.startsWith('node:')){const allowed=rule(path,item.kind,item.path);check(allowed&&!externals.has(allowed.importer+'\0'+allowed.kind+'\0'+allowed.specifier),'PATH_ALIAS_OR_EXTERNAL_IMPORT_REFUSED');externals.add(allowed.importer+'\0'+allowed.kind+'\0'+allowed.specifier);continue}
   const target=resolveImport(path,item.path,entries);if(target&&!selected.has(target))queue.push(target)
  }
 }
 check(externals.size===EXTERNAL_IMPORT_RULES.length,'EXTERNAL_IMPORT_SET_REFUSED')
 return selected
}
async function findPackage(root:string,name:string,issuer?:string,optional=false):Promise<string|null>{
 check(/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i.test(name)&&!name.includes('..'),'DEPENDENCY_NAME_REFUSED')
 const candidates:string[]=[]
 if(issuer){let current=issuer;while(inside(root,current)){candidates.push(join(current,'node_modules',...name.split('/')));if(comparable(current)===comparable(root))break;current=dirname(current)}}
 else candidates.push(join(root,'node_modules',...name.split('/')))
 for(const candidate of candidates){try{await lstat(candidate)}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')continue;throw error}return await regular(candidate,true)}
 if(optional)return null
 throw Error('ARTIFACT_PUBLISHER_DEPENDENCY_MISSING')
}
async function dependencyClosure(root:string){
 const dependencyRoot=await regular(root,true),packages=new Map<string,{root:string;metadata:Record<string,unknown>}>(),queue:[string,string?,boolean?][]=[['pg',undefined,false]]
 while(queue.length){const[name,issuer,optional]=queue.shift()!,packageRoot=await findPackage(dependencyRoot,name,issuer,optional===true);if(packageRoot===null)continue;const key=comparable(packageRoot);if(packages.has(key))continue
  const packageFile=join(packageRoot,'package.json'),metadata=object(parseJson(await fileBytes(packageFile)))
  check(metadata.name===name&&typeof metadata.version==='string'&&metadata.version.length>0,'DEPENDENCY_IDENTITY_REFUSED');packages.set(key,{root:packageRoot,metadata})
  const peerDependencies=metadata.peerDependencies===undefined?{}:object(metadata.peerDependencies),peerMetadata=metadata.peerDependenciesMeta===undefined?{}:object(metadata.peerDependenciesMeta)
  for(const child of Object.keys(peerMetadata)){check(Object.hasOwn(peerDependencies,child),'PEER_METADATA_REFUSED');const declaration=object(peerMetadata[child]);exact(declaration,['optional']);check(typeof declaration.optional==='boolean','PEER_METADATA_REFUSED')}
  for(const field of ['dependencies','optionalDependencies']as const){if(metadata[field]===undefined)continue;const values=object(metadata[field]);for(const child of Object.keys(values).sort()){check(typeof values[child]==='string'&&(values[child]as string).length>0,'DEPENDENCY_RANGE_REFUSED');queue.push([child,packageRoot,false])}}
  for(const child of Object.keys(peerDependencies).sort()){check(typeof peerDependencies[child]==='string'&&(peerDependencies[child]as string).length>0,'DEPENDENCY_RANGE_REFUSED');queue.push([child,packageRoot,object(peerMetadata[child]??{}).optional===true])}
 }
 const files=new Map<string,Uint8Array>()
 for(const pkg of packages.values()){
  const walk=async(directory:string)=>{for(const name of(await readdir(directory)).sort()){const full=join(directory,name);if(name==='node_modules')continue;const stat=await lstat(full);check(!stat.isSymbolicLink()&&comparable(await realpath(full))===comparable(full),'DEPENDENCY_LINK_REFUSED');if(stat.isDirectory())await walk(full);else{check(stat.isFile()&&stat.nlink===1,'DEPENDENCY_NONREGULAR_REFUSED');const path=canonicalPath(relative(dependencyRoot,full).replaceAll('\\','/'));const content=new Uint8Array(await readFile(full));check(content.length<=ARCHIVE_LIMITS.fileBytes,'FILE_SIZE_REFUSED');files.set(path,content)}}}
  await walk(pkg.root)
 }
 const actual=new Set<string>()
 const walkAll=async(directory:string)=>{for(const name of(await readdir(directory)).sort()){const full=join(directory,name),stat=await lstat(full);check(!stat.isSymbolicLink()&&comparable(await realpath(full))===comparable(full),'DEPENDENCY_LINK_REFUSED');if(stat.isDirectory())await walkAll(full);else{check(stat.isFile()&&stat.nlink===1,'DEPENDENCY_NONREGULAR_REFUSED');actual.add(canonicalPath(relative(dependencyRoot,full).replaceAll('\\','/')))}}}
 await walkAll(dependencyRoot);check(actual.size===files.size&&[...actual].every(path=>files.has(path)),'DEPENDENCY_ROOT_NOT_PRIVATE_CLOSURE')
 return{files,packageNames:new Set([...packages.values()].map(pkg=>pkg.metadata.name as string))}
}
function archive(files:Map<string,Uint8Array>,kind:'source'|'dependency'){
 check(files.size>0&&files.size<=ARCHIVE_LIMITS.files,'ARCHIVE_FILE_COUNT_REFUSED');let total=0,prior='';const names=new Map<string,string>(),fileNames=new Set<string>()
 const rows=[...files].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([path,content])=>{canonicalPath(path);check(path>prior,'ARCHIVE_PATH_COLLISION');prior=path
  const segments=path.split('/');let prefix=''
  for(const[index,segment]of segments.entries()){prefix=prefix?prefix+'/'+segment:segment;const folded=prefix.toLowerCase(),priorName=names.get(folded);check(priorName===undefined||priorName===prefix,'ARCHIVE_PATH_COLLISION');check(!fileNames.has(folded),'ARCHIVE_PATH_COLLISION');names.set(folded,prefix);if(index===segments.length-1){check(priorName===undefined,'ARCHIVE_PATH_COLLISION');fileNames.add(folded)}}
  check(kind==='source'?!segments.some(segment=>segment.toLowerCase()==='node_modules'):segments[0]==='node_modules','ARCHIVE_LAYOUT_REFUSED');total+=content.length;check(total<=ARCHIVE_LIMITS.totalDecodedBytes,'ARCHIVE_SIZE_REFUSED');return{path,kind:'file' as const,contentBase64:Buffer.from(content).toString('base64')}})
 const bytes=Buffer.from(JSON.stringify({profile:FILE_ARCHIVE_PROFILE,files:rows}));check(bytes.length<=ARCHIVE_LIMITS.archiveBytes,'ARCHIVE_SIZE_REFUSED')
 return{bytes:new Uint8Array(bytes),pins:rows.map((row,index)=>({path:row.path,sha256:sha([...files].sort(([a],[b])=>a<b?-1:a>b?1:0)[index]![1])}))}
}
async function outputPath(path:string,excluded:string[]){
 check(typeof path==='string'&&isAbsolute(path),'ABSOLUTE_PATH_REQUIRED');const target=resolve(path);await regular(dirname(target),true)
 check(!excluded.some(root=>inside(root,target)),'OUTPUT_LOCATION_REFUSED');try{await lstat(target)}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return target;throw error}throw Error('ARTIFACT_PUBLISHER_OUTPUT_EXISTS')
}
async function writeExclusive(path:string,bytes:Uint8Array){const file=await open(path,'wx',0o600);try{await file.writeFile(bytes);await file.sync()}finally{await file.close()}}

export async function publishHostedSetupArtifact(paths:ArtifactPublisherPaths,policy:ArtifactPublisherPolicy):Promise<Readonly<ArtifactPublication>>{
 const p=JSON.parse(JSON.stringify(paths))as ArtifactPublisherPaths,q=JSON.parse(JSON.stringify(policy))as ArtifactPublisherPolicy
 exact(p,['repositoryRoot','dependencyRoot','gitExecutable','runtimeExecutable','supervisor','config','headEvidence','checksEvidence','reviewEvidence','sourceArchive','dependencyArchive','publication'])
 exact(q,['reviewedProductHead','requiredChecks','operatorId','independentReviewerId','nowMs','headEvidenceSha256','checksEvidenceSha256','reviewEvidenceSha256','gitSha256','runtimeSha256','supervisorSha256','configSha256'])
 const reviewedHead=head(q.reviewedProductHead),now=integer(q.nowMs),operator=text(q.operatorId),reviewer=text(q.independentReviewerId);check(operator!==reviewer,'INDEPENDENT_REVIEW_REQUIRED')
 check(Array.isArray(q.requiredChecks)&&q.requiredChecks.length>0&&q.requiredChecks.every(item=>typeof item==='string'&&item.length>0)&&new Set(q.requiredChecks).size===q.requiredChecks.length,'REQUIRED_CHECKS_REFUSED')
 const evidencePins=[digest(q.headEvidenceSha256),digest(q.checksEvidenceSha256),digest(q.reviewEvidenceSha256)]
 const expectedPins=[digest(q.gitSha256),digest(q.runtimeSha256),digest(q.supervisorSha256),digest(q.configSha256)]
 const repositoryRoot=await regular(p.repositoryRoot,true),dependencyRoot=await regular(p.dependencyRoot,true)
 check(!inside(repositoryRoot,dependencyRoot)&&!inside(dependencyRoot,repositoryRoot),'PRIVATE_DEPENDENCY_ROOT_REQUIRED')
 const gitExecutable=await regular(p.gitExecutable),runtimeExecutable=await regular(p.runtimeExecutable),supervisor=await regular(p.supervisor),config=await regular(p.config)
 for(const [path,pin] of [[gitExecutable,expectedPins[0]],[runtimeExecutable,expectedPins[1]],[supervisor,expectedPins[2]],[config,expectedPins[3]]]as const)check(sha(await readFile(path))===pin,'EXECUTABLE_OR_CONFIG_PIN_MISMATCH')
 check(decoder.decode(await readFile(config))===ARTIFACT_CONFIG&&Bun.version===RUNTIME_VERSION&&comparable(runtimeExecutable)===comparable(process.execPath),'FIXED_RUNTIME_REFUSED')
 const headDoc=await evidence(p.headEvidence,evidencePins[0]!),checksDoc=await evidence(p.checksEvidence,evidencePins[1]!),reviewDoc=await evidence(p.reviewEvidence,evidencePins[2]!)
 exact(headDoc,['profile','repository','pullRequest','head','observedAtMs','expiresAtMs']);exact(checksDoc,['profile','repository','pullRequest','head','observedAtMs','expiresAtMs','checks']);exact(reviewDoc,['profile','repository','pullRequest','head','operatorId','independentReviewerId','verdict','materialFindingsOpen','reviewedAtMs','expiresAtMs'])
 for(const doc of[headDoc,checksDoc,reviewDoc])check(doc.repository===REPOSITORY&&doc.pullRequest===PULL_REQUEST&&doc.head===reviewedHead,'EVIDENCE_TARGET_REFUSED')
 check(headDoc.profile===PR_HEAD_EVIDENCE_PROFILE&&checksDoc.profile===PR_CHECKS_EVIDENCE_PROFILE&&reviewDoc.profile===PR_REVIEW_EVIDENCE_PROFILE,'EVIDENCE_PROFILE_REFUSED')
 const headTime=evidenceTime(headDoc.observedAtMs,headDoc.expiresAtMs,now),checksTime=evidenceTime(checksDoc.observedAtMs,checksDoc.expiresAtMs,now),reviewTime=evidenceTime(reviewDoc.reviewedAtMs,reviewDoc.expiresAtMs,now)
 check(reviewTime.start>=headTime.start&&reviewTime.start>=checksTime.start,'REVIEW_CHRONOLOGY_REFUSED')
 check(reviewDoc.operatorId===operator&&reviewDoc.independentReviewerId===reviewer&&reviewDoc.verdict==='accepted'&&reviewDoc.materialFindingsOpen===0,'REVIEW_REFUSED')
 check(Array.isArray(checksDoc.checks)&&checksDoc.checks.length===q.requiredChecks.length,'CHECKS_REFUSED')
 const checks=(checksDoc.checks as unknown[]).map(value=>{const row=object(value);exact(row,['name','head','conclusion']);return{name:text(row.name),head:head(row.head),conclusion:row.conclusion}})
 for(const name of q.requiredChecks)check(checks.filter(item=>item.name===name&&item.head===reviewedHead&&item.conclusion==='success').length===1,'CHECKS_REFUSED')
 const treeOid=await assertCleanHead(gitExecutable,repositoryRoot,reviewedHead),entries=await tree(gitExecutable,repositoryRoot,treeOid)
 const sourceFiles=await sourceClosure(gitExecutable,repositoryRoot,entries),dependencyClosureResult=await dependencyClosure(dependencyRoot),dependencyFiles=dependencyClosureResult.files
 for(const rule of EXTERNAL_IMPORT_RULES)check(rule.resolution==='packaged-runtime'?dependencyClosureResult.packageNames.has(rule.specifier):!dependencyClosureResult.packageNames.has(rule.specifier),'EXTERNAL_IMPORT_DEPENDENCY_REFUSED')
 const source=archive(sourceFiles,'source'),dependencies=archive(dependencyFiles,'dependency')
 const migrations=[] as{path:string;name:string;sha256:string;normalizedSha256:string}[],manifest=[]as{name:string;sha256:string;sql:string}[]
 for(const name of MIGRATIONS){const path='packages/neuvetra-database/src/migrations/'+name,bytes=sourceFiles.get(path);check(bytes&&bytes.length>0,'MIGRATION_MISSING');const sql=decoder.decode(bytes).replace(/\r\n/g,'\n'),normalizedSha256=sha(sql);migrations.push({path,name,sha256:sha(bytes),normalizedSha256});manifest.push({name,sha256:normalizedSha256,sql})}
 const migrationManifestSha256=sha(canonical(manifest)),observedAtMs=Math.max(headTime.start,checksTime.start,reviewTime.start),expiresAtMs=Math.min(headTime.end,checksTime.end,reviewTime.end)
 const receipt={profile:PUBLICATION_PROFILE,trustBoundary:'trusted-operator-host',reviewedProductHead:reviewedHead,repository:REPOSITORY,pullRequest:PULL_REQUEST,operatorId:operator,independentReviewerId:reviewer,materialFindingsOpen:0,observedAtMs,expiresAtMs,checks,
  publisherEvidence:{profile:ARTIFACT_PUBLISHER_PROFILE,sourceRead:'exact-clean-git-commit',gitSha256:expectedPins[0],headEvidenceSha256:evidencePins[0],checksEvidenceSha256:evidencePins[1],reviewEvidenceSha256:evidencePins[2]},
  sourceFiles:source.pins,dependencyFiles:dependencies.pins,migrations,migrationManifestSha256,artifact:{sourceArchiveSha256:sha(source.bytes),dependencyArchiveSha256:sha(dependencies.bytes),runtimeSha256:expectedPins[1],supervisorSha256:expectedPins[2],configSha256:expectedPins[3],entrypoint:'tools/staging/hosted-setup-artifact-worker.ts',launchPolicy:'neuvetra.hosted-setup.fixed-bun-worker.v1'}}
 const publicationBytes=new TextEncoder().encode(JSON.stringify(receipt));check(publicationBytes.length<=32*1024*1024,'PUBLICATION_SIZE_REFUSED')
 await assertCleanHead(gitExecutable,repositoryRoot,reviewedHead)
 const excluded=[repositoryRoot,dependencyRoot],sourceArchive=await outputPath(p.sourceArchive,excluded),dependencyArchive=await outputPath(p.dependencyArchive,excluded),publication=await outputPath(p.publication,excluded)
 check(new Set([comparable(sourceArchive),comparable(dependencyArchive),comparable(publication)]).size===3,'OUTPUT_COLLISION_REFUSED')
 await writeExclusive(sourceArchive,source.bytes);await writeExclusive(dependencyArchive,dependencies.bytes);await writeExclusive(publication,publicationBytes)
 await assertCleanHead(gitExecutable,repositoryRoot,reviewedHead)
 return Object.freeze({profile:ARTIFACT_PUBLISHER_PROFILE,reviewedProductHead:reviewedHead,publicationSha256:sha(publicationBytes),sourceArchiveSha256:sha(source.bytes),dependencyArchiveSha256:sha(dependencies.bytes),sourceFileCount:sourceFiles.size,dependencyFileCount:dependencyFiles.size,migrationManifestSha256,gitSha256:expectedPins[0],runtimeSha256:expectedPins[1],supervisorSha256:expectedPins[2],configSha256:expectedPins[3],launchAuthorized:false,productionAuthorized:false})
}
