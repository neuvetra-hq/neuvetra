# M50 v4 live result

M50 v4 **failed safely**. The exact H02 question was submitted once through the consumed one-use authorization. One validated analyze request reached OpenRouter and Anthropic Claude Opus 5. OpenRouter returned HTTP 200 with finish reason `stop`; its current log records 4,132 input tokens, 521 output tokens and $0.033685 native cost. No plan or verify request ran, no retry occurred and no capacity carries forward.

The application rejected the analyze stage and returned `unavailable / provider_failure`. The response contained no claims, evidence, sources, retrieval result or composition. It therefore did not satisfy H02 and cannot be graded as a successful answer. The post-shutdown grader refused before reading the evaluator-only key because no success terminal capture exists.

The runtime sealed a failed payload, an exact native-cost closure with no pending or uncertain attempt, the terminal response bytes and a controlled shutdown. All scoped ports are closed and no wrapper process remains. The rounded account balance moved from $98.16 before the run to $98.12 after the run, consistent with the exact $0.033685 settlement.

Two observability defects are now demonstrated. First, the runtime did not preserve the finite response-validation failure detail, so the sealed artifacts establish only that a successful provider generation was rejected during analyze. Second, after shutdown the wrapper tried to parse live-backend stdout as JSON even though the live backend emits no final JSON result. That produced a separate wrapper parse error. Its generic failure record incorrectly says zero provider requests; the runtime capture and shutdown are authoritative and prove one.

M51 is the next milestone: reproduce the analyze response-contract failure offline with a sanitized response-shape fixture; preserve a bounded failure phase/detail; repair the live-backend result emission and contradictory wrapper failure accounting; then obtain independent provider-disabled QA. No live rerun is authorized. The M50 v4 candidate stays frozen and unchanged.

[Execution record](../../operations/openrouter50-v4-live-execution.json)
