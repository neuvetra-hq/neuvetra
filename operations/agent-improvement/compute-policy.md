# Role compute policy

Version 2026-09-14.1; checked September 14, 2026. These are provisional operating defaults for new assignments, not measured optima or guarantees of perfect work. [roles.json](roles.json) is the single machine-readable source. The coordinator selects settings through the actual dispatch tool; a Markdown role title does not change the model.

## Defaults

| Role | Default model / effort | Critical or ambiguous work |
| --- | --- | --- |
| CEO coordinator | GPT-6 Astra / medium | Astra / high |
| CPO | GPT-5.6 Sol / medium | Astra / high |
| CTO | GPT-5.6 Sol / high | Astra / high |
| Software engineer | GPT-5.6 Terra / medium | Sol / high |
| Data / database | GPT-5.6 Sol / high | Astra / high |
| Head of QA | GPT-6 Astra / high | Astra / high |
| Security / reliability | GPT-6 Astra / high | Astra / high |
| Regulatory research | GPT-5.6 Sol / high | Astra / high |
| Accounting validation | GPT-5.6 Sol / high | Astra / high |
| CARB / GHG audit reviewer | GPT-6 Astra / high | Astra / high |
| Commercial operations | GPT-5.6 Terra / medium | Sol / high |

Assign the critical route before work involving authorization/tenant boundaries, concurrent or immutable data, numerical methods, source applicability, uncertain law, security controls, live provider lifecycle, or consequential acceptance. Thus a database or accounting implementation is not a routine Terra engineering task merely because its diff is small. The coordinator may combine planning responsibilities but an author cannot be the independent release reviewer.

For mechanical extraction, formatting, link inventory or a structured summary from supplied evidence, a separately bounded helper may use GPT-5.6 Luna / low or medium. It cannot give final consequential approval. Use deterministic tools for calculations, hashes and record validation. A helper still needs an independent check proportionate to its result. Do not split a five-minute task across multiple roles merely to save tokens.

## Escalation and economy

- Start with the applicable route; do not make every role maximum effort. Increase effort or move to the critical model when a failed check reveals a reasoning gap, competing interpretations remain, or coupled boundaries exceed the brief. First repair missing evidence, unclear scope or broken tools; compute does not supply them.
- After two unsuccessful corrections of the same material defect, obtain a fresh stronger review of the whole affected contract rather than repeatedly patching its latest symptom. Preserve the first result and rework cost. This is a local correction trigger, not permission to retry paid product requests or consumed authorizations.
- `xhigh` is an exception for a specifically named unresolved reasoning problem and a defined stopping condition. `max`/`ultra` are not defaults. Escalation changes only the assigned work, not an ongoing sibling task or the user's global settings.
- Use a complete but small context packet, bounded output and reusable deterministic checks. Avoid full archive reads, duplicate research and full-suite reruns without a changed risk. Review quality is not measured by how many tests are listed.
- A full-history fork inherits the parent's settings with the current collaboration tools and does not accept model overrides. For an explicit override, use `fork_turns="none"` or a supported limited fork and provide the complete handoff. The current session supports three delegates plus root. Verify availability each time; API capability is not proof that this client supports the same setting. If selection is unavailable, record the actual inherited model or unknown, and disclose the deviation; do not claim policy enforcement.

## What we observed

Selective read-only inspection of local configuration found global `gpt-6-astra`, `medium`, service tier `default`. Current task metadata also records Astra/medium. M60's three named subagent contexts (CPO, CTO and QA) record Sol/medium; their spawn calls omitted overrides. The inspected continuation of the product coordinator contains both Luna/high and Sol/medium contexts; its last observed context was Sol/medium. That does not assign every historical defect to either model or establish per-role defaults for all eleven roles. [Sanitized observation](compute-observation.json).

The historical reviews show recurrent omissions and integration defects. We have no controlled same-task model/effort comparison, complete role-level resource accounting or causal evidence explaining how much compute contributed. Stronger reasoning may help hard boundary analysis; the effect here is **unmeasured**. Additional tokens cannot guarantee correctness, current source evidence or independence.

## Cost basis and evaluation

Official API standard text rates observed on September 14, 2026, USD per million tokens:

| Model | Uncached input | Cached input | Output |
| --- | ---: | ---: | ---: |
| GPT-6 Astra | 10.00 | 1.00 | 50.00 |
| GPT-5.6 Sol | 4.00 | 0.40 | 20.00 |
| GPT-5.6 Terra | 2.00 | 0.20 | 12.00 |
| GPT-5.6 Luna | 0.20 | 0.02 | 1.20 |

These are base API reference rates, **not the user's Codex subscription/credit bill**, not an observed task cost, and not a savings estimate. Long-context requests, cache writes, service tiers and tools can change the bill; the linked model pages describe these conditions. Runtime service-tier selection can differ from global config. Do not map API dollars onto Codex usage or count nested token counters twice. Refresh rates and service-tier rules before estimating actual paid execution.

Compare cost per independently accepted result, including failed attempts and reviewer cost. To isolate model impact, compare the same task, prompt, tools and evidence across two models at fixed effort. To isolate effort, keep the model fixed. Use separate fresh contexts and evaluator-held expectations; retain failures, false alarms and inconclusive cases. Keep source freshness and candidate visibility equal. Include unfamiliar variations and a later supervised real assignment. The three-assignment pilot establishes instrumentation first; broader paired benchmarking is a separate bounded experiment, not silently launched paid traffic.

Sources: [Codex model choice and effort](https://learn.chatgpt.com/docs/models), [Astra API model](https://developers.openai.com/api/docs/models/gpt-6-astra), [Sol API model](https://developers.openai.com/api/docs/models/gpt-5.6-sol), [Terra API model](https://developers.openai.com/api/docs/models/gpt-5.6-terra), [Luna API model](https://developers.openai.com/api/docs/models/gpt-5.6-luna). Model positioning and rates come from these sources; the role assignments and escalation thresholds above are Neuvetra's provisional policy choices.
