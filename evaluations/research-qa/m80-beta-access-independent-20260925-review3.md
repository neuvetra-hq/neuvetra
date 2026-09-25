# Candidate3 focused review: rejected for incomplete CI provisioning

**Verdict: reject Candidate3; one material CI finding remains.** Candidate2's local access/security acceptance remains valid for its unchanged runtime bytes. No native rehearsal, database mutation, local package installation, Git write or provider mutation was performed for this review.

Reviewed snapshot: `operations/agent-improvement/snapshots/M80-BETA-ACCESS-IMPLEMENTATION-20260925-CANDIDATE3.json`, SHA256 `77aba791a6b48e1306138a1bb62cddb16ee99ab4ee4531802921ffbe07a51f7c`. Author evidence SHA256 `c2be6bb9b39a5da28de3a5048b5f3c573d65ccbad3a781b06e746aa054e5d7b4`. All18 current/embedded UTF8 file bytes verified. Relative to Candidate2, only two source files change: shared database index and CI workflow; the author evidence record also changes. All runtime, SQL, owner controls, listener and native restore harness bytes match Candidate2.

## CI-C3-F01 — P2: client17 installation lacks its package repository

At `.github/workflows/verify.yml:125`, the new step runs `apt-get update` then installs `postgresql-client-17` without configuring PGDG or otherwise proving that package is available. A previously installed PostgreSQL16 client does not establish repository availability.

Primary evidence inspected September25:

- The official Ubuntu24.04 runner inventory lists PostgreSQL16.15, matching the client version reported in the escaped native-job failure. [Runner image inventory](https://raw.githubusercontent.com/actions/runner-images/main/images/ubuntu/Ubuntu2404-Readme.md).
- The official runner-image installation script temporarily configures PGDG, installs its selected version, and then removes both `/etc/apt/sources.list.d/pgdg.list` and the repository key. See source lines10-30. [Runner installation source](https://raw.githubusercontent.com/actions/runner-images/main/images/ubuntu/scripts/build/install-postgresql.sh).
- PostgreSQL documents that Ubuntu keeps a particular major version in its distribution and provides PGDG for other supported majors; its Ubuntu instructions configure a signed repository before installing that version. [PostgreSQL Ubuntu instructions](https://www.postgresql.org/download/linux/ubuntu/).

**Inference and limit:** on the documented runner configuration, Candidate3 has not established a source from which apt can install17. The step can fail before either version assertion or the real restore test. This is a source/configuration finding, not an observed Candidate3 Linux execution failure; no new remote job was run by QA.

Required bounded correction: explicitly configure the official signed PGDG repository for the runner's actual Ubuntu codename before update/install, or use another independently verified available17-client source. Preserve the explicit pg_dump17 and pg_restore17 checks, PATH selection and real native dump/restore. Do not skip the test, weaken server17 or install anything on the local machine. Root owns correction authorization and journal handling.

## Checks that passed

- Shared index exactly matches `ecb5b9d3:packages/neuvetra-database/src/index.ts`, SHA256 `7f7a96f2fd015ee11a94ed56d5948745f6743c82ac0ba21aa5d06a74e629ad53`. The only index delta removes three beta exports; dedicated beta consumers retain direct imports.
- Independent recursive runtime import scan from the staging server/shared index resolved98 local files, including66 database source files: no missing imports and no beta edges. Every database graph file has both a runtime Docker COPY and the matching deny-by-default context exception. Local in-memory bundling of both entrypoints passed. This is not a Linux image build.
- Workflow YAML parsed; server17 remains. The17 client path is written to `GITHUB_PATH`; both explicit client paths have major17 guards. The immediately following native step retains `M80_BETA_ACCESS_NATIVE=enabled`, the actual `postgres.test.ts`, and its unchanged real pg_dump/pg_restore calls. No conditional skip or continue-on-error was introduced. Package availability is the unresolved prerequisite.

Exact machine evidence: `m80-beta-access-independent-20260925-review3-graph.json`, `-review3-ci.json`, and `-review3-checks.ts` in this directory. Requested Astra/high; observed compute and actual cost remain unknown.

## Preserved history and next gate

Candidate1 rejection, Candidate2 local acceptance and both escaped CI failures at `3331b62c8328b54c0b35f016d6078e2b5f4ce3ef` remain preserved. The image import failure is addressed by the reviewed index change; the client16/server17 failure is not yet fully addressed because installation lacks repository setup. This new finding was caught before Candidate3 acceptance; it is not a third escaped remote defect.

Root owns the next bounded correction decision. After a newly frozen CI repair, targeted re-review and the actual remote container/native/full checks are still required before successful publication can be claimed. No access-source reimplementation or new native database rehearsal is indicated by this two-file change. Hosted/customer readiness and four held method/source gates remain separate.
