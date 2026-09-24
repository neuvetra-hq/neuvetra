# M78 continuation runtime observer source review

Task M78-CONT-RUNTIME-REVIEW-01. Reviewer /root/resume_release; root authored the observer. Source verdict: accept exact SHA aedfb1164141af8cd108f313ac352d3e2cba37cbeb54ae1f5f1e5cae9105b194 for commit d139628cb53f591bfd516a4aac41dd62e1138a53. September22,2026.

Adapted the preserved prior26-case evaluator under new continuation-only filenames. It compiles and executes the exact byte-pinned observer in a temporary synthetic filesystem with urllib mocked. All26 cases matched expectations:2 valid deployment/restart cases and24 rejected negatives. No provider, credentials, hosted database, actual readiness call, original journal, official runtime output, Git or shared ledger operation occurred. Historical evaluator/results are unchanged.

The observer requires the requested deployment ID to select a SUCCESS deployment, no competing live deployment, exact published commit, full image digest, HTTP200 and ready/private-staging/schema21/legacy-containment fields. Restart requires the same deployment/image/commit and prior readiness, an acknowledged restart, log-byte hash bound to collection deployment/commit/image, prior observation before request, request before startup, startup at or before collection, collection no later than observation and less than15 minutes old. Old startup, startup exactly at request, future startup/collection, missing event, changed logs and substituted identities are rejected. Existing output remains unchanged because writing uses exclusive x mode. Optimized Python is refused so assertions cannot be silently disabled.

This is validation of source behavior using fabricated test inputs, not verification of an actual deployment or restart. Root owns provenance and fresh collection of private request/deployment/log metadata and exact observer byte admission. The readiness endpoint does not itself return a commit; code identity is bound through the selected provider deployment metadata. No independent provider attestation is claimed by this evaluator.

Evidence: m78-continuation-runtime-observer-independent.py and m78-continuation-runtime-observer-independent-result.json. The result explicitly states networkMocked=true, hostedCalls=0, officialOutputWrites=0 and actualDeploymentOrRestartVerified=false. Root must still run its admitted observer on actual collected evidence and separately verify continuation lifecycle.

Requested inherited role compute gpt-6-astra/high; actual model/effort not observable. Own new evaluator/result/report/run/snapshot only; observer untouched.
