# M55 — synthetic electricity bill evidence intake

**Status:** Complete; independently accepted for the bounded local synthetic scope
**Date:** 2026-09-13
**Board direction:** Proceed after acceptance and publication of M54

## Demonstrated outcome

M55 extends the local M54 tenant workspace with one fixed fictional electricity statement. A signed-in synthetic owner can preserve the exact original PDF, run a deterministic extraction, explicitly assign the authorized facility, save a reviewer correction as immutable version 2, and pin that version to the existing 2023 draft boundary. The final state reads **Draft evidence — no emissions calculated**.

The fixed journey is:

1. Preserve `neuvetra-m55-synthetic-electricity-bill.pdf`, exactly 4,605 bytes with SHA-256 `0a97cd0976c03af0776214fc19bdc3d4f0c00e9c835f3e116574a6f375c8e135`.
2. Extract the fictional utility, account, bill number, January 1–31 service period and `12,345 kWh` with local deterministic code.
3. Keep facility unset and label the record `needs_review`.
4. Require the user to choose **Synthetic California office** and record the deliberate `12,346 kWh` reviewer override with reason **Synthetic review exercise**.
5. Preserve version 1 and append version 2.
6. Link version 2 as `12.346000 MWh` to the version-1 2023 operational-control draft.
7. Revisit the exact history and link without rerunning extraction or changing the pinned version.

Duplicate intake, correction and linkage return the existing result without creating another original, version or activity. A signed-out request fails authentication. A foreign tenant receives the same absent result as an unknown record.

## Implemented boundary

- Seven bill-owned and derived tables carry `company_id`, enabled and forced row-level security, composite tenant foreign keys, explicit read grants and no direct authenticated write grants.
- Three fixed-purpose database functions derive the actor from authentication and permit changes only to an owner or administrator of the target company.
- The original PDF bytes, digest, filename, type and size are immutable. The extraction is tied to parser version `m55-fixed-pdf-v1`.
- The browser sends only the exact file, reviewed facility/correction values and existing boundary identifier. It stores only opaque workspace and evidence identifiers locally.
- The API validates finite request and response shapes, checks browser origin before state access on writes, authenticates before lookup, and returns bounded errors.
- The M55 surface requires both `M54_SYNTHETIC_WORKSPACE=enabled` and `M55_SYNTHETIC_BILL=enabled` in an exact development or test runtime.
- The development component and fixture are absent from the ordinary production build.

The integrated implementation follows the CPO's accepted `12,345 → 12,346 kWh` product journey. It intentionally uses a real one-page PDF and a tenant-scoped database summary cache instead of the proposed CTO text fixture and null cache, while retaining exact-byte validation and tenant isolation. The cache is an isolation exercise only: `readBill()` does not consume it, and cache-hit or performance behavior is unmeasured. This variance is part of the independent review scope.

## Verification evidence

- Focused database/API/browser-contract suite: 40 tests, 176 assertions, pass.
- Full API suite: 623 tests, 5,342 assertions, pass.
- Full web suite: 56 tests, 196 assertions, pass.
- Full database suite: 18 tests, 101 assertions, pass.
- API and web type checks: pass.
- Web lint and production build: pass.
- Production output scan: M55 filename, correction reason, quantity, flag and bill route absent.
- Database challenge: all seven M55 tables have enabled and forced RLS; an outsider sees zero rows in all seven; authenticated direct updates and deletes fail; exact stored bytes rehash to the pinned digest; altered bytes fail even with a claimed pinned digest; cross-company facility and boundary substitutions fail; the same digest remains isolated when both tenants ingest it.
- Composed API journey: exact multipart intake, changed-file refusal, idempotent second intake, stale-edit refusal, administrator correction and draft linkage, idempotent repeated link, member read-only behavior, outsider 404 and signed-out 401 pass against the real SQL-backed store.
- Browser demonstration from a clean in-memory database: create, intake, review, link, outsider refusal and owner revisit pass. The rendered final view shows the original and reviewed versions, selected facility and version-pinned draft label.
- Temporary listeners and preview artifacts were removed after the demonstration.

## Limits

This is a development-only, memory-only, single-fixture workflow. It does not support customer documents, arbitrary utility formats, OCR, malware scanning, durable job scheduling, hosted database or object storage, factors, emissions calculations, filing, assurance, production deployment, merge or release. The synthetic correction demonstrates review lineage; it does not assert that the changed value is truer than the fictional statement. Stage 4 and release acceptance remain false.

Changed, unsupported or parser-inconsistent bytes are rejected before persistence. Because the only admitted digest maps to the exact known fixture, M55 has no reachable terminal failed-extraction row. This is an explicit variance from the broader failure-state acceptance case in the CPO brief; a persisted failed job and retry lifecycle remain future work before arbitrary or customer document intake.

The final independent review passed all 26 exact file bindings with zero material open findings. M55 is ready for publication to the existing open pull request. Stage 4 and release acceptance remain false.
