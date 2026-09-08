# Scope 2 pilot — independent QA

**Scoped pass, September 8, 2026:** the reviewed EPA subset and bounded answer/control-flow demonstration pass the checks below for the authorized private internal evaluation. The reviewer is `independent QA /root/site_review`, separate from the evidence, backend and UI/integration authors. This reviewer authored this report and the fixtures, inspected implementation and executed offline checks. The coordinator executed the live run and browser checks, identified separately below. This does not grant commercial reuse rights, accounting assurance or production release approval.

**Final packaging pass:** the release and fixtures use LF so Git's configured text filters preserve their bytes. Reconstructing the release's prior CRLF form reproduced its exact original hash, proving a newline-only content change. Only `release.sha256` changed in the parsed fixture. The actual loader returns exactly P01–P04 with the new pin. Run 02 below binds the portable files and repeats all 17 HTTP question cases successfully. Git filtered/unfiltered object IDs match for all 17 checked release, fixture, run, backend/runner and frontend files.

## Acceptance boundary

The pilot must distinguish a supported general explanation, relevant missing company facts, unsupported calculation/filing coverage, unresolved source applicability and a technical dependency failure. Responses use the existing M2 states: `supported`, `qualified`, `needs_input`, `needs_review`, `unsupported`, `stale_or_conflicting` and `unavailable`.

The model may select independently reviewed propositions. Its unvalidated factual prose must never appear in an answer, stream, cache or error response. A real citation attached to an unrelated or contradicted proposition is a failure. General conceptual questions must not require a company questionnaire; supplying a location does not authorize a numeric factor selection.

## Original-source inspection completed

| Original artifact | Independently recomputed SHA-256 | Inspection |
| --- | --- | --- |
| `epa-electricity-emissions-2023.pdf` | `14159d202f33dc9953bced7d8acdb53c8affd4b4260e2e0c8482f1b174f28cf3` | December 2023, 19 PDF pages; read relevant introductory, activity-data, factor-choice and qualification text. Visually inspected PDF pages 4, 9, 10 and 11, corresponding to printed pages 1, 6, 7 and 8. Selected passage/proposition review passed with the limits below. |
| `ghg-scope-2-guidance.pdf` | `b4f17030e5d723d5b9b65ed85592c5449dafe4f798eb845ed9db0465893c894a` | 2015 guidance, 120 PDF pages; read methods, reporting qualifications and PDF page 119 copyright notice. Not automatically eligible for runtime reuse. |
| `ghg-scope-2-corrections.pdf` | `b7772e0d86764383b41f923bfcace305d239ac5baf39ad22ffb55f78ba9dacad` | Two PDF pages; correction history includes April 2025 on page 2. |

Originals are in `C:/Users/nimab/Neuvetra/research-sources/2026-09-08/`; the [download manifests](calculation-extra-downloads.json) and [core manifest](downloaded-sources.json) record canonical URLs and retrieval provenance. These are source-integrity observations, not release approval.

The current [EPA inventory-guidance page](https://www.epa.gov/climateleadership/scope-1-and-scope-2-inventory-guidance) still links the December 2023 electricity publication. The [GHG Protocol correction sheet](https://ghgprotocol.org/sites/default/files/2023-03/List%20of%20Corrections%20to%20the%20Scope%202%20Guidance.pdf) includes an April 2025 correction about IEA non-CO2 factors in Table 6.4, even though its publisher landing-page label says December 2022. Preserve both dates with their meanings; the label is not the latest correction date inside the file.

## Use and attribution constraints

GHG Protocol's Scope 2 PDF states a CC BY-NC-ND 3.0 license; its [Terms of Use](https://ghgprotocol.org/terms-use) also impose restrictions. EPA's [copyright notice](https://www.epa.gov/web-policies-and-procedures/epa-disclaimers) does not establish blanket commercial reuse permission for everything hosted on its site. The electricity guidance includes material based on GHG Protocol, so third-party content, figures and tables cannot be treated as automatically cleared EPA originals.

The coordinator authorized a private internal evaluation using concise attributed factual paraphrases, including selected EPA proposition, qualification and anchor text as input to the configured Anthropic adapter. The disposition is limited to that exact content and use; `commercial_runtime_approval` remains false. Public/commercial redistribution, general document ingestion, model training, logos/graphics and third-party text remain outside this operational disposition. A short quotation or a passed hash check does not itself settle reuse rights; this is not legal assurance or permission to widen distribution.

## Required negative checks

- Select a valid but unrelated proposition; omit an essential method or qualification; attach extra or reversed factual prose. Withhold the candidate.
- Mutate a source/release hash, locator, citation URL or approval state. Withhold affected evidence; retain the original artifacts.
- Request an unreleased corpus or return a withheld/withdrawn/context-trimmed evidence ID. Caller or model text cannot grant access.
- Inject source instructions, unsafe markup or fabricated citations. Do not execute them or display unvalidated claims.
- Disable or fail retrieval/provider configuration. Return a truthful unavailable state without raw provider output, credentials or a canned answer presented as live AI.
- Verify API and UI responses, including delayed failure, so a rejected draft never appears briefly or survives from an earlier answer.

## Current portable versions and source disposition

| Artifact | SHA-256 |
| --- | --- |
| [Approved release](../../data/research/releases/scope2-pilot.v1.json) | `c926e527ebb276aad1f279f950cb87f997557f86b3e993ba65957de9bb51ed0f` |
| [Independent fixtures](../../evaluations/research-qa/scope2-pilot-fixtures.json) | `ccea3506492ccb0fd7742f3ebca15fddb7aa7a70c1eaea9c63a7abc7b15d7c8d` |
| [Recorded live run 02](../../evaluations/research-qa/runs/2026-09-08-scope2-pilot-02.json) | `e146843422b86da921eb31ec7fae7232d15cdd74e5e8199d5f115aab38ae4e2f` |

[Run 01](../../evaluations/research-qa/runs/2026-09-08-scope2-pilot-01.json) remains historical evidence of its original CRLF release/code bytes: release `9a702dce0627791a1c6031bdb3e04e494d8d02f092b049b81168c9d724814cc7` and fixture `a86ab8076b7a78de2d358f3266eb9078b45603d789434a00f75bdadd19af4373`. Those recorded values were not rewritten. Its storage file alone was normalized to LF, now SHA `87b28d658600847b5c04df9ffe92959dc43591d4eea3be5cfb2ff3693cd7200b`; reconstructing CRLF yields the original artifact SHA `71a85518d4113e145591875eaddeb5dbf20e66dfc1ef063dbca5d09ad14eb479`, independently proving its JSON data did not change.

All eight original source files in the release were independently checked for matching bytes, sizes and hashes. All thirteen evidence contexts were read in the originals; normalized page/context hashes, offsets and short anchors were reproduced. Normalization uses Unicode NFKC and collapsed whitespace; HTML extraction excludes script/style. These checks establish reproducible locators, not automatic semantic entailment. Exact paths/provenance are in the release and [evidence handoff](scope2-pilot-evidence.md). The existing EPA PDF was rehashed and read; a fresh publisher-byte comparison was not claimed for this passage review.

Only source `epa-electricity-2023`, evidence `E01`–`E06` and propositions `P01`–`P04` received the scoped disposition:

| Proposition | Original support checked | Qualification retained |
| --- | --- | --- |
| P01: location-based grid electricity concept | E01: PDF p4/printed p1, third body paragraph; E05: PDF p9/printed p6, §3.3.1 item 2 | Excludes direct-line and on-site cases. |
| P02: market-based procurement concept | E01 and E02: PDF p10/printed p7, §3.3.2 | Contract/certificate quality requires review; no automatic eligibility or factor selection. |
| P03: EPA recommendation for separately labeled results | E03: PDF p9/printed p6, opening §3.3 paragraph | U.S. inventory guidance, not a worldwide or legally binding reporting rule. |
| P04: relevant company context | E02; E04: PDF p7/printed p4, §3.1; E05; E06: PDF p11/printed p8, §3.3.3 final paragraph | Bounded synthesis about location, period and supply evidence, not a sufficient factor-selection checklist. |

The author corrected three locator findings: E01's paragraph number and incomplete sentence endings in G04 and D03. The corrected candidate hash was `6ea304f71b3306df7b52f65e4ac843319a947d4249353685a8adbcc966138683`. Approval metadata then produced the first-run release, subsequently normalized to the current LF version; proposition text, qualifications, anchors and locators were unchanged. GP01, GP02, DP01 and all other sources/evidence remain pending or withheld. Their presence in the JSON does not make them eligible for runtime use.

Review time is `2026-09-08T23:20:32Z`; the operational review deadline is `2026-09-15T23:20:32Z`. That deadline is neither source expiration nor a regulatory effective date.

## Software review and offline execution

The isolated service pins the approved release, verifies approved originals before retrieval and again after model latency, filters approval states, and renders reviewed text only after strict candidate-ID/reference/topic validation. Extra factual prose is rejected even with real citation IDs. No candidate stream or answer cache exists. The loopback-only service does not import the legacy greeter/authentication setup.

Material findings were fixed by their authors and rechecked: unrelated broad-word retrieval; incomplete method comparisons; zero-emissions/excluded-supply requests; publisher/global obligations and financial questions; HTTP override rejection; and client acceptance of facts in nonanswer states, unresolved references or unsafe citation destinations. The client clears the previous answer before submitting and displays only decoded responses. Source controls open the associated details and original PDF page; short anchors are explicitly phrases to locate in full surrounding context.

Independent execution on Windows with Bun 1.3.12:

| Check | Actual result |
| --- | --- |
| `bun test src/research` in Site API | 30 tests pass; 108 assertions. Includes source/release mutations, approval/expiry/status failures, path escape, candidate mismatch, disabled/failed provider, post-model source changes, mocked transport/budget/concurrency and HTTP boundaries. |
| `bun test src/lib/research-api.test.ts` in Site Web | 10 tests pass; 26 assertions. |
| All 17 question fixtures against the pinned original with a controlled provider | 17 pass; six mock selections; zero real calls. Valid results also pass the client decoder. |
| Additional worldwide/GHG Protocol obligation, electricity pricing, cheapest supplier and Brazil questions | Four pass; unsupported with empty content and zero provider calls. |
| Candidate fixtures S2-A01–A05 and S2-A10 | Six pass: unrelated, extra-prose, partial-topic, unretrieved, withheld and context-trimmed selections rejected. |
| Additional client protocol probes | Fourteen pass: unsafe URLs, facts in nonanswer states, disabled/null provenance and duplicate/dangling/extra references. |
| Disabled, transport-failing and malformed-candidate provider probes | Three pass; correct unavailable/review states, empty content and no injected raw-error sentinel. |
| Release provenance | Exact approved SHA appears in status and answer responses. |

The fixture file defines **31 cases**, of which **17 are live-eligible questions**. The other fourteen are adversarial-layer definitions. Their covered controls were exercised through the named offline fixtures/probes and implementation tests; this is not a claim that 31 cases ran end to end or that the separate 35-case planning bank passed. Source mutations used temporary/synthetic files; preserved originals were not modified.

Run 02 identifies base commit `0100b96e628d4c15d80c40da7f0e69332586c7eb` plus ten exact backend, test and runner hashes. All ten were independently recomputed after the run and matched current files. Working changes are identified by those hashes, not represented as part of the base commit. The runner explicitly writes UTF-8 bytes to avoid platform newline conversion. Independently inspected frontend versions:

| File | SHA-256 |
| --- | --- |
| `apps/site-web/src/lib/research-api.ts` | `0ac8c689526bcf50035769e8ad677d8e1d960156abc7e10045bfeb4989b376cc` |
| `apps/site-web/src/lib/research-api.test.ts` | `9b1dce1ffa7223916748683ca34baa01543dd35e5e5a2c04be9f44e27dbbaf34` |
| `apps/site-web/src/components/ResearchAnswerPanel.tsx` | `6017d787de9cb675a4f1e8ba867752f7cc6f77f21b4240568193c34573f4a41f` |

## Live and browser evidence

The coordinator's [explicit live runner](../../tools/research/run_pilot_eval.py) executed run 02's 17 question cases at `23:46:26Z`–`23:46:40Z`. Independent review of its assertions and saved responses confirmed all expected states, exact required proposition text/qualifications, approved evidence/source references and release pin. All 17 saved responses independently passed the current client decoder. Six qualified answers used P01 and/or P02; eleven requests returned empty nonanswer content. P03/P04 have source approval but were not demonstrated as live selected answers in this run.

Run 02 records `claude-sonnet-5`, six provider-call counter decrements from 23 remaining to 17, and a $0.36 reserved-spend increase. These are service counters/reservations, not provider billing receipts. It excludes run 01's six calls and the coordinator's two separate browser calls; the coordinator reports fourteen aggregate calls, with sixteen remaining after the final browser check. Run 02's code/release/fixture unchanged checks passed, and independent post-run hashing confirmed them. No paid calls were made by this reviewer.

The coordinator reports desktop/mobile inspection and three guard-case interactions showing no retained prior answer and correct context, unsupported and source-status states. After run 02, the coordinator also reports a live P01/P02 comparison with exact E01/E05 and E01/E02 references, successful expansion of E01, and an original publisher link ending `electricityemissions.pdf#page=4`. This reviewer inspected corresponding component behavior but did not independently operate a browser or validate those screenshots. The run artifact establishes HTTP behavior, not all rendered interaction details.

## Remaining limits and handoff

The scoped pass supports showing this private pilot to the board for milestone feedback. Routing is deliberately lexical and conservative; finite examples do not prove universal semantic relevance or resistance to every adversarial paraphrase. The status-comparison example reports an unresolved limitation; no published-versus-draft interpretive answer was released.

Not established here: broad/historical/jurisdictional coverage, numerical methods, contract eligibility, filing, cloud storage, customer authentication/tenant isolation, public deployment, commercial rights, vendor comparison, load testing, screen-reader usability or every delayed-network/cancellation race. Integrity checks bind reviewed local files; they are not a hostile-filesystem sandbox or automatic source-review service. Provider budget counters reset on process restart and require operator accounting across restarts. No paid, production or customer-data calls were made by this reviewer.

Next owner is the coordinator: incorporate this result and separate repository-wide checks, demonstrate the approved behavior, and collect board feedback before widening evidence or implementation scope. Changed releases require review and a new pin; revisit the operational deadline before further use after September 15.
