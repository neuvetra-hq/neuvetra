---
id: 2026-09-11-neuvetra-m43-rag-pilot-readiness
type: meeting
title: "M43 bounded RAG pilot-readiness preparation"
status: complete
created: 2026-09-11
updated: 2026-09-11
tags: [neuvetra, ghg, rag, evaluation, pilot, qa]
related: [2026-09-08-neuvetra-ghg-focus, 2026-09-09-scope2-benchmark, 2026-09-11-neuvetra-m42-deterministic-calculation]
---

# M43 bounded RAG pilot-readiness preparation

The board directed the next milestone after M42: prepare a narrow live RAG pilot-readiness evaluation and its paid-test decision package without executing it. The CEO coordinator bounded M43 to the already approved EPA S01-S18 release and public/synthetic questions. CPO defined outcomes and acceptance, CTO produced the provider-disabled preflight and execution contract, source review assessed the evidence boundary, and independent QA challenged the integrated result.

M43 completed offline with independent QA pass. The evaluation set has 14 new cases: nine development and five held-out. The proposed primary paid canary is `M43-H01` followed by gated `M43-H04`; the first must independently pass before the second is sent. It allows at most ten stages total, zero retries and zero carry. Expected cost is $0.455912001; the conservative local two-case reservation is $9.17912 and is not a guaranteed provider cap.

The source review is operationally valid through `2026-09-15T23:20:32Z` but must be refreshed immediately before a live run. Commercial runtime source approval remains false. No provider request, credentials, customer data, external network request, source expansion, deployment, merge, release or commit occurred. The next action is a board yes/no decision on only the exact two-question paid canary. See the [milestone record](../../docs/research/rag-pilot-readiness-milestone-43.md), [board report](../../operations/board-report.md), [ledger](../../operations/status.json) and [handoff](../../operations/next-session.md).
