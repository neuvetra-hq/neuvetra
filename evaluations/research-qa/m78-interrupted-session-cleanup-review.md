# Interrupted sessions: actual metadata disposition and cleanup strategy

M78-INTERRUPTED-SESSION-CLEANUP-REVIEW-01. Independent reviewer /root/resume_release. September22,2026. Actual metadata receipt4570ae628e05c71d8feab14acc6e5c04fe985f842ab2cdf8d111b19031d1f273 validated locally. No host/auth/DB or cleanup execution by reviewer.

## Attribution verdict

The admitted read-only observer found exactly one session for each of the four admitted test subjects, all with created_at==updated_at and exactly one linked refresh row. Creation follows the four recorded login outcomes in the same order by249/336/338/347ms respectively. This pattern strongly supports attribution to the interrupted test run, together with its four successful subjectMatched logins. It is inferential attribution, not recovered JWT session_id proof. These timestamps fall outside the client response intervals; describe the small consistent displacement as compatible with clock/observation differences, not a measured clock correction or exact-window match. No other session for these four subjects was present in that snapshot; other users' sessions were outside this observer scope.

The selected IDs and user/timestamp predicates remain in the private pinned receipt. Public review output records only role/count/offsets and a target metadata digest. Never select all sessions for a user, choose newest dynamically, or create a replacement login to clean up the lost session.

## Bounded cleanup implementation criteria

Root may prepare a new exact-source cleanup candidate for independent review. Before any delete, bind immutable15/30 interruption and4570 observation plus all four exact session rows. In a single transaction verify each exact(id,user_id,created_at,updated_at) predicate still matches, lock only selected rows, require exactly four distinct matches, and refuse changed or additional session candidates for those subjects. Preserve current nonselected session metadata and related counts, including browser sessions. No auth.users mutation, broad logout, app writes, schema or repeated inventory save.

Revalidate the two incoming cascade constraints: auth.refresh_tokens.session_id and auth.mfa_amr_claims.session_id reference auth.sessions.id ON DELETE CASCADE. Outgoing sessions→users/oauth_clients constraints do not imply deleting parent users/clients. Inspect applicable enabled noninternal triggers and reject unexpected side effects rather than assuming FK metadata is the whole delete path. Capture selected dependent counts before deletion; refresh count currently1 per selected session, MFA counts not yet observed. Compare nonselected session metadata and linked counts and complete application inventory/content before/after, with appropriately scoped unchanged assertions for the chosen transaction isolation. Do not imply a snapshot comparison observes concurrent unrelated commits outside that snapshot.

Only delete the four fixed rows using bound parameters and all four metadata predicates; require returning rowcount4 and expected identities. Then require selected sessions and their linked refresh/MFA rows absent and nonselected/app comparisons exact. Any mismatch rolls back. New exclusive intent/outcome evidence must distinguish attempted action, transaction commit and verified postcondition; a write timeout must be reconciled before retrying. Final source review precedes execution. This document is strategy acceptance, not approval of code not yet inspected or a claim of completed cleanup.

## Access-token limitation and continuation contract

Supabase distinguishes session/refresh revocation from access-JWT expiry. Its official sign-out guide states that access tokens for revoked sessions remain usable until their encoded expiry; its session guide explains the token session_id and database session relation. Sources checked September22: [Supabase sign-out](https://supabase.com/docs/guides/auth/signout), [Supabase sessions](https://supabase.com/docs/guides/auth/sessions). These sources support the residual-token limitation, not a claim that this direct database cleanup is an officially documented public API.

Original access/refresh token strings and exp claims were not retained. Process absence does not prove token expiry or universal inaccessibility. Therefore never emit accessTokenDispositionVerified=true, allLostTokensInvalid=true, or infer expiry from the elapsed wall clock. A suitable factual post-cleanup contract, populated only after actual evidence, is:

```json
{
  "sessionDisposition": "selected_rows_removed_and_linked_refresh_rows_absent",
  "selectedSessionCount": 4,
  "selectedSessionRowsRemaining": 0,
  "selectedRefreshRowsRemaining": 0,
  "selectedMfaRowsRemaining": 0,
  "nonselectedSessionsPreserved": true,
  "applicationInventoryPreserved": true,
  "accessTokenUsability": "not_verified",
  "accessTokenExpiryVerified": false,
  "accessTokenMaterialRetained": false,
  "residualLimitation": "Previously issued access JWTs may remain valid until their own expiry; expiry was not observed."
}
```

Require exact cleanup receipt/source/transaction hashes and commit evidence alongside that contract. At present sessionDisposition is pending, not removed. Following independently reviewed actual targeted cleanup, this explicit limitation is sufficient for a bounded synthetic-test continuation admission: no credential compromise is evidenced, fresh test sessions are separate, and no claim that all previous tokens are unusable is necessary. This is not customer/security certification. Preserve both interrupted journals as interrupted; do not manufacture logout outcomes. A new separately admitted read-only baseline with fresh source/runtime evidence must still precede the unchanged37 write plan. If attribution or no-drift predicates fail, do not broaden cleanup; return unresolved for review.

Requested inherited gpt-6-astra/high; actual runtime settings unobservable. Root owns cleanup authoring/execution and Git/shared ledger. Own report/result/run/snapshot only.
