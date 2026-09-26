import {expect,test} from 'bun:test'
import {DEPLOYMENT_TARGET,deploymentCaptureSha256} from './hosted-setup-deployment-binding'
import {HOSTED_SETUP_RAILWAY_CLI_SHA256} from './hosted-setup-railway-cli'
import {captureHostedSetupRailwayDeployment,RAILWAY_CAPTURE_INVENTORY_QUERY,RAILWAY_CAPTURE_PROFILE,type RailwayCaptureInvocation,
 type RailwayCaptureRuntime} from './hosted-setup-railway-capture'

const input={profile:RAILWAY_CAPTURE_PROFILE,executablePath:'C:\\railway\\railway.exe',workingDirectory:'C:\\operator',timeoutMs:5000}
function fixture(){
 const calls:RailwayCaptureInvocation[]=[];let time=Date.parse('2026-09-26T21:00:00.000Z'),digest=HOSTED_SETUP_RAILWAY_CLI_SHA256
 let version='railway 5.62.1',status='{"id":"'+DEPLOYMENT_TARGET.projectId+'"}',inventory='{"data":{"project":{"id":"'+DEPLOYMENT_TARGET.projectId+'"}}}'
 const runtime:RailwayCaptureRuntime={sha256File:async()=>digest,now:()=>{time+=1000;return time},
  execFile:async call=>{calls.push(call);const command=call.args[0]
   return {exitCode:0,stdout:command==='--version'?version:command==='status'?status:inventory,stderr:''}
  }}
 return {runtime,calls,setDigest:(v:string)=>{digest=v},setVersion:(v:string)=>{version=v},setStatus:(v:string)=>{status=v},setInventory:(v:string)=>{inventory=v},setTime:(v:number)=>{time=v}}
}
test('pinned CLI collects exact raw status and inventory without a mutation command',async()=>{
 const f=fixture(),result=await captureHostedSetupRailwayDeployment(input,f.runtime)
 expect(result.providerMutationAuthorized).toBe(false)
 expect(result.sha256).toBe(deploymentCaptureSha256(result.capture))
 expect(result.capture.statusJson).toContain(DEPLOYMENT_TARGET.projectId)
 expect(f.calls.map(c=>c.args[0])).toEqual(['--version','status','api'])
 expect(f.calls[1]!.args).toEqual(['status','--project',DEPLOYMENT_TARGET.projectId,'--environment',DEPLOYMENT_TARGET.environmentId,'--json'])
 expect(f.calls[2]!.args).toContain(RAILWAY_CAPTURE_INVENTORY_QUERY)
 expect(JSON.parse(f.calls[2]!.args[5]!).serviceId).toBe(DEPLOYMENT_TARGET.serviceId)
 expect(f.calls.every(c=>c.executablePath===input.executablePath&&c.workingDirectory===input.workingDirectory)).toBe(true)
})
test('refuses unpinned CLI, wrong version and failed or malformed provider output before returning evidence',async()=>{
 const a=fixture();a.setDigest('0'.repeat(64))
 await expect(captureHostedSetupRailwayDeployment(input,a.runtime)).rejects.toThrow('EXECUTABLE_HASH_REFUSED')
 expect(a.calls).toHaveLength(0)
 const b=fixture();b.setVersion('railway 5.62.2')
 await expect(captureHostedSetupRailwayDeployment(input,b.runtime)).rejects.toThrow('VERSION_REFUSED')
 expect(b.calls).toHaveLength(1)
 const c=fixture();c.setStatus('not-json')
 await expect(captureHostedSetupRailwayDeployment(input,c.runtime)).rejects.toThrow('STATUS_JSON_REFUSED')
 expect(c.calls.map(x=>x.args[0])).toEqual(['--version','status'])
 const d=fixture();d.setInventory('{')
 await expect(captureHostedSetupRailwayDeployment(input,d.runtime)).rejects.toThrow('INVENTORY_JSON_REFUSED')
 const swapped=fixture(),original=swapped.runtime.execFile
 swapped.runtime.execFile=async call=>{const result=await original(call);if(call.args[0]==='--version')swapped.setDigest('0'.repeat(64));return result}
 await expect(captureHostedSetupRailwayDeployment(input,swapped.runtime)).rejects.toThrow('STATUS_EXECUTABLE_HASH_REFUSED')
 expect(swapped.calls.map(c=>c.args[0])).toEqual(['--version'])
 const swappedAfterStatus=fixture(),originalAfterStatus=swappedAfterStatus.runtime.execFile
 swappedAfterStatus.runtime.execFile=async call=>{const result=await originalAfterStatus(call);if(call.args[0]==='status')swappedAfterStatus.setDigest('0'.repeat(64));return result}
 await expect(captureHostedSetupRailwayDeployment(input,swappedAfterStatus.runtime)).rejects.toThrow('INVENTORY_EXECUTABLE_HASH_REFUSED')
 expect(swappedAfterStatus.calls.map(c=>c.args[0])).toEqual(['--version','status'])
})
test('refuses excessive acquisition time and process failure without exposing provider stderr',async()=>{
 const a=fixture();let calls=0;a.runtime.now=()=>calls++===0?0:31_000
 await expect(captureHostedSetupRailwayDeployment(input,a.runtime)).rejects.toThrow('CAPTURE_DURATION_REFUSED')
 const b=fixture();b.runtime.execFile=async call=>({exitCode:call.args[0]==='status'?1:0,
  stdout:call.args[0]==='--version'?'railway 5.62.1':'{}',stderr:'private provider detail'})
 try{await captureHostedSetupRailwayDeployment(input,b.runtime);throw Error('unexpected success')}
 catch(error){expect(String(error)).toContain('PROCESS_STATUS_REFUSED');expect(String(error)).not.toContain('private provider detail')}
})
