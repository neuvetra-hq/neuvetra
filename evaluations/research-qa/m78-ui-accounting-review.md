# M78 provisional UI accounting review

Task M78-UI-ACCOUNTING-01; independent reviewer `/root/m78_security`; root authors the frontend. Requested critical accounting-validation Astra/high; actual inherited settings unknown. Read-only source review against accepted accounting candidate2; no frontend/backend edits or browser/runtime claims. Drafts are changing, so this is not frozen integrated acceptance.

## First draft findings and resolution

1. **UI-ACC-01 — gas CO2e field mismatch.** `apps/site-web/src/components/Scope1Totals.tsx` reads `line.co2eKgExact`, while `M78Totals.gasLines` exposes `kgCo2eExact` in `packages/neuvetra-database/src/m78-contract.ts`. The table would omit the gas CO2e value or fail typechecking. Render the actual declared field and recheck the decoded response.
2. **UI-ACC-02 — source identity is ambiguous.** The shared rollup table shows only `row.label` for source rows. Distinct same-named sources at different entities/facilities therefore cannot be distinguished in the numerical source list. Use the authoritative `sourceRows.id` mapping to show entity/facility and stable physical context, preserving both same-named distribution locations. Facility rollups already append their owning entity.
3. **UI-ACC-03 — source estimate basis is missing beside results.** Generic candidate-method wording does not disclose which source uses default HHV or estimates leakage from servicing. Source contributions should identify the stationary-diesel default-HHV estimate and fugitive servicing-balance estimate/annual timing uncertainty, using the retained source version/proof. The backend contribution type retains `estimateBasis`, but the aggregate rollup shape does not; do not invent an activity interpretation from a display name.
4. **UI-ACC-04 — rounding delta direction is ambiguous.** The policy defines company displayed total minus sum of displayed source values. The current phrase “difference between summed source displays and the company display” does not specify that direction. Use the defined order and explicitly label the value as display rounding, not an emissions adjustment.

## Semantics currently preserved

- A null full total falls back only to the named known-source subtotal; missing/unsupported sources are explicitly not zero. An unavailable compatible subtotal produces no number.
- R-410A is labeled as blend mass and the UI says constituent quantities were not inferred.
- Totals use gross labels, retain unreleased-method/no-assurance wording, and show functional blockers plus wider corporate/release gaps.
- Discovered unmatched sources remain visible; no frontend aggregation or offset deduction is performed.

## Seven-gas draft review after root's ready signal

The four findings above preserve the first observation. In the next draft, UI-ACC-01 is resolved by `line.kgCo2eExact`; UI-ACC-02 is resolved in totals by entity/facility/physical source labels; UI-ACC-04 is resolved by the explicit company-minus-source order. UI-ACC-03 now has the two family-specific estimate disclosures directly below source results. Attaching the estimate label to each applicable source would improve traceability, but the generic paragraph no longer hides those estimation assumptions. These are source-review resolutions, pending rendered/decoded integration checks.

Two actionable editor findings remain:

1. **UI-ACC-05 — entering multiple discovered identifiers is broken during ordinary typing.** `ProcessScreenEditor.tsx:64` serializes the controlled input with `join(', ')` while each keystroke immediately applies `split(',').map(trim).filter(Boolean)`. Typing `source-a,` becomes `source-a` on rerender, removing the separator before a second identifier can be entered. Pasting a complete list avoids this, but is not an adequate entry flow. Retain raw draft text until normalization on blur/save, or offer one stable identifier per input row. This matters because multiple additional gas sources must stay separately represented.
2. **UI-ACC-06 — gas-source choices lack facility/physical identity.** `ProcessScreenEditor.tsx:66` labels source checkboxes with source name and owning entity only. Same-named sources within one entity at different facilities are indistinguishable. Include facility and physical-source identity, using the same authoritative mapping now present in totals. A gas applicability assertion must bind the intended physical source.

The seven-gas design otherwise meets the source-level accounting intent: `m78-form.ts:10` initializes exactly CO2/CH4/N2O/HFCs/PFCs/SF6/NF3 as unknown, empty links, and unconfirmed discovery. The editor offers unknown, indicated, proposed non-applicability, and covered-by-listed-sources separately. It does not enter quantities or turn blank fields into numerical zeros. Explicit location/off-site scopes, source links, evidence issuer/date/purpose/scope, and discovery confirmation are available. Blank lists do not establish absence, the evidence is labeled fictional, and manual confirmation explicitly grants no acceptance. The gas guidance includes direct gas use and electrical equipment.

The backend's current `m78-validation.ts:26,35` requires exactly seven groups and refuses removal/reclassification of previously indicated gas-source identities. The editor allows those attempted edits, so a retained-source explanation or disabled existing tokens would improve usability; the current server refusal prevents a source-review claim of silent omission. Editing an evidence reference after selecting it leaves stale reference strings in dependent scopes; current findings logic rejects unresolved evidence rather than accepting it. Clear inline feedback or remapping unsaved references would avoid confusing resubmissions. These are follow-up usability observations, not evidence of an accepted incomplete inventory.

Role-specific action eligibility, decoder handling, actual controls and error messages remain outside this component-only draft review because root is still integrating the main UI. No rendered screen, numerical response or browser interaction was tested here. This report is provisional until those files and dependencies are frozen.

The current totals source was inspected at SHA-256 `46dcb83f494f021f4478445264837128fd69504f4536f5b8e26fd7ecde58148c`. This hash is a dated draft observation, not a pin for later acceptance. UI rendering, actual response decoding, click/download behavior and narrow-screen/print checks remain separate integrated QA.

Current second-draft read pins (SHA-256):

- ProcessScreenEditor.tsx: 25fc6c7026a11a76504bef7737110b18b380fd4afffce3fbb4a2af385afac012
- Scope1Totals.tsx: 5927f8d8b184ae47e7acb86195675dbda5166caa72c8cca27fcfec77f8afb6a5
- m78-form.ts: 5a57712d0e0ee1ba0718f7a0b8f5636c56886b94ed4b7a60269e0256344b6983
- m78-contract.ts: 5ba2ebe2f64715ea0dc0b8f9a27bc00e6e10889145034fe1f2fb52faf941fc08
- m78-validation.ts: 095a9ef6c279c3e4bdce72fd9839bcfe69f6a1cbc2c068f2b4a0e6bce7e4cad9

## Mounted inventory draft follow-up

Root requested a further read after mounting `Scope1Inventory.tsx` and changing the two editor controls. UI-ACC-06 is resolved at source level: gas-source options now include owning entity, facility and physical identity, with explicit unresolved identity wording.

**UI-ACC-05 remains open in a different form.** The uncontrolled `defaultValue` input normalized only on blur fixes comma typing, but the mounted form saves the React draft directly. Keyboard Enter in the input can submit without blur, leaving newly typed identifiers outside `draft.gasCoverage`. With an existing indicated identifier already present, adding a second one and submitting with Enter can retain the old valid list while silently omitting the new identifier. Moreover, `load()` replaces the draft without remounting the editor, while an uncontrolled input's `defaultValue` does not synchronize its displayed value. Use raw controlled entry state tied to draft/version identity and read that state explicitly during save, or controlled individual identifier inputs. Verify keyboard submission and refresh/correction behavior in runtime QA.

**UI-ACC-07 — exact retained discovery is unavailable for review.** The selected process-version panel in `Scope1Inventory.tsx` renders findings and statement descriptions, but not `selectedVersion.activity`: the declared operations, location facts, category assessments, or seven-gas source/location/evidence matrix. The editable owner/admin form represents the separate current draft; it is not a retained-version view. Read-only roles cannot inspect that structured discovery either. Add a clearly labeled read-only selected-version view for all authorized roles, using `selected.proof` to resolve historical labels. An internal reviewer needs the exact matrix and evidence links being accepted, rather than only an absence of blockers. This is a reviewability gap, not evidence of a server authorization bypass.

The mounted screen preserves suitable role and limitation wording: preparation and review controls require owner/admin, contributors to the selected version/supporting records cannot accept it, acceptance requires acknowledgment and a note, and functional blockers disable acceptance. It distinguishes bounded internal review from external assurance and unreleased candidate methods. It labels retained reports as historical, and a retained reconciliation receives the selected version's proof/coverage for display. These observations do not establish the server's enforcement or byte-validity of downloads.

Disposition: source review delivered with two open material findings (UI-ACC-05 follow-up and UI-ACC-07). No runtime or release acceptance. Root continues integration; close this provisional review only after the response to these findings is recorded.

Mounted draft pins: Scope1Inventory.tsx SHA-256 d0e16647b00deb8e7458eec309bd432e589382c82c51105634a3fc372230f2d9; ProcessScreenEditor.tsx SHA-256 ae46943764aae1b6645a21daba3ef110ac706e09cda866cfd086984996be3d3d.

## Final provisional source-review disposition

Final source correction observed: the additional-ID field is controlled using join(',') and split(',') without removing draft separators; Scope1Inventory.save trims and filters the captured IDs before validation. This resolves UI-ACC-05's typing, Enter-submit and stale-default source defects. UI-ACC-06 source options have entity/facility/physical context. UI-ACC-07 is resolved by a read-only selected-version editor available to authorized readers, keyed by selected version ID, using the saved activity and selected proof's coverage and explicitly distinguished from the current draft. All material findings are closed for this provisional source-only scope.

The review does not establish rendered behavior, actual keyboard events, API/server enforcement, deployment, or report-download correctness. Runtime QA must verify those boundaries, including historical physical-source labels: the retained view pins coverage/proof but currently obtains its physical-label lookup from the current reconciliation. Stable historical identity should be demonstrated or that lookup bound to the selected proof. This label check does not change saved source IDs or numerical results. Optional evidence-reference rename feedback and clearer retained gas-source edit restrictions remain usability follow-ups.

Outcome: ACCEPT for the provisional accounting source-review assignment; no runtime or release acceptance. Root remains integration/release owner. Earlier findings and failed fixes above remain dated evidence and are not current open defects.

Final read pins: 
[
  {
    "sha256": "ae6f4ef6a56960eaaf1891c606f52042375053edbb1f6fc67621245efe6bd649",
    "path": "apps/site-web/src/components/Scope1Inventory.tsx"
  },
  {
    "sha256": "ae46943764aae1b6645a21daba3ef110ac706e09cda866cfd086984996be3d3d",
    "path": "apps/site-web/src/components/ProcessScreenEditor.tsx"
  },
  {
    "sha256": "5927f8d8b184ae47e7acb86195675dbda5166caa72c8cca27fcfec77f8afb6a5",
    "path": "apps/site-web/src/components/Scope1Totals.tsx"
  }
]
