# M77 final-runtime observer independent review

**Scoped software PASS**, 2026-09-16, reviewer `/root/m76_cto`. Actual final deployment, restart, completed exercise/revisit and browser closure remain pending. This review does not run a completed-journal checker against the open exercise.

Requested QA reviewer Astra/high follows the existing registry; reused context's observed model/effort remain unknown. Reviewer authored no observer/runtime code. Root owns host access, final deployment, restart and actual log collection.

## Exact reviewed source

Private `.superpowers/m77-observe-final-runtime.py`: SHA-256 `18e9812e8209f298d1f7a066efad9737877331b9bb8e9015ed4672fb40b5dcf1`.

The first source inspection identified missing deployment-scoped startup provenance, permissive readiness/image/active-deployment checks and optimization-sensitive assertions. Root repaired those boundaries. The final restart path also binds the predecessor observation's exact commit, phase, ready payload and chronology to the requested restart. Initial concerns were found by inspection; no failed actual host observation is claimed.

## Boundaries now enforced

- Exact requested deployment, SUCCESS, commit `da90417ba302575cc6c02380adfcaeba37e7b9b6`, valid image digest and no other nonterminal deployment in the supplied observation.
- HTTP200 readiness with exact private-synthetic profile, schema20 and verified legacy containment.
- Restart acknowledgement and same deployment/image/commit as the preceding verified deployment; predecessor readiness observation precedes the restart request.
- Raw startup-log bytes match the scoped collection hash and deployment/commit/image. Collection follows the restart request, is not future-dated and is less than15 minutes old.
- A real `staging_started` event occurs after that request and no later than collection. Optimized Python execution refuses before observations; official output creation is exclusive.

The collection receipt is internal provenance, not independent provider authentication. Root must actually collect the logs using the exact deployment argument and preserve the resulting receipt/raw bytes. Future artifact review will verify those records; source acceptance alone cannot prove that restart happened.

## Independent offline evidence

Executed the exact final source with network and filesystem effects mocked: **19 cases**, two valid deployment/restart observations and17 refusals. Challenges cover wrong phase/profile/schema/containment/image, another active deployment, substituted prior commit or chronology, wrong collection deployment/image/commit/hash, future or old startup, future collection, unacknowledged restart and optimized execution. No host request or official output write occurred.

Private `.superpowers/m77-independent-final-runtime-final-probe.json`: SHA-256 `fc7ed5146958f5564145f08393f6bec6bbb507a82bcc0cff5d328eb86d124bc9`.

Root may use these exact observer bytes for the authorized final deployment/restart observations after the running exercise closes. Unknown or failed outcomes remain preserved; full M77 acceptance requires the later actual evidence.
