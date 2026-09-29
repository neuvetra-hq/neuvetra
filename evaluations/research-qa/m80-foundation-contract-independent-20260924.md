# M80 offline foundation contract: independent QA

Task: `M80-FOUNDATION-CONTRACT-QA-20260924`. Reviewer: `/root/m80_foundation_qa`, QA lead. Requested model/effort: `gpt-6-astra/high`; observed settings and resource usage unknown. Implementation author is a separate execution context. Review status: **pass for frozen candidate 2, offline scope only**.

## Independently derived review plan

The accepted technical plan candidate 3, product plan candidate 2 and M79 four-profile inventory define expectations. The scope is a pure offline contract increment; database authorization, history/concurrency, routes, browser use, real documents, deployment, domain/rights release and customer readiness are not implemented or accepted by this review.

1. Admit only exact known synthetic fixture metadata under separately supplied server context. Challenge omitted/inactive/wrong-company admission, coordinated changed payload/hash, client-injected admission or release authority, and labels that merely say synthetic.
2. Exercise actual exported input boundary with malformed JSON, duplicate or escaped-equivalent keys, prototype keys, arrays/null in object positions, extra authority/content fields, invalid enums, oversized values and cardinality excess. Rejection must not depend on detecting arbitrary real data or include untrusted content in diagnostics.
3. Independently reconcile entities, locations and source IDs; challenge duplicates, missing rows, mismatched links, unknown references, self/foreign links and reordered equivalent input. Reject incomplete census rather than dropping unknowns. Preserve all source families including fuels, mobile vehicles/equipment, refrigerants, fire suppression, process screens, all seven gas groups and other direct sources.
4. Compare candidate profiles to M79 natural-gas HHV, No. 2 distillate generator, controlled medium/heavy on-road fossil diesel 2007â€“2022 with gallons and miles, and stable serviced fugitive equipment boundaries. Require held-only matching; known unsupported and missing facts remain named rows. No release flag, emissions result, subtotal, export, source text or complete-company assertion may appear.
5. Exercise canonical serialization independent of object key order, immutable bundled fixtures and output aliasing. Calendar 2025 and operational control must remain synthetic proposals, not confirmed customer facts.
6. Freeze reviewed byte hashes, preserve first-review failures and target repaired cases on each new frozen candidate. Local module tests establish only the stated pure-contract behaviors.

## Evidence

The executed checks and exact candidate verdicts are recorded below and in the adjacent JSON receipt.

## Frozen candidate 1: fail

Snapshot `48f2135eaa3656bcf794f9f633f2d8f042ab7ee3fb6f52770ae95efcfd98631c` was verified against all five live file byte hashes. Independent tests: 13 passed, 1 failed, 320 assertions; package typecheck passed.

**F01, material:** Changing the fixture entity control to `unknown` makes the process source classification return only `entity_control_state`, removing all fourteen existing process-category and gas-group gaps. The input still contains those unknowns, but the prioritized classification loses them. The author must compose all required facts before selecting the result branch. The independent regression is in the review test at line 136.

Pre-freeze feedback P01 required explicit seven-category/seven-gas screening; the author implemented it before candidate 1. F01 is the first frozen-candidate failure. No final acceptance is issued.

## Frozen candidate 2: pass for offline scope

Accepted implementation snapshot: `operations/agent-improvement/snapshots/M80-FOUNDATION-CONTRACT-20260924-CANDIDATE2.json`, SHA-256 `631e5859f642ae312eb97387d504c22696effd9a6639efff30ed92a35bae2a15`. All five file byte hashes and saved UTF-8 texts match. Candidate 1 and its failed review remain preserved.

The independent suite passed **14 tests / 354 assertions** using Bun 1.3.12. Package TypeScript checking also passed. F01 is resolved: both an unknown entity-control fact and an unknown source activity-data kind preserve all fourteen process/gas-group required-fact codes. The targeted source change, author regression and updated implementation description were inspected against candidate 1.

| Criterion | Independent evidence | Verdict |
| --- | --- | --- |
| Fixture/context integrity and closed metadata | Wrong/inactive/malformed context; client authority fields; unknown fields on every object; duplicate and escaped JSON keys; prototype/accessor, size and type rejection | Pass |
| Complete cross-linked census | Removed/duplicate/excess IDs, source/location and evidence/source rebinding; all fourteen sources and nineteen requirements; seven process categories and seven gases | Pass |
| Held-only profile classification | M79 profile/method/engine/factor/GWP/source identities independently compared; held current profiles; unsupported substitutions; named unknowns and composed missing facts | Pass |
| Canonical, immutable, bounded output | Independent fixture SHA-256; reordered records/keys/registry; immutable fixture/registry; detached output; fixed incomplete status and zero released-supported rows | Pass |

Static inspection found no M80 mount/export in the existing package index, workspace adapter or staging server. Changed implementation files perform no database, HTTP or calculation operation. First-review evidence: `operations/agent-improvement/snapshots/M80-FOUNDATION-CONTRACT-QA-20260924-FIRST-REVIEW.json` (`9a1aee83d5be5664a319262751ff1575d62718ed7125a9282b9686f7a42e8d58`).

## Limits and next owner

A caller can construct the trusted-context argument; these tests establish its shape and company/fixture binding only. Authentication, authorization and operator-owned provenance require the future server/database adapter. No runtime tenant-security claim follows from the offline tests.

Persistence, immutable database history, concurrent writes, migrations, actual API/browser behavior, hosted recovery and two-tenant rehearsal remain unrun. M79 retained identity comparison is not a fresh primary-source or domain/rights approval. No number, source release, complete customer inventory, SB 253 determination, professional assurance or invitation readiness is accepted. Calendar 2025 and operational control remain proposed synthetic values.

Root owns review of this QA deliverable, integration, shared operational records and publication. The implementation is acceptable for this bounded offline increment; downstream integration needs its separately specified review gates. No Git, provider, customer-data, deployment, migration, M78 replay, paid-call or model-default action was performed by this reviewer.
