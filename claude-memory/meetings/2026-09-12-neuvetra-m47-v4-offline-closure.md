---
id: 2026-09-12-neuvetra-m47-v4-offline-closure
type: meeting
title: "M47 v4 offline closure"
status: complete
created: 2026-09-12
updated: 2026-09-12
tags: [neuvetra, ghg, rag, remediation, qa]
related: [2026-09-12-neuvetra-m46-live-failure-and-m47-remediation, 2026-09-11-neuvetra-m43-rag-pilot-readiness]
---

# M47 v4 offline closure

## Board direction and boundary

The board directed the team to move forward after M46 failed. M47 remained provider-disabled and preserved every M46 execution byte. It included no paid authorization, customer data, source expansion, commit, push, merge, deployment or release.

## Completed outcome

Three frozen approaches exposed successively deeper provenance gaps. The final v4 design uses a dedicated frozen wrapper executable. Before the backend can create an eligibility claim, it queries Windows for its actual live parent program, resolves the canonical executable path and verifies the on-disk SHA-256 against fixed internal policy. The reproduced manual Python-parent bypass, an identical executable copied to another path, an altered wrapper at the approved path, and direct, partial, stale and replayed paths refuse before backend consumption or claim.

The question analyzer now treats bounded leading application instructions such as “Use this guidance to” as supplied background while preserving the material action. H01 is unchanged, old H04 produces only `action_out_of_scope`, genuinely unresolved references remain `context_required`, and the terminal contract is unchanged.

## Independent review

Independent QA `8b5e74f7eb8eace4295887bac9b53b7b1ede65146c61146ff738284514b853fa` reproduced 166 tests / 1,019 assertions, both TypeScript checks, two stable freezer runs, all 161 M46 pins and 23 v4 implementation pins. It also completed separate approved-wrapper runs in two pre-created OneDrive-local workspaces and confirmed the required refusal and cleanup behavior.

Candidate `8261f9f160aec205e3fc08a81a02c667a84ec744f3ced11938f090cd506b04f7`, manifest `d25e0f36e5ae0d0ce41d33550f5e217946191ff547cc502d160a6e136ea22260`, rehearsal `16991ffda586479bc41c9032e90319905ffab6f090d83a671defdcfaaeb7c9d0` and wrapper `ba52fe7dd72eaabc92488e3b4cf386a23f811e760fe7dbaf3eebfe0c58b0c774` are the accepted frozen bytes. Provider requests, credential access, network use and services were zero.

Acceptance is limited to the frozen local Windows/OneDrive wrapper workflow. It is not hardware or administrator attestation and does not establish live, held-out, customer-pilot, publication or release acceptance.

## Recommended next milestone

M48 should prepare the disjoint M43-H02 qualitative grid-factor research case offline. It should refresh source applicability, runtime identity, exact request and cost evidence and receive independent preflight. A paid execution remains a separate explicit board decision.
