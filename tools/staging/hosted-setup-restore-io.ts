/** In-memory DPAPI and pinned PostgreSQL17 transport. No credentials are loaded. */
import { readFile, open, realpath } from 'node:fs/promises'
import { resolve } from 'node:path'
import { sha, requireRecovery } from './hosted-setup-restore-core'
export async function child(command: string[], stdin?: Uint8Array, env?: Record<string,string|undefined>): Promise<Buffer> {
  const process = Bun.spawn(command,{env,stdin:stdin===undefined?'ignore':'pipe',stdout:'pipe',stderr:'pipe'})
  // Drain both pipes concurrently; never forward PostgreSQL/DPAPI diagnostics.
  const output = new Response(process.stdout).arrayBuffer(), error = new Response(process.stderr).arrayBuffer()
  if(stdin!==undefined){await process.stdin.write(stdin);await process.stdin.end()}
  const [bytes,,code] = await Promise.all([output,error,process.exited])
  requireRecovery(code===0,'CHILD_FAILED')
  return Buffer.from(bytes)
}
export function localEnvironment(database:string) {
  return {...Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.toUpperCase().startsWith('PG'))),PGHOST:'127.0.0.1',PGPORT:'55479',PGDATABASE:database,PGUSER:'supabase_admin',PGSSLMODE:'disable',PGPASSFILE:'NUL',PGCONNECT_TIMEOUT:'10'}
}
export async function pinnedTool(path:string,pin:string,name:'pg_dump.exe'|'pg_restore.exe') {
  const actual=await realpath(path)
  requireRecovery(actual.toLowerCase().endsWith('\\'+name)||actual.endsWith('/'+name),'TOOL_NAME_REFUSED')
  requireRecovery(sha(await readFile(actual))===pin,'TOOL_PIN_CHANGED')
  requireRecovery((await child([actual,'--version'])).toString().includes('(PostgreSQL) 17.'),'POSTGRES17_REQUIRED')
  return actual
}
export async function dpapi(mode:'Protect'|'Unprotect',bytes:Uint8Array):Promise<Buffer> {
  requireRecovery(process.platform==='win32','WINDOWS_IDENTITY_REQUIRED')
  const ps=resolve(process.env.SystemRoot??'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe')
  const script=`$ErrorActionPreference='Stop';Add-Type -AssemblyName System.Security;try{$b=[Convert]::FromBase64String([Console]::In.ReadToEnd());$r=[Security.Cryptography.ProtectedData]::${mode}($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);[Console]::Out.Write([Convert]::ToBase64String($r))}catch{exit 1}`
  return Buffer.from((await child([ps,'-NoProfile','-NonInteractive','-Command',script],Buffer.from(Buffer.from(bytes).toString('base64')))).toString(),'base64')
}
export async function exclusive(path:string,bytes:Uint8Array|string) {
  const file=await open(path,'wx',0o600)
  try{await file.writeFile(bytes);await file.sync()}finally{await file.close()}
}
