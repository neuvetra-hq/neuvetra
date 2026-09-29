# HOSTED-SETUP-ROLE-QA-01 — independent candidate1 review

Date:2026-09-26. **FAIL: ROLE-F01 remains open.** Independent Head of QA context `/root/hosted_qa`, requested gpt-6-astra/high; observed inherited model/effort and cost unknown. Reviewer authored only the independent probe, result and this report; no product/provider/Git/shared-ledger edits or actual archive read occurred.

## Frozen reviewed bytes

| File | SHA256 |
| --- | --- |
| tools/staging/hosted-setup-local-roles.ts | dbf498ddaecfa95cdbd7d0dad4974814c324cc3843cc46b487acc1ad4f5b8976 |
| tools/staging/hosted-setup-local-roles.test.ts | 6b507e1a6771390032d159cceb75c202676cafaba23d2e5c425bac8824ae70b9 |
| evaluations/research-qa/hosted-setup-01-local-role-bootstrap-author.md | a62b1167b798ae73df4c1f2b314627659572dafdbe5eaa1306a1021e9a915d1f |

All three hashes matched before and after the independent execution.

## ROLE-F01 [P1]: ambiguous start failure leaves a live trust-auth cluster

At `hosted-setup-local-roles.ts:190`, `started=true` is assigned only after `clusterControl(...start)` returns success. If PostgreSQL starts but its launcher reports failure, such as a readiness timeout, the catch at lines212–215 skips shutdown because `started` is still false. No result receipt exists, so the exported stop path—which requires that successful result—cannot reconcile this failure itself. A failed bootstrap can therefore leave its privileged local server running and block the required subsequent rehearsal/cleanup boundary.

Reproduction used the real pinned PostgreSQL17.11 binaries and a fresh uniquely named synthetic cluster under the private recovery root. The independent probe wrapped only `Bun.spawn`'s returned start-process completion: it allowed the actual pinned pg_ctl to finish successful startup, then reported exit1 to model ambiguous launcher completion. All other subprocess behavior and product code were unchanged. Bootstrap rejected `HS_RECOVERY_CLUSTER_CONTROL_FAILED`; the attempt journal existed, the success result did not, and a fresh TCP connection confirmed port55479 still accepted connections. This was a deliberate failure injection, not an observed natural pg_ctl timeout.

The probe then restored the original spawn function, stopped only its own exact fresh data directory with the pinned pg_ctl, and confirmed port55479 free. The independent final OS listener check also returned `PORT_55479_FREE`. No unrelated cluster was stopped or modified.

Required repair: mark start as attempted before invocation and reconcile the exact reserved data directory on any uncertain completion, with explicit cleanup evidence. Ensure a failed connection close cannot skip cleanup, and do not hide an unsuccessful shutdown as a clean failure. Preserve no-replay reservation and reject further work until an uncertain state is reconciled. Test a server-started/launcher-failed case and verify no listener remains; do not use broad port/process termination.

## Passed checks and evidence

`bun test evaluations/research-qa/hosted-setup-01-local-role-independent.test.ts`: **1 passed,1 failed,229 assertions** on Bun1.3.12. The final failure is the expected no-leftover-server assertion above. Durable observed outcomes are in `hosted-setup-01-local-role-independent-result.json`.

- Every boolean flag on all16 roles was independently flipped with a recomputed supplied pin; all112 changes were rejected by the internal allowlist. Every admin/inherit/set membership flag on all22 grants was flipped with recomputed pins; all66 changes were rejected. Duplicate/reordered/renamed role and missing/changed-grantor membership cases also refused.
- A real native17.11 positive bootstrap reproduced all16 role rows and22 membership rows exactly. An independent `pg_authid` query found no password values for any role. No provider identity recovery or actual hosted data was involved.
- Remote host, wrong port/role/database, path outside the private root, wrong executable/state/snapshot pin, and wrong synthetic receipt pin were refused before attempt reservation. The receipt test used newly created synthetic marker files only, not an actual backup or archive. Occupied55479 using a disposable TCP listener was refused before reservation.
- Wrong stop-result pin refused without stopping the running test cluster. The correctly pinned stop succeeded; stop replay and bootstrap replay refused. Cluster data and local journals were retained.
- Source review confirms fixed loopback target; private-root containment and realpath ancestor checks; same-directory content/version-pinned initdb/pg_ctl/postgres; source state/snapshot/archive binding checks; no password-copy SQL; exact initial system databases/roles/memberships; transactional grant creation and exact readback; and stop verification of actual data directory and role hashes. Provider-style privileged flags are deliberately recreated only inside the isolated local cluster.

## Limits and next step

This is not a successful hosted restore or approval to use a real archive. Actual encrypted-archive positive loading and private-root junction cases were source-reviewed, not exercised; only the negative synthetic receipt path was run. No claims are made about provider Auth recovery, schema23, hosted upgrade or release readiness. The author should repair ROLE-F01 and request a focused independent re-review while retaining this first FAIL and result. Port55479 is free at handoff.
