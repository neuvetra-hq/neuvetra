# Candidate2 correction: independent preparation only

Root addendum SHA256 `8162fd5008ea7ad856186b678e39db8552bb5226c7f81b318ed1a88bea5ec5c8` verified. This note neither accepts the design as implemented nor authorizes execution. No Candidate2 native target or frozen implementation has been supplied. Candidate1 rejection, first QA setup failure, transport reproductions, REVIEW1 snapshot and private archive relocation remain unchanged.

## Design checks sent to root

1. Private identity helper derives `auth.uid()` internally and locks current identity; it must not accept an arbitrary actor parameter. Runtime/PUBLIC/legacy roles cannot execute either private helper; only the new beta owner has the bridge grant.
2. Future helper creation must occur as the new owner through `SET LOCAL ROLE`. Creating as the old operator and merely transferring ownership retains creation-time ACLs and can repeat F01. The old owner's global/schema defaults stay byte-for-byte unchanged.
3. Check membership in both directions (`member` and `roleid`) for the new owner/runtime. Runtime cannot `SET ROLE` owner/operator. New owner has no effective direct auth/neuvetra schema, relation, sequence or function privileges. Private bridge calls are fully qualified, with fixed safe search paths and no dynamic caller-controlled SQL.
4. Exact owner/grant inventory: new schema/eight tables/three entrypoints belong to new owner; two private helpers remain operator-owned and non-public. Check FORCE RLS under the actual non-bypass owner. Definer nesting must preserve `session_user` checks and obtain actor from trusted transaction-local identity.
5. The Connection-close correction needs actual raw socket EOF after bounded413 and a successful reconnect for the next403, including headers and safe request log. A response header alone does not demonstrate closure; unbounded draining is unacceptable.

## Executable preparation

`m80-beta-access-independent-20260925-c2-checks.ts` exports helpers and performs no native work on import:

- Target-checked legacy row hashes/counts and metadata hashes for schemas, relations, columns, functions, constraints, policies, indexes, triggers, enums, roles, memberships and defaults. Capture before install, after exact replay and after test cleanup. Only explicitly new owner/runtime records are excluded; separately classify beta-FK triggers on old companies. No row/identity/token contents are exported.
- Full owner/runtime privilege inventory, including both membership directions, direct cross-schema privileges, exact function owners/ACLs/search paths and new-owner default ACLs.
- A committed benign future helper created under the new owner; require real restricted-login SQLSTATE42501, then remove only that QA probe.
- A bounded raw chunked2049-byte socket request that verifies413, no-store, Connection-close and observed EOF without shutting down its own write side. Following normal client request must reconnect and receive the expected403 with security headers/log.

Only syntax transpilation was run. SQL, role transitions, socket behavior and assertions remain unexecuted until root supplies exact Candidate2 bytes/targets. Helpers may require adaptation to the frozen interface; preserve any first harness failure rather than attributing it automatically to author code.

## Remaining execution schedule

1. Verify frozen current/embedded bytes and baseline pins; assert new database/restore/runtime/owner absent. Fresh template0 plus fixed synthetic bootstrap only. Capture legacy baseline before installing beta. No old DB cloning.
2. Install/replay and compare full legacy state. Execute owner/default-ACL challenges, including deliberate wrong-owner/private-helper grant/role-membership/default drift under bounded rollback, then confirm actual readiness refusal and restore exact baseline.
3. Repeat existing native success suite against Candidate2. Add deterministic barriers for revoke-first and admission-disable-first, actor identity changes before and after identity locks, plus same-connection transaction-local identity cleanup across A/B/signed-out/error. No sleeps as race-order evidence.
4. Test temporary/search-path shadows and direct private-helper calls from restricted runtime. Verify confirmed/unconfirmed/disabled provider response adapters and auth error/timeout behavior using bounded local mocked responses; no real provider claims.
5. Exercise raw413-close/reconnect403, 2048/2049 and multibyte limits, forbidden origin, method/content-type, safe logs and rate bounds. Do not suppress listener-level failures.
6. Native dump/restore only into the exact new restore target; archive path must be private `.superpowers`. Record archive/state hashes only. Verify active, pending, consumed, revoked and tombstoned authority after explicit target rebind and cross-tenant denial.
7. Recheck source bytes and legacy parity, freeze results and issue an exact Candidate2 verdict. Full acceptance requires remaining criteria, not merely F01/F02 closure. Four method holds and hosted/customer readiness remain separate.

Cost and observed compute remain unknown. Owner: independent security reviewer; root owns correction routing, additional target authorization and publication.
