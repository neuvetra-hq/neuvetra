# M75 final byte normalization and restored-clone review

Independent reviewer `/root/m74_accounting`, 2026-09-16 UTC. Local acceptance remains **pass**, with no open blocker in this reviewed scope.

## Normalized candidate

Preserved both earlier immutable pin maps. The new 25-file map is `m75-normalized-final-pins.json`, SHA256 `ab8d74cc06259267e63afdb85032581c860daac47aad896a77f6fba4f4860558`.

The reviewer independently hashed the original text retained in `operations/agent-improvement/snapshots/M75-IMPLEMENTATION-ACCEPTED1.json`, matched the earlier accepted raw hashes, then proved exact `CRLF` to `LF` conversion equality for:

- `m75-api.ts`: final `473c4f2170bcdd8f143ab616c876855eafc6ae8d7df1c82b0315f7de5423feab`.
- `0018_controlled_fleet.sql`: final raw and canonical `76c8a17a46d96b40ed98213ceb3cf79caf564c5a639583197bd0adaf1c8a98f3`.
- `m75-backend-fixture.ts`: final `8f16168d1fd965da52c6e02da35796af6cb815a3512f6fada8145ed6ecfa5b43`.

Focused actual browser-decoder rerun: **12 tests, 47 assertions, all passed**. No semantic implementation change was found in these three files.

The workflow's original mixed-line-ending bytes were not retained. Root reports line-ending normalization; this reviewer does **not** claim cryptographic equivalence to those missing bytes. The current workflow was independently reinspected: isolated native setup, native/direct-SQL/parity checks, helper journey, and image manifest18/exact0018 plus readiness18 remain present. Its current raw hash is in the new map.

The two `.gitattributes` additions were inspected: `evaluations/research-qa/m75-*-pins.json -text whitespace=cr-at-eol` and `tools/staging/m75-seal-backup.ps1 -text whitespace=cr-at-eol`. These preserve the existing raw evidence/operator bytes. `.gitattributes` SHA256 is `4c455c91e76cbbe692ba32c042fb6ced4fd4e58224715e8942c399c2bf6cd0d5`.

## Fresh restored-clone attestations

Reviewer-owned `m75-security-recovery.ts` performs separate all-table row and content-manifest reconstruction in read-only repeatable-read transactions, invokes the frozen runtime replay/download helper, then repeats reconstruction. No live host, Auth provider, migration or application mutation is invoked.

| Restored target | Independently checked | Actual replay |
|---|---|---|
| Hosted schema17 archive restored locally, port55472 | 83 tables / 224 rows, exact backup/restore application rows/catalog/roles/memberships/dependencies, exact content bytes, unchanged after replay | 2 gas versions, 2 mobile versions, all14 legacy downloads |
| Populated schema18 source and restored clone, port55463 | 90 tables / 2,263 rows, exact source/restored rows and content, unchanged after replay; earlier independent full catalog comparison retained | 11 gas versions, 3 mobile versions, all115 legacy downloads, 1 fleet version and exact report/proof/browser-decoder downloads |

The hosted backup and local restore differ in default privileges for unrelated provider schemas. Application/global default privileges are absent in both; no whole-provider restoration claim is made. The first overly broad inventory equality assertion stopped before database access; it was narrowed explicitly to the reviewed application scope before the successful run.

Gate-shaped local attestations, each with `reviewerId: /root/m74_accounting` and exact receipt hashes:

- `.superpowers/m75-security-hosted-recovery-candidate1.json`: SHA256 `6fa020eeb26d0160a33aaec137394d30c797c70fa1531ab72f35533cb6c1d544`.
- `.superpowers/m75-security-forward-review-candidate1.json`: SHA256 `c9f92b29eb60e7a479aeb4ca5befe418d570607f53a4104d701b769482ae85fa`.

These attest reviewer-executed reconstruction and replay of author-restored local databases. CTO/root executed encrypted backup/restore; root retains operator safety and hosted deployment responsibility. Customer release, source/method approval, legal compliance, complete corporate Scope1 coverage and independent external assurance remain outside this acceptance.
