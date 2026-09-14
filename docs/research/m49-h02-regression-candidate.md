# M49 H02 provider-disabled regression candidate

M49 prepares exactly one public/synthetic question, `M43-H02`: “How should I
research a U.S. grid-average factor for a facility, and what should I verify
before treating the result as current?” It is a regression/recombination of
semantics already exercised by live W02 and W09. It is not a novel held-out
canary, does not enlarge the evidence base, and cannot support a fresh held-out
or reliability claim.

The exact initial analyze request is source-blind and contains the question,
ordinary application instructions, schema, and routing controls. Any later
provider-dependent plan or verify request may use only the reviewed S01-S18
model-visible corpus. The H02 grading key is a separate evaluator-only file.
Its expected `qualified` / `none` result, four required points, required S06-S10
and S18 evidence roles, forbidden claims, and objective checks do not enter the
question or source artifacts.

The configured route remains OpenRouter's Anthropic Messages endpoint. Analyze
and verify use `anthropic/claude-opus-5`; plan uses
`anthropic/claude-sonnet-5`. Routing is direct to Anthropic with fallbacks
disabled, required parameters enabled, `anthropic/fast` ignored, and all eight
known optional/default plugins explicitly disabled. The frozen profile retains
strict returned model, canonical model, provider, attempt, strategy, pipeline,
cache, and native-cost checks.

The maximum path is five stages for this one case: analyze, plan, verify, then
at most one existing in-request correction using an additional plan and verify.
There are zero question retries and zero carried stages. Each stage has 180
seconds, the question has 240 seconds, and the fixed supervisor has 30 minutes
to cover bounded capture, review, and shutdown overhead. Any transport, model or
provider identity, material pipeline, cost, source, stage/order, timeout,
response validation, terminal capture, or shutdown mismatch stops the run. A
stopped or uncertain attempt cannot restart or carry capacity.

The initial request is 12,398 bytes. With current adapter pricing and its 25%
margin, its analyze reservation is $0.462175. Conservative 64 KB plan and
verify reservations are $0.37798 and $1.3632. The five-stage sequence therefore
reserves $3.944535. The planning expectation is $0.271573, the arithmetic mean
of only the two latest same-pipeline M46 settled cases; that small,
path-dependent sample is not predictive.

Exact settled exposure through M40 plus M46 is $4.082972001. Adding retained
historical uncertainty of $1.62485 gives $5.707822001. Adding the proposed M49
reservation gives $9.652357001 against the current internal monitoring target
of $16.2966005, leaving $6.644243499. The reservation and target are local
controls. Neither is an OpenRouter-enforced cap or billing guarantee.

The provider-disabled rehearsal uses the dedicated frozen M49 wrapper and the
same M47 v4 Windows parent-process mechanism. The backend queries its actual
parent executable path through Kernel32 and hashes the live executable before
admission. It then consumes a one-use wrapper capability before exercising
startup, question admission, deterministic response-validation mechanics,
terminal capture, and controlled shutdown. The simulated records contain no
model output or answer class and make no live outcome claim. Direct, manual,
copied, changed, stale, partial, and replay paths refuse before admission.

Immediately before any later paid request, a new independently hash-bound check
must prove current official EPA source bytes/applicability, unchanged local
release and catalog pins, current OpenRouter account/workspace/plugin/routing
controls, sufficient balance for $3.944535, exact runtime binaries, absent prior
M49 production receipts, closed conflicting ports/processes, and the approved
canonical browser origin. M49 contains no paid authorization. A provider call
requires a separate explicit board decision for this exact regression case,
route, five-stage limit, zero retries/carry, and conservative reservation.

The wrapper check is local process and filesystem evidence, not hardware or
administrator attestation. A malicious same-user administrator able to replace
the wrapper, backend policy, and state together remains outside this bounded
control.

