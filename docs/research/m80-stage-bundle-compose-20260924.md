# M80 stage bundle composer

Date: 2026-09-24. This is an offline convenience helper for root execution support. It does not create a plan, gate, review, intent, predecessor receipt, credential, database connection or provider request. It performed no network, database, provider, Git or hosted action.

The accepted hosted preparation and executor CLIs validate and seal their individual artifacts but do not compose the executor bundle. `.superpowers/m80-stage-bundle-compose.ts` fills that narrow gap. It accepts explicit workspace-relative paths for the actual plan, stage gate, sealed intent, accepted executor review and predecessor intent/observation/outcome triplets. It computes hashes from the bytes it reads; it never accepts a caller-supplied hash for those inputs.

Before writing, the helper:

1. validates the current plan and stage gate with the accepted v2 validators;
2. opens the gate's exact security, integration and target evidence;
3. derives and validates all eight typed plan-evidence receipts from the plan;
4. opens each supplied predecessor and its gate evidence;
5. reconstructs the sealed intent at its recorded creation time and requires exact semantic and byte equality;
6. validates the accepted executor transport review and its recursive current-source closure; and
7. requires the deterministic `.superpowers/m80-foundation-executor-<operation-scope>-<stage>-bundle.json` output path.

Only after these checks pass does it use the accepted synced exclusive writer. An existing output refuses. Migration requires no predecessor, admission requires the complete migration triplet, and deployment requires complete migration and admission triplets. Three `-` placeholders represent an absent predecessor; partial triplets refuse.

## Command

```text
bun run ./.superpowers/m80-stage-bundle-compose.ts compose <deterministic-output> <migration|admission|deployment> <plan> <gate> <sealed-intent> <executor-review> <migration-intent|-> <migration-observation|-> <migration-outcome|-> <admission-intent|-> <admission-observation|-> <admission-outcome|->
```

The helper prints only the status, stage, output path and exact SHA-256 after the new bundle has been written and synced. `self-check` is an offline, write-free author check.

## Frozen source pins

- `.superpowers/m80-stage-bundle-compose.ts`: `0969b8417e88ca261acb365bfe8c5e1ce9de08b324f47172cbd8bfafdf1837c3`
- `.superpowers/m80-foundation-executor.ts`: `4cf676a7f93e664800205146afcb45621d6018d1e821c7bcf7c2c5d7a48f18fb`
- `.superpowers/m80-foundation-hosted-once-v2.ts`: `5db678e1332a75c08aa63d9052dedbb15a096266f28dfab9139685f7772daf74`
- `.superpowers/m80-foundation-hosted-prepare-v2.ts`: `82e2a01469a4d85cb77a71f53f55275a044952046d23bdf8aaff9f710e7c14b5`
- `packages/neuvetra-database/src/m71-validation.ts`: `44add799b85939bc0825a0e1fe095e41104faea13796d5ee1b58227660b0b7ec`
- accepted Candidate 9 executor review: `b589b0ab127cb537c91f9c80e584382255a45cf537a1703104ee4df4f31174a2`

The author self-check used the current private Candidate 9 fixture API without embedding its fixture values in this report or snapshot. It accepted one complete deployment chain and refused a chain whose admission predecessor used the migration outcome. Targeted TypeScript compilation passed, and Bun bundled the helper successfully at 193.40 KB. These are offline author checks. Independent review is still required before root uses the helper for a live stage bundle.
