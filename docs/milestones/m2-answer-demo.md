# Scope 2 research pilot

This document describes the historical fixed-statement pilot. The [passage retrieval experiment](m2-passage-retrieval.md) addresses its systemic vocabulary and evidence-context limitations in a separate entry point; its validation and remaining limits are recorded independently.

This increment adds an **Ask Neuvetra** workspace to the approved green Site preview and an isolated local research service. It is a private internal evaluation of U.S. purchased-grid-electricity concepts. It is not a general greenhouse-gas expert, a calculation engine, a filing service, or a production deployment.

## What the user can try

1. Compare location-based and market-based accounting. The actual model selects reviewed propositions; the server renders their unchanged text, qualifications and precise source references.
2. Ask which electricity factor a company should use. The service requests missing location, reporting period and supply context. Supplying those facts does not unlock an unreviewed numerical factor.
3. Request emissions calculations or a California filing. The service explains the coverage limit and displays no invented result.
4. Ask whether a new draft replaces published guidance. This pilot leaves that status comparison unresolved because its comparative evidence is withheld.

These are four different outcomes, not four prerecorded AI answers. Only accepted conceptual questions need model selection. Context, unsupported, suspicious-request and version-status guards can respond without a model call; they contain no factual answer claims. With a disabled provider, a supported conceptual question returns unavailable.

## Evidence and answer controls

The [reviewed release](../../data/research/releases/scope2-pilot.v2.json) has SHA-256 `5e735bba3c029f2c41c94edb12fd57ff13c4859047446be520fc3a81533b8d99`. Only EPA source `epa-electricity-2023`, spans E01–E06 and propositions P01–P05 are approved for this internal use. All other source records and comparative propositions remain withheld. The [original source brief](../research/scope2-pilot-evidence.md) documents editions, precise original locators, rights constraints and the correction-date discrepancy discovered in GHG Protocol material.

The source author and independent reviewer opened the originals. The short displayed excerpts are **locator phrases**, not complete supporting passages; the UI labels them as phrases to find and links PDFs to their actual PDF page. Printed page numbers and full section locators remain visible. Claim text is an attributed, reviewed paraphrase, not an extract presented as a publisher quotation.

The model receives only the retrieved approved propositions and their evidence anchors. Structured output may select proposition/evidence IDs or decline; it cannot supply factual prose to the answer. The server rejects unknown, unrelated, incomplete, duplicate or mismatched selections and renders the approved text itself. It checks the pinned release and original-source bytes again after model latency. The browser also rejects inconsistent answer states, unresolved references and unsafe publisher links. There is no answer streaming or cached fallback.

These controls bound factual generation; they do not prove universal understanding, relevance, applicability or zero hallucinations. The lexical routing deliberately rejects unsupported topics and can miss unfamiliar phrasings. Broader retrieval or generation needs a separately reviewed corpus and measured evaluation. The evidence-review deadline is September 15, 2026 at 23:20:32 UTC; overdue evidence stops answering until reviewed. This is an operational deadline, not a law or publication expiration.

The second release addresses [board feedback](../../operations/feedback/2026-09-08-milestone-2.md) about a compound methods-and-reporting question. It adds a separately reviewed explanation of the grid-average and procurement perspectives, keeps EPA’s recommendation qualified, and requires every requested topic in the selected answer. The [feedback evidence brief](../research/scope2-pilot-feedback-evidence.md) records the new approval; v1 and its previous test runs remain frozen.

## Local startup

Use Bun 1.3.12 with the existing root lockfile. Start the frontend with `bun run dev` at `http://localhost:5174`. Its new `/research-api/*` proxy forwards to the isolated loopback service on port 3012. The older `/api` proxy and Site greeter remain separate.

Start the isolated service with `bun run dev:research` after setting the server-only variables below through a local secret manager or private shell environment. This command does not use watch mode: restarting resets the in-memory call budget. The service can start without a provider and will truthfully show answering as unavailable.

| Variable | Meaning |
| --- | --- |
| `RESEARCH_PROVIDER` | `anthropic` explicitly enables the adapter; otherwise disabled. |
| `RESEARCH_ANTHROPIC_API_KEY` | A development credential passed only to the server process. Never a `VITE_*` variable. |
| `RESEARCH_MODEL` | `claude-sonnet-5`, the current evaluated baseline; other models need a new pricing/behavior review. |
| `RESEARCH_PORT` | `3012`; the service always binds `127.0.0.1`. |
| `RESEARCH_ALLOWED_ORIGINS` | `http://localhost:5174,http://127.0.0.1:5174`; loopback origins only. |
| `RESEARCH_RELEASE_PATH` | Absolute path to the reviewed release JSON. |
| `RESEARCH_RELEASE_SHA256` | The exact approved hash above, supplied independently of the file at startup. |
| `RESEARCH_SOURCE_ROOTS` | JSON array of allowed absolute original-source directories. Restore the original bytes at the recorded paths for this local release. |
| `RESEARCH_MAX_CALLS` | At most 30 per process. Reduce it on restart to preserve the session's remaining allowance. |
| `RESEARCH_MAX_OUTPUT_TOKENS` | At most 1,200, with thinking explicitly disabled. |
| `RESEARCH_MAX_SPEND_USD` | At most 2; conservative local reservation envelope. |
| `RESEARCH_CALL_RESERVATION_USD` | At least 0.06 per attempted request; failed/uncertain calls retain their reservation. |

The provider makes no automatic retries and permits only one in-flight model call. It limits serialized request size and sets a 45-second timeout. Its reservation calculation uses Sonnet 5's published $2/$10 per million input/output token rates and conservative input headroom. It is not actual billing telemetry, an account-level spending limit, or a durable cloud budget. Current API details were verified in Anthropic's [structured-output documentation](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) and [Sonnet 5 migration guide](https://platform.claude.com/docs/en/models/sonnet-5/migration-guide).

For this session, the supplied ENV export was inspected privately; only the Anthropic credential was passed to the child process. No environment values are committed, sent to the browser, or included in model prompts. The read-only models endpoint confirmed access before live testing. The previously disabled GitHub Claude reviewer is a separate integration and remains disabled.

## Reproduce validation

`bun run check` includes the new offline Site API and browser response-boundary tests, plus existing application checks/builds. These tests use controlled transports and synthetic temporary sources; they do not spend model credits or establish live answer quality.

The independent [pilot fixtures](../../evaluations/research-qa/scope2-pilot-feedback-fixtures.json) bind the exact evidence release. Run their 20 eligible question cases only against an explicitly configured, budgeted local live service:

```sh
python tools/research/run_pilot_eval.py --run-live --output evaluations/research-qa/runs/UNIQUE_RUN_NAME.json
```

The runner records question/response pairs, IDs, exact reviewed text/qualifications/references, source and fixture pins, code hashes, statuses and call reservations. It preserves previous outputs and does not run automatically in CI. The remaining adversarial fixtures cover controlled candidate, provider, source mutation and UI-protocol tests separately. The original 35-case future question bank is not declared fully passed by this subset. See the [feedback QA report](../research/scope2-pilot-feedback-qa.md) for actual execution and limitations.

## Next release boundaries

This remains a local pilot. Public hosting requires authentication, durable usage limits, rights clearance, portable source storage, controlled release promotion and deployment verification. The existing Railway production services have not been reconfigured. No tenant data, uploads, billing changes, database changes, report submissions or unattended workers were added. Company calculations require a separate deterministic-method increment and independent expected-value checks.
