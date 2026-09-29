# HOSTED-SETUP-ARTIFACT-SOURCE-QA-01

2026-09-26. Independent security/CTO review by `/root/upgrade_boundary_review`, sponsored by `/root`. Requested critical security route `gpt-6-astra/high`; observed model/effort, tokens and cost unknown. Role prompt SHA-256: `3b3c1d31d5e5e35bf90ad971d4511a7693b7f14d12f2eb7ac0ed4723cc0b79d3`. This context authored the preceding execution-boundary design recommendation, but did not author the component, tests or author report reviewed here. Lessons applied: L02 evidence lineage and L06 lifecycle/cross-record consistency.

## Verdict

**FAIL for the advertised artifact-source component contract: two reproducible P2 defects remain.** The frozen author suite and strict TypeScript pass. Private SQL pinning, the separately guarded single migration invocation and the explicit absence of launch authorization survived the independent probes. Neither finding demonstrated duplicate SQL execution, a hosted action, false live publication authentication or a loaded-module claim.

The two narrow repairs below are necessary before accepting this component's active-checkout exclusion and single-operation semantics. Preserve this first-review result. The larger operational launcher remains unimplemented regardless of these repairs.

## AS-QA-F01 — P2: binding getters can reenter the single-use source operation

At `tools/staging/hosted-setup-artifact-source.ts:162`, `withArtifactSource` checks `phase === 'ready'` and then calls `canonical(candidate)` before line 163 changes phase. `canonical` calls `Object.entries` on the caller's object, which invokes getters. A getter can synchronously invoke a second `withArtifactSource` while phase is still ready. The outer call does not check phase again after serialization. Both operation callbacks can consequently run and resolve successfully.

My independent probe used an authentic verified capability and the real exported lock. The binding's `profile` getter started an inner operation waiting on a promise. The outer operation invoked the pinned migration through an in-memory database stub and completed. The inner operation was then released and also completed, because the shared `entered` flag was already true from the outer operation.

Minimal mechanism:

```typescript
const candidate = {...lock.binding}
Object.defineProperty(candidate, 'profile', {
  enumerable: true,
  get() {
    inner = lock.withArtifactSource(lock.binding, async () => {
      callbacks++
      await releaseInner
      return 'inner'
    })
    return lock.binding.profile
  },
})
const outer = lock.withArtifactSource(candidate, async () => {
  callbacks++
  await lock.migrate(fakeDb, syntheticProject)
  return 'outer'
})
```

Observed: two callback entries, outer result `outer`, inner result `nested` in the retained full probe; one migration transaction in this reentrant attempt. The probe's printed cumulative migration counter is two because an earlier independent baseline test had already executed one migration on a different lock. This is **not** evidence of two migrations on one lock: `entered` still prevents that. It is a failure of the stated single-operation lifecycle and permits a second callback to report success without its own migration.

Repair: reserve the operation state before reading caller-controlled binding properties, or snapshot/strictly validate primitive binding fields and then atomically recheck/reserve state before invoking any operation. Handle snapshot failure consistently with the chosen consumption policy; do not reopen a lock that a nested operation already consumed. Check operation type before invoking it. Independently retest getter/proxy reentry, getter failure, ordinary mismatched binding, concurrent entry, inner failure and both late completions; exactly one operation callback may enter.

## AS-QA-F02 — P2: active-checkout exclusion ignores filesystem aliases in the policy

The verifier requires `activeCheckoutRoots` to contain absolute strings, but its overlap checks compare those strings lexically via `resolve`/`relative`. Only source/dependency artifact paths subsequently receive realpath/junction validation. An exclusion path may itself be a normal Windows junction alias for the artifact root, and the overlap check misses that identity.

Independent native Windows fixture:

- Real source root: `C:/Users/nimab/AppData/Local/Temp/artifact-independent-fixture-jbiRPJ/source`.
- Policy exclusion: sibling `actual-active-checkout-alias`, created as a directory junction targeting that exact source root.
- All ordinary published synthetic file hashes and pins remained valid.

Observed: `verifyHostedSetupArtifact` accepted the source root and returned `launchAuthorized: false`. The policy explicitly identified that same directory as active through its filesystem alias. This is ordinary alias resolution, not an adversarial time-of-check race. The component's separate refusal of aliases in `paths.sourceRoot` and within dependency/source inventories works; it does not cover aliases supplied on the exclusion side.

Repair: resolve and validate every exclusion root before comparing canonical root identities and containment. Either canonicalize policy aliases or explicitly refuse them; fail closed if an exclusion root is unavailable or cannot be verified. Compare both ancestor directions using resolved roots. Test an alias for the exact source root, an alias for its ancestor, a dependency-root alias, and a genuinely unrelated active root. This does not require hostile-host filesystem immutability or a runtime module graph.

## Verified component behavior

- The externally supplied receipt digest is checked against private receipt bytes. Wrong bytes, duplicate checks, wrong PR/repository, wrong exact check head, future/expired or excessive observation windows, open findings and mismatched reviewer identity refuse. Authentication of the external pin itself remains a trusted operator input.
- Archive/runtime/supervisor/config byte changes refuse; even a coordinated config hash change cannot permit a preload config because exact config bytes are checked. Source/dependency inventories reject missing/extra or changed files. Root and nested directory junctions refuse. Independently tested traversal, absolute paths, null character, trailing space, drive/stream colon, Windows reserved name, backslash and case alias all refuse.
- Paths and policy are synchronously copied before awaiting filesystem operations. My post-invocation mutation of operator identity and source root did not change the accepted pending request. This does not make arbitrary caller getters harmless at other APIs, as F01 demonstrates.
- The inspection object is frozen, carries `launchAuthorized: false`, contains the narrow at-rest/private-SQL claim and lacks the former closure/complete-module-graph fields. A JSON copy or ordinary copy cannot mint the WeakMap capability. Simultaneous lock construction from the same real capability permits exactly one claim.
- The private manifest keeps its original SQL after modifying a returned manifest copy and the backing migration file. The in-memory adapter observed exactly the original migration-23 SQL once. Invalid raw/normalized/manifest pins refuse. Normal repeated source entry and repeated `migrate` calls refuse. F01 narrows acceptance of the operation wrapper without invalidating those tested SQL protections.
- `launchAuthorized: false` is an explicit claim limit, not a universal prohibition on calling the worker-side `migrate` API with a supplied database. That API intentionally remains callable inside its source operation. No exported operational supervisor, real credential acquisition, worker file or automatic launch follows from verification. Integrators must not treat the inspection alone as publication or execution authority.

## Checks actually run

1. Frozen focused suite on Bun 1.3.12: **10 passed, 0 failed, 57 assertions**. The initial restricted invocation failed with filesystem `EPERM` before the suite could load; the authorized execution with the filesystem restriction removed passed. That initial environment failure is preserved here and is not a candidate failure.
2. Installed strict TypeScript on the two candidate files: **PASS**, exit 0 with no diagnostics. No dependency installation was performed.
3. Separate reviewer-written probe: **26 explicit negative/control assertions passed**, plus the independently reproduced F01. Probe source retained at `C:/Users/nimab/AppData/Local/Temp/hosted-artifact-independent-141e500baf4a462193ffa3270bd63d00/independent.ts`; fixture root `C:/Users/nimab/AppData/Local/Temp/artifact-independent-fixture-jbiRPJ/`.
4. Separate Windows exclusion-alias probe reproduced F02. Source retained beside the first probe as `alias.ts`; its temporary alias was unlinked after observation. Only synthetic temporary paths were involved.
5. The suite's actual controlled Bun child probe passed again: positive ambient preload control executed its harmless marker; the controlled child had no marker or inherited environment sentinels and exited 0. The nonsettling child was killed and recorded `uncertain_do_not_retry` with exit 143, not rollback. This run's observation is `C:/Users/nimab/AppData/Local/Temp/hosted-artifact-launch-probe-nHP91G/observation.json`. This is a rerun of the author's launch-input experiment, not an independently implemented operational supervisor. All children from the suite exited; the independent probes spawned none.

No PostgreSQL instance, actual `pg` connection, provider, ENV export, credential, Git operation or candidate edit was used. The in-memory SQL stub is not database preservation evidence.

## Exact reviewed bytes

Hashes matched the assigned pins before testing and were unchanged at report preparation.

| Artifact | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-artifact-source.ts` | `0821c9f1a5fc4d03f0ae2a257a1fde614a4d1be6c57c3400374d0dde8e94f8c7` |
| `tools/staging/hosted-setup-artifact-source.test.ts` | `b711e47e0d1929e2bc6b7214b3bdf096bdef7c8633bf8403fd866b4660d42fa7` |
| `evaluations/research-qa/hosted-setup-01-artifact-launch-author.md` | `076005d4791bc0d75409e51ac6f284f5400d8e82ced7e2331bc24c234a5b4a69` |

## Operational exclusions and next action

Even a repaired component PASS would not establish any of the following:

- Independently authenticated current PR #6 publication/checks or trusted receipt-pin delivery.
- Materialization of the source/dependency trees from the pinned archives. This component hashes archives and separately checks the receipt-pinned trees; it does not parse/extract archives or prove their relationship.
- A working dependency layout or complete resolution of the dedicated adapter's `createRequire(...package.json)('pg')`. The presence of a pinned `node_modules/pg/package.json` is not proof of executable dependency resolution.
- Authentication of currently loaded application JavaScript. `lockHostedSetupArtifactSql` dynamically imports migration code relative to the verifier module's current location, which in these tests is the development checkout. The final supervisor must actually start the packaged worker from the accepted private artifact.
- A fresh supervised worker enforcing one dedicated adapter/transaction, durable external journal, private credential channel, bounded shutdown, exact target/TLS, or a distinct reconciliation process.
- Versioned integration with the existing transactional runner, source/publication/stop bindings, sequence fence, preservation comparison and uncertain-COMMIT handling. The new binding is deliberately incompatible with the old complete-closure contract; no silent field reinterpretation is acceptable.

Return F01/F02 to the sole component author for narrow repair, then independently review changed exact bytes and these reproductions. Continue independent integration work within its separate ownership; do not promote this offline verifier or its controlled-input test harness into a live launcher by status wording. Only this new repository report was written by the reviewer; all implementation, ledger and earlier reviews remain untouched.