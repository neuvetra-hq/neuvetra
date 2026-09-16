# M76 CI compatibility review

Verdict: **PASS for the three test-only compatibility changes**. No runtime/operator/SQL guard was weakened.

Reviewer `/root/m76_accounting`, requested `gpt-6-astra/high`, observed model/effort unknown. Root authored the three changes; this reviewer compared them with embedded accepted M75 snapshot text and independently executed the targeted checks.

## Reviewed changes

- `tools/staging/m75-operators.test.ts`: when the repository manifest has more than eighteen migrations, valid historical seventeen- and eighteen-receipt inputs must both be refused by the legacy operator. The earlier positive expectation remains for a supported manifest; malformed, reordered, stale and foreign-target cases are unchanged.
- `m75-independent-direct-sql.ts`: binds the native fleet SQL comparison to named `0018_controlled_fleet.sql`, instead of assuming the last manifest entry is M75.
- `m75-independent-native.test.ts`: records that same named M75 migration hash in its result. This changes evidence attribution, not runtime behavior.

Diffs were compared with `M75-INTEGRATED-ACCEPTED2.json` and `M75-QA-DELIVERY-ACCEPTED1.json`; the changes are exactly those above. Eighteen snapshot-bound M75 runtime/operator/SQL files remain byte-identical. In particular, `m75-common.ts` still requires manifest length seventeen or eighteen before accepting historical receipts, so manifest nineteen keeps this legacy operator closed.

## Independent execution

`m75_author_ci` was absent locally. The existing isolated synthetic `m75_author_final6` was used only as a clone template. Native lifecycle and direct SQL checks each created a fresh independent database, applied the canonical missing migration, and were separately verified to contain nineteen exact migration receipts. No existing database was changed.

| Check | Result |
| --- | --- |
| Legacy operator tests plus real native fleet lifecycle/access/history | 8 tests, 132 assertions passed |
| Direct native save/review/report adversarial probes | 35 of 35 passed; every probe rolled back; fleet-version count remained 4 → 4 |
| Read-only SQL/TypeScript reconciliation and HTML parity | 53 of 53 cases passed |

Native lifecycle retained its existing access, independent-review, immutable history, concurrent correction, stale dependency, captured-null proof and forty-report/forty-first-refusal checks. All result artifacts independently agree on the M75 SQL SHA-256 `76c8a17a46d96b40ed98213ceb3cf79caf564c5a639583197bd0adaf1c8a98f3`; neither native result nor direct SQL validation substitutes the M76 schema19 hash. The actual fresh-clone receipts are retained privately.

A private preload redirects only the three generated legacy result paths to this review’s private artifacts, including the parity reader’s input. The test sources, calculation methods, database routes, SQL and test assertions execute unchanged. Historical public M75 result files are not overwritten.

## Exact reviewed file pins

| File | SHA-256 |
| --- | --- |
| `tools/staging/m75-operators.test.ts` | `2df6eb9c231fb233cb8ec16dd26644e133e9a0b1cf13dd352d24c177247fa217` |
| `evaluations/research-qa/m75-independent-direct-sql.ts` | `d1c4fd76159b35540e8ab81ba322c0daab33cc343cf39eeb8f8b0dc10363bf3e` |
| `evaluations/research-qa/m75-independent-native.test.ts` | `d40e2ca7e39e01b208df3b3c7c36b7163e07c580192252d8d39afec8324b28cd` |

All 87 source files in `M76-INTEGRATED-ACCEPTED2.json` remain exact. Snapshot SHA-256: `ff37df932c9c140965010308d05f73bbf2ace65eae0e106be504968cd2cc8cc0`.

Private evidence: `.superpowers/m76-ci-compatibility-native.log`, `m76-ci-compatibility-direct-sql.log`, `m76-ci-compatibility-parity.log` and `m76-ci-compatibility-evidence.json`. Evidence JSON SHA-256: `8981e6211828bc5a330e0c1ea7fe50182605aaa29743c227ba8232a7236fa20b`. The initial remote failure log is preserved separately; this action does not claim the remote rerun has passed.

No material blocker remains for publishing these three test corrections and this review. Git publication, exact staged/committed comparison and the six remote checks remain coordinator-owned. This review made no host connection, no Git changes, and no production source edit. It expands no accounting, method-release or deployment authorization.
