**FAIL for proving executable-source identity. Conditional PASS by inspection for the pinned-SQL, single-use component. No hosted-upgrade approval.** I did not author these artifacts or modify files.

- **High — hashed source can differ from loaded code.** In [source-lock.ts:126](/C:/Users/nimab/.codex/worktrees/inventory-plan-delivery/Neuvetra/tools/staging/hosted-setup-source-lock.ts:126), the lock reads cwd-relative files, but migration execution uses the function imported earlier at lines 12–15. Concrete reproducer sequence: load an altered migration helper, restore its approved on-disk bytes, then acquire the lock. Hash checks see approved bytes; line 157 still calls the previously loaded implementation. Importing from checkout A while cwd points to approved checkout B creates the same gap. These are code-path findings; I did not execute those mutation scenarios.
- **Closure/path enforcement is incomplete.** Lines 63–101 check lexical paths without realpath/symlink validation and use a regex rather than runtime resolution. A read-only reproduction confirmed it misses `import /* comment */ './helper'`, `require('./helper')`, computed imports and bare dependencies. Changing an already pinned source file still changes its hash; these omissions matter when accepting a new closure. Additional resolver/preload files are neither enumerated nor rejected. No symlinks or junctions were observed within the inspected tree.

The SQL-specific boundary is sound under trusted runtime and adapter prerequisites: it copies, validates and freezes all 23 entries before awaiting, then executes retained strings without file rereads. State changes synchronously prevent a second migration entry. This establishes **at-most-once invocation**, not guaranteed successful execution.

I independently reproduced the **95-file / 23-migration** inventory and normalized manifest hash:

`ec11c9b39bb706f64c970745d0d122ec5fb76b480ea0cd2362d685c8b2620452`

Git identity and review acceptance are **external integration dependencies**: the component compares caller-supplied head observations; the runner relies on supplied publication/review verifiers. Conditional component acceptance requires a verified runtime loaded from the approved immutable tree, controlled resolution/preloads, trusted database adapter, and all three coupled lock methods wired into the runner. Restore, publication, continuous write gate, journal and reconciliation gates remain required.

All five SHA-256 values matched on initial and final reads:

| Artifact | SHA-256 |
|---|---|
| `hosted-setup-source-lock.ts` | `18d6535a50d4049a4d1e9b1e90b965fdfdc00e91762d97499b99916485787592` |
| `hosted-setup-source-lock.test.ts` | `8db78442534d4805ab3a334981ce106cbb23ee1dfea15a7a67a8d81eccf521ee` |
| `staging-migrations.ts` | `d575922e6465a5324d8ded85f9f197a692deb53e2f988abb549eb2c0727bf7cc` |
| Author handoff | `14d80951aecfefbbd44f720d3b4160845888c7732407b46dd91fbe1e248159f0` |
| `hosted-setup-upgrade.ts` | `2eb3445b725a7c6547486ccac8ed1e6e1b52730b26ebe13fa99dcf1d5a6e9e2c` |

**Unrun:** Bun tests/typechecks, runtime bypass demonstrations, database/hosted checks and remote publication/review verification. The reported **11 passes / 118 assertions** are root-provided evidence, not my rerun.