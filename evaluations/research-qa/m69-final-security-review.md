# M69 final-candidate security review — rejected candidate preserved

Date: 2026-09-15 UTC. Reviewer `/root/m69_security`, independent security/reliability QA; requested Astra/high, actual settings unobserved. No implementation authorship, paid request, credential access or account mutation. This is a new review of the submitted frozen candidate, separate from the earlier first-review report.

## Exact verdict: FAIL — closure integrity; account gate separately blocked

The submitted candidate and executable match the assignment:

- Candidate SHA-256: `4d691a46e74a6f7e88d920fb5ef77d59b8d64c36f53c1101c05e0c2fcb5cf280`.
- Compiled executable SHA-256: `c2ea124b7bbc93fb4d06168a0965b4d0de3ad5dceeba7a137d043858f51c0488`.
- Original compiled rehearsal: `.superpowers/m69-rehearsal-final`; qualified, analyze/plan/verify, three synthetic transport invocations, zero paid requests, $0.003 fixture cost. This is mechanical runtime evidence, not a live answer-quality result.

`validateClosure` accepts materially inconsistent durable records. The new independent test file `evaluations/research-qa/m69-final-security.test.ts` copied only the public/synthetic rehearsal into disposable test directories and exercised these changes:

| Finding | Rebound mutation | Observed result | Required control |
| --- | --- | --- | --- |
| M69-FINAL-SEC-01, high | Set execution mode to live but retain zero provider requests despite three dispatches | Accepted | Exact execution-mode schema and mode-dependent provider count; fixture evidence must never become paid-run evidence |
| M69-FINAL-SEC-02, high | Set first settled cost to zero and update receipt/aggregate totals while native stage metadata still reports 1,000,000 nano-USD | Accepted | Cross-check native stage cost and allowed cost source against settlement and totals |
| M69-FINAL-SEC-03, high | Change first completed event from analyze to verify and rehash the event | Accepted | Validate event contents, exact stage/attempt/phase pairs, request binding, legal sequence, and failure/success semantics |
| M69-FINAL-SEC-04, high | Set controlled exit false while retaining successful answer eligibility | Accepted | Keep incomplete shutdown inspectable as failure, but deny successful acceptance/grading |

Initial new test result: **1 pass, 4 failures, 5 assertions**. The unchanged compiled rehearsal passes its own validator; all four negative controls fail to reject. These are substantive repetitions of the earlier requirement to validate the composed lifecycle (L06), not a request for more superficial hashes.

Static inspection also finds that the validator does not reconcile uncertain records, extra attempt records, allowed settlement cost sources, provider/model/plugin semantics in captured requests, or strict boolean schemas. Repair the complete contract together. A fully coordinated rewrite of every artifact is outside ordinary corruption detection; independent review and trusted frozen bytes remain necessary. But contradictory surviving evidence must not be silently accepted.

## Actual compiled refusal checks

The exact compiled executable was invoked with (1) invalid/missing authority, (2) a different root, and (3) a replayed rehearsal output directory. All three exited 1 with empty stdout and `m69_launch_refused`; no live-run directory was created and no credential was supplied. This focused test passed **11 assertions**. It does not establish correct fresh paid admission, a valid-account path, copied-executable refusal, crash recovery, or successful process termination after an uncooperative native transport.

## Evidence and authority assessment

The fixed executable/root paths, one-use directory, bound board record, credential digest comparison, exact endpoint/model/price fields and account privacy/settings checks improve admission under the stated trusted-operator boundary. A hash and `pass` field are not evidence that an external observation occurred. Final authorization still needs an actual fresh independent review of repaired bytes.

`operations/m69-preflight/account-evidence.json` correctly records **blocked**, unknown balance/settings and no credential access because the browser session is signed out. It must remain blocked until a fresh authorized observation resolves these fields. The launcher should refuse this record. This is a separate dependency from the code defects; neither can substitute for the other.

The source record preserves the exact internal EPA-only scope and deadline; no public/commercial release is approved. The endpoint record accurately labels public model metadata as distinct from account balance and live compatibility. Its five-minute freshness gate means it must be re-observed/reissued truthfully at actual admission; its current timestamp does not remain fresh indefinitely. The board decision records the new five-stage, no-retry/carry, $3.946085 scope and excludes M50 authority reuse. This reviewer does not issue or infer new paid authorization.

The product fixture's selected answer units include factor-date companions U10/U17/U20/U21 for the period-documentation part. The supplied test checks IDs and citations, not independent semantic proportionality. Product QA must decide whether those extra factor passages answer the actual activity-period question; this security review does not turn fixture-programmed `pass` flags into a factual grade.

## Next action

Root/CTO owns the validator repair, new frozen candidate/executable, and replacement compiled rehearsal. Return the new hashes for targeted independent re-review. Preserve this rejected candidate's findings and first result. Account readiness remains blocked, and **no paid run may be described as accepted or executed** on this evidence.
