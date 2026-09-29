# Hosted setup post-scale verifier: author candidate

Task: `HOSTED-SETUP-POSTSCALE-01`. Author: `/root/artifact_runner`, software-engineering specialist with CTO sponsorship. The registered critical route requested `gpt-5.6-sol/high`; observed model and effort are unknown. Independent QA is pending. This task performed no provider read or mutation, database operation, Git action, credential access, or live launch.

## Frozen candidate

| File | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-postscale.ts` | `7c8065493651e39851135d4a14bf9e9d50bb8b7b502add443a50ee4cde1becd9` |
| `tools/staging/hosted-setup-postscale.test.ts` | `43e9ea37a99be8adab4d483840407fa966eb3088c7a24a79ceafc8746f936a72` |

These are working-tree byte hashes. They are an author candidate, not an accepted snapshot or publication claim.

## Implemented contract

`verifyHostedSetupPostscale(binding, stoppedCaptures, resumedCaptures, policy)` is synchronous and pure. It accepts the reviewed `DeploymentBinding`, exactly two raw status-plus-inventory captures after stop, exactly two after resume, and a trusted clock plus optional configuration-version pins. It has no mutation or provider-authentication authority. The result carries `mutationAuthorized:false` and `providerAuthenticationEstablished:false`.

Every observation is bound to the exact project, production environment, Site-Web service ID and configured region. Status services and service instances are filtered by the exact Site-Web service ID; their position in provider arrays is irrelevant. The inventory shape follows the currently authorized query and deliberately omits the redundant `data.project` root. Project identity is still required independently from status and from both inventory service and environment `projectId` values.

Both stopped observations require the reviewed deployment ID, commit and image digest to remain the active/latest successful image, with zero runtime instances and either a null configured region or an exact `{numReplicas:0}` object. Both resumed observations require that same image with exactly one RUNNING runtime and an exact `{numReplicas:1}` region. Each pair must be semantically stable, separated in time and individually bounded to 30 seconds. Stop must precede resume; the four-capture sequence must finish by the trusted clock within five minutes; all raw capture digests must be unique.

The inventory must be complete (`hasNextPage:false`), scoped to the exact target, non-empty, terminal, uniquely identified and contain the expected deployment exactly once. A second SUCCESS or any in-flight or unknown status is refused. The verifier also requires an empty staged patch, null-or-zero pending count, disabled automatic deployment and the exact sole configured region. Stop and resume configuration etags must differ. Optional before-stop, stopped and resumed version pins are checked when supplied.

The historical deployment `40546ef7-9004-4486-a471-370aaa305c80` and commit `75d8ec4b16054a1bbfc1a51ddaec99000ee1efe2` are explicitly refused as the candidate binding. A sponsor-provided exact Site-Web probe still showed that historical deployment active, so current live observations cannot satisfy this verifier. A newly deployed, separately reviewed bridge `DeploymentBinding` is required before stop or resume evidence can be verified.

## Trust boundary and remaining integration

The verifier checks raw bytes and semantics; it does not authenticate that those bytes came from Railway. The reviewed collector must acquire and preserve authenticated status and inventory bytes, timestamps and any externally pinned hashes. The trusted caller supplies the exact accepted `DeploymentBinding` and clock. Stable pairs are point-in-time observations, not a provider lease or atomic precondition.

The future scaling wrapper remains a separate owner and must acquire the raw pairs around independently authorized scale operations. It must pass the exact new bridge binding and cannot reconstruct one from a commit, image, current deployment alone, or from the post-scale result. This module supplies no live launcher, credentials, provider adapter, durable journal or database authority.

## Checks and preserved failures

`bun x tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --types bun --skipLibCheck tools/staging/hosted-setup-postscale.ts tools/staging/hosted-setup-postscale.test.ts`: **PASS**, exit 0.

`bun test tools/staging/hosted-setup-postscale.test.ts --timeout 30000`: **11 pass, 0 fail, 47 assertions**. Synthetic tests cover stopped null/zero region forms, exact service filtering despite unrelated positional edges, stale historical binding, deployment/commit/image drift, runtime cardinality, missing commit and incomplete inventory, terminal inventory, staged/auto-deploy/in-flight refusals, within-pair drift, chronology/replay/freshness, configuration-version transitions, duplicate JSON keys and obsolete project-root shape.

`bun test tools/staging/hosted-setup-deployment-binding.test.ts tools/staging/hosted-setup-postscale.test.ts --timeout 30000`: **21 pass, 0 fail, 114 assertions**, Bun 1.3.12.

The first author suite ran 8 passing tests and 1 failing test because the adversarial runtime-drift fixture altered only `latestDeployment`; it was therefore internally inconsistent and correctly failed earlier with `HS_POSTSCALE_INSTANCE_MISMATCH`. The fixture was repaired to alter matching latest and active observations so it remained individually valid and exercised the intended stable-pair refusal. The complete suite and strict typecheck then passed. The first sandboxed Bun invocation also encountered process-access `EPERM`; the approved scoped execution passed.

All capture fixtures are unmistakably synthetic. No live capture, source authentication, scaling action, bridge deployment, independent review, or publication was performed. Independent QA must review these exact hashes before any wrapper or live use.
