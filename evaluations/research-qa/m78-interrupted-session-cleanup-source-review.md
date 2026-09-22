# Exact interrupted-session cleanup source review

M78-INTERRUPTED-SESSION-CLEANUP-SOURCE-01. Reviewer /root/resume_release; root authored cleanup/wrapper. September22,2026. Accept V2 ONLY: observer08d4934f1fc9679f8eb00e0fd8733b37e29ab3b564b5b3db372d76edf1594b1a, wrappera041ec8ba115c732358076edc3f17cb8560f10ab701322ffd8fa42654223ce86. This is source admission, not actual cleanup.

## Preserved first failure and repair

Candidate1 source4fa277/wrapper06aa8 compares PostgreSQL timestamps exactly to the millisecond JSON observation. Sub-millisecond database precision can survive while the ISO comparison drops it, making the precheck pass but DELETE return0. That safely rolls back yet consumes the exclusive intent. Material finding CLEAN-TIME-01 required repair before execution. Candidate1 and its4tests81assertions remain preserved.

V2 adds created_at::text and updated_at::text to the fresh transaction snapshot, retains ISO admission against frozen4570 metadata, and binds exact raw server strings to each four-field DELETE predicate. No broader timestamp range or changed target list. Exact source diff is limited to raw timestamp projection/binding. Final5tests90assertions pass, including nonzero microseconds and separate created/updated precision.

## Guard and transaction review

Exact4570 metadata selects four distinct session and user IDs. Private wrapper hashes V2 before narrow DATABASE_URL access and transfers only root/operatorURL by hidden stdin; no DPAPI is needed. Fixed TLS operator boundary is reused. An exclusive intent is written before connecting, so prior intent refuses retry. The single serializable sql.begin transaction asserts operator/database/isolation, exact two session cascade relations and no noninternal triggers on the three affected auth tables.

All auth session metadata and linked counts are bounded to10001 and reject over10000 before deletion. Selected identities/user IDs and observed ISO timestamps must match; exactly one refresh row per selected session is required. Four parameterized deletes bind fixedID/user and raw timestamps, each returning exactly the expected one ID. Native DELETE acquires target row locks; concurrent drift is subject to serializable transaction conflict/row predicates. There is no automatic retry in the reviewed transaction adapter.

Postconditions require selected session/refresh/MFA rows absent, every nonselected session metadata row and linked count unchanged, and full neuvetra inventory/catalog/content hash unchanged. The imported inventory helper hashes complete rows, not just counts. Nonselected and app comparisons are transaction-snapshot comparisons, not observation of unrelated concurrent commits outside that snapshot. Any failed assertion rejects the transaction callback; reviewed sql.begin controls commit/rollback. FK cascades remove only linked rows, not parent users. No global logout or auth.users/application mutation exists.

Successful result file is written exclusively only after transaction promise returns, with commitReturned:true. If commit succeeds but result-file write fails, absence of result does NOT prove rollback. Preserve intent and reconcile exact metadata read-only before any next action; never rerun by deleting intent. Source test explicitly covers this uncertainty. Intent/result writes use exclusive file flags but no explicit fsync; do not treat filesystem artifacts alone as a crash-proof transaction log. Root already retains independent provider/application evidence boundaries.

## Test scope and residual limitation

Tests verify source hashes, strip imports, transpile exact body and inject synthetic filesystem/database/inventory/stdin mocks. Positive cases check exact four targets/commit and token limitation. Negative cases cover FK/custom trigger/metadata mismatch, second-delete zero row count, app preservation mismatch, existing intent and postcommit output failure. The V2 precision test exercises raw server strings with microseconds; wrapper checks are static. Mock rollback behavior is not a live PostgreSQL rollback experiment; correctness is also grounded in the inspected sql.begin implementation and original native transaction semantics.

No host/auth/DB calls, credentials, original journals, actual intent or cleanup result writes. Root must execute exact admitted V2 once and supply actual commit/postcondition evidence for independent disposition. tokenUsability remains not_verified and expiryVerified:false; session/refresh removal does not claim lost JWT expiry. Own test/result/report/run/snapshot only. Requested inherited gpt-6-astra/high; runtime compute unobservable.
