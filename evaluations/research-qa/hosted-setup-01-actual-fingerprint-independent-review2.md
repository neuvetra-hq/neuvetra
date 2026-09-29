**PASS — corrected historical local fingerprint chain only.**

- All seven SHA-256 hashes match the supplied values. V2 binds the unchanged operator script and derivation result; fingerprint, archive/receipt, source/restored-state and ACL cross-fields agree.
- The substantive correction is the malformed 55-character script pin. V2 also changes profile/status/pending-review wording, adds correction provenance, and removes `recordedUtc`; the preserved v1 retains `2026-09-26T10:21:22Z`. The original observation and first **FAIL** remain intact and are not retroactively accepted.
- Static inspection confirms input-pin checks, loopback/stopped-cluster preconditions, snapshot-buffer zeroization in `finally`, and verified shutdown before result creation. Failure cleanup attempts shutdown and reports reconciliation required; it does not prove successful shutdown on every failure path.

This verdict relies on the **2026-09-26 first review’s 25 restore-pin checks and historical stopped-cluster observation**, plus the **2026-09-26 accepted actual-restore review** and Candidate2 component review. Those checks were not rerun here.

Fresh independent corroboration of the **27 external default-ACL archive entries** remains unavailable. The prior accepted restore’s normalization evidence, pinned script and consistent derived output support this bounded historical acceptance with that caveat. No additional material gap was identified within the authorized scope.

No files were modified or scripts/databases executed. This establishes no current hosted state, live writer gate, provider recovery, or upgrade authorization.