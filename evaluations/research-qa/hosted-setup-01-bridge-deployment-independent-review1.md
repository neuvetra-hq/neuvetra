# Bridge deployment independent review — original live integration failure preserved

Task: HOSTED-SETUP-BRIDGE-DEPLOYMENT-QA-01. Reviewer: /root/compose_qa, separate from deployment and binder author /root. Date: 2026-09-26 UTC. Requested registered critical qa-lead gpt-6-astra/high; observed model/effort unknown because the bounded task reused an existing review context. QA operating guidance and current handoff refreshed. No source, Git, database or provider mutation performed.

**Verdict: FAIL for original live deployment-binder integration (BRIDGE-BIND-F01, P2). Bounded PASS for the independently observed bridge image and schema-22 readiness at the times below.** The failed original artifact is not retrospectively accepted. Root's subsequent repair has its own separate review, `hosted-setup-01-bridge-region-repair-independent-review.md`.

## Independent provider evidence

Used Railway CLI 5.62.1 at `C:/Users/nimab/Neuvetra/m63-runtime/railway-cli/node_modules/@railway/cli/bin/railway.exe`, SHA-256 `f9351033614c86882332a5c82e1856b21792b176ebf84a9417dfd1362c425177`. Capture source SHA `3c384fb1ac6ff2ffb06b4cb8d4b62c67d87e9cd1dd972ae24fa197a4acb39b83` verifies binary/version and invokes read-only commands without shell. This is authenticated local CLI session evidence under the trusted-host boundary, not a cryptographic provider attestation.

Selected service by exact ID, never the first service edge. The retained pair spans **15:58:03.152Z–15:58:07.711Z**:

| Field | Independently observed |
|---|---|
| Project | 119f3652-9d84-4d16-983c-1a17c0fd1aaa |
| Environment | 6642d65a-15a2-41e9-b25e-b7b01990aa28 / production |
| Service | f43abcf9-72f0-4034-828a-8d83ca26b0db / Site-Web |
| Deployment | 8946ec8e-3dba-484c-8f84-80fa71d8da5f / SUCCESS |
| Provider commit metadata | d2f0ca16f02bb99801b68a7925f34016f3ba51bb |
| Provider image digest | sha256:b227c13eb069960fee6e26839997324fe59c343d9dd078792384dab0fce03c6d |
| Runtime | e1194cc7-8db3-4155-ae50-e1a14d117889 / one RUNNING |
| Configured region/replicas | Only us-east4-eqdc4a / 1 |
| Configuration etag | 7838eb61097efd28630c30eb7f5e97457655a4dbcfc4b787027996ad92a4dda0 |
| Deployment inventory | 72 entries; 1 SUCCESS, 57 REMOVED, 6 SKIPPED, 8 FAILED; terminal page, hasNextPage=false; no duplicate IDs, in-flight or additional SUCCESS |
| Inventory canonical SHA | bff05cc1273719c069225f7eac2a18890f292ec2c0258b0c183edf6651de49af |
| Source/build | neuvetra-hq/neuvetra; DOCKERFILE; Dockerfile.staging; healthcheck /ready |
| Source branch | Absent/unknown; not inferred from commit |
| Automatic deployments | false |
| Staged changes | id <empty>, status STAGED, patch {} |
| Pending changes count | null, preserved as unknown rather than zero |
| Domain | www.neuvetra.ai, targetPort 8080; no service domains |

Earlier independent 15:56:25.256Z–15:56:28.979Z pair agreed on these image/config/runtime/inventory observations but original binder refused. The later retained raw pair is unchanged and contains the same omitted status-region condition. Root's earlier deployment attempt/response/active observation agree on the exact image. No observed target or image drift.

At **15:58:49.379Z**, independently fetched `https://www.neuvetra.ai/ready` without credentials, redirect following disabled and Cache-Control:no-cache: HTTP 200; exact response keys status/profile/schemaVersion/legacyContainmentVerified; values ready, neuvetra.private-synthetic-staging.v1, 22, true. This endpoint result supports its claimed containment behavior; this review did not independently inspect hosted database contents.

## Preserved finding BRIDGE-BIND-F01

Original binder SHA `ddc00cd264cce8c1b49060453fee73c40f96682b3706e33f11ede26d2b0a8333` requires `serviceInstance.region` null or empty string. Actual exact-service status omits that property entirely, while the separate authenticated environment configuration explicitly provides the exact single region and one replica. The unmodified capture therefore throws `HS_DEPLOYMENT_BINDING_STATUS_INSTANCE_REFUSED` before producing a deployment receipt. The synthetic fixture used region:null and did not exercise the live shape. This is a compatibility/availability failure, not an unsafe acceptance.

Minimum source repair: permit an absent status-region field while retaining exact single-region/one-replica checks in environment configuration and rejection of explicit unexpected status values. Add a regression using an absent property. Do not normalize or add fields to raw provider captures.

Root repaired source during the live observation. That change is explicitly excluded from the original verdict. An exact-byte reconstruction of the original source was later hashed to the original ddc00... pin and independently replayed against the untouched retained pair: the same original refusal reproduced. The first reconstruction attempt removed the predicate but left the new explanatory comment, so its hash check failed and no test ran; removing both known repair additions reproduced the exact original hash. This harness correction changed no candidate bytes.

## Evidence retention and scope

Raw captures remain private outside Git at `C:/Users/nimab/AppData/Local/Temp/bridge-deployment-private-We3xnD/capture-1.json` and `capture-2.json`. They were not normalized or printed. File SHA-256: `adeae6b2ba784eb46fd76fd4d9d677938bb4b8b8d7512fabf17ef6e25796b483`, `63596b823b1716f01bad78c7183c42d44418d05e6e7e6e16ea845a26a8d56932`. Canonical capture SHA-256: `6245166d4b476d70f72e24c01068e3b2219dcf56a584803c7cca5758adcedee7`, `5ceeda6a2a3d508eafaa53ddf2fdf46a70786120ec8a6fc2cb346ea6e71603da`. Local temporary-file persistence and filesystem protection depend on this host; raw capture relocation/publication needs separate secret-safe handling.

Sanitized evidence remains in local temporary files: `hosted-setup-bridge-deployment-qa-sanitized.json` SHA `d5a19c86bc9a2cd21edb7707081e69ce4a1ccb0202fc23b27b56ae112f143f8a`; `hosted-setup-bridge-ready-qa-sanitized.json` SHA `6b2c53dff4dfb66a265b916541ff540fbf9a09001243fbc462bc91780ead0582`. Acquisition probes: `hosted-setup-bridge-deployment-qa-20260926.ts` SHA `ed953e4053c06f71283816943ad2b0fb7ab8bbe4aee2efe90794824124be6227`; `hosted-setup-bridge-ready-qa-20260926.ts` SHA `7c4ffecf1fc858bfcda74a41c18da337c5d8f902f2e897b2d32cb5a6c9844073`.

Root-supplied evidence reviewed (under evaluations/research-qa): bridge-deploy-attempt-20260926 JSON SHA `ceede644f2de05a7df58518713e829f567b39c6d98f5df7e2473e57630415f9c`; bridge-deploy-response JSON SHA `65cdb3ccf8a4b18fa4635041f519740322867050a655aa49634da54bfcfc934e`; bridge-active-observation JSON SHA `e55171fbb05d2d713c38072bfd308a9bac310860ef018001a73cdd4b85252840`; schema-bridge-independent-review Markdown SHA `9c89c3909a3e25c8321e2e6ddf8d394b61e6d1b7aced6f2278a77c7071931701` (all filenames prefixed hosted-setup-01-). The schema bridge source review was bounded local/native acceptance, including precise schema22 exception and schema23 manifest, not a hosted migration result.

PR6 head d2f0ca... and seven green exact-head checks are **root-supplied context only**, as recorded in operations/board-report.md and operations/hosted-setup/upgrade-runbook.md. Independent GitHub connector attempts returned 404 and gh was unavailable on PATH; neither failure is head/check proof. I independently verified only matching provider commit metadata, not GitHub head/check state or OCI build provenance.

This accepts a point-in-time bridge image/readiness observation only. No stop, schema23 migration, durable maintenance authorization, synthetic-company admission, signed-in histories, external writer exclusion or product launch approval is implied. Raw pairs become historical evidence as time passes; fresh authenticated acquisition is required before any separately authorized action. Original integration FAIL remains preserved even though its targeted repair is separately reviewed.
