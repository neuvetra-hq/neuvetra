# Failed cleanup: read-only postobserver admission and diagnostic plan

M78-INTERRUPTED-SESSION-POSTOBSERVER-01. Reviewer /root/resume_release; root authored private sources. September22,2026.

## Immediate source admission

Accept exact postobserver446365e4f9eed95347fcf67cefdf55e24bec343ae234ac95fde239cfb3ca69a2 and wrapper28805aadc790ee2b8a22c674f9f77dfdb13422bcbc4c4f5c0d80868fa05f2eed for a single read-only reconciliation. All raw hashes checked. Normalized source diff shows only output filename m78-interrupted-sessions-after-cleanup-attempt.json; wrapper changes only fixed script path/hash. Raw substitution equality initially rejected line-ending differences, then decoded line-by-line comparison established no logic change. Existing accepted fixed15/30 guards, four-subject scope, metadata/count projection, readonly transaction/TLS,1001bound, secret suppression and exclusive output remain unchanged. No full mocked suite repeated because behavior is identical.

## Failed-attempt uncertainty

Root reports one V2 attempt exited1 after5.9seconds, exclusive intent30aa7e0076dd3e37fce77c74df632e81fed41624b2e000278bc37a68e0d24f28 exists and success result does not. This does not establish rollback: precondition/transaction failure and committed cleanup followed by output failure both remain possible. Do not retry, remove intent or change original journals. New metadata must establish whether exact four selected sessions/linked rows remain. The read-only observer cannot by itself prove all application/nonselected snapshot postconditions if a committed result was lost; a separate bounded observer would then be required.

## Minimal additional read-only diagnosis if sessions remain

No exact SQLSTATE/stage was retained; permissions42501, FK/trigger/no-drift guard, statement timeout, serialization and inventory failure are hypotheses, not findings. Root can author a separately reviewed diagnostic observer using fixed project/identity and read-only transaction, exclusive output, phase labels and sanitized SQLSTATE only. Do not emit raw errors/query values/connection strings.

Safe probes:

```sql
select current_database(),current_user,
       current_setting('transaction_read_only'),
       current_setting('transaction_isolation');
select x.table_name,
       has_table_privilege(current_user,x.table_name,'SELECT') as can_select,
       has_table_privilege(current_user,x.table_name,'DELETE') as can_delete
from (values ('auth.sessions'),('auth.refresh_tokens'),('auth.mfa_amr_claims')) x(table_name);
select tgname,tgenabled,tgrelid::regclass::text as table_name
from pg_trigger where not tgisinternal
and tgrelid in ('auth.sessions'::regclass,'auth.refresh_tokens'::regclass,'auth.mfa_amr_claims'::regclass);
```

Re-read exact two incoming cascade FK definitions and fresh four fixed session metadata including raw timestamp text. Compare counts/guard booleans against4570 without DELETE or EXPLAIN ANALYZE. If necessary invoke the existing inventory(tx) helper within the read-only diagnostic transaction and emit only succeeded/failed stage plus inventory digest, not rows. This can localize an inventory-read permission/time-budget failure. Table DELETE privilege is only a diagnostic hint: it does not execute or guarantee a delete with RLS/triggers, and missing privilege is not authorization to grant it. No GRANT/schema/auth mutations.

Future mutator, only after this failed attempt is reconciled and separately reviewed, should preserve safe stage/SQLSTATE/guard-label outcome outside its transaction with explicit commit-known/unknown state. Never log raw exception text. Current failure remains preserved; changing diagnostics does not retroactively establish its cause.

Actual auth/session state remains pending root postobservation. No host/auth/DB execution by reviewer. Own new report/result/run/snapshot only. Requested inherited gpt-6-astra/high; actual settings unavailable.
