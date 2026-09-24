# M78 continuation backup preparation

Author: /root/resume_release. Prepared 2026-09-22 at 17:22 UTC. Requested inherited security-reliability compute: gpt-6-astra/high; runtime settings not independently observable.

## Candidate and boundary

New explicit schema-21-only backup/restore module and focused tests. Root independently reviews this authored module and owns execution. This preparation performed no database, host, credential, decrypt, Git or shared-ledger operations. Historical operators, journals and accepted snapshots remain unchanged.

The module binds the original closed failed journey d3301eb2, read-only committed-save observation 995f9135 and independent reconciliation 3147cea3. It requires the exact initial version 3e45de5d-d312-4a22-8418-35cb740a3a12 / 977fdd9d, all 121 tables and complete catalog/content equality. No later continuation state is admitted. Backup uses the existing fixed-project verified TLS connection, repeatable-read read-only exported snapshot and schema-only custom dump in memory, UUID subject validation, exclusive DPAPI CurrentUser archive and exclusive separate journal. Restore binds the original two-event backup journal, archive/snapshot/dump hashes and dates; generic fresh-local restore preserves complete source inventory and explicitly projects only the previously declared 27 unrelated default ACL entries. It neither upgrades nor retries.

## Exact interface

- backup pgDumpPath archivePath backupJournalPath; stdin is exactly operatorDatabaseUrl and operatorId /root.
- restore archivePath archiveSHA snapshotSHA pgRestorePath database localJournal hostedJournal.
- Fixed archive: .superpowers/m78-continuation21-20260922.dpapi.
- Fixed backup / hosted restore / local restore journals: .superpowers/m78-continuation21-20260922-backup.jsonl, .superpowers/m78-continuation21-20260922-hosted-restore.jsonl, .superpowers/m78-continuation21-20260922-local-restore.jsonl.
- Fixed fresh database: m78_ops_continuation_20260922 on local port 55472.
- pins prints the current 117-file source map. The frozen map is m78-continuation-backup-source-pins.json beside this report. Root must admit exact bytes before execution; the map does not rewrite historical 115-file evidence.

## Validation

Final candidate: 5 offline tests passed, 167 assertions; targeted strict TypeScript passed. Tests challenge argument/path/clone boundaries, original single-save and provenance guards, schema/profile/dump/default-ACL transfer validation, changed private evidence refusal before database use, all 117 raw source hashes and original backup journal identity/chronology. Fixtures are synthetic; no actual backup or restore is claimed. An initial shell quoting attempt to add UUID validation failed before editing; the subsequent patch and all final checks passed.

## Separate independent wrapper review

Root authored .superpowers/m78-private-continuation-backup.ps1 SHA256 6022c8a16466fa5bad92685ec6ebed33bae2b388fe11e8a8ba4417dab43be196. I independently inspected its credential-free source and exact three changes from the prior reviewed wrapper: backup-only ValidateSet, fixed new module path, backup-only three-argument guard. The existing narrow DATABASE_URL selection and stdin-only child handoff are retained. Accepted for bounded source preparation subject to root external byte/source admission. I did not execute it or read the supplied ENV export. This is independent review of root's wrapper, not self-approval of my module.

Actual encrypted backup, restore, full independent content review, native continuation and hosted lifecycle remain separate evidence gates.
