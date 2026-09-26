# Hosted setup write-gate path and input independent review 2

Date: 2026-09-26. Task: HOSTED-SETUP-GATE-PATH-QA-02. Independent reviewer: `/root/source_lock_holistic_qa`, QA/security, CEO sponsor. Reviewer did not author the repair. Requested critical gpt-6-astra/high; observed model/effort/cost unknown. Scope: exact gate source/test, narrow evidence-pin repair and relevant path/capture regressions. Previous FAIL remains unchanged.

## Verdict

**PASS, bounded repaired path/input component.** GATE-PATH-F01 [P1] is resolved on these exact bytes. Both evidence fields must now be primitive strings before regex validation. Arrays, boxed strings and coercible objects cannot survive the input snapshot into journal creation or gate operations. No new material defect found in this narrow repair.

## Evidence map

Reviewer-written stdin probe imported the actual gate module and transpiled only the fixture declarations preceding the first test in its frozen test file. No permanent probe source was added.

| Boundary | Independent result |
| --- | --- |
| Original F01 array mutation | For each evidence field, supplied a one-element digest array, invoked acquisition, then changed the array element. Refused with HS_GATE_EVIDENCE_PINS_REQUIRED before openJournal or provider/mutation calls; no held receipt. The formerly pending journal callback is never entered. |
| Other coercible/malformed inputs | Both fields separately tested with arrays, boxed String, an object whose toString returns a digest, undefined, null and numeric 1: twelve cases all rejected. The custom toString was never invoked. |
| Primitive snapshot | Six stateful input getters each read exactly once. While openJournal waited, replaced every original input property and all dependency methods. Original operator, both digests, journal/receipt paths and methods retained; four expected journal events and scale/limit/terminate/login-probe actions observed. |
| Module boundary | Relative journal/receipt paths refused. Direct paths inside the module repository refused. Changing process cwd to an outside temp directory did not change that boundary. |
| Real parent | An outside temporary junction pointing into the repository was refused by both default filesystem writers with PRIVATE_PATH_PARENT_REQUIRED. No target file was written. |
| Valid private files and no overwrite | Outside journal append and receipt write succeeded. Second exclusive creation of either existing path refused with EEXIST. |

Probe result: **40 checks passed**, comprising 24 malformed-input/no-I/O assertions, 5 primitive snapshot assertions and 11 filesystem assertions. Stdout: `{"probe":"gate-path-QA2","checks":40,"status":"PASS","malformedCases":12,"propertyReads":{"profile":1,"operatorId":1,"journalPath":1,"stopReceiptPath":1,"writerInventorySha256":1,"gateCapabilitySha256":1}}`.

The actual filesystem probe created a unique directory under OS temp, verified its absolute containment, created a junction into the worktree for rejection testing, unlinked that junction, and removed only the verified temporary directory. Synthetic operations were in-memory; no hosted/provider/database calls occurred.

## Focused checks

```text
bun test tools/staging/hosted-setup-write-gate.test.ts
9 pass, 0 fail, 51 expect() calls; Bun 1.3.12

bun x tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --types bun --strict --skipLibCheck tools/staging/hosted-setup-write-gate.ts tools/staging/hosted-setup-write-gate.test.ts
exit 0; no diagnostics
```

The added author regression covers both array-valued evidence fields and asserts refusal before journal creation/actions. Independent coverage extends it to other coercible values and repeats the original mutation attempt.

## Exact reviewed bytes

Initial and final hashes matched.

| File | SHA-256 |
| --- | --- |
| tools/staging/hosted-setup-write-gate.ts | 6f5ee2acb97774c31099360d560750b952510efc09be376fe12ce368461d829f |
| tools/staging/hosted-setup-write-gate.test.ts | 01b6bca7093254729f3bee696c3f48f61e0bf4578d06ac6e304f91bfd5474ea9 |
| Prior FAIL report, hosted-setup-01-write-gate-path-independent-review.md | 75933809d225b791862529179bbff113df84c64b6812cc5409217f60e139aa74 |

## Limits and next owner

The previous report's trust limits remain: realpath-then-open is not atomic against hostile parent-junction replacement; use trusted/stable output directories. Injected writers own their storage behavior. Receipt-parent failure can occur after gate mutations and correctly yields uncertainty rather than success. Function capture does not authenticate client output or freeze client internal state. Existing broader held-observation/provider-admin claims and the proposed transactional migration redesign are outside this narrow acceptance. No current hosted authority or live gate/migration approval follows from this PASS.

Next owner: root/CTO to accept these exact bytes, preserve the historical FAIL and refresh affected source/release closure. Only this assigned report was written permanently; no code, shared notes/status, Git, hosted/provider/external DB or ENV mutation occurred. Bounded managed-worktree permission escalation was used for local tests/report writing.
