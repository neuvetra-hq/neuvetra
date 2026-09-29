# HOSTED-SETUP-MAINTENANCE-STOP-QA3 — independent Repair2 review

Date: 2026-09-26. Reviewer: `/root/txn_runner`, independent QA/security for this component under CEO sponsor. This execution context did not author the maintenance-stop source, tests or Repair2 handoff. It previously authored the separate transactional runner, which is outside this candidate. Requested critical registry route: `gpt-6-astra` / `high`; observed model, effort, token use and cost unavailable. Only this report was written. No provider, network, database, ENV, Git or shared operations action occurred.

## Verdict

**FAIL, bounded to one new P2 evidence-chronology defect.** Repair2 closes both residual QA2 findings and preserves the earlier fixes for MS-F01 through MS-F03. Observation evidence is primitive serialized before the asynchronous handoff; the returned/journaled receipt remains immutable and truthful under writer mutation; dependency and journal method getters are captured once. The helper continues to represent a one-service availability stop and explicitly reports `databaseWritersExcluded: false`.

However, runtime validation checks each clock value only in isolation. A successful run accepts canonical UTC timestamps in strictly decreasing order. The returned receipt can therefore claim the zero-replica observation occurred before the reservation and pre-stop evidence even though the code executed those phases in the opposite order. This is an internal evidence contradiction, not merely lack of external clock authentication.

## Exact reviewed bytes

| Artifact | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-maintenance-stop.ts` | `0299c56c8ebc127731ca6138a7c8531ee5c51cf02e99603b55e7e467d6c19e46` |
| `tools/staging/hosted-setup-maintenance-stop.test.ts` | `b5ef34ca7a77855511871266b92b415513db71961d01d853c22ed892deb80add` |
| `evaluations/research-qa/hosted-setup-01-maintenance-stop-repair2-author.md` | `1a0ee216ae6d4224e0b6b5261b271c210032a24428764a4f7b9592ede7f35980` |
| Prior QA1 report | `3881f5d81e8a189495c365a45d7f237e239d81232358b14f9a1b8d874f43803e` |
| Prior QA2 report | `cd61479e3350c6e291b8645a8699a251d399375ad7489d7b5413ece08417aec9` |

Hashes were checked before and after all tests and probes and remained unchanged.

## MS-F04 — P2: canonical clock values can reverse evidence chronology

Source line 129 validates that every `now()` result is a primitive canonical UTC ISO timestamp. Lines 132, 135, 146 and 149 then consume four independent values without comparing them. The following in-memory probe supplied valid timestamps in reverse order:

```ts
const times = [
  '2026-09-26T12:00:04.000Z', // reservation
  '2026-09-26T12:00:03.000Z', // prior deployment observed
  '2026-09-26T12:00:02.000Z', // returned receipt observedUtc
  '2026-09-26T12:00:01.000Z', // receipt-written journal event
]
deps.now = () => times.shift()!
```

All provider observations and the scale callback were otherwise valid. Observed result:

```json
{
  "scale": 1,
  "observedUtc": "2026-09-26T12:00:02.000Z",
  "eventTimes": [
    "2026-09-26T12:00:04.000Z",
    "2026-09-26T12:00:03.000Z",
    "2026-09-26T12:00:01.000Z"
  ]
}
```

The helper returned `hosted_setup_maintenance_stop_observed`. The receipt says it was observed two seconds before the reservation, and the final durable event predates all earlier evidence. This does not cause a second scale or claim database-writer exclusion, so P2 is proportionate. It does undermine the chronological evidence needed to review a one-time maintenance action.

Repair: retain the parsed milliseconds for the last accepted timestamp and require each later timestamp to be greater than or equal to it. Refuse a backward value before scale when encountered in pre-stop evidence, and report the existing uncertain/no-retry outcome when encountered after mutation begins. Add reverse, equal and increasing timestamp tests. This consistency check does not authenticate the clock; the concrete launcher still owns clock trust and host-time integrity.

## Closed prior findings and adversarial checks

### MS-F01 closed — serialized observation isolation

An independent probe serialized a wrong deployment, returned that immutable string, then changed the producer's source object to the expected deployment in a microtask. Repair2 refused with `HS_MAINTENANCE_REFUSED_BEFORE_MUTATION`, made zero scale calls and journaled reservation plus pre-mutation refusal. The author regression for malformed/boxed/oversized observation forms remains applicable. Authentic provider truth remains the concrete transport's responsibility.

### MS-F02 and MS-F02-R closed — receipt and clock scalar ownership

The receipt is frozen and contains only validated primitives. An independent receipt writer attempted to change `databaseWritersExcluded` and `operatorId`; the returned receipt retained `false` and the original operator, remained frozen, and its hash matched the final journal digest. Author tests reject undefined, object, invalid-date and noncanonical clock values before scale.

### MS-F03 and MS-F03-R closed — method capture

An independent accessor probe counted reads of `observe`, `scaleToZero`, `openJournal`, `writeReceipt`, `now`, journal `append` and journal `close`. Every getter was read exactly once. Replacing the journal's ordinary `append` property during its first call still produced all three expected events because Repair2 retained the original bound method.

### Journal, receipt, path and no-replay

The focused default-filesystem test produced the expected receipt and three-event journal, then refused the same journal path before a second scale. Prior independent path probes remain preserved: relative/repository paths, an external junction into the worktree and identical journal/receipt paths refused; default files use exclusive creation and per-event sync. Source inspection confirms a failure after `scaleToZero` begins remains `HS_MAINTENANCE_OUTCOME_UNCERTAIN_DO_NOT_RETRY`, with no automatic restart or retry.

These controls are bound to one journal path. Selecting or deleting a different path is outside this component's replay boundary. Receipt-path occupation can still be discovered after scale and therefore remains an uncertain operator-recovery case. Real-parent validation assumes a stable trusted parent directory between check and open; crash/power-loss durability and directory-entry fsync were not fault injected.

## Checks performed

1. Focused author suite: **8 passed, 0 failed, 52 expectations** on Bun 1.3.12.
2. Focused strict TypeScript: **PASS**, no diagnostics.
3. Independent getter/clock probe: dependency and journal getter counts all exactly one; one scale; decreasing canonical chronology reproduced as MS-F04.
4. Independent original-F01 probe: wrong serialized deployment plus later producer mutation refused before scale; zero scale calls.
5. Independent original-F02/F03 probe: writer mutation and post-first-append method replacement did not affect receipt or journal; one scale, three events, frozen receipt, truthful `databaseWritersExcluded: false`, matching digest.
6. Source and test hashes were unchanged after all probes.

## One-service availability scope

The helper pins one exact Railway project/environment/service/region/deployment/commit and scales only that service target. Its receipt is explicit that this is availability evidence and that database writers are not excluded. This is a truthful component boundary.

QA2's repository mapping was rechecked by hash: `Dockerfile.staging` `4d765902a5a2f9d8edf825c85cd646fbd2c5ad97a871020965ad9cf26af71830`, `apps/site-api/CLAUDE.md` `ffe04c75f5f9131cc07f7caf98479e261d198a8fd01c17e1d033d54c515d2cbf`, and `apps/site-api/src/staging/server.ts` `c7e2c0701c2e8398b907a907200edb12eaac70890aaded6dcfde567985ca53b0`. They retain the reviewed design in which Site-Web packages the corporate web and workspace API while the separately named Site-API is historical chat. This is repository architecture, not a current live deployment observation. Before live maintenance, authenticate that the pinned Site-Web deployment actually runs that combined image and that no additional corporate runtime is in scope.

The provider action remains non-CAS: deployment/configuration can race between readback and scale. Four observations do not create a lease or continuous stop. `inventoryComplete` and configuration-version semantics require a separately reviewed authenticated transport. Database preservation remains the transactional runner's table and sequence locks, not this availability helper.

## Next owner

Root author should repair MS-F04 with monotonic chronology enforcement and return new frozen source/test hashes. Independent QA should then rerun the clock regression plus the closed mutation/getter cases. This report grants no live stop, migration, restart, deployment or release authority.
