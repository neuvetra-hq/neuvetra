# OPS-AGENT-02 independent review

Reviewer: `/root/agent_ops_qa`, Head of QA. Date: September 14, 2026. Requested route: GPT-6 Astra/high; the coordinator's sanitized observation reports the same setting. This reviewer authored none of the policy, role prompts, source summaries or implementation under review. The reviewer owns this report only.

Final disposition: **PASS for the bounded local workflow and the exact stable artifacts listed below.** Publication and final mutable run/status closure remain separate observations. The initial disposition was **FAIL**; the original findings and repair history are preserved below.

## Initial findings

| ID | Finding and reproduction | Required disposition |
| --- | --- | --- |
| OPS-QA-01 | The complete-run fixture from `tools/test_agent_ops.py`, with only `outcome.first_review` changed to `pending`, passes validation. A completed, independently reviewed assignment cannot still have an unperformed first review; this also distorts the summary's first-review denominator. | Reject this contradictory completion state and preserve a real initial disposition. |
| OPS-QA-02 | The same fixture accepts `input_tokens=1`, `cached_input_tokens=20`, and `metrics_evidence=['proof.md']`. The published metric semantics explicitly describe cached input as a subset, so this known pair is impossible. | Reject inconsistent known subset measurements; keep unavailable observations null. |

The initial focused suite passed all 13 tests. Independent probes exposed the findings above despite that result. Other probes checked known unknowns and routing; the actual repository validated with 11 roles and zero runs at this checkpoint. A critical software-engineering dispatch returned Sol/high, null observed settings, and an explicit assignment-manifest-only limitation. No worker was started by this command.

## Review already performed

- All eleven role prompts link to the shared workflow, registry and their own benchmark brief. The registry's consequential routes and escalation rules are explicit. These choices are provisional; their effectiveness is unmeasured.
- Continuation-pointer edits direct the reader to current board instructions and observable activity and label superseded milestones historical. Existing active work is explicitly exempt from prospective compute changes.
- The six historical lessons are supported by the referenced original review findings. The reviewer independently recomputed every original SHA-256 recorded in `historical-evidence.json`, and inspected the cited findings, including first-pass misses and coordinated corruption cases. This is historical evidence review, not present product validation.
- The sanitized compute observation contains settings and context identity metadata. Its local-session extraction is attributed to the coordinator; this reviewer did not access private session logs or independently reproduce that extraction. No controlled model comparison or measured savings is supported.
- The CARB role, dated basis, original source manifest and earlier independent review distinguish MRR from corporate accounting, internal AI review from accreditation, proposed curriculum from demonstrated capability, and retained originals from source release. This review does not refresh current law or reapprove domain methods.
- The onboarding template defines scope, authority, sponsor, compute routes, independent evaluation and staged evidence. A registered role is not thereby competent; public briefs are curricula, and scored expectations require separate custody.

 No product code, main operational ledger, private session logs, global settings, external provider, credentials or sibling product task was modified or operated by this reviewer.


## Final repair recheck and acceptance

OPS-QA-01 and OPS-QA-02 are closed. The original independent probes now reject contradictory first-review completion and impossible cached-input totals. The follow-up duration probe initially accepted a known active duration greater than elapsed when waiting was unknown; the second repair now rejects either known component greater than known elapsed, independently of the other component. All 18 focused tests pass after the final repair. Unknown resource observations remain null.

The version-binding concern is also resolved: completed runs require the independent review's path/hash map to equal the delivered artifact map. An independent probe changed artifact bytes and refreshed only the delivered digest; validation rejected the retained stale review. Duplicate or missing review bindings are refused. This cannot prevent a person from fabricating both maps or reviewer identity; independent review and source custody remain necessary.

The added CI workflow has read-only repository permissions, a bounded timeout, and runs the same local tests and registry validation. Its path filters now include the four supporting documentation paths identified during review. No GitHub execution or branch-protection requirement is certified by this local review.

| Acceptance criterion | Independent disposition |
| --- | --- |
| AC-11-ROLES | PASS: all eleven prompts have shared-workflow, registry and role-specific benchmark links; roster and registry agree. |
| AC-ROUTING | PASS: explicit supported default/critical routes; actual manifest output returns requested settings separately from null observations and says no worker was started. QA's actual setting is attributed to the coordinator's sanitized metadata extraction. |
| AC-EVIDENCE-GATES | PASS: focused tests and independent mutations exercise missing evidence, pending completion, self-review, artifact changes, copied stale review bindings, path escape and malformed records. Semantic truth and real-world reviewer independence are outside mechanical enforcement. |
| AC-UNKNOWN-METRICS | PASS: unknown values stay null with explicit denominators; impossible known token subsets and durations are refused; no task billing or savings is invented. |
| AC-ONBOARDING | PASS: scoped proposal, sponsor, exclusions, staged topic evidence, independent evaluation and fresh-case custody are defined. A disposable additional-role registry/run validated and retained unknown cost. No general role competence is demonstrated. |
| AC-NONINTERFERENCE | PASS for reviewed scope: publication inventory contains only this workstream and required role-definition dependencies; prospective settings exempt already-dispatched work. QA did not access private sessions, modify global settings, operate providers, contact or interrupt the product task, or edit product code/main state. Parent noninterference is an attributed coordinator observation, not a full process audit. |
| AC-PORTABLE-PACKAGE | PASS: copied exactly the 36 manifest files to a disposable directory. With neither original historical reviews nor CARB source originals present, validation passed with 11 roles/1 run and all 18 focused tests passed. |

The reviewer independently compared all 32 snapshot entries' UTF-8 bytes with the live candidate, recomputed each SHA-256, and confirmed the original source map and bound bundle digest. The snapshot contains neither itself nor mutable run/status/review metadata. Keeping immutable per-assignment snapshots allows future live-file improvements without rewriting historical acceptance. The validator binds the bundle's bytes; it does not interpret its entries or automatically approve later live code.

Reproduction commands: `python -B -m unittest discover -s tools -p test_agent_ops.py -v` and `python -B tools/agent_ops.py validate`. Tests ran under Python 3.14.7 on Windows. CI requests Python 3.12 on Linux; that hosted environment remains a publication-time check. Disposable probes used synthetic files only. A first snapshot-inspection probe used the Windows default text encoding and failed to decode UTF-8; the explicit UTF-8 rerun passed without altering artifacts. A manifest-only copy made during author hash refresh correctly refused the stale digest; the final frozen copy passed.

## Limits and mutable metadata

The pilot is honestly pending: zero of three future eligible assignments; this bootstrap is excluded. The seven criterion dispositions here concern the implemented local workflow, not all agents' skill, reliable autonomous learning, perfect accounting, model superiority, measured savings or production readiness. API reference prices are dated coordinator-sourced observations, not this user's Codex billing; this reviewer did not repeat the price fetch. Historical CARB materials retain their dated review and restricted-original availability limits and were not freshly revalidated as current law.

The exact mutable exceptions are `operations/agent-improvement/status.json`, `operations/agent-improvement/runs/OPS-AGENT-02.json`, and this `operations/agent-improvement/review.md`. They are excluded from recursive snapshot binding. The run was in progress at stable-artifact acceptance, preserves first_review=fail and two rework cycles, records unknown metrics, and excludes this bootstrap from the pilot. The coordinator may advance its criteria/review/outcome from this report and update actual publication metadata, followed by targeted independent recheck. Stable-artifact changes require a new binding and affected re-review. The publication inventory itself is stable and is bound below.

Commit, remote-head agreement, visible CI and required-check-rule visibility are not established by this report. The coordinator owns those observations and must disclose unavailable required-rule visibility rather than infer a clean release gate. Do not call this review a merge, deployment, source-release or professional assurance approval.

## Exact reviewed versions

These SHA-256 bindings identify the accepted stable candidate. The bundle preserves all original text, and each original entry was independently checked against the live file.

| Repository path | SHA-256 |
| --- | --- |
| `.github/workflows/agent-ops.yml` | `11f4af6fc57af23819f1dcd8a1564567349893df5d008ec46fe4350c74bc6c50` |
| `AGENTS.md` | `5e183a8b46132a072d54bcf553700536139c5c1a97c6e1ff41f022edaec0122c` |
| `CLAUDE.md` | `c69b0f499b799d21f8bcd98bd2e1a2abcfdee6d56def420d91870157d923ae5d` |
| `docs/research/carb-verifier-role-basis.md` | `e2232bbe54c07b6ed43c715cf5b3af12d0cd81c218ada0b8e9db19263e1682ae` |
| `docs/research/carb-verifier-role-qa.md` | `a521583b9d80b05126a84a3cc4388eac440cb5d6b59ff9936fd7a4f99b18a53b` |
| `docs/research/carb-verifier-role-sources.json` | `6022709396057f6474421c0a39d6f126ec2e1de35ef8b8e874055ee6bd1c0bd0` |
| `docs/roadmap-neuvetra-ghg.md` | `8ce20d82e9e46af77d53d2bf1ae3180530b8cf42df82b5abc9432bbd276d8fa6` |
| `operations/agent-improvement/README.md` | `03a922e2ec4c089c07d49a8dbd9587ccae258960fb29aa009c90ccc89629339e` |
| `operations/agent-improvement/benchmarks.md` | `c38e5b1ae0de3f1bd0a9dcb1eea52fd8932613af16ebd3922dfd0a349c884d9d` |
| `operations/agent-improvement/compute-observation.json` | `2ab07d21ff3ba22158105324af7919ce7c0bd36081129ec39393eab024802ede` |
| `operations/agent-improvement/compute-policy.md` | `ee5f66386564e3192fba2d4bdcbb9a272c43af09f9f8504e446854dba7fe477e` |
| `operations/agent-improvement/decision.md` | `1d1703ab06560fd9d4b35eaf38f76199d2178e0fce297d1bbdb6a51bf90e5cf4` |
| `operations/agent-improvement/historical-evidence.json` | `9ee4cdce815b3e9575a2f095f2a3bc98c87adb3b7c1759f4b206cd65ca686605` |
| `operations/agent-improvement/lessons.json` | `8e55569cf348db25d7081dcf7168b6dd805f615de102821a2f9341a30d62318f` |
| `operations/agent-improvement/new-role-template.md` | `b1daa400a0bb7a4279b483c07bbe25fc9b02dfb84055eefecf142bfc8c8f4daf` |
| `operations/agent-improvement/publication-files.json` | `6c2e6276f134327f19a7e143c25bb3ffbedc62ee9ac55bd35cbc9d57be929ecc` |
| `operations/agent-improvement/roles.json` | `f936b5d30a99c2a651f350c34506b880a114d2b9f0778471a51c66bf4d8d4266` |
| `operations/agent-improvement/run-template.json` | `868a2243c971ffec2d27cee91e657349cf3755f724375ee880fda2aeb0f652ed` |
| `operations/agents/README.md` | `db58f355ac9aa455658d3a6b86de516b5c9939abb09a670978d64982960b9cb0` |
| `operations/agents/accounting-validation.md` | `3b3a733efb0344a328dd838e088cd0d4abdfc903cd4f7b52d46d851c5a4d0f36` |
| `operations/agents/carb-verifier.md` | `93dd7b6aaa7cb60fb6933b0f5bbef738b1882fc792a5f6dd58b90360ea4a7fd6` |
| `operations/agents/ceo.md` | `4c23b0495339512e30b312ea00fb4594eb45827803f4304b58acb85cd599dea1` |
| `operations/agents/commercial-operations.md` | `3d2337460547d3b5e161347417e515f185d26d7c2ec5e1e0cc4411c578947a32` |
| `operations/agents/cpo.md` | `fe5237292aafa6fe307801d3d9d07414110d11dc6ecd7812ee52ed77feacb2e6` |
| `operations/agents/cto.md` | `1368166de5ee8c4d399f3d3b4b26e94a92c99de2fd2ad6389fdf7b78f8a054f1` |
| `operations/agents/data-database.md` | `9f5a9ec9fb9c99d0cb0352fed641e77c97c6b388b6793706603628900d8a457e` |
| `operations/agents/qa-lead.md` | `0b947520b2f109b5ffbfe2724cb4ea68ef5372150dacf67c34efa0e6bb48bd94` |
| `operations/agents/regulatory-research.md` | `b8302825b83953d49d2783538b424498348aa20f322b1c2c1c0b5e011145a7f2` |
| `operations/agents/security-reliability.md` | `3b3c1d31d5e5e35bf90ad971d4511a7693b7f14d12f2eb7ac0ed4723cc0b79d3` |
| `operations/agents/software-engineering.md` | `a9ab5574fe2ef1e940cb1950e6ae69da008ff71ba1f857b6a63b45d53240a52b` |
| `tools/agent_ops.py` | `7b101c4b6157c17ca46398a0f913d5745c4467d4927cfa82c8255258880001b3` |
| `tools/test_agent_ops.py` | `48e82b087007117cefb9e5772143d0e414dfc89eb3c8f19ad8214f62830d3b67` |
| `operations/agent-improvement/snapshots/OPS-AGENT-02.json` | `a53b890e5522369a52587df24eac9c04f1889c605293c8a09cbcfcdf602c1733` |


## Local closure metadata recheck

PASS. After the coordinator advanced the mutable records, independent validation passed with 11 roles and one complete bootstrap run. All seven criteria resolve to this review; the independent reviewer differs from the author; first_review=fail and rework_cycles=2 are preserved. All resource metrics and escaped defects remain null. The summary correctly reports one complete run, zero first-review passes out of one pass/fail disposition, and one unknown cost with no known cost sum. Pilot eligibility remains false and zero of three future pilot assignments is recorded.

The status is `independently_accepted_local_pending_publication`; publication remains pending for branch `codex/m57-inventory-review`, PR #3. No remote head, hosted CI or required-rule visibility is asserted by this local closure. All 32 stable original-file hashes still match the accepted snapshot. Later factual publication metadata remains the coordinator's explicit mutable exception; changes to scope, stable artifacts, pilot eligibility, unknown observations or preserved first results require re-review.
