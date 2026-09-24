# M77 facility label independent review

**Scoped PASS**, 2026-09-16, reviewer `/root/m76_cto`. This review covers the single facility-checkbox label change; actual hosted exercise completion remains pending and its partial journal was not evaluated for completion.

Requested reviewer Astra/high follows the existing registry; this reused context's observed model/effort remain unknown. Reviewer authored no M77 UI/runtime change. No host calls, Git edits, application edits or accounting/schema/report changes were performed by this reviewer.

## Exact candidate

- Full-text snapshot `operations/agent-improvement/snapshots/M77-FACILITY-LABELS-CANDIDATE1.json`: SHA-256 `e5f23ed2738a24ee722505710acf59d5b6f5cdfe545d567044547be79c076089`.
- `apps/site-web/src/components/FugitivePopulationEditor.tsx`: SHA-256 `cda3edc46a8d05b73d4241a40bc118bf444d2f165f21650432dccec5ebdbd6d2`.
- HEAD predecessor component: SHA-256 `92b9dcdc88fc758202e097414f68a3fc74f0071a419384d58c13c241ee2371b3`.

Read-only HEAD diff and byte reconstruction confirm exactly one JSX label expression changed. Replacing the added entity-name expression with the prior facility-name expression reconstructs the HEAD component exactly. Snapshot captured text, source bytes and file pin agree.

## Independent evidence

Rendered the actual React component locally using the retained three-facility snapshot from the already accepted four-event baseline prefix. That prefix remains SHA-256 `396f086ee8702e7fbb48dbd0b303ab1a9a993fed62db5569ac1bf184b8fd5462`; no partial exercise completion checker was run.

The duplicate display names now render distinctly:

| Facility ID | Rendered label |
| --- | --- |
| `71000000-0000-4000-8000-000000000021` | Synthetic California distribution center (Synthetic Juniper California distribution) |
| `98d69117-f3c9-43a7-bee0-c9e9940ac721` | Synthetic California distribution center (Synthetic Juniper California parent) |

Each entity name resolves by the facility's exact `entityId` within the same captured coverage snapshot. All three checkbox keys remain unique facility IDs. Invoking each actual checkbox handler selects only its own facility ID, preserves the entity selection and leaves completeness unknown. Missing entity information displays “Entity unavailable”; absent coverage and disabled state do not create selected coverage or automatic completion. The original checkbox expression and every action/binding are byte-identical to HEAD. Server validation, numerical calculation and report generation are outside this one-expression diff and remain intact.

Private receipt `.tmp/m77-qa-label-review-result.json`: SHA-256 `92d695989de64bf9d18b7603292879e83a28711f66ac86d13247745e91c21d40`. Actual-component static rendering and handler checks were independently run; root's typecheck/build passes are supplied author evidence. This is not a physical hosted-browser render or a full M77 acceptance claim.

The label-only candidate may be published. Deployment remains root-owned and, as instructed, follows closure of the running hosted exercise.
