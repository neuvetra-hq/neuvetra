# M78 read-only revisit preparation

Candidate 1 was prepared on 2026-09-22 as source-only work. It did not access credentials, authentication, a host, a database, a provider, Git, or an official journal. It did not execute a recovery, restart, or revisit.

## Prepared boundary

- `m78-readonly-revisit.ts` is an inert public adapter around the unchanged `runM78Continuation4ReadonlyRecovery` runner and unchanged full recovery evaluator.
- Admission requires a separately pinned receipt whose status says that a real recovery was independently accepted, zero material findings remain, and the accepted journal, diagnostics, observation, current source gate, commit, deployment and image match. It then requires a separately pinned restart admission, one restart request, observed schema-21 startup, and independent restart review. Recovery closure must precede the request, and startup must follow the request.
- The runtime is fixed to commit `9dd9c85fb674528a2c1dd1b0138f5a2d87ba683e`, deployment `f6d77b2e-6886-429b-a4d2-4873c9199ce8`, and image `sha256:3e4c2c91591a5598a85f63b4099b1b4890588ce79ec832b21b7d284b5aa89d1b`.
- The unchanged runner sees only remapped journal, diagnostic and observation paths dedicated to the revisit. Reads or appends to any other logical path fail closed. The accepted recovery's journal, diagnostics, observation and lock are byte-checked before and after the run.
- A physical revisit lock must already exist. Lock creation and trusted external pinning remain the root-owned private wrapper's responsibility.
- A passing runner result is not sufficient. The new observation is decoded with the production Scope 1, corporate, gas, mobile, fleet, diesel, equipment, fugitive and full-report decoders. The unchanged full recovery evaluator must pass on the new journal, diagnostics, observation and current source gate. Only `scope1`, all seven `registers`, `downloads`, `m78bytes`, `fullReports`, and `legacy` are compared canonically with the accepted recovery observation; observation timestamps and run metadata are deliberately excluded.
- The adapter cannot authorize application writes, recipe replay, retries, a restart, or lifecycle acceptance. Its only possible success label is `m78_readonly_revisit_passed` after the inherited runner reports zero application POSTs and closed sessions.

## Offline validation

- Focused unit fixture: 5 passed, 0 failed, 28 assertions.
- Strict targeted TypeScript over the adapter and test: passed.
- Refusals cover wrong deployment, invalid recovery/restart chronology, changed runner evidence, missing revisit lock, inherited runner failure, changed retained downloads, an unsupported IO path, and an independent restart review with open findings.
- The structural positive uses production decoders on a baseline-shaped observation with no full retained report bodies. The full evaluator is injected in that unit test. This proves path remapping and the selected-state comparison, not the complete real artifact contract.

## Blocking dependency

The real read-only recovery attempted after this source preparation did not produce an accepted observation. Root reported that it failed offline-deterministically while reconstructing artifacts: fleet and equipment registers expose report metadata rather than complete `html`/`snapshotJson` report bodies, and their available proof/export shapes differ from assumptions in the currently accepted runner. The existing empty-full-report fixture did not exercise this condition.

Therefore this candidate is preserved as **blocked preparation**, not an accepted revisit implementation. The adapter's required real recovery receipt and restart evidence do not exist. The next recovery revision needs a real baseline artifact-positive fixture and independent acceptance before this revisit adapter can be reviewed against a complete post-37 observation. No current result authorizes another hosted recovery, restart, or revisit.

