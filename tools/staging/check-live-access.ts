import { HostedWorkspaceDatabase } from "../../packages/neuvetra-database/src/hosted"
import { loadStagingDatabaseCa } from "../../packages/neuvetra-database/src/staging-tls"
let db: HostedWorkspaceDatabase | undefined
let stage="configuration"
try {
  const config=JSON.parse(await Bun.stdin.text())
  stage="restricted database readiness"
  db=await HostedWorkspaceDatabase.create({connectionString:config.env.DATABASE_URL,expectedProjectRef:config.env.NEUVETRA_STAGING_PROJECT_REF,reuseExistingProject:true,tlsCaPem:await loadStagingDatabaseCa({caFile:"tools/cloud/fixtures/supabase-prod-ca-2021.crt"})})
  const ready=await db.checkReadiness()
  stage="real authentication"
  const results=[]
  for(const account of config.accounts){
    const response=await fetch(config.env.SUPABASE_URL+"/auth/v1/token?grant_type=password",{method:"POST",headers:{apikey:config.env.SUPABASE_ANON_KEY,"Content-Type":"application/json"},body:JSON.stringify({email:account.email,password:account.password}),signal:AbortSignal.timeout(15000)})
    if(!response.ok)throw new Error()
    const session=await response.json() as {access_token:string;user:{id:string}}
    if(session.user.id!==account.id)throw new Error()
    const verified=await fetch(config.env.SUPABASE_URL+"/auth/v1/user",{headers:{apikey:config.env.SUPABASE_ANON_KEY,Authorization:`Bearer ${session.access_token}`},signal:AbortSignal.timeout(15000)})
    if(!verified.ok||(await verified.json() as {id:string}).id!==account.id)throw new Error()
    const roster=await db.hasStagingAccess(account.id)
    if((account.role==="outsider")!==(!roster))throw new Error()
    stage="deployed session boundary"
    const hosted=await fetch("https://www.neuvetra.ai/workspace-api/session",{headers:{Authorization:`Bearer ${session.access_token}`},signal:AbortSignal.timeout(20000)})
    if(hosted.status!==(roster?200:403))throw new Error()
    await hosted.body?.cancel()
    results.push({role:account.role,realSignIn:true,serverVerified:true,rosterAccess:Boolean(roster),hostedSessionStatus:hosted.status})
    stage="verified logout"
    const logout=await fetch(config.env.SUPABASE_URL+"/auth/v1/logout?scope=local",{method:"POST",headers:{apikey:config.env.SUPABASE_ANON_KEY,Authorization:`Bearer ${session.access_token}`},signal:AbortSignal.timeout(15000)})
    if(logout.status!==204)throw new Error()
  }
  const signedOut=await fetch("https://www.neuvetra.ai/workspace-api/session",{signal:AbortSignal.timeout(20000)})
  if(signedOut.status!==401)throw new Error()
  const receipt={status:"live_database_and_auth_pass",ready,results,signedOutStatus:signedOut.status,scope:"live provider Auth, restricted SQL and deployed HTTP session boundary; not full workflow",logoutStatus:204}
  await Bun.write(".superpowers/m63-live-access-hosted.json",JSON.stringify(receipt,null,2)+"\n")
  console.log(JSON.stringify(receipt))
}catch{console.log(JSON.stringify({status:"live_access_failed",stage}));process.exitCode=1}
finally{await db?.close()}
