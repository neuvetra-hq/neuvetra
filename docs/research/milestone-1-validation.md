# Milestone 1 validation — September 8, 2026

The delivered scope is a preserved development baseline, current deployment assessment, primary-source research and architecture, a focused website preview, and an agent operating model. Customer GHG answers, calculations, persistent cloud workers and production cutover are not part of this validation result.

## Website demonstration

Open the [local preview](http://localhost:5174/) while the development server is running. The overview introduces Neuvetra's California/U.S. greenhouse-gas direction and identifies the application as a research preview. Choose **Explore the sources** or **Sources**, search for `EPA` or `California`, and use the publisher/category controls. An unknown query produces an explicit empty state; reset restores all four source entries. Each entry links to its primary publisher.

The four public entries are a curated introduction. They are not an indexed knowledge release of the 47 downloaded artifacts. The page does not make unsupported answers or calculate emissions. Existing legacy chat/auth components remain in source control but are not mounted by the current application.

| Check actually performed | Result and practical limit |
|---|---|
| Site TypeScript check and lint | Passed; no Site lint errors or warnings. |
| Existing Site frontend unit suite | 15 tests, 33 assertions passed. These cover retained helpers and state behavior; they are not automated coverage of the new source-browser interface. |
| Site production build | Passed. The optional Three.js chunk still produces a size warning. This is a build result, not a deployed-container result. |
| Source-filter smoke checks | Six direct checks passed for search/filter behavior. Browser checks below separately exercised actual interface controls. |
| Independent browser review at 1280 × 720 | Overview/source navigation worked; EPA search returned one entry; an unknown search returned zero with an empty state; reset restored four; California search returned one; return to overview worked. |
| Independent browser review at 390 × 844 | Layout remained usable with no horizontal overflow. Overview and source interactions remained accessible. |
| Browser diagnostics | No console warnings or errors were observed during the reviewed flows. No new Lighthouse score is claimed. |
| Branding and readiness review | Current mounted interface is Neuvetra-only, focused on GHG; unsupported Q&A and calculation capabilities are described as in development. |

The implementation agent performed the Site checks. The coordinator separately inspected the running page, exercised the controls and checked browser diagnostics. This is independent application review within the current AI collaboration environment, not an external accessibility or security certification.

## Foundation and research evidence

- The preceding [foundation cleanup](../foundation-cleanup.md) passed nine TypeScript targets, 65 offline tests and all three frontend builds. Lint had zero errors and 44 legacy FrontDesk warnings. The final website checks above cover the later Site changes; the full baseline suite was not needlessly repeated after documentation-only edits.
- The annotated checkpoint `checkpoint/pre-ghg-focus-2026-09-08` was pushed and verified at `367497e750530c590c7eedd229e48a34e2daf8b8` before the GHG pivot. The tag includes all three product workspaces and the reviewed foundation.
- Independent [source-integrity checks](source-integrity-check.md) verified all 47 downloaded artifacts, hashes, formats and PDF page counts. The [legacy inventory](legacy-source-inventory.csv) records 1,220 inherited files. Integrity is distinct from approval for a specific legal or accounting use.
- A separate reviewer checked the research synthesis against the detailed legal/accounting reports, source manifests and inherited-code findings. The review retained the distinction between proposed and effective rules, unresolved docket evidence and calculation-method applicability.
- The [deployment guide](../deployment.md) records direct Railway dashboard observations and public HTTP checks. Four services are mapped to their old repositories. FrontDesk API failures and the absence of a GHG deployment remain explicit.
- The supplied environment export was inspected for variable names, presence and relevant configuration categories without printing credentials. It remains outside Git and has not been loaded into the prototype.

## Operating model review

Independent QA checked the [role hierarchy](../../operations/agents/README.md), all ten role prompts, root instructions, task dependencies, evidence links, JSON parsing, authority boundaries and the board report's completion claims. Findings were to align five task-owner references with actual role filenames, add this missing validation record, and make the initial Python Decimal proposal consistent across the roadmap and architecture. The coordinator addressed those findings before handoff.

The [ledger](../../operations/status.json) is the current record of work and dependencies. Roles are reusable instructions; actual delegates are dispatched per task. The current runtime supports four concurrent agents including the coordinator. Cloud execution and scheduled monitoring are planned, not running.

## Unrun checks and outstanding gates

Docker/container execution, remote CI, production deployment, real OTP delivery, paid AI, live billing, external integrations and production database behavior have not been established by this milestone. Existing GHG TypeScript packages remain incomplete; the full Python reference suite still fails on unfinished `TBD` data. No customer answer or numerical result is certified by a frontend build.

Source bytes are retained locally outside the application repository. GitHub carries the code, reports and manifests; cloud object storage, rights/retention review, approved runtime source/method releases and isolated development credentials remain open work. Current-law claims must be refreshed before consequential use. Milestone 1 is ready for board review; feedback remains pending before dependent product implementation.
