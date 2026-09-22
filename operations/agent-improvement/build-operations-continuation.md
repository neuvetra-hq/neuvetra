# Build operations continuation — 2026-09-22

Board approved implementation of feature scorecards, model performance reviews and an aggregate $5 OpenRouter pilot. The initial candidates are MiniMax M3 and Kimi K2.7 Code, selected for current coding capability rather than lowest price. Existing role defaults remain unchanged. Read model-performance-policy.md and model-performance-reviews.json.

## Actual state

The pilot adapter has passed independent offline review. Paid execution has not occurred. OPENROUTER_API_KEY is absent from the executing process, and the product task knows no approved binding. The board has been asked to use secure local setup, never paste the key into chat. Do not read unrelated ENV exports, account test credentials or secrets to improvise access. The $5 approval persists; do not ask for it again.

The feature scorecard uses build-feature-registry.json, build-feature-events-v1.jsonl, build-usage-events.jsonl and existing runs. The original draft event stream is preserved; feature-event-schema-migration.json explains the initial explicit-independence field migration. Only the v1 event stream receives new events. Native subscription usage remains unknown and separate from provider API costs. The scorecard does not infer zero cost from missing call data.

Read OPS-METRICS-QA-01.md for exact implementation review findings and final artifact hashes. Do not infer acceptance from test count alone. build-scorecard.md/json are generated local reports, not a hosted dashboard. Event capture is explicit; there is no automatic connection to every future agent dispatch, continuous model manager or paid idle loop.

## Next execution

1. Verify exact accepted adapter/fixture bytes against review evidence and refresh secure credential availability without printing secrets.
2. Run the adapter's default offline preflight. When the credential is available, execute one uniquely identified batch with the fixed $5 ledger. A fresh catalog gate can still refuse incompatible prices or settings. Never reset the ledger or retry an uncertain request.
3. Preserve returned output and usage receipts. Independent QA applies build-pilot-review-rubric.json; never include that rubric in candidate requests. Count truncated or invalid outputs separately from billing outcomes. Record provider events in the feature scorecard with exact receipt references; do not treat a native run as a single API request.
4. Report six case/model results, actual costs and unknowns, reviewer effort and defects. Three cases per candidate do not establish general competence or warrant changing critical role defaults. A supervised real patch task follows only after screening acceptance.
5. At each subsequent feature closure, record the QA history and one lesson; at milestone closure, inspect comparable results and decide whether to retain, restrict or replace a role's model. New roles inherit the same onboarding and independent evaluation requirements.

## Publication boundary

Changes in this coordinator checkout are isolated new operations/tooling artifacts. No product code, deployment, model defaults or main milestone ledger was changed. The product task explicitly reported being paused for a platform update; leave it paused. After that task is explicitly resumed, its sole Git writer should integrate the accepted files into the existing rolling PR5, add the small tooling checks to the relevant CI path if appropriate, and verify the remote head/checks. These local files are not yet claimed pushed or live.
