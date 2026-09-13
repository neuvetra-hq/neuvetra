---
id: 2026-09-12-neuvetra-m49-h02-regression-readiness
type: meeting
title: "M49 H02 regression readiness"
status: complete
created: 2026-09-12
updated: 2026-09-12
tags: [neuvetra, ghg, rag, evaluation, regression]
related: [2026-09-12-neuvetra-m48-heldout-selection-blocked, 2026-09-12-neuvetra-m47-v4-offline-closure, 2026-09-11-neuvetra-m43-rag-pilot-readiness]
---

# M49 H02 regression readiness

## Board direction

After M48 established that no remaining M43 case was materially novel inside the approved EPA S01-S18 semantic space, the board chose the regression route. M49 prepared exactly `M43-H02`: “How should I research a U.S. grid-average factor for a facility, and what should I verify before treating the result as current?”

H02 is a recombination of behavior already exercised by live W02 and W09. It is not a novel held-out canary. A future passing run can establish one-run repeatability under this new wording only.

## Frozen package

The candidate is `d954dc0508e26350c138163049adbf13e85814af523e64e84e00a00cb8c6e96c`; its manifest is `334379536c8a21e2d4d124f85c37a4e7c3615e00c81f75c190d42a59d31c6c46`. The dedicated wrapper is `93dbae144918003d3d3da24a9e7ee9edf5c1604e69acd60930f904724e35de42`. The provider-disabled rehearsal is `61cff517738bab6be176e9a8078ae0dc5c5c42b02eb17b4823e2f47c71bf3a1f`.

The package uses the exact H02 question, the approved S01-S18 product corpus, and a separate evaluator-only key. Analyze and verify are pinned to `anthropic/claude-opus-5`; plan is pinned to `anthropic/claude-sonnet-5`; OpenRouter routes directly to Anthropic with fallbacks and plugins disabled. The run is limited to one case, at most five stages, zero retries, zero carried stages, 180 seconds per stage, 240 seconds for the question, and a 30-minute fixed supervisor.

The initial analyze body is 12,398 bytes and has SHA-256 `513d064d3f52a63d2a4adbe3eca2b7210c5f7b5fe2353c799e0fa883ca5e205e`. Dynamic plan and verify bodies must be captured and checked for evaluator separation before dispatch. Grading may occur only after terminal capture.

## Cost and review

Expected cost is $0.271573, the arithmetic mean of the two latest same-pipeline M46 cases. The conservative local reservation is $3.944535. The retained exposure basis plus that reservation is $9.652357001, leaving $6.644243499 below the $16.2966005 internal monitoring target. These local controls are not an OpenRouter-enforced cap or billing guarantee.

Author verification passed 184 tests and 1,134 assertions, TypeScript checks, three concurrent lifecycle rehearsals, and two stable freezes. Product acceptance `cc4955049fbd0c58331fade893afb812450f4321a0363a1efb6484bfd7e14abd` found no evaluator leakage in the exact analyze body, S01-S18 source artifact, or runtime prompts. Independent QA `57b65614efcf35f053a7efafc4680733a3720c3b6d3ef0f593195398acae3ddb` rechecked 36 M49 pins and four inherited M47 pins, passed 18 unique tests with 141 assertion calls across repeated rehearsal, and found no discrepancy.

An authoring-time concurrency race was fixed before freeze: the negative tamper test now changes only a disposable wrapper copy, never the canonical executable. Bounded OneDrive cleanup retries leave no rehearsal folders behind.

## Decision boundary

M49 is complete offline. No provider/model request, paid authorization, credential access, external network use, customer data, source expansion, persistent service, commit, publication, merge, deployment or release occurred.

Any paid run requires a separate explicit board approval for this exact H02 regression/recombination, direct OpenRouter-to-Anthropic route, at most five stages, zero retries/carry, and the $3.944535 conservative reservation. Immediately before execution, the source review and official EPA bytes, local pins, account/workspace/plugin/routing controls, balance, runtime identity, empty attempt paths and browser origin must be rechecked. The current source review expires `2026-09-15T23:20:32Z`.
