# HOSTED-SETUP-ACTUAL-RESTORE-QA-01 — independent actual archive review

2026-09-26. **Bounded PASS against corrected observation v2.** The exact paired application archive decrypts and validates, and the retained local restore independently matches its source snapshot for all application rows, supported catalog objects, sequence state, roles and recorded tenant reads. This does not authorize schema23 migration, deployment or provider recovery.

Reviewer: /root/hosted_recovery_qa, independent of root's actual execution and the product helper authors; QA authored only the new probes/results/this report. Requested critical gpt-6-astra/high; inherited observed settings and resource costs unknown. Read the role operating instructions, current board/next-session context, local board brief, Candidate3 recovery/transport and role-bootstrap PASS reports, original recovery FAIL and both role-bootstrap FAIL records. The leading next-session section still described restore as pending; actual receipts and independent observations below establish this narrower later outcome.

## Material finding and correction

**ACTUAL-RESTORE-QA-F01 [P2], resolved in v2:** the original root observation's localStopReceiptSha256 (line14) had 63 characters: aff47e9f382273932d5fdcc4e88434a8df2cc53eaf7087d98f8fcdd4eec48df. The actual unchanged stop file hashes to aff47e9f382273932d5fdcc4e88434a8df2cc53eaf7087d98f8fcd8d4eec48df. The first independent probe refused at this pin after24 successful checks and before any local startup. This was an evidence transcription defect, not evidence of failed shutdown or changed archive.

The original observation, first probe and failed result remain preserved. Root authorized continuation using the separately measured stop pin and created a distinct corrected observation v2 with an explicit correction record. QA subsequently verified v2's supplied digest, the original v1 digest, the real stop-file digest and an object comparison proving that only the profile, stop hash and correction record changed. No first-pass acceptance is claimed, and the original v1 is not accepted as a complete chain.

## Independent execution and coverage

Ran the separate r2 probe on Bun1.3.12 against native PostgreSQL17.11: **175 checks passed**. It did not call backup, role bootstrap, restore or migration entrypoints. It restarted only the pinned existing data directory on loopback55479, used read-only repeatable-read transactions, closed both sessions, then stopped that same directory using the exact hashed pg_ctl binary. No hosted connection or provider operation occurred.

- **Cryptographic chain:** archive and receipt byte hashes match the task and paired observation. CurrentUser DPAPI unseal succeeded entirely in memory; decrypted bytes match snapshotSha256. Bundle validation binds profile/project/application-only/synthetic-only exclusions, snapshot JSON digest, dump bytes/digest, lossless state digest and snapshot-token digest shape. The encrypted outer file is neither a plaintext PGDMP archive nor plaintext JSON. No decoded rows or credential values were written or printed.
- **Actual source and restore:** independently queried every restored application table using PostgreSQL row_to_json(t)::jsonb::text and compared sorted full-row hashes and multiplicity with the encrypted source snapshot, avoiding JavaScript numeric decoding. All **127 tables /748 rows**, including **one zero-row table**, matched. Source migration-receipt count is22; those exact rows are included in the comparison.
- **Full supported catalog and sequence state:** a fresh captureState against the actual restored target passed assertPreserved. All supported metadata, columns, constraints, indexes, policies, functions, triggers, dependencies, **three sequence states**, **16 role records** and **22 memberships** matched their source fingerprints. Live database, actor, data_directory, address, port and server170011 checks bound queries to the intended target.
- **Independent restricted tenant session:** QA opened a separate neuvetra_runtime login and imported the local exporter's snapshot before SELECT. The reviewed Candidate3 checks verified restricted current/session identity and read-only settings. Five actors across127 tables yielded **635 observations:630 completed reads and5 select-privilege-denied records**; their digest exactly matched the source. Positive company visibility and outsider exclusion were enforced.
- **Actual tenant scope:** the archive represents **one company**, four member actors and one outsider, with actor company counts [0,1,1,1,1]. Therefore this actual exercise establishes preservation of those member/outsider boundaries. It is not a two-existing-company live tenant demonstration. Earlier independent synthetic cross-company tests remain distinct evidence; the board's two-company application/browser requirement remains open.
- **Auth dependency:** four referenced auth.users UUID stubs and the auth.uid() function definition matched exactly. An independent pg_authid count found zero stored role passwords. These facts do not establish recovery of provider accounts, login credentials or sessions.
- **Comparison challenge:** in-memory row-digest drift and removed tenant observation were rejected without mutating the actual database.
- **Lifecycle and no replay:** original successful backup/role/restore reservations remain reserved-no-replay. The earlier08:30 backup attempt retains its reservation but has no archive/receipt. The malformed-tool-pin preflight's different target has neither directory nor attempt journal. The accepted target and attempt were not reused for bootstrap/restore. Original root stop receipt binds the exact role journal/result hashes and records successful stop; QA's later independent restart/stop is separately recorded.
- **Final stop:** independent pg_ctl stop exit0, status exit3, TCP listener false, cluster files retained. A separate operating-system check returned PORT_55479_LISTENERS=0. The original root stop receipt was not rewritten. No broad process or port kill was used.
- **Freeze:** all eight Candidate3 manifest entries plus the manifest, current root wrapper and role-bootstrap helper pins matched. Recovery and transport PASS bytes and original recovery FAIL bytes remained unchanged. A final closure pass rehashed all25 recorded source/evidence pins, verified the corrected observation and recorded only hashes/counts.

The raw source state digest is 85763f14b6bd15768296e8f9acaf4b03e11c3f6d7a53312398ab831c526aba30; restored and normalized-state digests are 08c3e791556b33a7c2db3a9907894bb15a9a15577338fd777b18c9508d736786. Their only admitted normalization is removal of **27 source external-schema default-ACL entries**; application and global default ACLs remain compared, and no unexpected external default ACL exists locally. This is application-catalog equivalence under the previously reviewed normalization, not raw equality of every provider schema setting.

Tenant-access digest: e0f29a8b069a4b440e66bfe1ddd3573a9e90c641133c57cfb12c66b881baa0bb.

## Exact evidence

Private recovery root: C:/Users/nimab/Neuvetra/m63-runtime/recovery. Successful archive stem: hosted-setup-20260926T090844493Z-d3471989. Local retained directory stem: hosted_setup_roles_1790414845902_b1f2a12a. Database: hosted_setup_restore_1790414845902_b1f2a12a.

| Artifact | SHA-256 |
| --- | --- |
| Actual .snapshot.dpapi (9,466,390 bytes) | 22280e654a823d3922acfa56ddee1bc9ac0c9c17fa1c29fb672671071c488495 |
| Actual .receipt.json (566 bytes) | 60c093af17ec31cfea52b5a1b7689b5adb6dd72d06053b2f59f7c269c8ad0819 |
| Decrypted snapshot (memory only) | c061e8316581296f795c353feccca537e5b2db6e8796f164a096f34727766667 |
| Contained pg_dump (memory only) | 4906d34d421cc5752a52c96e74654a974ff04dc92e1d655a2fe52e01ece8c886 |
| Role .attempt.json | 836f26a6e401146d48070db66c85dde40900deb53244d23fec22f293295356b3 |
| Role .result.json | beb223247e0eac1d34fe3803c5e2ee8aa05aabb6ab1238b176d4ec5b41b4721f |
| .restore-attempt.json | 3e03a0e0c12befb6cff2e98958ecb390477ac2283de0373abdbfcd1672a9b362 |
| .restore-result.json | dd9c646bb04707225d07f074b1b3db01b26f548101311a5c8cf906771923daa4 |
| Original .stop.json | aff47e9f382273932d5fdcc4e88434a8df2cc53eaf7087d98f8fcd8d4eec48df |
| pg_ctl.exe | 595303cede56a05eff6e2ec6e6e8bd5531c13832ba09fab57b1a9e93bc945c34 |
| paired-backup-20260926.json | a18b1566d4cb88b1241b6a3a19e28a0a030c68f089609587897c33daad06ca4e |
| actual-restore-observation-20260926.json (preserved malformed v1) | d01338ebb2996c024205f6ba767d047ab6e810ea20bb132e537db96c8ca3c5c6 |
| actual-restore-observation-corrected-20260926.json (accepted v2) | 166c578f9909234ed7c127c7c9a957dcb2a726b46cea4ff1bfefd09e7f633f1a |
| restore-preflight-refusal-20260926.json | 8f170793f3f5c634f1eb8ab3fde525a5972f7d84766c6282942fa38b3b2e3a23 |
| actual-restore-independent-probe-20260926.ts (first) | aa14a445fb2dcd82e1e1e2792246df69d4cb1d9843907c9c88cfde9a3497b2e6 |
| actual-restore-independent-result-20260926.json (first refusal) | 43c6ef7f40a197aea16454c04804e8ba64dc7435a9bb84e25c6bbb0784585a43 |
| actual-restore-independent-probe-20260926-r2.ts | d0b693053cb7f54fa5fc386c57de8c679ff0c399cbc9ccd58909e6984a0102c4 |
| actual-restore-independent-result-20260926-r2.json | 8a3a1fcfe33204e72a8629814ce5cc4b95bf3367d683fd0ec7ca533c0b9cd4b6 |
| actual-restore-independent-closure-20260926.json | 3a98838e99da31f4c154e553a57986e455fcef00bcda137f7b82085eb4a57fda |

Repository filenames abbreviated in the table live under evaluations/research-qa/ with hosted-setup-01- prefix. All executable/source pins and component fingerprints are retained in the r2 result, not inferred from file names.

## Practical limits and next gate

QA verified an actual root-created historical paired archive and independently recaptured its existing local restore. QA did not independently repeat the original hosted read, TLS handshake, source credential provenance, pg_dump launch or absent-target creation. The inspected exact implementation, receipt bindings and synthetic prior reviews support those execution claims; current hosted state and quiescence were not reobserved. A historical consistent snapshot does not guarantee that later hosted writes are absent or that the archive is the current database.

The archive contains the supported application schema and minimum Auth dependencies, not a provider disaster-recovery image. Provider Auth identities/passwords/MFA/sessions, external schema policy/configuration, storage objects, files, service configuration and deployment are excluded. The retained local cluster uses loopback trust authentication with provider-shaped privileged roles and must remain stopped except for explicitly scoped work. DPAPI recovery requires the original Windows identity. No off-machine disaster test or filesystem fault injection occurred.

This verdict does not grant schema23 execution authority. Root must still accept the independently reviewed source/manifest fingerprint derivation and concrete migration/publication integration, revalidate exact target/source and write-stop controls at execution, preserve no-replay journals, and demonstrate the authorized synthetic signed-in setup. API/storage/export/job isolation, two-company live demonstration, board feedback, methods/factors and customer readiness remain separate. No product, shared ledger, Git, hosted data or provider state was changed by this reviewer.

