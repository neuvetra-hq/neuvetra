# M78 read-only recovery failure 2 review

## Reconciliation

The first GET-only recovery remains failed. Its immutable main journal has 18 events and its diagnostic journal has 49 events; both byte hashes, event chains and terminal heads match the published failure record. The diagnostic contains 24 paired requests: four authentication requests, sixteen application GETs and four local logout requests. The application statuses are `403, 401, 200, 200` for the authorization prefix followed by twelve more `200` responses, including all five full Scope 1 report reads. There are no request errors and no application POSTs. Each of the four known roles has one local logout outcome with status 204. Legacy verification never began and no observation was written.

The terminal journal flag `allCreatedAuthSessionsClosed:false` records the phase state at the failure boundary; it does not override the four retained role-specific logout outcomes. No actual exception text was retained in the hosted journal. The local cause is therefore a deterministic offline reproduction, not a claim that the hosted process recorded the same error: the frozen reconstructor hashes `report.html` and `report.snapshotJson` from fleet and equipment register entries, but those register entries are metadata-only, so the reconstruction throws before legacy verification.

## Verified fixture contract

The reusable loader is `m78-readonly-failure-review2-fixture.ts`. It selects archived report responses only by exact report ID and raw UTF-8 SHA/byte length. All three retained fleet reports and all five retained equipment reports have archived full response strings. Without any normalization, every HTML and snapshot string matches the corresponding continuation-4 baseline metadata and download pin, each snapshot is already canonical JSON, and each current renderer reproduces the archived HTML byte-for-byte.

The verified baseline fixture reconstructs the complete mobile, fleet and equipment download maps exactly:

- Mobile statement artifacts retain their original `fuel_<id>` and `mileage_<id>` keys. Combining both under `statement_<id>` changes the evidence contract.
- Fleet and equipment register reports are metadata-only. Tests may obtain historical full HTML and snapshot strings through the exact-ID archive loader; production recovery must use a durable raw capture made before local verification.
- Fleet and equipment proof payloads are separate endpoint envelopes shaped as `{reportId, proof}`. They are absent from report snapshots and their raw historical bodies were not archived. For unchanged historical reports, preserve the already-verified baseline `proof_<id>` digest as an opaque pin after matching report identity and metadata. If fresh proof verification is required, explicitly fetch and durably capture the proof endpoint, verify `reportId`, and hash the complete canonical envelope including both `reportId` and `proof`; never read `snapshot.proof`.
- Archived strings are fixture evidence for unchanged historical records, not substitutes for fresh hosted responses or proof that a new recovery succeeded.

## Scope and next admission

The review used no network, authentication, credentials, database, provider or Git operation. It did not change or execute the frozen runner or evaluator. Recovery 2 should use new exclusive paths, bind this failed recovery and review before authentication, persist bounded raw responses before reconstruction, and test the exact real baseline fixture. It must retain failure if capture or local reconstruction fails. No restart or revisit is authorized.
