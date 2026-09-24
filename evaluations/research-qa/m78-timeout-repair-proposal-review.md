# M78 timeout repair proposal — independent lock-path review

Reviewer `/root/resume_release`, M78-PERF-PROPOSAL-REVIEW-01, security-reliability. Requested Astra/high; inherited observed compute unknown. Independent of proposal/runtime author. Exact proposal SHA f69dab907878ce7fa12bb4bda6cf8e568063eeea0834f6823cf3bbc8cc163594. Source-only review: no database/host/journal/Git operation or product edit.

**Accept the bounded two-file implementation proposal, subject to actual integrated independent QA. No blocking supported-writer lock escape found.** This is permission to implement within root's assignment, not acceptance of unwritten code, latency, live continuation or a reconstructed missing response. Frozen failed72event attempt remains untouched; root must reconcile its unknown outcome separately.

## Source lock-path evidence

M78 beforeWrite calls m78_lock(company,true) before state. SQL21 m78_lock calls m71_lock and takes company FOR UPDATE plus ordered Scope1 heads; lock lives to transaction end. m71_lock takes active actor staging_access and company_members FOR SHARE first and checks company/manager. Its native writer entry m78_request repeats the lock. Each save_scope1_version/review_scope1_version/create_scope1_report calls m78_request before mutation; m78_record_request is private and only records inside that locked path. M78 writes touch only its own Scope1 tables.

Audited all20 supported upstream mutators in migrations15–20, including report writers because state reads reports:

- Corporate save/review: m71_lock(true), then same company FOR UPDATE (SQL15:159–160,196).
- Natural gas save/review/report: m71_lock(true), company FOR UPDATE, corporate/head locks (SQL16:49,83,102); m73_lock follows same order.
- Mobile diesel save/review/report: m71_lock(true), company FOR UPDATE, corporate/head locks (SQL17:56,70,90); m74_lock follows same order.
- Controlled fleet save/review/report: m75_lock(true), company before corporate/fleet/mobile heads (SQL18:13 and writer entries).
- Stationary diesel save/review/report: m71_lock(true), company before corporate/head locks (SQL19:93,133,143); diesel lock SQL19:90 same order.
- Stationary equipment save/review/report: m76_lock(true), company before corporate/equipment/gas/diesel heads (SQL19:188 and writer entries).
- Fugitive workpaper and population save/review/report share native writer functions, all m77_lock(true), company before corporate/fugitive heads (SQL20:19 and70/88/103 entries).

Each affected family revokes direct runtime/public/authenticated DML and grants runtime SELECT plus bounded native writer entrypoints. Immutable-history triggers reject update/delete. Reservation inserts occur inside locked native save procedures; cross-mobile/stationary fuel evidence trigger SQL19:390 checks consistency and adds no independent mutation path. No earlier migration can write these later-created family tables, and SQL21's six altered invoker functions change search_path only. This source audit covers supported runtime mutations, not privileged administrative edits, role DDL or dynamic untrusted code.

Therefore a privately captured upstream graph after acquiring this company lock cannot be changed by another supported writer until commit. Concurrent readers and other-company work do not justify global caching. Actor access/member share locks retain admitted authorization until completion; revocation-first must refuse admission. Preserve actor/access→company→head order and distinguish an upstream writer already admitted and waiting from one started after revocation.

## Required implementation boundaries and adversarial QA

Keep reused graph private to one actor/company/transaction/authority/policy scope; no exported optional trusted graph, shared mutable cache or cross-request lifetime. Do not mutate captured upstream objects during pre/post verification. Reload every M78 row after native writes, recheck all proofs/reports/histories/requests/audits and capacity, and return verified stored records. Any post-write verification failure must roll back. SQL/method/timeout/limits and GET paths remain unchanged.

Removing route preflight must retain early grammar/origin/auth/staging/method/manager denials and exact under-lock company/stream/family selection for direct backend callers. Explicit bounded missing/wrong stream errors must not map generic integrity failures to404. Challenge null initial stream versus existing head, wrong-family/foreign streams, report/version identity, and mixed malformed-body/wrong-stream cases; document any unavoidable validation-order difference rather than claiming byte-identical denial ordering without evidence.

Independent native two-connection tests must hold a real barrier after capture and attempt competing corporate, source and discovery mutation; same-company writes wait/refuse, then changed head/dependency conflicts hold. Cover second initial inventory writer uniqueness, another tenant's independent progress, revocation-before and revocation-after admission, original idempotency exactly-once on a fresh fictional fixture, forced post-write verification rollback and history/capacity/captured-null corruption checks. No test may retry the actual unknown hosted request.

A separate bounded local wrapper must measure before/after same-dataset request-stage cost including early and retained-history saves/reviews/reports; verify one upstream capture and fresh two-stage M78 validation. Existing correctness/source-maps/native tests and independent code review remain required. Demonstrated local improvement does not prove hosted30second success. Root must preserve outcome reconciliation, reviewed publication/sixchecks/deployment and separately admitted nonduplicating continuation. Proposed25second margin remains a criterion to measure, not an achieved result or SLA. No user permission wait beyond standing authorized work is introduced.
