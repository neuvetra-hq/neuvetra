import { expect, test } from "bun:test"
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { assessHostedSetupSourceLauncher, launchHostedSetupMaintenanceWorker } from "./hosted-setup-source-launcher"

// Safe synthetic counterexamples, never importing the maintenance application.
// Fixtures are retained for evidence. Each child is bounded and killed on timeout.
async function fixture() {
  const root=await mkdtemp(join(tmpdir(),"source-launcher-probe-"))
  await writeFile(join(root,"clean.toml"),'logLevel = "warn"\n')
  return root
}
function child(root:string,args:string[]) {
  return Bun.spawn([process.execPath,"--no-env-file","--no-install",...args],{
    cwd:root,env:{SystemRoot:process.env.SystemRoot??"C:\\Windows"},stdin:"ignore",stdout:"pipe",stderr:"pipe",windowsHide:true,
  })
}
async function finish(proc:ReturnType<typeof child>) {
  let timer:ReturnType<typeof setTimeout>|undefined
  try {
    const exit=await Promise.race([proc.exited,new Promise<never>((_,reject)=>{timer=setTimeout(()=>{proc.kill();reject(new Error("Synthetic probe exceeded 5s supervisor deadline"))},5000)})])
    const stdout=await new Response(proc.stdout).text(),stderr=await new Response(proc.stderr).text()
    expect(exit).toBe(0);expect(stderr).toBe("")
    return JSON.parse(stdout)
  } finally {if(timer)clearTimeout(timer);if(proc.exitCode===null)proc.kill();await proc.exited}
}
async function waitFile(path:string) {
  const end=performance.now()+3000
  while(performance.now()<end){if(await Bun.file(path).exists())return;await Bun.sleep(10)}
  throw Error("Synthetic fixture handshake timed out")
}

test("launcher refuses forged trusted flags without consuming getters or invoking work",()=>{
  let touched=0
  const fake=new Proxy({attestedBeforeApplicationImport:true,immutableRuntimeTree:true,moduleGraphComplete:true,materialFindingsOpen:0,verifyRuntimeLoadedCode:()=>true,launch:()=>{touched++}}, {get(target,key,receiver){touched++;return Reflect.get(target,key,receiver)}})
  expect(()=>launchHostedSetupMaintenanceWorker(fake)).toThrow("trusted pre-import closure")
  expect(touched).toBe(0)
  const state=assessHostedSetupSourceLauncher()
  expect(state.launchSupported).toBe(false);expect(state.attestation).toBeNull();expect(state.status).toBe("blocked")
  expect(Object.isFrozen(state)).toBe(true);expect(Object.isFrozen(state.blockers)).toBe(true)
  expect(state).not.toHaveProperty("runtimeSourcePins")
})

test("installed runtime observation remains a diagnostic and cannot grant authority",()=>{
  const state=assessHostedSetupSourceLauncher()
  expect(state.observedRuntime).toBe(Bun.version)
  if(Bun.version==="1.3.12")expect(state.observedModuleGraphApi).toBe("undefined")
  expect(state.blockers).toHaveLength(3)
  expect(()=>launchHostedSetupMaintenanceWorker({runtimeVersion:Bun.version,archiveSha256:"a".repeat(64),reviewedProductHead:"b".repeat(40)})).toThrow("launch refused")
})

test("static scanner misses a computed import that executes changed bytes between equal file hashes",async()=>{
  const root=await fixture(),payload=join(root,"payload.ts")
  const original='export default "reviewed";\n',changed='export default "tampered";\n'
  const source=`const target=new URL("./payload.ts",import.meta.url).href;
    const sha=s=>new Bun.CryptoHasher("sha256").update(s).digest("hex");
    const before=sha(await Bun.file(new URL("./payload.ts",import.meta.url)).text());
    await Bun.write("ready", "ready");
    while(!await Bun.file("load.signal").exists())await Bun.sleep(5);
    const loaded=(await import(target)).default;
    await Bun.write("loaded", "loaded");
    while(!await Bun.file("readback.signal").exists())await Bun.sleep(5);
    const after=sha(await Bun.file(new URL("./payload.ts",import.meta.url)).text());
    console.log(JSON.stringify({before,after,loaded}));`
  const scan=new Bun.Transpiler({loader:"ts"}).scan(source)
  expect(scan.imports).toEqual([])
  await writeFile(payload,original);await writeFile(join(root,"entry.ts"),source)
  const proc=child(root,["--config="+join(root,"clean.toml"),join(root,"entry.ts")])
  const result=finish(proc)
  try{
    await waitFile(join(root,"ready"));await writeFile(payload,changed);await writeFile(join(root,"load.signal"),"go")
    await waitFile(join(root,"loaded"));await writeFile(payload,original);await writeFile(join(root,"readback.signal"),"go")
    const observed=await result
    expect(observed.before).toBe(observed.after);expect(observed.loaded).toBe("tampered")
    expect(await readFile(payload,"utf8")).toBe(original)
    await writeFile(join(root,"observation.json"),JSON.stringify({probe:"equal-file-hashes-do-not-attest-loaded-code",observed,staticImports:scan.imports}))
    console.log("SOURCE_LAUNCHER_PROBE "+root)
  }finally{if(proc.exitCode===null)proc.kill();await result.catch(()=>{})}
},10000)

test("bunfig preload runs before entry and can clear child-reported argv; explicit no-preload config excludes that fixture preload",async()=>{
  const root=await fixture()
  await writeFile(join(root,"bunfig.toml"),'preload = ["./preload.ts"]\n')
  await writeFile(join(root,"preload.ts"),'globalThis.fixturePreloadExecuted=true;process.execArgv.length=0;\n')
  await writeFile(join(root,"entry.ts"),'console.log(JSON.stringify({preloadExecuted:globalThis.fixturePreloadExecuted===true,execArgv:process.execArgv}));\n')
  const contaminated=await finish(child(root,[join(root,"entry.ts")]))
  expect(contaminated.preloadExecuted).toBe(true);expect(contaminated.execArgv).toEqual([])
  const explicit=await finish(child(root,["--config="+join(root,"clean.toml"),join(root,"entry.ts")]))
  expect(explicit.preloadExecuted).toBe(false)
  await writeFile(join(root,"observation.json"),JSON.stringify({probe:"preload-before-entry",contaminated,explicit}))
  console.log("SOURCE_LAUNCHER_PROBE "+root)
},10000)