# Candidate4 focused independent review: pass

**Pass for the bounded source/CI repair.** CI-C3-F01 is closed in Candidate4. Actual remote Linux provisioning, container build and native restore remain root-owned execution gates; this review performs no package installation, native replay, database mutation or provider write. Candidate2 local access acceptance remains preserved.

Snapshot SHA256: `63bc8ca34e40c62be20d2e068580305d2911c9b6e1c6794799008e0c377f6959`. Author evidence: `b94a39f4f570211651a3d39b65ca16615e446f78566aa6b5de87c14b7de0f675`. All18 current raw bytes equal embedded text explicitly encoded as UTF-8 and declared SHA256 values.

The only source change from Candidate3 is `.github/workflows/verify.yml` (SHA256 `012ca24cf50abce76ea502e73bc476161c76774b569bc93534ee032da53d1888`); author evidence also changes. Parsed workflow comparison proves that only repository provisioning is added before the previous client installation/selection step. Actual Ubuntu codename is required; the official key is fetched over HTTPS with failure checking, and the HTTPS PGDG repository uses a key-scoped Signed-By entry. Apt update and client17 installation follow repository creation. This follows the [official PostgreSQL Ubuntu repository instructions](https://www.postgresql.org/download/linux/ubuntu/), independently read for this review.

The17 bin directory, both explicit major17 guards, server17, and the immediately following enabled native test remain intact. No skip or continue-on-error is added. All runtime, SQL, listener and real restore harness bytes match accepted Candidate2. The shared index retains the reviewed pre-access hash `7f7a96f2fd015ee11a94ed56d5948745f6743c82ac0ba21aa5d06a74e629ad53`; Candidate3's import-graph review carries forward by unchanged bytes.

## Measurement correction and retained history

Candidate3's immutable snapshot is also correctly encoded for the reported local-rehearsal file: explicit UTF-8 reading gives declared/embedded SHA256 `adef448fdde284564ec0baab123657f95043b75c81d5cc3c7cfb0129e23baef4`,48362 bytes. Root confirmed its earlier default Windows decoding caused the reported mismatch. No product encoding defect is claimed. The initial review4 harness expected root's reported mismatch and failed; its source and first-result explanation are retained. Corrected checks pass. Frozen REVIEW3 is unchanged and its CI provisioning rejection remains valid.

Candidate1 failures, Candidate2 accepted native evidence and the two escaped remote CI defects are retained. Author workflow.task_version4 denotes candidate ordinal; the explicitly authorized continuation journal is version1, ticket `2677ff1a487b43c18f79ce478d83645f`. Root owns that metadata correction; obsolete author native-review bullets do not authorize replay. No hosted/customer readiness or held-method release claim. Actual cost and observed compute remain unknown.
