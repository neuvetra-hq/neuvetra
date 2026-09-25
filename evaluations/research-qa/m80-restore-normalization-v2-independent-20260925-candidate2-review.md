# Backup normalization v2 independent review

Candidate 2 passes this bounded source and synthetic rehearsal review. Candidate 1 remains failed; V2-F01 and V2-F02 are independently closed in this successor.

- All four frozen current/embedded files, eight declared dependency pins, and 110 historical Backup C3 current/embedded files match.
- Reproduced 10 author tests / 40 assertions. Independent controls: 54 semantic, raw migration, durability and native boundary cases; 70 targeted negative variants plus seven exact runtime orchestration cases.
- The runtime probe now uses a valid no-op DELETE and accepts only string SQLSTATE 42501. Every one of 42 table privilege and three sequence privilege cells was challenged. Wrong/duplicate/scalar-invalid privilege rows refuse. FK, connection, generic, numeric-code, missing-code and no-error results refuse. Both injected connections close.
- Forged content, metadata and application hashes refuse on either side and both sides, including a coordinated forged metadata/application hash pair. Raw hashes are recomputed before proof issuance. Normalization retains global/application ACLs and exact trigger multiplicity; an additional 27 external-ACL synthetic fixture proves raw-different/normalized-equal reporting without relabeling raw hashes.
- A fresh isolated synthetic clone passed schema21 restore, raw schema22 delta, four held records, six forced-RLS SELECT-only tables, denied sequence/write privileges and zero admission. All four generated receipt timestamps equal 2026-09-25T03:21:44.592Z; exclusive directory and clone remain retained.

Actual archived hosted restore is still unrun under this review. ACTUAL-RESTORE-F01 remains open until separately authorized actual-archive rehearsal and review. Preparation/executor consumer acceptance, publication/CI, fresh evidence and stage approval remain separate. No migration gate is issued. Author report's heading says three retained native attempts while listing four; the four bullets and explicit failure history make this a harmless count-label inconsistency.

Requested gpt-6-astra/high; observed execution settings unknown. Independent reviewer did not author the candidate. Test sources and sanitized result receipts are pinned in the deliverable snapshot.
