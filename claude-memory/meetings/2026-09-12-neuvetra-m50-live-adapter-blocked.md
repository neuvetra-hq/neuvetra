---
id: 2026-09-12-neuvetra-m50-live-adapter-blocked
type: meeting
title: "M50 live adapter blocked by Windows Application Control"
status: blocked
created: 2026-09-12
updated: 2026-09-12
tags: [neuvetra, ghg, rag, evaluation, operations]
related: [2026-09-12-neuvetra-m49-h02-regression-readiness, 2026-09-12-neuvetra-m47-v4-offline-closure]
---

# M50 live adapter blocked by Windows Application Control

## Outcome

The board approved the exact M49 H02 paid scope. Launch review then found that M49 was intentionally provider-disabled and had no reviewed live ingress. M50 began as the smallest separate provider-enabled adapter. No paid request was attempted.

Frozen M50 v1 failed independent review. Product review `c1d5277c0fe0ba0c77fbaee214b876ea037d852235bd7c95227831553e199156` found that the answer runtime read the evaluator key before shutdown and that model-based stage inference confused the two Opus stages. Technical review `ff942735f3b82c8a6d598118766b5a324eaff9de2bea35f2961a205f726024a2` also found missing mandatory cost closure, a rehearsal shortcut, weak dynamic route/plugin validation, double-stop risk and incomplete terminal failure capture. V1 remains rejected and non-reusable.

The v2 core repairs those findings. Its provider-disabled composed-path test reached explicit analyze, plan and verify stages, recorded three distinct request captures and synthetic native-cost settlements, then wrote payload, cost, terminal and shutdown seals. Nine source tests with 36 assertions and the focused TypeScript check passed. No credential, provider or external network was used, and ports 3012, 3016, 5174 and 5175 were closed afterward.

## Security block

The final compiled wrapper at `.superpowers/openrouter-50-v2-bin/m50-wrapper-v2.exe` is 116,286,552 bytes with SHA-256 `9995fb8c0412001b12bb5712d9bd8581c8f36eb46234da6b4c922598d37bd6e1`. Windows Application Control blocks these exact unsigned bytes. Six Code Integrity events, IDs 3033 and 3077 with records 823, 825, 828, 830, 833 and 835, report an Enterprise signing or policy failure under policy `{0283ac0f-fff1-49ae-ada1-8a933130cad6}`.

The block was not bypassed. A script-wrapper exploration is an unapproved draft and was not accepted as an alternate execution path. No v2 candidate, manifest, integrated wrapper lifecycle rehearsal or paid authorization was frozen.

The denial record `fbb4416ad20eb5dce706d0180e3f1b7bbcf7d0f1cd55dcc7c8a7a8e123c786a6` and bounded handoff `3e5b4f646bfaff7091f9fe8c5fe7283eaeda1f28b9b41dd5613fe3c2d03459c0` passed independent technical review `3eeaaaa587b175ec441f5efd822e758254b5cbbabc0fd2d39356cb96c3a379d2`. Product review `1d163aba413eaffc505ba27b4f1f66e60e88e6ef37c2359b3ff8bdcce1ba341f` accepted only the truthful blocked disposition.

## Decision needed

The Windows administrator or Application Control policy owner must approve the final wrapper, preferably through a trusted publisher signature or an explicit rule for the reviewed executable. Signing may change the bytes. After approval, rehash the allowed executable, update its parent-image pin, rerun the complete wrapper-to-issuer-to-backend provider-disabled lifecycle and adversarial refusal suite, freeze a new candidate and manifest, and obtain independent product and technical review. Only then may the board receive a fresh exact M50 paid authorization request.

M49's scope approval does not authorize a materially changed M50 candidate. No provider request, paid cost, customer data, source expansion, commit, publication, merge, deployment or release occurred.
