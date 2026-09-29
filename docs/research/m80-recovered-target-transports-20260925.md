# M80 recovered staging target transport candidate

This additive candidate prepares a separately reviewed operation against recovered deployment `7b7d1c4e-6039-4de5-9bfc-31b84d4b9cee`. Root observed that deployment healthy at prior commit `540c71dbea6057f35a8b44074a71ceb9cf6bd6c3`, schema21, on 2026-09-25 at 02:31UTC. That dated observation is not a fresh execution gate.

The original stop and recovery helpers, attempts, queries and responses remain unchanged and consumed. The successor changes only the fixed recovered deployment identity, exclusive output paths, recovery import and required executor-v2 entrypoint. Prior commit/image, target project/service/environment, six-check verification, current source closure, zero-session recovery checks and the global prohibition on recovery after a migration intent remain unchanged. It is not a schema22 rollback mechanism.

The read-only successor verifies its exact stop-module hash before import and uses the same baseline/stopped predicates. No live call occurred during candidate creation; only syntax was checked. Independent source review, accepted executor-v2 transport, fresh exact-head checks and fresh actual target/backup evidence remain required before maintenance.

The root-only input composer is a separate candidate and is not included here. No old journal may be removed, replaced or relabeled to use these successors.

Candidate1 had an additional entrypoint-list mismatch: the recovery review predicate still named the old helper paths. Root identified it before execution. Candidate2 changes that one list to require the actual recovered recovery/stop entrypoints. Candidate1 remains preserved in its snapshot and is not accepted.
