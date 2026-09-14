# M64 — Guided electricity entry and a versioned draft worksheet

Status: planned; implementation has not started. Product owner: CEO coordinator acting as CPO. Technical sequencing: CTO. Independent acceptance: QA, with accounting review before calculation changes.

## User outcome

An invited tester can enter a fictional company/facility and a January 2023 California CAMX electricity quantity, save it, correct it with a reason, and see a reproducible location-based draft subtotal. A second manager reviews an exact saved worksheet version. This advances the current fixed demonstration into a small usable input workflow.

## Supported boundary

Use a new explicitly synthetic input profile. Keep the existing M63 fixture contracts, original report and review intact. The first profile supports manual kWh entry for one facility, one month (January 2023), one geography (CAMX), and the existing pinned candidate electricity method only. Every view preserves synthetic, incomplete, unreleased and no-assurance status. No customer uploads, arbitrary PDF extraction, new factors/geographies/years, Scope 1/3, market-based electricity, billing, filing, or generalized annual reports/archives in this milestone.

## Sequence and ownership

1. Accounting validation: approve the variable-input policy, decimal precision, maximum range, zero versus missing behavior, rounding, and independently derived expected cases. No method widening before this evidence exists.
2. CTO and data/engineering: define the new profile and server contract, tenant-scoped immutable versions, correction reasons, idempotency and exact input/result hashes. Reuse verified sign-in and database boundaries.
3. UI engineering: guided entry, clear validation, saved version history, deterministic subtotal and exact-version manager review. A correction must never inherit acceptance of the earlier version; preserve the historical decision and require review of the new version.
4. Independent QA: test real PostgreSQL through the actual frontend decoders, then the signed-in hosted browser. Challenge member/outsider access, invalid inputs, changes after review and persistence after revisit. Re-run the existing M63 saved-workflow regression.

Role assignments are dispatched only when their dependencies are ready; this document is not a running worker. Existing role defaults and critical-case escalation remain in force. Record requested and observed compute separately; do not invent cost or token measurements. Work stays on the existing rolling PR4 branch.

## Demonstration and acceptance

- Enter a fictional facility and allowed quantity; the server saves an immutable version with explicit unit, period, geography, pinned method/factor and exact decimal result.
- Sign out and back in; revisit the same saved values and hashes through the real browser.
- Correct quantity with a reason; retain the original, create a new version and show the independently expected changed subtotal.
- Review one exact version with a distinct authorized manager. After correction, show that the old acceptance does not approve the new version.
- Reject missing, malformed, negative, excessive-precision, out-of-range and unsupported period/geography/unit inputs according to the independently approved policy. Treat explicit zero distinctly from missing evidence.
- Members can read but cannot change or approve. Test an active invited actor belonging to a second company, as well as an uninvited outsider and signed-out requests; none can retrieve the first company worksheet or derived data.
- Duplicate or concurrent correction retries produce one immutable version and one audit event, and never transfer the old review to the new version.
- Preserve the existing M63 report/review hashes and qualifications. Pass relevant tests, independent review, current PR checks and hosted demonstration, then collect board feedback before dependent work.

## Operational limits carried forward

Use the existing hosting without a new subscription. Preserve health checks and sanitized logs; take an encrypted backup before schema changes. Portable off-device recovery, provider Auth restoration, proactive alert delivery and scheduled backups remain separate readiness gaps before customer launch. This milestone does not claim to resolve them. An API-only pass cannot establish browser acceptance (M63-F03/L04).
