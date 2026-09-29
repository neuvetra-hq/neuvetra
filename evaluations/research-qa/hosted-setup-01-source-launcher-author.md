# HOSTED-SETUP-SOURCE-LAUNCHER-01 — author assessment and refusal candidate

2026-09-26. Security/reliability engineering under CTO/CEO; author `/root/shared_db_adapter`. Requested critical gpt-6-astra/high. Follow-up dispatch cannot override execution settings; observed model/effort, tokens and cost remain unknown. Role prompt SHA-256: `3b3c1d31d5e5e35bf90ad971d4511a7693b7f14d12f2eb7ac0ed4723cc0b79d3`.

## Disposition

**A trusted operational launcher is BLOCKED / NOT IMPLEMENTED.** The delivered module is deliberately a refusal-only boundary and diagnostic. It creates no runtime attestation, never authenticates a caller's flags, never imports the maintenance application, and never starts a database/provider operation. Direct invocation prints a blocked diagnostic and exits **78**. It is not evidence accepted by the existing source lock and is not a migration authorization.

The existing source-lock contract remains unchanged by this task. QA5 accepted private artifact/SQL handling only under a separately trusted authenticator. It explicitly excluded the external launcher, complete loaded graph and immutable-tree mechanism. This task does not turn that conditional component acceptance into an integration acceptance.

## Exact unresolved dependencies

1. **Pre-import loader evidence:** no separately reviewed mechanism available in this Windows/Bun 1.3.12 execution has demonstrated complete, authentic runtime-loader observation before application evaluation. The installed runtime reports `typeof Bun.ModuleGraph === 'undefined'`. That observation alone is not a proof that every possible instrumentation approach is impossible; it is a version-specific missing API observation. Newer online ModuleGraph documentation describes a different experimental lifecycle API and expressly disclaims a security sandbox. No runtime upgrade occurred.
2. **Contract compatibility:** the documented Bun plugin hooks customize resolution/loading; the accepted source-lock contract requires `dependencyResolution: 'runtime-loader-observed-v1'` AND empty preload/custom-loader lists. Implementing an observer as a preload/plugin and then recording an empty list would be false. A static import scanner or build graph cannot honestly be relabeled runtime-loader observation. No undocumented loader-internal inspection or debugger script listing has been established as a complete, pre-import enforcement mechanism here.
3. **Lifetime immutability:** no reviewed OS-supervised immutable source-tree lease is available to this launcher. A private copied directory, a file digest, `Object.freeze`, a file attribute or a clean Git observation does not hold all runtime code/dependency/configuration paths immutable for the worker lifetime. The concrete probe below defeats matching before/after file hashes. This is not a claim that an independently administered read-only filesystem or immutable image is impossible; that mechanism has not been supplied, implemented or reviewed in this task.
4. **Publication/provenance:** no authenticated final clean published commit/archive, complete dependency artifact and pinned runtime verifier is wired into this candidate. A caller-supplied head/hash is not authority. Git/publication operations are outside this assignment. The final source-lock/publication closure must include the accepted runner, maintenance client, launcher/supervisor, runtime executable and dependency/configuration bytes, plus the exact canonical migration manifest; no such closure or accepted attestation was fabricated.

Required next owner: CTO/coordinator must select and provide a reviewable trusted host/runtime mechanism for these proofs, then independently validate it before implementing an accepting launcher. A sealed bundle/image would require its own reviewed provenance, runtime/no-external-load policy and immutable execution boundary; it cannot silently satisfy the current `runtime-loader-observed-v1` contract just by renaming a build inventory. Keep the existing source lock fail-closed meanwhile.

## Concrete probes and observed results

All probe files are synthetic and created under fresh temporary directories. No product application module, database, provider, secret export or customer data was used. Child environments include only Windows SystemRoot; flags disable automatic ENV-file loading and package installation. Each child has a five-second supervisor deadline and exact-child kill/exit cleanup. No production security decision relies on the child observations; they are counterexamples.

### Computed import and reversible on-disk tamper

A Bun child hashes an original synthetic `payload.ts`, announces readiness, and waits. The parent changes that file before allowing `import(target)` to execute. After the child confirms loading, the parent restores the original bytes and permits the final disk hash.

Observed under Bun 1.3.12:

```json
{"before":"00fdac33b3d63cd7778146efa39a518cd5e94d479b8ab450b3a1b5871a0df24b","after":"00fdac33b3d63cd7778146efa39a518cd5e94d479b8ab450b3a1b5871a0df24b","loaded":"tampered"}
```

`Bun.Transpiler.scan` returned `imports: []` for that computed import. Both disk hashes match, while actually evaluated code differs. This demonstrates the limitation of this static scan and retrospective hashing, not a defect in the source-lock component's explicitly external trust contract. Evidence: `C:/Users/nimab/AppData/Local/Temp/source-launcher-probe-fq5yzM/observation.json`; source fixture and handshake files are retained beside it.

### Preload before entry and mutable self-report

A synthetic `bunfig.toml` preload sets a harmless marker and clears `process.execArgv` before the entry script. Observed entry output: `{"preloadExecuted":true,"execArgv":[]}`. Therefore empty child-reported argv does not prove that preloads did not run. A controlled configuration explicitly passed as `--config=<path>` omitted that fixture preload and observed `preloadExecuted:false`. This validates that one negative control only; it does not attest every loading mechanism or the runtime's integrity. Evidence: `C:/Users/nimab/AppData/Local/Temp/source-launcher-probe-0WpySP/observation.json` and adjacent source files.

### Fail-closed local entry

Forged archive/head hashes and `attestedBeforeApplicationImport`, `immutableRuntimeTree`, `moduleGraphComplete`, verifier and launcher callbacks never grant launch capability. The refusal function does not read request getters, invoke supplied code, import the worker or issue attestation bytes. These are refusal properties, not a successful trusted launch.

## Checks and preserved author failures

- `bun test tools/staging/hosted-setup-source-launcher.test.ts tools/staging/hosted-setup-source-lock.test.ts --timeout 30000`: **17 pass, 0 fail, 81 assertions**. Four new tests include supervised native Bun counterexamples; thirteen existing source-lock regressions remain green.
- Strict TypeScript on the two new files: **PASS**, no diagnostics.
- Direct `bun --no-env-file --no-install tools/staging/hosted-setup-source-launcher.ts`: expected diagnostic, **exit 78**.
- Earlier author probe harness attempts: **2 pass / 2 fail**, JSON parse EOF because the initial `--config` argument form did not execute the expected script; a separate empty-array config attempt also failed under this Bun version. The final harness uses observed working `--config=<path>` with a non-loading `logLevel` setting, explicit output assertions and child exit checks. No source-lock or product code was changed to make these probes pass. Earlier synthetic directories remain retained; these failed harness attempts are not first-pass success.
- No native PostgreSQL, actual protected filesystem mount, network loader, debugger instrumentation, code-signature authentication, archive attestation, live publication, migration or provider mutation was performed.

## Candidate bytes and ownership

| Artifact | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-source-launcher.ts` | `393ce99a418cc94d18319663ced82386ec28de689f2dff8a216bdf4f7c0dd366` |
| `tools/staging/hosted-setup-source-launcher.test.ts` | `b4ec96530bb4c3a309e343801891deb311ee86961acb9b9ec21c7443af24c2eb` |
| Read-only current `tools/staging/hosted-setup-source-lock.ts` | `b52b9f1d5347976b9bcb226917b40186e08a825dc2e4b78f1efe4a951053a20c` |

QA5's historical reviewed source-lock hash was `8201172e25271da9dd3625ece7976dc002639adfb11d9ec9a996e240a82f0a5c`. The later `hosted-setup-01-upgrade-input-independent-review3.md` explicitly accepts the bounded repaired runner and synchronous source-lock manifest interface at current hash `b52b9f1d5347976b9bcb226917b40186e08a825dc2e4b78f1efe4a951053a20c`; `hosted-setup-01-upgrade-reviewer-identity-independent-review.md` records that same hash and passing changed-dependency regressions. `operations/agent-improvement/runs/HOSTED-SETUP-SOURCE-LOCK-01.json` also binds the current hash. Thus the hash difference has later review provenance; it is not an unexplained or automatically unreviewed change. Those later reviews still explicitly exclude the missing trusted pre-import attestor and live integration. This author read these chronology records, did not modify the source lock, and grants no new verdict on it. The independently accepted shared database adapter, runner, source lock, package/lockfile, status and Git were not edited by this assignment. New writes are limited to the two new launcher files, this author report and synthetic temporary probe artifacts.

## Primary documentation

- [Bun plugin hooks](https://bun.sh/docs/runtime/plugins): resolution/loading customization; not an independent trust oracle.
- [Bun runtime configuration](https://bun.sh/docs/runtime/bunfig): preload and loader configuration mechanisms. Online documentation may describe newer Bun than installed 1.3.12; local probes above establish the stated observations.
- [Bun ModuleGraph](https://bun.sh/docs/runtime/module-graph): experimental lifecycle facility; documented as not a security sandbox. It is absent from this installed runtime and was not used.

Independent QA remains pending for this refusal/assessment candidate. No operational launcher acceptance or hosted readiness follows from passing refusal tests.