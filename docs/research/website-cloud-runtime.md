# Private website cloud runtime

This historical runbook describes generated-answer revisions01–04, all of which failed their answer-quality gate. The current implementation is the [reviewed-composition runtime](website-composed-runtime.md). Publication and dedicated-reader evidence below remain applicable; generated-answer sequencing and allocations below describe the preserved experiment. The [QA report](website-cloud-qa.md) owns evaluation dispositions. Neither runbook declares production readiness.

## Website and evidence path

The [website](../../apps/site-web/vite.config.ts) runs locally on port **5174**. Its `/research-api` requests proxy to `127.0.0.1:3012/research`. The [cloud server](../../apps/site-api/src/research-cloud-server.ts) instead defaults to **3016** for candidate QA, binds only `127.0.0.1`, and permits only those two configured ports. Starting the candidate on 3016 does not switch the mounted website to it. The coordinator uses 3012 for the reviewed website only after its quality gate; the unrelated `/api` proxy remains separate.

The browser submits only a question. It cannot supply a scope, build, provider key or reader token. The server uses the dedicated ordinary **C reader**, authenticated by Supabase, with its one C membership and RLS-protected access. This is a server-held private-review identity, not customer login. The [twelve recorded GET checks](../../evaluations/cloud-integration/website-reader-access-01.json) passed, including C access, A/B invisibility, anonymous denial and a forged-role denial. Those checks did not execute an RPC or establish isolation for every legacy application.

The [repository](../../apps/site-api/src/research-cloud/repository.ts) binds the [approved target](../../infra/cloud/website-epa-target.approved-01.json) to:

| Resource | Fixed candidate binding |
| --- | --- |
| Supabase | `icockcoguyadhryzydvl.supabase.co`; schema `neuvetra_research_dev`; private bucket `neuvetra-research-dev` |
| Research scope | `90000000-0000-4000-8000-00000000000c` |
| Build / Pinecone namespace | `63f0190c-9694-46db-9ea8-85445a80f6be` / `nv-63f0190c969446db9ea885445a80f6be` |
| Source release | `scope2-website`, version 1; SHA-256 `38f91ceac7aab790cb6faf98d39d8e0c5f2eb734f6a5763d51b6bf6ef7afa43f` |
| Vector profile | `llama-text-embed-v2`, 1,024 dimensions, cosine; query/passage input types; `truncate: NONE`; API `2026-04` |

Before planning, the repository verifies the ordinary identity, membership and active build, then resolves **three private objects**: the original EPA PDF, normalized extraction and approved release. It checks their hashes, sizes, source metadata, Unicode span offsets and all **18 approved paragraph** projections. Local paths retained inside the release are provenance only; this runtime does not read those source files or fall back to a local corpus.

Pinecone searches the fixed namespace with scope, release, vector-profile and active-record filters, requesting up to ten candidates. Returned IDs and metadata must resolve to the verified Supabase evidence. The planner receives the entire bounded 18-card catalog alongside ranked candidate IDs; a missed top-ten result therefore does not remove approved coverage. An empty or failed search still withholds the answer. This arrangement does not demonstrate ranking accuracy. Selected paragraphs and their required dependencies supply answer evidence; the full PDF and excluded Section 4 material do not enter model context. See the [source and hosted-processing disposition](website-source-release.md) and [publication provenance](../../evaluations/cloud-integration/website-epa-publication-01.json).

## Answer checks and limits

The [provider](../../apps/site-api/src/research-cloud/provider.ts) uses Sonnet 5 with thinking disabled and a 1,800-token output cap to plan. Drafting and independent model review use Opus 5, adaptive thinking/high effort and 8,192-token caps. Thinking display is omitted, and known thinking/signature blocks are discarded before the optional private trace callback. Traces can contain questions, selected evidence, final structured outputs and usage; they are private evaluation records, unsuitable for customer data. This makes no vendor retention or training claim.

The [answer pipeline](../../apps/site-api/src/research-cloud/answer.ts) enforces exact quote anchors, each paragraph's own citation dependency closure, facet completeness, one answer paragraph per requested facet,850 characters per paragraph and4,000 characters overall. Each paragraph may contain several factual clauses, all of which require source review. The wire schema uses a singular paragraph object, decoded verbatim into one internal review unit; no statement is deleted or rewritten by the decoder. Semantic review must preserve conditions, modality, relationships and source attribution. Two supported statements do not establish an author's causal rationale; absence in a paragraph cannot establish absence throughout a publication. Exact quotations alone do not prove the answer true.

There is **one shared whole-answer correction allowance**. A normal answer uses three model stages. A bounded draft-contract repair uses four: plan, draft, complete redraft, fresh review. An eligible semantic correction uses five: plan, draft, review, complete redraft, fresh review. The second review receives no prior verdict or repair history. The server never truncates claims, substitutes citations or grants another correction after a repaired answer fails. Unknown evidence, malformed output or output beyond the repair size limits, quantitative-result guards, scope/context failure, cloud failure and expired evidence remain fail-closed. Final evidence/identity checks run again before display.

Revision01 had three clean answers, one deficient released answer, two withheld supported questions and two correct refusals among eight questions. Revision02's full18 had five clean answers, one deficient released answer, three withheld supported questions and nine correct boundaries. Revision03 changes source-by-source expansion to one complete paragraph per requested facet and consistently blocks factor-value modifiers. The original16 source-review request bytes remain unchanged. A known conservative wording limitation remains: the numerical guard interprets “factor: one covering…” as a numerical assignment. This finite wording guard is not a complete natural-language classifier.

Before any revision03 model call, a documentation check caught that the provider does not support array maxItems. The candidate was changed to the singular object schema; its unused profile/policy is retained with zero reservations. [Provider schema limitations](https://platform.claude.com/docs/en/build-with-claude/structured-outputs#json-schema-limitations) explain why grammar constraints alone cannot impose that array maximum. A separate Windows startup failure occurred before reservation: Bun reported EEXIST for an existing OneDrive directory. Startup now skips directory creation when it already exists and retains type, policy and reservation checks. The [startup record](../../evaluations/research-qa/runs/website-revision03-startup.json) preserves the failure.

## Reviewed source-condition checks

Revision03 still falsely accepted a paragraph that omitted an applicable quality prerequisite, despite exact source quotes and a complete citation context. The [reviewed condition catalog](../../data/research/conditions/scope2-website.v1.json) now inventories36 requirements across all18 passages. It is a versioned software review policy derived from the same EPA evidence, not a new source publication. Its [independent source approval](website-condition-catalog.md) is bound to SHA-256 `063adbadbe9c70493a81228931c4e4ec4a833633d12c83e2ab48616bd876d2c6`, and the server checks that exact file before startup. The catalog also binds to the verified cloud source release and exact passage quotations.

Drafting receives the selected-source checklist. Verification receives a mandatory condition set for each paragraph's own citation closure; no condition can be silently omitted from its returned ledger. Applicable preserved conditions require exact supporting text within that same answer paragraph. An applicable missing condition must produce a negative claim condition assessment and aligned issue. Missing/malformed rows fail closed. The provider response puts evidence audits before summary flags and the final decision; this is an ordering aid, not a proof.

Applicability and whether an answer quotation truly preserves a prerequisite still require semantic judgment. A model can misclassify a condition as irrelevant or accept a weak quotation; exact row coverage alone cannot eliminate that risk. The24-case verifier gate and full18-question/browser evaluation must therefore be reviewed independently. The earlier false approval remains in the record.

## Private startup and allowance

Startup is explicit through `startCloudPreview(config)`; direct execution of the server module refuses to load configuration. The coordinator's ignored `website-bootstrap-04.ts` receives only individually supplied private process inputs, clears its four credential variables, pins its runtime target and uses a filtered environment for its session-persistence child. It does not load the supplied ENV export. No provider key, password or JWT belongs in browser configuration or a `VITE_*` variable.

The ordinary session starts with password exchange and refreshes near expiry. The persistence callback completes before the session is released for use. The reviewed private sink receives the snapshot through child stdin, encrypts it with Windows current-user DPAPI, and records only safe identity/expiry metadata. Failed refresh or persistence stops that instance; there is no hidden retry/password fallback. Encrypted persistence is not a portable credential manager or customer authentication system. This author inspected code only and did not read credentials or encrypted session contents.

The following is an **interface sketch**, not a runnable credential loader or permission to start a service. The operator supplies the reviewed persistence function and placeholders privately:

```ts
const config: PrivateCloudPreviewConfig = {
  port: 3016, // 3012 only for the separately accepted local website
  target: {
    supabaseHost: 'icockcoguyadhryzydvl.supabase.co',
    schema: 'neuvetra_research_dev', bucket: 'neuvetra-research-dev',
    pineconeHost: 'neuvetra-ghg-dev-0msj1fa.svc.aped-4627-b74a.pinecone.io',
    pineconeIndex: 'neuvetra-ghg-dev',
    scopeId: '90000000-0000-4000-8000-00000000000c',
    buildId: '63f0190c-9694-46db-9ea8-85445a80f6be',
    namespace: 'nv-63f0190c969446db9ea885445a80f6be',
    releaseSha256: '38f91ceac7aab790cb6faf98d39d8e0c5f2eb734f6a5763d51b6bf6ef7afa43f',
    profileSha256: '756dd7589f918a257dad2fad38e3d8839c7d9c55a007885f0e1505f5528871f5',
    expectedReaderUserId: '<reviewed dedicated C reader UUID>',
    reviewExpiresAt: '2026-09-15T23:20:32Z',
  },
  supabasePublishableKey: '<private server configuration>',
  pineconeApiKey: '<secret supplied in memory>',
  anthropicApiKey: '<secret supplied in memory>',
  readerEmail: '<dedicated private reader email>',
  readerPassword: '<secret supplied in memory>',
  budgetDirectory: '<absolute existing private revision-04 budget directory>',
  runId: 'website-evaluation-04', maxCalls: 100,
  persistSession: reviewedDpapiSink,
}
// The approved private operator invokes startCloudPreview(config).
```

The [revision04 allocation](../../operations/website-evaluation-allocation-04.json) provides100 attempts:55 carried forward and45 explicitly added for the expanded source-condition evaluation and browser work. Earlier reservations remain32+59+4=95; the combined conservative ceiling is195. These are operator-set test limits, not a user-specified financial cap or actual billing. Provider profile is `79c2244d1edc828148bac11d6000dd27525a006ccf330e1e0210cff0b05edfd0`, distinct from the embedding profile. Each stage reserves $1 before network I/O in an exclusive, flushed file. Failed/uncertain attempts remain counted, restart preserves reservations, and admission requires five remaining stages. Switching ports reuses the same budget. Any later private interactive allowance needs an explicit allocation preserving earlier usage.

The source and C-resource review deadline is **September 15, 2026 at 23:20:32 UTC**. Startup does not renew it. An expired source/target, changed build or exhausted allowance must stop answering; inspect the specific status and retained receipts rather than changing pins or resetting counters. Stop the candidate before an approved port switch. Starting/stopping a local server does not delete cloud resources or schedule cleanup.

## Remaining release boundaries

Use the [frozen acceptance contract](../../evaluations/research-qa/website-cloud-acceptance.v1.json), [QA report](website-cloud-qa.md), [allocation record](../../operations/website-evaluation-allocation-04.json), [publication runbook](../../tools/cloud/website-publication.md) and [reader receipt](../../evaluations/cloud-integration/website-reader-access-01.json) to assess the next demonstration. A benchmark pass cannot substitute for complete natural answers and browser verification.

This remains private, noncommercial conceptual research. Customer login, customer isolation, production deployment, deterministic emissions accounting, automatic source renewal and cleanup are not completed by this candidate. [Risk R8](legacy-database-access-review.md) remains open: legacy authenticated table access and privileged API authorization require separate work. Scoped C-reader checks and anonymous containment do not resolve that broader security gap.
