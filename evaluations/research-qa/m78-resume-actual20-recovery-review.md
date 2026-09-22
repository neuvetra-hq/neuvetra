# M78 resumed actual backup recovery review

## Verdict

**PASS for bounded recovery of the September 17 actual schema20 application archive into `m78_ops_actual20_20260917c`.** Fresh September 22 UTC local inspection, after the coordinator restored the existing PostgreSQL runtime, verified all113 tables,377 retained content entries, all20 migration receipts and the complete restored inventory exactly before and after replay. Eight families passed42 authorized GETs and18 exact downloads. No application data, catalog or global role changes occurred. The result is `m78-resume-actual20-recovery.json`; its timestamp records actual completion.

Reviewer `/root/resume_recovery` did not author the hosted adapter. Critical registered compute requests Astra/high; inherited observed settings remain unknown. This internal independent technical review is not professional assurance.

## Evidence and boundaries

Original backup journal SHA `54ab59711c68eca841b4a894526bd200ae482364cdcabcee834ba6ccc0bc5648`, successful c hosted restore journal SHA `ab8c7cae9ad5d5b767f88d5893fe0d4c8fa30be7d5c702309416b33df3f07c8a`, and c local restore journal SHA `351c2bc3e376a988edfb6d014c9e21b50ba91bfe61129e0b5f61a47e00b9fd26` matched their exact pins. Source/full inventory, archive/snapshot/dump provenance and transfer comparison matched. All27 excluded default ACL entries belong to the separately declared application recovery boundary; provider/deferred schemas are not claimed restored.

Actual native database reads, API GET handlers and applicable frontend decoders verified legacy electricity, corporate coverage, natural gas, mobile diesel, fleet, stationary diesel, stationary equipment and fugitive history. Corporate8, three facilities, accepted fugitive population4 and five devices are retained. The corporate report is explicitly the separately retained M60 annual draft; M71 supplies a coverage export. Native report and export downloads match exact retained bytes. No-claim runtime reads returned no rows for the three probed tables, and the legacy-containment audit passed.

Admin snapshots run in read-only repeatable-read transactions. Runtime GET handlers use their normal SELECT FOR SHARE locks; only GET routes are invoked. Complete before/after rows, catalogs, sequences, roles and content comparisons passed. There were no host calls, decryption, provider authentication, POSTs or browser rendering. Semantic replay is bounded to the recorded selected versions/reports, not full historical recalculation.

## Preserved failures and corrections

The first resumed connection failed ECONNREFUSED while local PostgreSQL was unavailable. An initial readiness binary command had an argument error. After root restored the runtime, a reviewer-added runtime read-only setting rejected a legitimate GET SELECT FOR SHARE with25006; removing only that added runtime setting restored normal read locking. The next full replay passed but packaging encountered an inherited nonexistent `m77-binding-root-acceptance.md` path. The reviewer inspected and bound the actual `m77-hosted-acceptance.md`, then reran all read-only comparisons and replay successfully. The initial pending snapshot remains immutable; these are reviewer harness corrections, not application defects.

## Remaining gates

The backup is historical September17 evidence. This result does not refresh the live baseline or authorize use of stale artifacts in the hosted migration gate. Root must refresh host backup/recovery evidence before hosted mutation, complete the separate exact38-write upgraded-clone recipe and current publication/deployment gates. Full Scope1 customer readiness, method/source release and external assurance remain outside this acceptance.

## Date correction

The initial candidate1 prose incorrectly said September23UTC. The immutable result timestamp is2026-09-22T15:45:02.101Z; this corrected report uses September22. No replay or result artifact was changed. Root independently accepted the actual eight-family recovery result.
