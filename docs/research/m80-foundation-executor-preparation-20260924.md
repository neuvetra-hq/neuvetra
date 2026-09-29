# M80 foundation hosted executor preparation

Date: 2026-09-24. Task `M80-HOSTED-EXECUTOR-PREP-20260924`; software-engineering author `/root/m80_foundation_runtime`; root is the only eventual hosted operator. Requested route `gpt-5.6-sol/high`; observed model and effort are unavailable. Role prompt SHA-256 `a9ab5574fe2ef1e940cb1950e6ae69da008ff71ba1f857b6a63b45d53240a52b`.

This increment implements a private, root-only executor for the already reviewed migration, admission and deployment interfaces. It does not authorize or perform a hosted database connection, credential read, provider request, network request, migration, admission, deployment, Git action, backup or restore. The author tests inject transports or refuse before transport. Live use remains blocked until the exact executor candidate passes independent security review and root supplies a current accepted plan, stage gate, sealed intent and prerequisite receipts.

The executor pins the additive, independently accepted hosted-preparation Candidate 6:

- `operations/agent-improvement/snapshots/M80-FOUNDATION-HOSTED-PREP-20260924-CANDIDATE6.json`, SHA-256 `ad834aee260dd732988b00b6d0f6e9ea4df64bdc1544064c0e87e8cc819a3c0a`;
- independent Candidate 6 review `evaluations/research-qa/m80-hosted-prep-independent-20260924-candidate6-review.json`, SHA-256 `166af7ea85c0c3d937840741add18f7a7165c18497e6b9a37b4c2b50dc8213f2`;
- runtime Candidate 2 SHA-256 `40c4ac822ef2d045457ade7dd63d471813178c8f3a585425be58eb81013de59b`;
- migration `0022_scope1_beta_foundation.sql` SHA-256 `0ee148b366e803e8cf28187393f9e5a6f19b29f5bb54578e359db7cbcd795e35`; and
- accepted runtime root closure SHA-256 `953cdda7f40b808be09f05aef2bc1b8ac271136f980774bb07c9d20aaa79aac6` through the preparation plan.

## Implemented transport

`.superpowers/m80-foundation-executor.ts` is the fixed executor entrypoint. It accepts one bounded JSON value on standard input and prints only a stage/status/no-retry result. It opens every plan, gate, intent, predecessor, raw preparation receipt and executor-review pin and recomputes their typed meaning before creating a durable attempt. An independent transport-only review must have verdict `pass_m80_executor_transport_only`, reviewer `/root/m80_foundation_runtime_qa`, an exact candidate snapshot and source pins equal to every outer artifact embedded in that snapshot. The live source bytes must still match those pins, including this entrypoint. For embedded accepted preparation and backup snapshots, the validator also recursively parses their bounded duplicate-key-protected artifact lists and rehashes every nested current source path. Pinning a snapshot file alone therefore cannot hide a changed TLS, connection, migration, inventory or helper dependency.

The database URL is accepted only through process standard input. The existing `connectOperator` target check restricts it to the reviewed Supabase pooler host, port, database and operator username with the reviewed CA. The executor verifies zero active `neuvetra_runtime` client sessions before a new action. Migration starts only from the exact schema-21 inventory and plan application-state digest. Admission and deployment execution start only from schema 22 with the exact 22nd migration receipt, private synthetic target and a live full application-state digest equal to the fresh stage gate. Migration and admission reconciliation keep the stopped-target session boundary. Deployment reconciliation is different: once the exact acknowledged deployment is running, legitimate runtime sessions and authorized application writes may exist. That observer-only path permits runtime clients and does not compare current application content with the pre-deployment gate hash, while still requiring the exact schema-22 migration receipt, target identity, acknowledged deployment ID, reviewed commit, provider success and schema-22 readiness. Admission runs one parameterized statement for the plan's existing synthetic company and existing owner/admin membership and requires exact one-row return plus readback. It never creates a company, user, membership, role or permission.

Deployment uses the current authenticated Railway CLI session; it neither accepts nor searches for a raw Railway token. The request calls `serviceInstanceDeployV2` with the exact reviewed environment ID, service ID and commit SHA. A returned deployment ID is only an acknowledgement. The executor flushes that ID in a receipt bound to the exact durable attempt before it observes provider state. A missing acknowledgement becomes terminal uncertainty and can never match a historical deployment with the same commit. A retained acknowledgement lets a fresh process observe the exact ID without resubmitting. Every fresh or retained success observation requires that acknowledgement, the same deployment ID and an observation time at or after the acknowledgement. Success additionally requires the same commit, status `SUCCESS`, plus `https://www.neuvetra.ai/ready` reporting the private synthetic profile and schema 22.

Every source-state, attempt, provider acknowledgement, terminal observation and outcome path is deterministic from the reviewed operation scope and stage. The writer uses exclusive create, writes all bytes, flushes the file, and closes it before transport begins or success is reported. Existing files refuse; a failed write, flush or close retains the marker and refuses replay. An unavailable observer or an acknowledged nonterminal deployment appends a timestamped pending-observation receipt and writes no terminal outcome. A later process may repeat only the read-only observer. It must obtain a fresh authoritative observation; it cannot relabel old unknown bytes. Explicit terminal uncertainty remains terminal and cannot be promoted.

The private entrypoint awaits the complete execute or reconcile promise before closing its operator connection. The same lifetime guard closes after success and after an exception. This keeps the database open through source capture, durable journals, migration/admission work and database observation, while still guaranteeing a final close.

### Migration timeout recovery

Before a migration attempt is persisted, the executor captures the complete schema-21 application state in the same repeatable-read, read-only preflight and writes it to the deterministic `...-migration-source.json` journal. It first verifies that the exact serialized source receipt fits the same four-million-byte duplicate-key-protected loader used during restart. An oversized source refuses before any journal file or migration call. It flushes the accepted source receipt, then flushes the attempt that pins it, and only then calls the migration transport.

If the transport commits schema 22 but the process exits before recording the observation, or if the first observer is unavailable, root must start a new process in `reconcile` mode with the exact retained attempt path and byte hash. Reconciliation does not rerun the schema-21 preflight and does not call the migration transport. It loads the attempt-bound source receipt, captures the current schema-22 state, and applies the reviewed `assertSchema22Delta` comparison against the retained source. A missing, changed or self-consistent replacement source receipt refuses. The original state is evidence from before the attempt; it is never reconstructed from schema 22. If the first process already flushed a terminal authoritative observation but exited before its outcome, immediate reconciliation consumes that exact observation and writes only the outcome; it does not observe or execute again. The fifteen-minute terminal-observation freshness bound still applies. Pending receipts are append-only history and never substitute for the new authoritative observation.

## Private PowerShell 7 bridge

`.superpowers/m80-executor-private.ps1` is the local credential bridge. It has `#requires -Version 7.0` because it uses `ProcessStartInfo.ArgumentList`. Invoke it only with the reviewed `pwsh` runtime, an explicitly named private export path, and exact bundle bytes. It parses exactly one `DATABASE_URL` field, validates the fixed database target, sends the URL to the TypeScript process through standard input, and emits a fixed refusal body on any error. It does not automatically load an ENV export, print the URL, pass it on the command line, or persist it.

The reviewed runtime path in this workspace is:

```powershell
C:/Users/nimab/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe
```

New execution, after every prerequisite below is independently accepted:

```powershell
& 'C:/Users/nimab/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe' -NoProfile `
  -File .superpowers/m80-executor-private.ps1 `
  -Mode Execute `
  -ExportPath '<explicit-private-export-path>' `
  -BundlePath '.superpowers/m80-foundation-executor-<operation-scope>-<stage>-bundle.json' `
  -BundleSha256 '<exact-bundle-sha256>'
```

Observer-only recovery of an existing uncertain attempt:

```powershell
& 'C:/Users/nimab/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe' -NoProfile `
  -File .superpowers/m80-executor-private.ps1 `
  -Mode Reconcile `
  -ExportPath '<explicit-private-export-path>' `
  -BundlePath '.superpowers/m80-foundation-executor-<operation-scope>-<stage>-bundle.json' `
  -BundleSha256 '<exact-bundle-sha256>' `
  -AttemptPath '.superpowers/m80-foundation-executor-<operation-scope>-<stage>-attempt.json' `
  -AttemptSha256 '<exact-attempt-sha256>'
```

Do not use `powershell.exe`; Windows PowerShell 5.1 does not provide the required argument-list behavior. Do not repeat `Execute` after an attempt exists. A reconcile failure is not retry permission.

## Exact bundle

The secret-free bundle has profile `neuvetra.m80.foundation-executor-bundle.v1` and exactly these keys:

```json
{
  "profile": "neuvetra.m80.foundation-executor-bundle.v1",
  "stage": "migration | admission | deployment",
  "plan": { "path": "<plan>", "sha256": "<sha256>" },
  "gate": { "path": "<stage-gate>", "sha256": "<sha256>" },
  "intent": { "path": "<sealed-stage-intent>", "sha256": "<sha256>" },
  "executorReview": { "path": "<independent-executor-review>", "sha256": "<sha256>" },
  "planEvidence": {
    "targetObservation": { "path": "<path>", "sha256": "<sha256>" },
    "publicationReview": { "path": "<path>", "sha256": "<sha256>" },
    "integrationAcceptance": { "path": "<path>", "sha256": "<sha256>" },
    "backupReceipt": { "path": "<path>", "sha256": "<sha256>" },
    "restoreReceipt": { "path": "<path>", "sha256": "<sha256>" },
    "preservationReceipt": { "path": "<path>", "sha256": "<sha256>" },
    "migrationRehearsalReceipt": { "path": "<path>", "sha256": "<sha256>" },
    "admissionObservation": { "path": "<path>", "sha256": "<sha256>" }
  },
  "migration": null,
  "admission": null
}
```

Admission replaces `migration: null` with the exact successful migration `{intent, observation, outcome}` pins. Deployment supplies both migration and admission triplets. Extra or missing fields refuse. Paths are workspace-relative, cannot traverse or use filesystem links outside the workspace, and every hash covers the exact UTF-8 bytes.

## Required sequence and remaining blocks

Root must not run the executor until all of the following are current and exact:

1. The executor candidate and its PowerShell bridge have an independent transport-only pass with zero open material findings. The candidate snapshot and review must satisfy the source-closure format described above.
2. A fresh encrypted application-only backup and disposable restore/preservation rehearsal have passed independent review and are bound into the plan's typed receipt files. Accepted Backup Candidate 3 is `operations/agent-improvement/snapshots/M80-BACKUP-REHEARSAL-PREP-20260924-CANDIDATE3.json`, SHA-256 `d29eb944ce0db89d30258ff514c8c3226b518bf59fd669d7e09b2040b8c8431d`; its canonical transport review is `evaluations/research-qa/m80-backup-rehearsal-independent-20260924-candidate3-review.json`, SHA-256 `991317f91a9ec71f6ed862298224a1e131de7a93839483d09b22bf340d5f9196`. A fresh live backup is still required before any hosted action.
3. The exact final publication head and required checks, healthy pre-stop schema-21 baseline, matching backup within fifteen minutes, later rehearsal, existing synthetic company/owner admission observation, and Candidate 6 preparation plan are exact. Each mutation still requires a fresh stopped-target stage gate.
4. The exact provider-stop transport, recovery transport and their independent source reviews are accepted. Root observes the reviewed deployment stopped, zero active app sessions and unavailable origin readiness before sealing the migration gate. There is no claimed application maintenance switch.
5. Root creates each fresh stage gate and sealed intent in order. Migration must be verified before admission; admission must be verified before deployment. Each later bundle includes the full earlier authoritative chain.
6. Root retains all private journal files and exact hashes. Any ambiguous action stops. Only `Reconcile` may inspect an existing attempt, and it never repeats the side effect.
7. After deployment, actual hosted authentication and setup behavior still require separate acceptance. Local mock/Auth-substitute integration evidence is not that postdeployment result.

The current candidate is therefore runnable code with injected author tests, but it is not authorized, deployed, or proven against hosted transports. No live bundle, export, credential or current target observation was created in this task.

## Author verification

- `bun test ./.superpowers/m80-foundation-executor.test.ts`: 19 tests, 65 assertions passed. These cover the exact 109,954-byte Candidate 6 preparation snapshot, recursive rehashing of its `files` closure, close-enforcing connection lifetime on successful migration/admission/observation and failed reconciliation, refusal before missing transport, oversized migration-source refusal before journal/mutation, ambiguous migration/no replay, unavailable migration observer to fresh-success reconciliation, committed migration plus new-process reconciliation, recovery from an already-flushed observation without re-observing, durable provider acknowledgement and `BUILDING` to `SUCCESS` reconciliation without redeploy, future acknowledgement refusal, retained-success refusal without an ack/with a foreign ID/with pre-ack chronology, rejection of acknowledgement-less historical same-commit matches, exact provider identity, current-session Railway observation, raw receipt tamper refusal, parameterized existing-company admission, exact pre-action schema-22 gate-state comparison, and the post-deployment live-session/content-change reconciliation boundary.
- A read-only check against the retained device-local PostgreSQL 17 schema-21 baseline captured the actual 120-table, 21-receipt application state. Its durable migration-source JSON was 3,224,598 bytes and replayed through the executor's separate duplicate-key-protected four-million-byte source-evidence loader with application-state SHA-256 `12bfd793aba2ae3332b141bbe36e7de7a213c3f3291f70ca4c7d6f3ee32b56dc`. No database row or schema was changed.
- Targeted TypeScript compilation passed for the entrypoint and tests with repository dependency declarations skipped.
- The entrypoint bundled successfully for Bun (about 215 KB), exercising the concrete import closure.
- The PowerShell source parsed without errors under the repository parser check.
- The explicit PowerShell 7 runtime returned only the fixed refusal JSON and exit code 1 for a missing named export; it made no provider, network or database request.

Executor Candidates 1 and 2 are preserved dependency-closure predecessors. Candidate 3 failed independent review because an acknowledgement-less provider timeout could match a historical same-commit deployment and because an unavailable migration observer wrote terminal unknown files that blocked a later fresh observation. Candidate 4 added durable acknowledgements and pending observer history. Candidate 5 added exact live schema-22 gate-state comparison, but independent QA found that it did not reject a future-dated acknowledgement. Candidate 6 closed that chronology gap and added source-size symmetry; QA then found retained success observations could bypass acknowledgement ID/time binding. Candidate 7 closed that binding gap, but independent review found that deployment reconciliation refused the healthy app's runtime session and that the historical preparation chronology could not be assembled truthfully. Candidate 8 imported accepted preparation v2 and repaired that observer boundary, but its private entrypoint closed the database before the returned asynchronous stage promise completed. Candidate 9 awaits both execute and reconcile inside the connection lifetime guard, so close occurs last on success and failure.

Independent review of exact Executor Candidate 9 is pending. The checks above establish offline author behavior only.
