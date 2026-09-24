# Bounded build-model pilot adapter

Status: implemented and tested offline on 2026-09-22. No live completion request has been made through this adapter. The approved aggregate pilot ceiling is USD 5; it is a ceiling, not a spending target.

## Fixed scope

The adapter compares `minimax/minimax-m3` and `moonshotai/kimi-k2.7-code` on the synthetic cases in `build-pilot-fixtures.json`. It sends text only and requests text only. It provides no model tools, code runner, file access, arbitrary prompt/model/endpoint control, production authority or retry. Returned text is untrusted and requires independent review.

The default action is offline and needs no credential or network:

```powershell
python tools/build_model_pilot.py
```

This validates the fixed fixture and prints a plan. It does not fetch prices, create a ledger or reserve money.

The only paid path is explicit:

```powershell
python tools/build_model_pilot.py execute --run-id OPS-PILOT-01-A
```

This command assumes an approved secure binding has already placed `OPENROUTER_API_KEY` in the executing process environment. Do not put the key in an argument, fixture, file, report or saved environment export. The adapter does not load environment files. A unique run ID prevents accidental duplicate request identities. There is no CLI option to reset or replace the ledger, change the USD 5 cap, candidates, endpoints, fixtures or token limit.

## Execution gates and receipts

Each execution fetches the public model catalog before reserving or dispatching. It blocks if either fixed model is absent; prompt, completion or cache pricing is invalid; an unknown pricing field or price override appears; a per-request limit is present; required parameters are unsupported; or text/context limits are incompatible. Provider routing sets prompt and completion price ceilings from that catalog, sets per-request price to zero, disables fallbacks, requires all parameters, denies provider data collection and caps each output at 8,192 tokens.

The complete batch is reserved under an OS file lock in `operations/agent-improvement/build-pilot-ledger.jsonl` before its first completion request. The immutable exposure calculation is settled known cost plus the full reservation for every open or uncertain request. Appends are flushed to durable storage. A corrupt event, changed cap, duplicate request ID, duplicate provider response ID or batch above USD 5 blocks. Ambiguous catalog charges block before dispatch; the implementation does not guess a charge. A timeout, malformed response, duplicate generation receipt or missing/unbounded usage cost retains the affected reservation. There is no retry or ledger-reset command.

Successful results are written once to `operations/agent-improvement/build-pilot-output/<run-id>.json`. The receipt includes response ID, observed model, bounded token usage and reported cost. Billing settlement and output usability are separate: truncated, non-JSON, model-mismatched or tool-attempting text is preserved with `output_status: unusable` and issue codes so review does not mistake a billed response for an accepted answer. Transport errors record only stable reason codes, never HTTP bodies, exception text or credentials.

Run the offline checks with:

```powershell
python tools/test_build_model_pilot.py -v
python -m py_compile tools/build_model_pilot.py tools/test_build_model_pilot.py
```

The mocked suite exercises missing credentials, a fresh catalog per run, request bounds, aggregate budget refusal before dispatch, timeout retention, unknown usage, duplicate request and generation IDs, concurrent locking, unknown catalog price fields and truncated output classification. These checks do not establish provider availability, account balance, actual billing behavior, model quality or fitness for autonomous GHG work. Independent QA must review the exact adapter and evaluation outputs before any staffing decision; one synthetic screening cannot change role defaults.
