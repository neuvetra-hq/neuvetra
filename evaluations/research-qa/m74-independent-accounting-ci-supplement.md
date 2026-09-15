# M74 independent accounting CI adaptation supplement

2026-09-15; task M74-ACCOUNTING-CI, reviewer/test author `/root/m72_ops`. Reused context; inherited compute settings unknown. This is a test harness change, not independent review of that change. Root owns its review and CI wiring.

The existing native test accepts explicit `M74_ACCOUNTING_TEMPLATE_DATABASE`; absent configuration retains `m74_author_backend_20260915c`. Before any database connection, identifiers must have the `m74_author_` prefix, lowercase ASCII letters/digits/underscores only, no surrounding whitespace, and total length at most 63. The source is used only as a PostgreSQL template. A fresh UUID-named `m74_qa_accounting_*` clone is still mandatory, and the selected template is retained in the receipt. Candidate pins, numeric oracle and all assertions are unchanged.

Executed the final revised test with the explicit local template: **2 passed, 0 failed, 254 assertions, 30.57 seconds**. New database: `m74_qa_accounting_5c89d10a96704443807390daa3b3ffe4`. It covered the same 11 vectors, 10 null cases, 12 refusals, five single-field successors and 28 versions. The local source database remains unchanged. This is local evidence, not a claim that CI has run.

Separate module-load checks refused five invalid configured values before tests/database access: SQL separator, non-M74 database name, overlong identifier, trailing newline and empty string. `m74_author_ci` passed the guard with an intentionally unmatched test filter, without cloning/accessing that database. The initial check harness incorrectly treated Bun's expected nonzero exit for zero matching tests as refusal; inspection confirmed the guard accepted the valid name, and the corrected harness checked the specific no-match result. No product defect was involved.

The previously accepted review and snapshots are preserved; this supplement records the new test identity. No product, source expectations, numeric oracle, hosted state or global database role changed.

## SHA-256 evidence

- `evaluations/research-qa/m74-independent-accounting-native.test.ts`: `2f45a9c7c44b178777dc7a8d20b6385ed707e53e7be3f005801b169f6ce059a3`.
- `evaluations/research-qa/m74-independent-accounting-native-m74_qa_accounting_5c89d10a96704443807390daa3b3ffe4.json`: `3d1b00c9e8413889e199c972bc5a5cb730d23168dcb8ca88d11daf0e8d525fa3`.
- `evaluations/research-qa/m74-independent-accounting-review.md`: `a5adbbddd8c206710d74eb6897ecf440b1abd141b5da3ffe5c1be2a62df22fdf`.
- `evaluations/research-qa/m74-independent-accounting-expectations.json`: `1068fba315aa68d517bb29532a23d9c9e3ab1ddd47f8ee075aa609a23d42724b`.
- `evaluations/research-qa/m74-independent-accounting-oracle.py`: `b0dfd69cf9482dea1022b2b1b9b6834ae45a45322813c891b244a822583b27e4`.
