# Deployment binding omitted-region repair — independent targeted review

Task: HOSTED-SETUP-BRIDGE-REGION-REPAIR-QA-01. Reviewer /root/compose_qa did not author the candidate. Root explicitly authorized this separate targeted follow-on while preserving the original live integration FAIL. Requested registered critical qa-lead gpt-6-astra/high; observed settings unknown in reused review context. No provider, source, Git or database mutation.

**Verdict: bounded PASS.** The unchanged raw pair from the exact Site-Web service is now accepted at the receipt-construction boundary, while exact configured region, image, target, full terminal inventory and staged-state defenses remain active. This verdict does not authorize a stop or migration. Original BRIDGE-BIND-F01 and the live point-in-time observations are preserved in `hosted-setup-01-bridge-deployment-independent-review1.md`.

Frozen reviewed SHA-256:

- tools/staging/hosted-setup-deployment-binding.ts: `ecca1ad63fd77598a56f2e599fd7b96b386bd6dacc797c0a4963f2ca3abdbae4`
- tools/staging/hosted-setup-deployment-binding.test.ts: `3affe1f8c679bdfed0e9f87d8032025abb4b99b8e42858c7e8278a2ffc0f2114`
- evaluations/research-qa/hosted-setup-01-deployment-binding-region-repair-author.md: `d985cf4f7b7d1e448025848467eda2951d7f51f512e463278bc6cbfc6da35cc5`

The only functional relaxation adds undefined to the null/empty status-region values. Exact configured multiRegionConfig still has exactly one allowed region and one replica. Explicit status-region strings (including the configured value) continue to refuse under the existing narrow status schema; this review does not broaden that future compatibility policy. Missing configuration remains a refusal.

Validation: Bun1.3.12, **14 tests passed / 99 assertions**, comprising 11 candidate tests/70 assertions and 3 independent tests/29 assertions. Strict TypeScript on binder and candidate test passed using `bunx tsc --noEmit --strict --target ESNext --module ESNext --moduleResolution bundler --types bun --skipLibCheck`. Hashes rechecked unchanged after tests.

Independent probes verify exact canonical raw capture pins, absent region on both actual status objects, byte-for-byte retention of saved raw files and receipt capture fields, exact accepted image/config with null pending count preserved, and reproduction of the original failure using an exact-hash reconstruction of original ddc00cd264cce8c1b49060453fee73c40f96682b3706e33f11ede26d2b0a8333. Null/empty continue to accept; explicit region/malformed status values refuse. Thirteen separate synthetic mutations of the captured payload challenge missing/extra/zero-replica configured region, wrong project/environment/service, missing commit, changed digest, staged patch, autodeploy, incomplete inventory, extra SUCCESS and in-flight deployment; all refuse. A changed configuration etag between the pair refuses. Synthetic adversarial copies were held in memory; original private captures were unchanged.

The first old-source reconstruction hash check failed because the root's new explanatory comments remained. No candidate test executed under that mismatched reconstruction. Removing exactly the known predicate and comment additions reproduced the original SHA before testing, preserving the initial harness failure transparently.

The independent fixture is `%TEMP%/hosted-setup-bridge-region-independent.test.ts`, SHA `3a36da89e4fae7f54c52611edd05db74545544a66090650243419d2a8069e791`; complete probe text is retained below. Original raw capture file/canonical hashes and private locations are documented in the separate original review. No raw environment configuration or secrets are copied into this report. The accepted receipt was ephemeral; no externally authenticated independent review capability or live mutation authority was minted. Candidate tests use synthetic policy/review identities and cannot establish real-world authorization.

Receipt-construction replay deliberately uses historical observation timestamps; no claim of present freshness is made. Full pipeline/source trust, runtime integration, publication, external approval, durable journal reservation and hosted schema23 behavior remain outside this narrow repair acceptance. Prior broader capture/binder review is historical supporting context and does not replace future integrated QA.

## Independent probe

```typescript
import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {createHostedSetupDeploymentReceipt as current,deploymentCaptureSha256,DEPLOYMENT_TARGET as T} from 'C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra/tools/staging/hosted-setup-deployment-binding';
import {createHostedSetupDeploymentReceipt as original} from './hosted-setup-deployment-binding-pre-region-repair';
const paths=[1,2].map(n=>`C:/Users/nimab/AppData/Local/Temp/bridge-deployment-private-We3xnD/capture-${n}.json`);
const texts=paths.map(p=>readFileSync(p,'utf8'));
const pair=()=>texts.map(t=>JSON.parse(t)) as [any,any];
const IMAGE={deploymentId:'8946ec8e-3dba-484c-8f84-80fa71d8da5f',deployedCommit:'d2f0ca16f02bb99801b68a7925f34016f3ba51bb',imageDigest:'sha256:b227c13eb069960fee6e26839997324fe59c343d9dd078792384dab0fce03c6d'};
const instance=(s:any)=>s.environments.edges.find((e:any)=>e.node.id===T.environmentId).node.serviceInstances.edges.find((e:any)=>e.node.serviceId===T.serviceId).node;
const mutate=(change:(s:any,d:any,i:any)=>void)=>{const c=pair();for(const item of c){const s=JSON.parse(item.statusJson),d=JSON.parse(item.inventoryJson).data;change(s,d,instance(s));item.statusJson=JSON.stringify(s);item.inventoryJson=JSON.stringify({data:d});}return c};
test('unchanged actual raw pair proves original refusal and repaired exact observation',()=>{
 expect(pair().map(deploymentCaptureSha256)).toEqual(['6245166d4b476d70f72e24c01068e3b2219dcf56a584803c7cca5758adcedee7','5ceeda6a2a3d508eafaa53ddf2fdf46a70786120ec8a6fc2cb346ea6e71603da']);
 for(const c of pair())expect(Object.hasOwn(instance(JSON.parse(c.statusJson)),'region')).toBe(false);
 expect(()=>original(pair(),IMAGE,'independent-observer')).toThrow('STATUS_INSTANCE_REFUSED');
 const r=JSON.parse(current(pair(),IMAGE,'independent-observer'));
 expect(r.observation).toMatchObject({...T,...IMAGE,replicas:1,pendingChanges:null,stagedPatchEmpty:true,inventoryComplete:true,automaticDeploymentsEnabled:false,configurationVersion:'7838eb61097efd28630c30eb7f5e97457655a4dbcfc4b787027996ad92a4dda0'});
 expect(r.captures).toEqual(pair());
 expect(paths.map(p=>readFileSync(p,'utf8'))).toEqual(texts);
});
test('omission relaxation does not admit explicit regions or malformed values',()=>{
 for(const v of [null,''])expect(()=>current(mutate((s,d,i)=>{i.region=v}),IMAGE,'independent-observer')).not.toThrow();
 for(const v of [T.region,'elsewhere',0,false,{},[]])expect(()=>current(mutate((s,d,i)=>{i.region=v}),IMAGE,'independent-observer')).toThrow('STATUS_INSTANCE_REFUSED');
});
test('authenticated config, image, scope, staged state and full inventory remain mandatory',()=>{
 const changes=[
 (s:any,d:any)=>{d.environment.config.services[T.serviceId].deploy.multiRegionConfig={}},
 (s:any,d:any)=>{d.environment.config.services[T.serviceId].deploy.multiRegionConfig.other={numReplicas:1}},
 (s:any,d:any)=>{d.environment.config.services[T.serviceId].deploy.multiRegionConfig[T.region].numReplicas=0},
 (s:any,d:any)=>{d.service.projectId='00000000-0000-4000-8000-000000000000'},
 (s:any,d:any)=>{d.environment.id='00000000-0000-4000-8000-000000000000'},
 (s:any,d:any,i:any)=>{delete i.latestDeployment.meta.commitHash},
 (s:any,d:any)=>{d.deployments.edges.find((e:any)=>e.node.id===IMAGE.deploymentId).node.meta.imageDigest='sha256:'+'0'.repeat(64)},
 (s:any,d:any,i:any)=>{i.serviceName='another'},
 (s:any,d:any)=>{d.environmentStagedChanges.patch={deploy:{}}},
 (s:any,d:any)=>{d.serviceInstanceAutoDeployStatus.enabled=true},
 (s:any,d:any)=>{d.deployments.pageInfo.hasNextPage=true},
 (s:any,d:any)=>{d.deployments.edges.find((e:any)=>e.node.id!==IMAGE.deploymentId).node.status='SUCCESS'},
 (s:any,d:any)=>{d.deployments.edges.find((e:any)=>e.node.id!==IMAGE.deploymentId).node.status='DEPLOYING'}
 ];
 for(const change of changes)expect(()=>current(mutate(change),IMAGE,'independent-observer')).toThrow();
 const drift=pair();const d=JSON.parse(drift[1].inventoryJson);d.data.environment.configEtag='0'.repeat(64);drift[1].inventoryJson=JSON.stringify(d);
 expect(()=>current(drift,IMAGE,'independent-observer')).toThrow('PROVIDER_CHANGED_BETWEEN_CAPTURES');
});
```
