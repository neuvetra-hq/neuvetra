# M40 live boundary closure and next product gate

Date: September 11, 2026  
Decision owner: Board  
Coordinator: CEO-facing root agent

## Decision and scope

The board authorized one exact EPA14-B01 diagnostic: **What if I don’t make specified renewable energy purchases—do I still have to do dual reporting?** The approved boundary was EPA S01–S18 only, OpenRouter messages API to Anthropic Claude Opus 5/Sonnet 5, one browser submission, at most five stages, zero question retries and zero carry. The $3.9377225 maximum estimate was explicitly acknowledged as a conservative estimate rather than a guaranteed billing cap. W03 rerun, customer data, source expansion, merge, deployment and release were excluded.

## Demonstrated outcome

The question was submitted once. Four stages completed and settled: Opus 5 analyze, Sonnet 5 plan twice, and Opus 5 verify. The website displayed **More source coverage is needed**. Its exact captured response was `unsupported` / `coverage_missing`, with empty claims, evidence and sources and a scope gap containing `specified renewable energy purchases`.

Exact current-run settled cost was 233,731,001 nanoUSD ($0.233731001). There was no pending, uncertain, unexpected or retained current-run cost. One stage was retired, none carries, and release acceptance is false.

Independent terminal QA passed at `53de5e233d7df60ab3881034c8be2551801daf5d5dd0c324d6bc26cafaf2f333`. Closure `c6ce9dde9c7c0bd24b04ee4649cfdbbb2b992b63196adfc685bd24529f267985` passed independent review `60b3e6fe680c565381236197296019db9517b80ff2bdb37abe9fbeae2742ca3e`. All 42 artifact pins and eight certificate pins matched. Backend PID 29944, frontend child PID 31632 and frontend supervisor PID 25548 are absent; ports 3012, 3016, 5174 and 5175 are closed; ordinary preview is paused.

## Product status and next milestone

The three intended research behaviors are accepted across preserved live runs:

- M35 W11: missing company context produces `needs_input` without an invented cause.
- M39 W03: sufficient approved support produces a qualified answer with visible evidence.
- M40 EPA14-B01: missing corpus coverage produces an explicit unsupported answer with no claims or citations.

Define M41 as **offline demo readiness**. Its outcome is one local board-review flow that presents these three preserved accepted behaviors, states pilot limits clearly, and links each view to the existing reviewed evidence. M41 must not start a new paid test, expand the source corpus, deploy or claim release acceptance. Product availability beyond a supervised local board demo remains gated by wider evidence, deterministic calculations, tenant isolation and launch review.

## Evidence

- `docs/research/supervisor-lifecycle-milestone-40.md`
- `.superpowers/website-epa-live-40/closure.json`
- `evaluations/research-qa/openrouter40-closure-review-10.json`
- `operations/openrouter40-root-shutdown.json`
- `C:\Users\nimab\Documents\Codex\2026-09-11\realtime-voice-chat\outputs\neuvetra-m40-epa14-b01-coverage-missing-accepted.jpg`
