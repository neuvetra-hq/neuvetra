# OPS-BUILD-TOOLS-INTEGRATION-01 review handoff

Date: 2026-09-22. Author: `/root/ops_integration`. Functional role: CTO integration author. Requested compute: `gpt-5.6-sol` / `high`; observed model, effort and resource usage: unknown. Role prompt SHA256: `1368166de5ee8c4d399f3d3b4b26e94a92c99de2fd2ad6389fdf7b78f8a054f1`.

## Candidate disposition

Ready for independent review; not accepted, committed, pushed, published or executed against a paid provider. This integration adds only the independently accepted build-metrics/model-pilot preparation, a prospective policy reference, and a focused CI test step. It does not change current role defaults, product code, deployment, provider state, product milestone records, `operations/status.json`, `operations/board-report.md` or `operations/next-session.md`.

The current candidate snapshot is `operations/agent-improvement/snapshots/OPS-BUILD-TOOLS-INTEGRATION-01-CANDIDATE3.json`, SHA256 `d96a4beef69f17fb80c7e1d3e51cbab8d45dbe56e93c40ecb1d3f3094b521412`. It contains the exact UTF-8 text and SHA256 for all 31 candidate files: the 28 source imports plus `AGENTS.md`, `.github/workflows/agent-ops.yml` and `.gitattributes`. Candidate 1 remains immutable at SHA256 `4a9cef626e520e8c344cc481b2d69fb2ee1aefa94fb68542cd583c8254583eb8`; candidate 2 remains immutable at SHA256 `bf905af8aec68db367f1b3ef47ac7a68064b075ae74ba8e61a40c61af2ff17a5`. Candidate 3 supersedes candidate 2 only to normalize `.gitattributes` itself to the repository's required LF form. The source checkout and destination hashes matched for all 28 imported files after copy; every destination was absent before import, so no existing content was overwritten.

## Explicit imported-file manifest

| Path | SHA256 |
| --- | --- |
| `tools/feature_metrics.py` | `594bd35f185949b5083eb693feafa28c64895a191001824f5be0147b788a7ad3` |
| `tools/test_feature_metrics.py` | `a72a29e98326b7e6c7c63cf5759f90aae414b08c836cfba6ae9e8ee28267ada7` |
| `tools/build_model_pilot.py` | `8f28f99db4e369b8973b3bece0b699c042a0de68a8abf43bab064178e02724f3` |
| `tools/test_build_model_pilot.py` | `9a27e086057adfd2164d73f258db1228e84f7d9836c572c8f721ed35153eadbf` |
| `operations/agent-improvement/OPS-METRICS-QA-01.md` | `1a230a4a8da03286aadb5a62367f6e647f199437549325d6bad0a45009171225` |
| `operations/agent-improvement/build-feature-events-v1.jsonl` | `db41d547de9af211482e919ea6ac835e56894ac4c6464236a2bbf3d566f6eca6` |
| `operations/agent-improvement/build-feature-events.jsonl` | `4e17b8e93b6d9a7ce54324ff196aafb679a5d6e07fd9fdb21a030b6eb07862d4` |
| `operations/agent-improvement/build-feature-registry.json` | `e36befa8434087588d69cd61d3d46b96cdbb6b741ccd51f6d1e4f6cc41ad2df0` |
| `operations/agent-improvement/build-operations-continuation.md` | `177e924538fb53be038d28baa2ea0647fe3bef7ebf7d09c3b9e359b9bee591a8` |
| `operations/agent-improvement/build-pilot-candidates.json` | `50dbe25be0b168f16fdfc588f433317696699a48fbd87cebe62a62111e042ba1` |
| `operations/agent-improvement/build-pilot-fixtures.json` | `4cbf395a45c8f9b8bcaed2fcc446f4930a63121feffa83541b962fa766d7f94d` |
| `operations/agent-improvement/build-pilot-review-rubric.json` | `7a636a2039858e2885cd47bd431f1af49d9f2865406feb786946281ec722d3aa` |
| `operations/agent-improvement/build-pilot-usage.md` | `0d8b50c3d12cbd2e30613aaf35570e80086ef444817d063463861fe9ef85741d` |
| `operations/agent-improvement/build-scorecard.json` | `65a3e661a121b986a980ffd1370af55b199457fe0bf7ac558d3fad9414e160c5` |
| `operations/agent-improvement/build-scorecard.md` | `5c6bf2a47f2d02c4fedbdfec308083d3e622adb30d64982b7658427e596e3db0` |
| `operations/agent-improvement/build-usage-events.jsonl` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `operations/agent-improvement/feature-event-schema-migration.json` | `737c98a61161c01712737104fcbca4f4e75ae35779535e0f670d85b5165f5afc` |
| `operations/agent-improvement/feature-metrics-usage.md` | `d4df7ddea79b1fc2c4e1084a4b566fa26b1f95dadb46fa4980478a195646c2bf` |
| `operations/agent-improvement/model-performance-policy.md` | `0a40c8f998cf8d12397ba0d95323a95aa27c81f8f0e93223e172cf9745541bc5` |
| `operations/agent-improvement/model-performance-reviews.json` | `76ff25631b757223a1daba66cb6bf015495db8be2c092256702a715453dbd552` |
| `operations/agent-improvement/openrouter-build-pilot-authorization.json` | `f3c9bcd9e062373512646a5fa64ae9f832ff8ead4ea6c62336ebf46b85747886` |
| `operations/agent-improvement/runs/OPS-METRICS-01.json` | `176292a505476e5e0e27e0cab3e2c97944b46a5aa3492a2257c25d4af2db3e29` |
| `operations/agent-improvement/runs/OPS-METRICS-QA-01.json` | `8e1f6e2c46300639d625387c9f5417d0554446abe022267ab5da7799d80e38fe` |
| `operations/agent-improvement/runs/OPS-PILOT-01.json` | `b09914e0daccde84fb500b2d17380bc5afd5f1fcf39c2523216056f6a9734241` |
| `operations/agent-improvement/snapshots/OPS-METRICS-01.json` | `6e8f5e1eebc16f68bf3e537946153027718788c6dee5ad68c670e02ea3134f78` |
| `operations/agent-improvement/snapshots/OPS-METRICS-EVENTS-PRE-INDEPENDENCE.jsonl` | `4e17b8e93b6d9a7ce54324ff196aafb679a5d6e07fd9fdb21a030b6eb07862d4` |
| `operations/agent-improvement/snapshots/OPS-METRICS-QA-01.json` | `146436a2f3ff3f9c5029a473d3548ccaa72b6525f6ed7cdf136c3fb305166465` |
| `operations/agent-improvement/snapshots/OPS-PILOT-01.json` | `e13afa8f685b3ef490053a358c2fdf8722ed515e8a1d1972415da17f7d4e3ffa` |

The candidate-only edited files are `AGENTS.md`, SHA256 `d39aaeccea6081dfcc945192f9719a629d9e888ac8f277a04ce06ed1c901195e`; `.github/workflows/agent-ops.yml`, SHA256 `da43acf423aced1e32a56b1c9ff934191e512fae50cc878f24ab1cabb1991a43`; and `.gitattributes`, SHA256 `d6482da90b3159939d9a5623e88fc5997283b1956cd9acc3918a530adc2c37e0`. `AGENTS.md` adds one prospective link to the model-performance policy and explicitly preserves all role defaults until comparable independently reviewed evidence supports a recorded change. The workflow adds the four tool/test paths and runs the two focused offline suites. The attributes change names exactly the 15 imported CRLF paths and marks only those files `-text whitespace=cr-at-eol`, preventing normal Git staging from changing accepted run, snapshot, event and report bytes.

## Verification performed

- `python -B -m unittest discover -s tools -p test_feature_metrics.py -v`: 20 tests passed.
- `python -B -m unittest discover -s tools -p test_build_model_pilot.py -v`: 10 tests passed.
- `python -B tools/build_model_pilot.py` with `OPENROUTER_API_KEY` removed from the child environment: exit 0; three fixtures, six planned requests, 8,192 output tokens per request; `network_used=false`, `credential_required=false`, `ledger_changed=false`.
- Before and after preflight, neither `operations/agent-improvement/build-pilot-ledger.jsonl` nor `operations/agent-improvement/build-pilot-output` existed. No paid execution command ran.
- All 160 `sourcePins` in `evaluations/research-qa/m78-continuation2-journey-preparation.json` matched their recorded SHA256 immediately before import and again after candidate assembly. No imported path appears in that pin set.

The integrated evidence preserves the original QA history: feature metrics first failed with three findings, failed a second review with one new finding, then passed after two repair cycles; the pilot adapter first failed with two findings, then passed after one repair cycle. Paid provider behavior, external prices, billing, candidate output quality and model suitability remain unobserved. Credential availability is an execution blocker for the already approved pilot, not a product dependency, and no credential was sought or read.

## Independent review request

Review the exact candidate 3 snapshot and live files. Recompute all 31 candidate hashes, verify the 15 exact `-text` rules produce staged Git blobs whose bytes retain the accepted SHA256s, rerun the 20+10 suites and credential-free preflight, confirm the CI path/commands are valid on Ubuntu Python 3.12, check that the imported scorecard and event stream preserve the stated first-review failures and repair counts, and verify the M78 160-file source gate remains byte identical. A passing review may bind this snapshot in the run record; publication, commit, push and any paid pilot execution remain with the root coordinator.
