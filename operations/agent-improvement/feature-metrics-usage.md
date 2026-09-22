# Feature metrics CLI

`tools/feature_metrics.py` is an offline, standard-library validator and report generator. It reads a feature registry, append-only feature and provider-usage event streams, and optionally the native run records already linked by each feature. It writes only the requested derived JSON and Markdown reports. It does not edit event streams, run records, status, or milestone ledgers.

## Commands

Validate the current build records, including the optional native-run join:

```powershell
python tools/feature_metrics.py validate --registry operations/agent-improvement/build-feature-registry.json --feature-events operations/agent-improvement/build-feature-events-v1.jsonl --usage-events operations/agent-improvement/build-usage-events.jsonl --runs-dir operations/agent-improvement/runs
```

Generate both scorecards:

```powershell
python tools/feature_metrics.py scorecard --registry operations/agent-improvement/build-feature-registry.json --feature-events operations/agent-improvement/build-feature-events-v1.jsonl --usage-events operations/agent-improvement/build-usage-events.jsonl --runs-dir operations/agent-improvement/runs --json-out operations/agent-improvement/build-scorecard.json --markdown-out operations/agent-improvement/build-scorecard.md
```

Omit `--runs-dir` when native run files are unavailable. The report then keeps every registered run in the denominator and marks its settings, review, and cost unknown. Native-run costs and provider-call settlements are displayed separately because they may overlap. No provider call is inferred from a native run.

## Registry v1

The registry is one JSON object with `schema_version: 1` and a `features` array. Each feature requires:

```json
{
  "feature_id": "OPS-METRICS-01",
  "milestone_id": "AGENT-IMPROVEMENT",
  "title": "Feature delivery scorecards",
  "problem": "Feature-level QA and cost history is missing.",
  "delivered_behavior": null,
  "state": "implementing",
  "owner": "/root/feature_metrics",
  "risk_class": "critical",
  "complexity_class": "bounded_tooling",
  "run_ids": ["OPS-METRICS-01", "OPS-METRICS-QA-01"],
  "dependencies": [],
  "acceptance_criteria": [
    {"criterion_id": "AC-01", "description": "Counts are exact.", "applicable": true}
  ]
}
```

States are `planned`, `implementing`, `in_qa`, `rework`, `accepted`, `published`, `live`, `blocked`, or `superseded`. Accepted or later features need a nonempty delivered behavior, prior passing applicable criteria, and the latest completed independent QA round on the exact accepted artifact. Publication and deployment must follow that acceptance on the same artifact. A later event for another artifact requires the registry state to move out of accepted until that version is reviewed and accepted.

## Feature events v1

Each nonblank JSONL line has these common fields:

```json
{"schema_version":1,"event_id":"E1","feature_id":"OPS-METRICS-01","occurred_at":"2026-09-22T12:00:00Z","event_type":"qa_disposition","actor":"/root/metrics_qa","run_id":"OPS-METRICS-QA-01","artifact_version":"sha256:...","evidence":["path/to/evidence.md#finding"],"correction_of":null}
```

The stream must be timestamp ordered, IDs must be unique, the run must be registered to the feature, and every event needs an artifact version and evidence. Type-specific fields are:

| Event | Additional fields |
| --- | --- |
| `started`, `repair`, `accepted`, `published`, `deployed`, `blocked`, `superseded` | None |
| `qa_handoff` | `round_id` |
| `qa_disposition` | `round_id`, `disposition` (`pass`, `fail`, `insufficient_evidence`), `independent` (boolean) |
| `finding_opened` | Stable `finding_id`, `severity` (`low`, `medium`, `high`, `critical`), `category`, `summary` |
| `finding_resolved`, `finding_reopened` | Stable `finding_id` |
| `criterion_result` | `criterion_id`, `status` (`pass`, `fail`) |

A correction is a new event whose `correction_of` names an earlier active event of the same type and feature. QA handoffs, QA dispositions, and finding history cannot be corrected away; append a new round or finding status instead. This preserves first failures and stable unique-finding counts. Unresolved high/critical findings block acceptance.

## Usage events v1

Every reservation or settlement has the common event fields above plus `call_id` and `phase` (`implementation`, `review`, `retry`, or `orchestration`). A reservation adds:

```json
{"event_type":"reservation","provider":"openrouter","generation_id":"provider-generation-id","retry_of":null,"reserved_usd":"1.00","requested_model":"model-name","requested_effort":null,"price_version":"provider-price-2026-09"}
```

A settlement adds:

```json
{"event_type":"settlement","actual_usd":"0.1375","charge_status":"billed","actual_model":"provider/model","actual_effort":null,"tokens":{"input":100,"cached_input":20,"output":40,"reasoning":10}}
```

Money is a nonnegative decimal string and is summed with decimal arithmetic. A known zero needs an evidenced settlement with `charge_status: "billed"` or `"not_billed"`; `not_billed` must be zero. An unsettled call remains unknown, even when it has a reserve. Each call has one reservation and at most one active settlement; provider/generation identity cannot be reused. A retry is a distinct call, references an earlier call with `retry_of`, and uses the `retry` phase. Cached input and reasoning tokens are subsets of input and output respectively.

## Report interpretation

Actual provider USD is a measured lower bound with known-call and total-call denominators. Unsettled reserves appear separately. Native-run requested and observed settings, reviewer/verdict, and cost coverage have run denominators and are never converted into provider calls. QA counts use stable findings, handoff rounds, and failed-round-to-revised-artifact rework cycles. The model review is descriptive by actual route and task class; it does not claim model causality or savings.

Run the focused tests with:

```powershell
python tools/test_feature_metrics.py
```
