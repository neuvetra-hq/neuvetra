# Hosted setup write-gate path and input independent review

Date: 2026-09-26. Task: HOSTED-SETUP-GATE-PATH-QA-01. Reviewer: `/root/source_lock_holistic_qa`, independent QA/security under CEO sponsor. Reviewer did not author these changes. Requested critical gpt-6-astra/high; observed model/effort/cost unknown. Prior component PASS reports remain historical against their recorded bytes.

## Verdict

**FAIL for the combined path/input-capture change.** The module-anchored absolute/real-parent path guard passes the bounded local challenges. The changed input snapshot is incomplete for malformed evidence pins: arrays pass coercive digest validation and remain mutable after the shallow freeze. This is a concrete input-binding defect, not a live provider finding.

## GATE-PATH-F01 [P1] Mutable non-string evidence survives capture and becomes an affirmative receipt

Source line 97 uses DIGEST.test without checking primitive string type. RegExp.test coerces a one-element array to its element string, so both evidence fields accept arrays. Lines 147-149 freeze only the enclosing input object. The array remains shared with its caller across asynchronous journal creation.

Independent synthetic reproduction imported the actual source and reused only the frozen test fixture declarations (transpiled before the first test with Bun.Transpiler). Journal and receipt implementations were in-memory. Core reproducer:

```typescript
const f = fixture(), i = input('C:/private')
const pin = ['a'.repeat(64)]
i.writerInventorySha256 = pin as any
let release!: () => void
f.ops.openJournal = async () => {
  await new Promise<void>(resolve => { release = resolve })
  return { append: async () => {}, close: async () => {} }
}
f.ops.writeReceipt = async (_path, receipt) => {
  console.log(JSON.stringify(receipt.writerInventorySha256))
}
const running = acquireHostedSetupWriteGate(i, f.ops)
pin[0] = 'c'.repeat(64)
release()
const receipt = await running
```

Observed: status application-writer-gate-held; actions scale, limit, terminate, login-probe; emitted/returned writerInventorySha256 was `["cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"]`, rather than the invocation-time primitive digest. A separate gateCapabilitySha256 one-element array also produced success.

Required repair: require typeof value === 'string' for both pins before regex validation and before any await or journal/provider operation; reject boxed strings, arrays and coercible objects. Keep the single-read snapshot. Add both malformed-field regressions, including mutation while openJournal waits; assert no journal/provider/mutation calls for malformed evidence. Do not coerce untrusted objects into accepted digests.

## Passing evidence

- Existing focused suite: **8 passed, 0 failed, 45 assertions**, Bun 1.3.12.
- Strict TypeScript for exact gate source/test passed, no diagnostics. Runtime malformed inputs are outside TypeScript's protection.
- Independent filesystem probe: **11 checks passed**, using a disposable directory beneath OS temp and a junction into the managed repository. Both journal and receipt helpers rejected relative paths, direct repository paths and outside lexical paths whose real parent resolved into the repository. Changing process cwd did not change the repository boundary. Actual outside journal append and receipt writes succeeded, and exclusive second opens refused. The junction was unlinked before removing the verified temp directory; no repository target was written or removed.
- Independent primitive snapshot probe: each of all six input properties was read exactly once through a stateful getter. While journal creation waited, all original input properties and all dependency methods were replaced. Original operator/pins/receipt path, original methods, expected four events and expected action sequence were retained. Stdout: primitive-getter-method-capture PASS, each property read count 1.

Commands:

```text
bun test tools/staging/hosted-setup-write-gate.test.ts
bun x tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --types bun --strict --skipLibCheck tools/staging/hosted-setup-write-gate.ts tools/staging/hosted-setup-write-gate.test.ts
```

## Path and trust limits

The guard checks a module-derived repository root, then its real path and the output parent's real path. These checks correctly reject the tested static junction alias. They are not an atomic protection against a hostile process replacing a parent junction between realpath and open: the final open still uses the original path. This review does not claim resistance to that filesystem actor. Output parents must remain trusted/stable, or a stronger directory-handle strategy must receive separate review.

Real-parent checks reside in the default filesystem writers; injected openJournal/writeReceipt implementations own their storage boundary. The receipt parent is checked when writing the receipt, after gate mutations. An unusable or changed receipt parent therefore yields uncertainty and reconciliation, not rollback or success; an early path preflight could improve failure timing but cannot alone eliminate the race. Lexically different aliases may still collide physically; exclusive creation fails closed.

Captured function references do not freeze a trusted client's internal state, bind arbitrary prototype methods or authenticate its outputs. The exported held-observation helper and mutable asynchronous observation outputs were not newly repaired or exhaustively re-reviewed by this narrow assignment. Existing provider/admin exclusion wording and the proposed transactional migration design remain separate issues; this report grants no live gate/migration authority.

## Exact bytes and handoff

Initial and final source/test hashes matched:

| File | SHA-256 |
| --- | --- |
| tools/staging/hosted-setup-write-gate.ts | 1a6b9d077a41ea092734780012d636514eb3d33b553e24f10cb0b0dbc3a0999e |
| tools/staging/hosted-setup-write-gate.test.ts | d0d375110f46ba70a81877adab2059c685f39361e60785e4b074376f813f77eb |

Only this assigned report was written permanently. Local test fixtures were temporary and removed. No candidate/code, shared operations/notes, Git, hosted/provider/external DB or ENV changes occurred. Execution/report writing used bounded managed-worktree permission escalation.

Next owner: root author to repair F01 and return exact changed bytes for independent re-review. Preserve this FAIL and earlier PASS reports. Path-component checks do not convert the combined input-capture verdict to PASS.
