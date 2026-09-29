# Independent review: setup database and API foundation

Verdict: **PASS for the bounded local database/API foundation**, reviewed 2026-09-26. This does not accept a hosted deployment, the UI, or completion of the board brief. Reviewer `/root/hosted_qa` authored QA fixtures/tests only, with no product-code authorship. Requested gpt-6-astra/high; observed model/effort and cost unknown. The controller cost-observation exception belongs to the coordinator's assignment record.

## Exact candidate and evidence

`hosted-setup-01-integrated-result.json` records before/after SHA-256 values for seven product files: hosted adapter, workspace adapter, setup reader, migration manifest, migration23, staged server and setup route. All matched across the final run. `hosted-setup-01-native-result.json` adds the DB/route checks, table inventory and explicit limitations. The reviewed operator handoff `packages/neuvetra-database/src/company-setup-upgrade.md` SHA-256 is `fa9fce41e1d5dd7faddb9156ee6329a85b85957184d4dbf204f13d9f0a252514`.

Executed command: `bun test evaluations/research-qa/hosted-setup-01-integrated.test.ts evaluations/research-qa/hosted-setup-01-native.test.ts`. Final result: 2 passed, 0 failed, 95 assertions, 15 named checks. Environment: Bun1.3.12, fresh isolated native PostgreSQL17.11, loopback55483; new uniquely named disposable synthetic databases, restricted `neuvetra_runtime` connections. Authentication used synthetic token maps; the actual HTTP listener, staged wrapper, adapter and SQL path ran. No provider credentials, customer data, existing database clone or hosted state was used.

## Criteria disposition

- I01–I04 and I10 pass locally: two-company API denial in both directions, guessed history IDs, eight tables with ENABLE/FORCE RLS, denied direct runtime mutation and unintended function execution, atomic cross-company facility/entity reference rejection, ordinary-member denial and revoked membership denial. Both concurrent admission-revocation orderings were exercised: an accepted save holds the lock through commit; a committed revocation defeats a waiting save.
- I05–I08 pass locally: immutable previous-version readback, stale conflict, exact replay, changed replay conflict, exactly one concurrent successor, null ownership retained, distinct unknown/no/not-applicable states with reasons, invalid reason/date/ownership rejection, and Nevada setup geography. Operator-only provisioning creates a new synthetic non-CA company and its membership without a fabricated facility. Runtime provisioning is denied. General membership/session retrieval works without old fixture joins.
- I09 passes for the local synthetic fixture: exact values in all125 pre-existing application tables remained equal after migration and new setup operations. Thirteen tables were populated, including SQL-conforming M71/M78/M80 preservation sentinels, associated audit rows, fixture admission and all four held release records. These sentinels test retention; they are not claimed valid accounting workpapers. Historical migrations1–22 and prototype files have no working diff. Migration23 intentionally widens four legacy geography CHECK constraints without rewriting existing values; classify this metadata change in any hosted preservation comparison.
- I11 passes for new connections and listener restart. Real provider sign-out/sign-in and database/server process restart remain separate hosted acceptance cases.
- I12 passes for the seven pinned files and focused independent tests. Broader application/CI checks remain the coordinator's publication gate. Any change to these reviewed files requires a targeted recheck.

## First finding and test history

F01 was a blocking route defect: the company UUID regular expression omitted one four-character segment, causing every valid company route to return404. The first failing source hash and receipt remain in `hosted-setup-01-native-f01-result.json`. The root corrected it; the final tests exercise valid requests and both foreign directions successfully.

Environment/fixture failures were separated from product findings: sandbox PostgreSQL/Bun access required authorized escalation; missing dependency payloads were repaired by root. A QA simple-protocol denial probe stalled and was replaced with a parameterized query. Synthetic metadata initially lacked mandatory RLS; the fixture was corrected. An M80 sentinel initially used an invalid fixed-fixture digest; the fixture now uses the actual pinned digest. Restoring a deliberately deleted QA membership initially lost microseconds through driver timestamp conversion; explicit text-to-timestamp restoration now preserves the entire legacy table exactly. None of these fixture failures is presented as a product pass or hidden defect correction.

## Still unaccepted

Fresh hosted backup and independent restore rehearsal, actual hosted row/metadata preservation, provider identities/invitations and sign-in, database/server restart, seven-step browser parity and all15 Bayline fixes, collection/activity/evidence storage, original-byte downloads/quarantine/recovery, exports/jobs, shared readiness logic, and live board demonstration remain unaccepted here. The operator handoff gives a preservation-first rollback plan; its existence is not restore proof. No live migration or deployment was performed. Local tests cannot establish customer readiness, method release or external assurance.

Coordinator owns next integration, broader checks, publication and hosted execution gates. Native runtime data lives under `.tmp/hosted-setup-01-qa-native` and must stay out of Git. The reviewer has not published or changed shared ledgers.
