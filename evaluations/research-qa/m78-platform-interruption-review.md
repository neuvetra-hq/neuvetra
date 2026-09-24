# Platform interruption: independent reconciliation and cleanup design

M78-PLATFORM-INTERRUPTION-REVIEW-01. Reviewer /root/resume_release, security-reliability independent incident review. September22,2026. Verdict: interrupted read-only baseline, four known session closures unresolved; no clean baseline or cleanup success.

## Actual evidence

Read-only evaluator verified exact main15-event SHA3ce68c3fc87e37623326badb88d412f2db36daceacf43060c5849f287a358507/head9762c119 and diagnostic30-event SHA8ae88cd344ab1a6376b91a63581c57c9c61c381eb57141e1b6a11ca7647eae08/heada7af0d5. Both hash chains parse. Fifteen request intents have14 header outcomes; the unmatched ordinal15 is GET scope1-inventory at18:49:57.528Z. No application POST intent appears. Four POSTs are password-token authentication. No legacy authentication, logout, attempt terminal or completed baseline is recorded. Original72/d330 and24/8525 journals still match their immutable hashes. The core clean-journal function rejects this interrupted journal.

| Role | Login intent UTC | Matched token outcome UTC | Diagnostic ordinal | Logout confirmed |
| --- | --- | --- | --- | --- |
| manager1 |18:49:12.648|18:49:13.155|3|No|
| manager2 |18:49:13.158|18:49:13.339|4|No|
| member |18:49:13.340|18:49:13.516|5|No|
| outsider |18:49:13.517|18:49:13.653|6|No|

All four outcomes assert200/tokenObserved/subjectMatched. Subject UUIDs and provider session IDs are not stored here; do not invent them from role names. There are zero unmatched authentication intents in this prefix, but that does not mean zero unresolved active sessions: four known issued sessions lack cleanup evidence. Their current provider state is unobserved.

Root reports no matching Bun process at19:57:27 and reports setting diagnostics read-only after the requested pause to trigger fail-closed cleanup. The supplied immutable resume observation records journal state, not process enumeration or the exact attribute-change timing. Platform interruption and cleanup timing cannot be independently resolved from these bytes. Do not attribute causality more precisely or infer cleanup ran. GET200 headers at ordinal14 establish no independently checked body or complete baseline. No retry, journal reset, save replay or schema action is justified.

## Minimal root-only read-only observer

Implement a new separately reviewed private observer; no login/refresh is needed. Root privately obtains exactly the four admitted roster UUIDs from its existing authorized configuration and fixed-project database connection from the established narrow wrapper. Neither passwords, tokens, connection URL, emails, user metadata, IPs, user agents nor arbitrary audit payloads enter output. Fail if roles are missing/duplicated or UUIDs are not exactly the admitted roster.

Use one read-only transaction and bounded statement timeout. Discover schema before choosing queries; inspect only column names/types and relevant FK definitions:

```sql
begin transaction read only;
set local statement_timeout = '10s';
select table_name,column_name,data_type,udt_name
from information_schema.columns
where table_schema='auth' and table_name in ('sessions','refresh_tokens')
order by table_name,ordinal_position;
select conname,pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in (to_regclass('auth.sessions'),to_regclass('auth.refresh_tokens'))
  and contype='f';
select current_database(),current_user,transaction_timestamp(),
       current_setting('transaction_read_only');
```

Require expected fixed provider/database identity via the existing reviewed connection boundary. If tables/columns/types differ, stop and return a sanitized schema-only result for review; do not guess or expand to auth.users/raw audit payloads. After confirming UUID and timestamp column types, parameterized projection for the exact four users:

```sql
select id,user_id,created_at,updated_at
from auth.sessions
where user_id = any($1::uuid[])
order by user_id,created_at,id;
```

This returns metadata for these test users' candidate and pre-existing sessions, allowing preservation of browser/other sessions. Bound result count and refuse truncation. Classify candidates against each per-role login window above. A small explicitly reported search margin for client/provider clock difference may find candidates, but expanded-window membership is not identity proof. Require one unambiguous session for each role, matching server creation time and available exact correlation evidence; report multiple/zero matches without choosing the nearest/newest. Do not manufacture audit session identity. If time plus uniqueness is the only evidence, label attribution as candidate rather than confirmed and return it for the separate cleanup review.

Only if schema confirms refresh_tokens.session_id and revoked semantics, collect counts, never token values:

```sql
select session_id,count(*) as refresh_rows,
       count(*) filter (where revoked is true) as revoked_rows,
       count(*) filter (where revoked is false) as nonrevoked_rows
from auth.refresh_tokens
where session_id = any($1::uuid[])
group by session_id order by session_id;
commit;
```

Parameter here is the explicit candidate session-ID list, not all user sessions. Record null revocation count separately if nullable. Foreign-key metadata identifies whether refresh rows are session-linked; do not infer it merely from a similarly named column. Record before-state metadata for every other session of the four users. Optional broader preservation fingerprint may aggregate only session IDs/user IDs and timestamps without exposing rows, but legitimate concurrent activity must be distinguished from intended cleanup; no assertion of unchanged unrelated state without evidence.

The observer emits a new exclusive, sanitized receipt with source/pin/run hashes, fixed project, exact roster subject IDs, time windows, candidate session IDs and metadata, counts, ambiguity flags, and explicit no-writes. It must refuse existing output. No tokens, auth audit payloads, metadata bodies or IP projection is necessary. Root requests independent exact-source review before executing it.

## Later cleanup and next baseline admission

Read-only observation does not authorize an inferred blanket logout. A separate reviewed cleanup must target only explicitly attributed session IDs with unchanged expected user/creation metadata and guarded row counts; preserve all nonselected sessions and retain before/after receipts. Prefer a supported exact-session revocation primitive if verified available. Do not assume a user-wide admin logout is session-specific. If the original token were privately recoverable and demonstrably belongs to the exact session, local-scope logout could be considered separately; a new login would create a different session and cannot clean up the lost one. Do not recover passwords/tokens from memory or broad logs for this task.

If no unique attribution or supported exact-session operation is established, return unresolved rather than revoke browser/user-wide sessions. Missing session rows or revoked refresh rows alone do not prove every previously issued access token is unusable; actual auth validation/expiry semantics need separate source/provider evidence before such a claim. Report precisely the session/refresh outcome actually observed.

After independently accepted exact-session cleanup or a justified observed expiration/revocation disposition, preserve interrupted journals permanently. Any next baseline needs a newly reviewed parent-interruption adapter/admission, new exclusive filenames, fresh exact runtime/source/CI checks and explicit0 applicationwrites. Never append invented logout/terminal events or reuse continuation2 as though it completed. The unchanged37 recipe can only follow a genuinely completed new baseline and its independent review; no repeated initialsave/SQL21.

## Review boundaries

Actual evaluator executed locally with no provider/auth/DB calls. Requested inherited compute gpt-6-astra/high; actual runtime settings unobservable. Own evaluator/result/report/run/snapshot only. Root owns observer implementation/execution, cleanup decision, Git and shared operations. The previous next-session leading section is stale regarding actual execution and does not override the observed interrupted bytes.
