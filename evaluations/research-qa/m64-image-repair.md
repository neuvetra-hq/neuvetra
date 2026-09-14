# M64 image repair review

September 14, 2026. Disposition: **source/context repair accepted for push and a fresh Linux image CI run; migration remains gated on that actual image job passing.** No local Docker image was built by this reviewer.

Root reported **M64-IMAGE-F01**, a packaging defect at published commit `dcaa420`: the isolated web-build stage could not resolve the new worksheet type module. Review also confirmed the runtime copy/context lists needed the worksheet API route, domain module and tenth migration. CI stopped deployment; root reported the live database remained healthy at schema9. Those CI/live observations are root evidence, not independent cloud queries by this executor.

The reviewed repair adds `packages/neuvetra-database/src/m64.ts` to the web-build stage, and explicitly copies `apps/site-api/src/workspace/m64-routes.ts`, `packages/neuvetra-database/src/m64.ts` and `0010_manual_electricity_worksheet.sql` into the runtime. The three matching exact context exceptions are present. The original deny-by-default filter and exclusions for tests, node_modules, credentials/environment exports, Git and private receipts remain. No broad application/package subtree exception was introduced by these additions.

Source/import review confirms: the browser decoder uses a type-only relative import from m64.ts; that module itself has no module imports. The hosted server imports the new API route; the route imports the database export; index.ts and workspace.ts reference m64.ts; the migration manifest reads the tenth SQL file during readiness verification. Both build-time typing and runtime/readiness file dependencies now have explicit matching COPY/context entries. The existing offline runtime import/asset verification RUN and Linux image smoke job remain required evidence.

An independent local static check passed: all 69 repository source operands in non-stage COPY instructions exist; all three new files have exact context exceptions; m64.ts is copied in both required stages; the original secret/test exclusion patterns remain; all 29 frozen QA artifact hashes are unchanged. This is a source/context check, not a Docker ignore-engine emulation, container build, Linux runtime smoke, provider migration or browser test. Actual Linux CI must exercise those boundaries before migration. The earlier passing application checks did not prove image packaging completeness; retain this first-review failure alongside the numerical and native-driver findings.

Canonical hashes normalize CRLF to LF only:

| File | SHA-256 |
| --- | --- |
| Dockerfile.staging | `e965e936f557047258e21d674ce0f578cd2c5dc63c3317d2e4f3c19f0dbf908d` |
| Dockerfile.staging.dockerignore | `c9fc47d67e0583d4d08986fba7e94e0c7332f8ba22e332f201ba0322cf04206b` |

The original frozen QA report, original artifact manifest and supplement are preserved. Root authored this packaging repair; reused QA executor `/root/m63_data` authored no M64 product or packaging implementation. Prior M63 authorship and unknown inherited compute settings remain disclosed in the original report. This bounded review grants no hosted/browser acceptance or professional assurance.
