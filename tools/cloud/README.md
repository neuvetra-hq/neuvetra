# Synthetic cloud evidence tools

The coordinator completed this bounded cloud test with six owned fictional passages. Saved results verify six private objects and two vector builds, two synthetic identities and memberships, three restricted-reader cases, and 22 access checks. Independent QA reviewed the implementations and recorded results. The implementation author made no live calls or credential reads; the coordinator performed the authorized cloud operations.

See the [independent QA report](../../docs/research/cloud-integration-qa.md), [current resource state](../../operations/cloud-development.json), and [saved demonstration](../../evaluations/cloud-integration/demo.html). The demonstration displays recorded results and account filters; it is not a login or live-query interface. This experiment does not generate answers or connect the product answering route, and it leaves the frozen GHG passage experiment unchanged.

The owned fictional fixture is frozen at SHA-256 `1d048902d03a948d27ea8fc9d08975970de794242a065ae83b0b743be2958098`. It has two scopes, an active dependency pair, an inactive record and three fixed paraphrases. At `top_k=4`, this tiny corpus tests integration, not meaningful semantic ranking accuracy. No EPA source is uploaded.

## Offline reproduction

From the repository root with Python 3.10 or later:

```powershell
python -B -m unittest discover -s tools/cloud -p "test_*.py" -v
```

The recorded Python suites contain 35 evidence-adapter tests, 10 identity tests and eight publication tests. They use fake cloud/HTTP transports, without network or credentials. They cover scope/filter/dependency boundaries, original/extraction/span hashes, pending/expired evidence, wrong profile/truncation, denied providers, no local fallback, idempotent logical publication, source citation identity and redirect refusal. Independent QA found mutable-plan and object-suffix gaps during development; corrected tests now reject modified records, approval, scopes, bytes and keys before any I/O. Fake semantic responses are not cloud results.

## Execution order and interfaces

1. **Prepare/stage:** `build_seed_plan(fixture_bytes, target)` is pure. It derives immutable UTF-8 originals, normalized extractions, release bytes, content-addressed objects, code-point spans and deterministic build/namespace/vector IDs. `stage_payload(plan, target, review_expires_at)` validates the plan and returns concrete table arrays for the database owner's transaction. Source/passage review is `pending`, release status is `candidate`, and ingestion state is `staged`; memberships and active pointers are absent.
2. **Approve the execution target:** root reviews the synthetic fixture and target/build bindings, then pins the exact target bytes. The shipped `resource-target.template.json` remains pending and cannot execute. The separately reviewed `resource-target.synthetic-01.json` binds the observed Pinecone host/profile and isolated Supabase development resources; its recorded execution is covered by the QA report. Do not derive an approval pin from an unreviewed file immediately before use.
3. **Upload:** `publish_artifacts(config, transport, plan)` revalidates the entire pinned plan before I/O, describes the exact Pinecone host/profile, uploads absent objects without overwrite, verifies downloaded bytes, and upserts hosted text in only the fixed namespaces. An identical plan reuses objects and vector IDs; repeating the explicit upsert may still incur embedding usage. Conflicting existing bytes fail. No retries or activation occur.
4. **Verify:** `verify_published_once(config, transport, plan)` fetches every expected vector ID and checks exact metadata and finite 1024-dimensional values. It performs one check; any further readiness check requires an explicit bounded coordinator attempt because Pinecone visibility can lag writes. Neither upload nor fetch proves DB approval or RLS.
5. **Explicit synthetic approval and activation:** the database owner independently verifies rows, objects, expected IDs, source review and deadline, applies the scoped synthetic approval, marks the run verified and calls its admin activation transaction. This module cannot write approval or a pointer. External Storage/Pinecone operations are not part of that DB transaction.
6. **Retrieve:** `Reader(config, transport).retrieve(question)` authenticates a non-admin JWT through Supabase Auth, resolves its single membership and active approved build, then uses a fixed namespace plus scope/release/profile/active filters. Every candidate ID is re-resolved through authorized Supabase rows, downloaded object hashes, exact normalized source spans and full dependency closure. Returned Pinecone text is never authority. Missing/corrupt/expired/foreign data withholds all evidence; empty search returns `no_result`. No alternate store, relaxed filter or local source fallback exists.

Imports perform no I/O. Configuration and credentials are explicit in-memory arguments; keys never belong in CLI arguments or tracked files. The direct TLS transport uses reviewed exact hosts, ignores HTTP proxy environment settings, refuses redirects, and records only safe operation counters/status/request IDs. JWT decoding is deny-only; the remote Auth call performs authentication.

```python
# Run only inside the coordinator's private, explicitly authorized wrapper.
import evidence_smoke as cloud
config = cloud.Config(reviewed_target_bytes, independently_reviewed_target_sha,
    cloud.Secrets(pinecone_key=server_key,
                  supabase_publishable_key=public_reader_key,
                  reader_jwt=non_admin_jwt))
transport = cloud.Transport(config)
# Stage/approve/activate through the database owner in the order above.
result = cloud.Reader(config, transport).retrieve(frozen_question)
```

Persist exact code/fixture/target pins and `transport.events` in a unique safe run artifact. Returned citations contain checked source identity/version, hashes, locator and an authenticated Storage URL. That URL still needs an authorized JWT; no browser auth/download handler or signed-link issuer is implemented here.

## Recorded results and remaining work

The isolated migration and corrected staging transaction completed with 20 rows. The earlier two stage failures remain recorded as rolled back; the driver JSON binding correction was independently reviewed and then confirmed by the successful stage. See [stage observations](../../evaluations/cloud-integration/observations/2026-09-09-synthetic-stage.json).

| Recorded check | Result |
| --- | --- |
| [Publication verification](../../evaluations/cloud-integration/observations/2026-09-09-publication-verified.json) | Six objects checked by hashes/keys and six vectors across two builds checked for metadata and finite 1024-dimensional values. |
| [Synthetic activation](../../evaluations/cloud-integration/observations/2026-09-09-activation.json) | Two memberships and two builds activated after bounded fictional-source approval; the inactive passage stays inactive. |
| [Restricted readers](../../evaluations/cloud-integration/observations/2026-09-09-roundtrip.json) | Three frozen reader cases passed, with checked source locators and dependencies. |
| [Access checks](../../evaluations/cloud-integration/observations/2026-09-09-access-checks.json) | 22 checks passed, including cross-scope reads, membership-write denials, private-object boundaries, inactive passage exclusion and anonymous denials. |

These are saved September 9 UTC results, not a claim that resources remain unchanged indefinitely. The retained development target has a review deadline of **2026-09-10T05:30:00Z**. No automatic renewal or cleanup is implemented. The small corpus does not establish retrieval ranking quality, universal tenant isolation or production readiness.

The product authentication/query/download route, real-source processing and provider-use approvals, GHG answer quality, numerical accounting, cleanup, interruption/resume and pointer rollback remain separate work. Legacy anonymous access was contained; the [legacy signed-in access review](../../docs/research/legacy-database-access-review.md) still identifies unresolved boundaries. The synthetic access tests do not settle those legacy permissions. Commercial runtime approval remains false, and no production deployment is established by this test. Cleanup must deactivate first and remove only manifest-owned IDs and unreferenced objects/rows; this adapter has no deletion operation.

## Identity and publication controls

`provision-test-identities.py` creates only the two fixed `.invalid` test identities with admin `email_confirm: true`, then performs password sign-in with the public client key. It has no invitation, signup, OTP, user-listing, deletion or automatic retry path. Required safe journaling preserves each created ID before later calls; passwords and JWTs are hidden from object representations and must be persisted privately by the coordinator, never in these artifacts.

`publication_setup.py` validates the reviewed fixture, target and committed stage receipt before publication. It gets or creates only the fixed private `neuvetra-research-dev` bucket with its 1 MB file limit and `application/octet-stream` restriction, refusing incompatible existing settings. Publication uploads absent content-addressed objects without overwrite; `verify_once` checks existing objects and vectors without repeating writes or activating a build.

Modern Supabase `sb_secret_` keys use the `apikey` header without a non-JWT Bearer value. Legacy service-role JWT handling remains supported; readers use their actual non-admin JWT and public client key. A Storage HTTP 400 counts as missing only on the exact approved GET route with bounded JSON containing `statusCode: 404` and the matching `NoSuchBucket` or `NoSuchKey` code. Other 400 responses fail. Raw provider messages are not logged. Historical implementations and failed attempts remain preserved for review.

The API contract is Pinecone `2026-04`, integrated `llama-text-embed-v2`, 1024/cosine, `text -> text`, query/passage input types and `truncate=NONE`. Official checks: [hosted-text upsert](https://docs.pinecone.io/reference/api/2026-04/data-plane/upsert_records), [text search](https://docs.pinecone.io/reference/api/2026-04/data-plane/search_records), [ID fetch](https://docs.pinecone.io/reference/api/2026-04/data-plane/fetch), [integrated profile](https://docs.pinecone.io/reference/api/2026-04/control-plane/create_for_model). The [cloud gate](../../docs/research/cloud-integration-gate.md) governs the complete integration; the [isolated migration](../../infra/cloud/001-neuvetra-research-dev.sql) defines the coordinated table contract.

## Reviewed database application and staging

CLOUD-APPLY-01 adds [apply-development.ts](apply-development.ts), an explicit coordinator tool for two operations: apply the exact isolated migration once, or insert the reviewed synthetic projection in one transaction. Imports and the default `check` mode do not read credentials, initialize a driver or connect. Authoring checks were offline; the coordinator subsequently executed the reviewed migration and corrected staging transaction described above. A read-only inventory remains separate evidence and does not authorize arbitrary writes to the shared product database.

The migration is fixed to `infra/cloud/001-neuvetra-research-dev.sql`, SHA-256 `f4a620013b9d61503137c7551030975bc9fcd0737714a3eabc5d4f30d23e2a84` (revision 2, 1 Oct 2026). Revision 2 makes research-dev Storage objects service-role only; revision 1 (`5e136e3c859375a427b410d9ea680821e07f5e315610a0fa10ff0e6cfd6ab5fa`, the bytes applied to the hosted project) is kept unchanged at [`infra/cloud/history/001-neuvetra-research-dev.v1.sql`](../../infra/cloud/history/001-neuvetra-research-dev.v1.sql). A project that already ran revision 1 applies [`004-research-dev-storage-read-fence.sql`](../../infra/cloud/004-research-dev-storage-read-fence.sql) instead; this helper never reruns 001 on an existing schema. The helper checks that pin, a separately reviewed successful inventory pin and the official CA before reading an explicitly supplied export. It validates the export's database target, then retargets only that same project's direct endpoint (`db.icockcoguyadhryzydvl.supabase.co:5432`, user `postgres`, original password). TLS certificate verification stays enabled. Before writing, a fresh read-only transaction must confirm database/role, `read_only=on`, backend TLS and expected schema absence/presence. A pooler report with backend TLS false is not accepted.

The unchanged migration's full `BEGIN` through `COMMIT` is sent once, after a fixed project acknowledgement. Existing `neuvetra_research_dev` causes refusal; the helper does not adopt or replace it. Installed Postgres.js 3.4.9 uses the simple protocol for this zero-parameter command. Stage writes instead use fixed table/column names and bound parameters, with one transaction for all 20 rows. Pre-serialized JSON values bind through `::text::jsonb` to avoid the reproduced Postgres.js double-encoding fault. Identical existing rows are accepted; a conflicting row, including an already approved state, aborts staging without overwriting it. Neither operation calls activation, creates auth users/memberships, exposes a Data API schema or uploads objects. The migration itself creates the reviewed activation function and additive Storage policies; it does not invoke that function.

The tracked [public CA fixture](fixtures/supabase-prod-ca-2021.crt) contains only the downloaded public certificate, SHA-256 `700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7`. The coordinator verified the [official Supabase download](https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt) against first-party dashboard source; see the [provenance observation](../../evaluations/cloud-integration/observations/2026-09-09-supabase-ca.json). Keeping `.crt` distinct preserves the repository's private `.pem` ignore rule. Runtime still requires an explicit CA path.

Offline checks, from repository root with installed Bun:

```powershell
bun test tools/cloud/apply-development.test.ts tools/cloud/activate-synthetic.test.ts
bun node_modules/typescript/bin/tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --types bun --skipLibCheck --strict tools/cloud/apply-development.ts tools/cloud/apply-development.test.ts tools/cloud/activate-synthetic.ts tools/cloud/activate-synthetic.test.ts
bun tools/cloud/apply-development.ts --operation migrate --inventory .superpowers/cloud-db-inventory-05-direct.json --inventory-sha 023973c8eec1fbf690375272963ce2c5433e437be8b5e251b7fc1d21c13d03d5 --migration-sha f4a620013b9d61503137c7551030975bc9fcd0737714a3eabc5d4f30d23e2a84 --ca-file tools/cloud/fixtures/supabase-prod-ca-2021.crt
```

The last command requires the coordinator's locally saved reviewed inventory; it is intentionally absent from a clean checkout. The recorded portable apply suite has 15 tests and 192 assertions; the activation suite has six tests and 63 assertions. Both use synthetic inputs and the public CA, with no connection. It checks zero-call refusal for mismatches, existing schema/TLS refusal, unchanged migration bytes, second-insert rollback, same-row reruns, conflict refusal and finite scope/type/state boundaries. The author also generated the actual frozen fixture's 20-row projection through `stage_payload` and validated this helper's contract offline. That is projection compatibility, not independent source review or a cloud result.

For a separately authorized compatible operation, only after independent review, the coordinator adds `--mode execute --export <explicit-private-file> --out <new-private-result.json>` to the checked command. The export is parsed solely for `DATABASE_URL`; no environment is loaded. The output file is reserved without overwrite before connection. Do not put a credential value in arguments. Failures have bounded error codes, no raw database details, no automatic retry, and an explicitly unconfirmed outcome where appropriate. If connection loss follows a commit or a result file cannot be saved, inspect current state with a fresh read-only inventory before deciding whether another operation is appropriate.

For a future staged build, obtain and review a new successful **direct** inventory containing the new schema/columns. Generate the stage JSON using the frozen `build_seed_plan` and `stage_payload` functions; independently verify its fixture/target bindings, original bytes/locators and intended deadline. Pin those exact JSON bytes before execution. `--operation stage` then requires the same public-file arguments plus `--stage <reviewed-stage.json> --stage-sha <reviewed-exact-sha256> --contract-sha b3c9cf14177c00cebd9f4e7b6ccdf382839214573c48e31c2282d4485fff2803`. The helper checks the finite six-table contract, content hashes and relationships, but does not reconstruct originals from the stage JSON. An arbitrary freshly calculated pin is not independent review. Source/passage reviews remain `pending`, releases `candidate`, runs `staged`; external verification, explicit synthetic approval and activation remain separate steps in the sequence above.

The recorded first-run migration, staging and activation commands are not reset instructions. The existing schema and approved rows deliberately cause incompatible reruns to refuse. Before any further operation, review current state, input pins, scope and deadline; never retry an uncertain commit blindly.
