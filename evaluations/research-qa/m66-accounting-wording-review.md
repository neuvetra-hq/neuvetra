# M66 independent accounting wording and numerical presentation review

September 14, 2026. **PASS for the exact renderer, UI wording and frontend correction-decoder bytes below, after the recorded clarifications.** This bounded review does not establish SQL/native PostgreSQL upload/lineage behavior, hosted browser operation, rendered print layout, security acceptance or milestone completion.

Reviewer: reused accounting-validation context, requested Astra/high, actual inherited runtime settings unknown. Prior M64–M66 accounting contract/case authorship is disclosed. The reviewer authored no M66 product code. Root owns UI edits; CTO owns server/template edits; independent QA owns integrated technical acceptance.

## Exact evidence

| Artifact | Raw local SHA-256 |
| --- | --- |
| `packages/neuvetra-database/src/m66-template.ts` | `226ac0b125f1cf8cd4d390fdd715bf7c647b440f5ab571c77c4524e1b0f5bac9` |
| `packages/neuvetra-database/src/m66-report.ts` | `0efacc1b94280cbf960e8c755b208499416dc114fd0405fdb4d956e36a8903d0` |
| `apps/site-web/src/components/SourceElectricityWorksheet.tsx` | `0c606367c713afb9905a854e07cfb73d41c8fb4c515e227620bc796c1b129d61` |
| `apps/site-web/src/lib/m66-api.ts` | `11cbf0b6528e37259c6e330c58ce8cd8f41abd4d7ae11f141f6a49966ad823ae` |
| `evaluations/research-qa/m66-accounting-wording-check.ts` | `0222dd92f75cc905ae16392577420239804fb31f553fa850b96f87837ecd7322` |
| `evaluations/research-qa/m66-accounting-wording-results.json` | `f46f581c452b8e4cb09fe9e6d0d1623e0a5aa901f3bad6e04b3920324d162928` |
| `evaluations/research-qa/m66-accounting-wording-initial.json` | `51647129aa74a0207255d05def6b8fb44295bb0563ac4481789136251d0af979` |

The initial findings receipt preserves the observed strings and findings, but its checkpoint hashes were taken after messages reached active writers. Template/UI fixes had already arrived by hash capture. Those hashes must not be presented as immutable pre-repair defect versions. Final acceptance is bound to the successful execution receipt and hashes above.

## Findings and disposition

- **M66-ACC-W01, repaired — worksheet decision versus source authentication.** QA flagged, and accounting independently confirmed, that the initial report had only M65's generic worksheet-review/report-approval disclaimer. CTO added the approved source-specific meaning: the manager decision covers recorded manual confirmation and does not authenticate the fictional bill or approve presentation. Final rendered output contains this qualification.
- **M66-ACC-W02, repaired — ambiguous download status.** The UI initially called the PDF verified without specifying byte integrity. Root changed it to `PDF byte integrity was checked and the file downloaded. This does not verify its contents.` This accurately describes the hash/length check without upgrading document authenticity.
- **M66-ACC-L01, repaired — explanation-only correction rejected by frontend.** The frontend initially rejected a successor whenever source ID and quantity were unchanged, even if the discrepancy reason changed. CTO confirmed the server's effective-input tuple also includes labels and `quantityDifferenceReason`. Root aligned the frontend tuple. The accounting check executed the actual decoder on a valid synthetic reason-only successor and it passed. This execution is decoder evidence, not an independent SQL persistence check.
- **M66-ACC-U01, adopted — stale confirmation checkbox.** Root now clears the manual-confirmation checkbox when source, company/facility label, quantity or discrepancy explanation changes. This makes the attestation visibly apply to the final entry. Source inspection confirms the handlers; browser interaction coverage remains with root/QA.

## Executed numerical and text checks

`bun run evaluations/research-qa/m66-accounting-wording-check.ts` passed under Bun 1.3.12: **22 actual rendered HTML cases and one explanation-only successor through the actual frontend decoder**. Twenty cases cross the ten independently derived accounting quantities with both approved fixture identities; two additional cases exercise captured acceptance and changes-requested states. The record inputs are synthetic fixtures, not live saved tenant records.

The renderer consumes the expected numerical strings without recalculation. Checks verified canonical kWh/MWh, exact and four-place displayed kg CO2e for matching/equivalent `12345`, override `12346`, `25000`, explicit zero, minimum `0.001`, both half-even ties, the precision neighbor and maximum quantity. The source's printed `12345.000 kWh` remains visible beside the manually selected amount, and both source fixtures' digest/length/printed-value metadata match the independently approved case manifest.

Matching input is described as numerical agreement with the fictional printed amount, explicitly not independent verification. Differing input shows `Manual worksheet quantity differs from the bill:` with its escaped reason. The report includes page 1, confirming actor/time, exact retained PDF identity, manual versus automated/independent-verification distinctions, and a private authorized retrieval instruction. It no longer says there is no bill evidence; it says the retained bill is fictional and not real customer or independently verified evidence. That substitution is correct for M66 and does not change old M64/M65 reports.

The actual rendered reports preserve January/CAMX/location-based scope, annual-factor-to-January explanation, exact candidate/method/source/GWP pins, half-even/no-intermediate-rounding wording, incomplete other months/sources, and synthetic/unreleased/no-assurance status. Three captured worksheet review states remain explicit and never imply report approval. HTML fingerprint claims retain M65's distinction between snapshot identity, full HTML byte receipt and browser print/PDF bytes.

The harness also checked escaped company/discrepancy text, resolved fingerprint placeholders, absence of script elements, deterministic repeat rendering and report byte-hash agreement. These are bounded content checks, not a comprehensive sanitizer/security review. Print status and margin styling were inspected in source; no actual printed page was inspected in this assignment.

## UI wording disposition and limits

UI printed and entered quantities appear together, with a required discrepancy textarea when they differ and an explicit page-1 confirmation checkbox. Source replacement is described as a new version, historical sources/reviews remain visible, and a different manager is required for review. The rendered report is more detailed about source/review meaning than the compact worksheet card; the card's limitations/confirmation language remains consistent with it. The UI's `Number` comparison is only for showing/resetting a discrepancy field, not calculation; server canonical validation remains authoritative, and no emissions are computed with browser floating point.

The approved semantics are implemented in the reviewed presentation bytes. No open wording or presentation-accounting finding remains here. Changing any bound file requires targeted re-review. Upload byte enforcement, actual confirmation persistence, server no-op rules, concurrent review/correction, tenant/revocation behavior, native database/API/frontend integration, historic report preservation and live screen/print remain separate evidence requirements. No product files, cloud state, Git history or accounting factors were changed by this reviewer.
