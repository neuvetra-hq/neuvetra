import { randomBytes, randomUUID } from "node:crypto"
import { extractDatabaseUrl } from "../cloud/database-inventory"
import { createPostgresConnection } from "../../packages/neuvetra-database/src/hosted"
import { loadStagingDatabaseCa } from "../../packages/neuvetra-database/src/staging-tls"
import { provisionStagingRoster } from "../../packages/neuvetra-database/src/staging-migrations"
const [source, encryptedOutput] = process.argv.slice(2)
let db: ReturnType<typeof createPostgresConnection> | undefined
let stage = "validate"
try {
  if (!source || !encryptedOutput || await Bun.file(encryptedOutput).exists()) throw new Error()
  const raw = await Bun.file(source).text()
  // Parse only the explicitly required privileged Auth assignment. Never evaluate the export.
  const matches = raw.split(/\r?\n/).flatMap(line => {
    const m=line.match(/^\s*(?:export\s+)?SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.*?)\s*$/) ?? line.match(/^\s*"SUPABASE_SERVICE_ROLE_KEY"\s*:\s*("(?:[^"\\]|\\.)*")\s*,?\s*$/)
    if (!m) return []
    const v=m[1]!; return [v.startsWith('"')?JSON.parse(v):v.startsWith("'")&&v.endsWith("'")?v.slice(1,-1):v]
  })
  if (matches.length!==1 || typeof matches[0]!=="string") throw new Error()
  const key=matches[0], ref="icockcoguyadhryzydvl", base=`https://${ref}.supabase.co`
  const url=new URL(extractDatabaseUrl(raw))
  if(url.hostname!=="aws-1-us-west-1.pooler.supabase.com"||url.port!=="5432"||url.username!==`postgres.${ref}`||url.pathname!=="/postgres")throw new Error()
  url.search=""
  db=createPostgresConnection(url.toString(),{maxConnections:1,tlsCaPem:await loadStagingDatabaseCa({caFile:"tools/cloud/fixtures/supabase-prod-ca-2021.crt"})})
  const create=async(email:string,password?:string)=>{
    const response=await fetch(base+"/auth/v1/admin/users",{method:"POST",headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({email,...(password?{password,email_confirm:true}:{email_confirm:false}),app_metadata:{neuvetra_m63_synthetic:true}}),signal:AbortSignal.timeout(15000)})
    if(!response.ok)throw new Error("Auth provisioning unavailable")
    const result=await response.json() as {id?:string};if(!result.id)throw new Error();return result.id
  }
  stage="approved board account"
  const boardEmail="nima.birgani@gmail.com"
  const existing=await db.query<{id:string}>("SELECT id FROM auth.users WHERE lower(email)=lower($1)",[boardEmail])
  if(existing.rows.length>1)throw new Error()
  const ownerUserId=existing.rows[0]?.id??await create(boardEmail)
  const stamp=Date.now().toString(36)
  const accounts: Array<{email:string;password:string;id:string;role:string}>=[]
  stage="synthetic test accounts"
  for(const role of ["manager1","manager2","member","outsider"]){
    const email=`m63-${stamp}-${role}@example.invalid`,password=randomBytes(32).toString("base64url")
    accounts.push({email,password,id:await create(email,password),role})
  }
  const runtimePassword=randomBytes(40).toString("base64url")
  const runtimeUrl=new URL(url);runtimeUrl.username=`neuvetra_runtime.${ref}`;runtimeUrl.password=runtimePassword
  const roster={expectedProjectRef:ref,workspaceId:randomUUID(),ownerUserId,members:accounts.filter(a=>a.role!=="outsider").map(a=>({userId:a.id,role:a.role==="member"?"member" as const:"admin" as const}))}
  const settings={env:{NODE_ENV:"production",PORT:"8080",NEUVETRA_STAGING_ENABLED:"enabled",NEUVETRA_STAGING_PROFILE:"neuvetra.private-synthetic-staging.v1",NEUVETRA_STAGING_ORIGIN:"https://www.neuvetra.ai",NEUVETRA_STAGING_PROJECT_REF:ref,NEUVETRA_STAGING_REUSE_EXISTING:"confirmed",SUPABASE_URL:base,SUPABASE_ANON_KEY:"sb_publishable_5i_JbtrPO2XRvzQ1oM2IIw_wav0PjMn",DATABASE_URL:runtimeUrl.toString()},roster,accounts,boardEmail}
  stage="seal private configuration"
  const seal=Bun.spawn([process.env.NEUVETRA_POWERSHELL_PATH ?? "pwsh","-NoProfile","-File","tools/staging/seal-private.ps1","-OutputPath",encryptedOutput],{stdin:"pipe",stdout:"pipe",stderr:"pipe"})
  seal.stdin.write(JSON.stringify(settings));seal.stdin.end()
  if(await seal.exited!==0)throw new Error()
  stage="runtime login and roster"
  await db.transaction(async tx=>{
    const literal=await tx.query<{value:string}>("SELECT quote_literal($1) value",[runtimePassword])
    await tx.exec(`ALTER ROLE neuvetra_runtime LOGIN PASSWORD ${literal.rows[0]!.value}`)
  })
  await provisionStagingRoster(db,roster)
  console.log(JSON.stringify({status:"accounts_runtime_and_roster_provisioned",encryptedOutput,testAccounts:accounts.length,boardAccountAlreadyExisted:existing.rows.length===1,invitesSent:0}))
}catch{console.error(JSON.stringify({status:"provisioning_failed",stage}));process.exitCode=1}
finally{await db?.close()}
