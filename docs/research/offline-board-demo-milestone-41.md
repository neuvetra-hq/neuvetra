# M41 offline board demo

September 11, 2026. M41 packages the three independently accepted purchased-electricity behaviors into one local board-review flow. It is a preserved reviewed replay, not a live question service. It starts no research API or provider process and makes no paid request.

The fixed scenario order is:

1. **W11 — More context is needed.** The exact M35 response asks what the referenced company subject means and makes no company-specific claim.
2. **W03 — Supported, with qualifications.** The exact M39 response presents all three reviewed units, labels U03 as reviewed interpretation, cites EPA PDF pages 4 and 9, and preserves the company, legal-duty and instrument-eligibility limits.
3. **EPA14-B01 — More source coverage is needed.** The exact M40 response returns no claims, evidence or sources and preserves the unresolved phrase `specified renewable energy purchases`.

The page verifies each copied response byte stream against its accepted SHA-256 before parsing and validates status, reason, release, counts and order. A missing, altered or invalid artifact displays **Reviewed replay unavailable** and never substitutes generated or mock content. Full response, terminal-QA and closure-QA hashes are inspectable in the page. The M35 conservative emergency closure, M39 fail-closed supervisor outcome and M40 ordinary closure are disclosed separately from each accepted case result. Release acceptance is false.

The replay is available only in a development build when `VITE_RESEARCH_BOARD_DEMO=preserved-results`. It is lazy-loaded and its three diagnostic payloads are excluded from an ordinary production build. Root inspection found no copied artifact or diagnostic question/hash in `dist`.

Validation passed all 45 site tests / 165 assertions, TypeScript, lint, the production build and diff checks. Browser review passed at the default panel width and 390 × 844 mobile viewport, with no horizontal overflow. The fixed scenarios support arrow, Home and End keyboard navigation. A Chrome DevTools request capture on a fresh reload recorded only localhost assets, exactly one GET for each preserved response, no external request and no `/research-api/answer`, OpenRouter or Anthropic endpoint. Ports 3012, 3016 and 5175 remain closed; only the offline Vite front end is intentionally available at `http://127.0.0.1:5174/?view=demo` for board review.

Independent QA rehashed all 19 source/evidence bindings with zero mismatch, reproduced the test/build and browser results, and accepted M41 as a local demo milestone. The review is `evaluations/research-qa/milestone41-offline-demo-review-10.json`, SHA-256 `7e8167c6c97b15b4bf2da09e0553b962edb91139529c3900b7267c1811f3acca`. This acceptance does not authorize deployment, source expansion, a paid request, merge or release.

## Pilot boundary and next decision

The page states the current boundary directly: selected EPA purchased-electricity guidance only; no calculations, factor selection, legal-duty or instrument-eligibility determination, company data, customer-isolation proof, expanded source rights or production readiness.

The next gate is board feedback on the visible local flow. Stage 2 release remains open. A dependent product milestone should be selected only after that feedback; likely choices are targeted usability refinement within the offline replay or the separately gated deterministic inventory slice. Any source expansion, live answering, deployment or customer-facing work requires its own current evidence and authorization.
