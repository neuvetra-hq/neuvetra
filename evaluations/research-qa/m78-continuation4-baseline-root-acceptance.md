# Continuation 4 closed baseline

Root session 32670 exited successfully. The read-only baseline completed at `2026-09-22T22:23:10.489Z`: 285 requests, zero application writes, zero request errors, four main and four legacy test sessions closed, and zero unknown sessions. The prior failed and interrupted journals and the original saved inventory remain unchanged.

The closed main journal has 42 events and 9,186,947 bytes, SHA-256 `ef4d8ebaa36b447d4dfa7cf8e6636b263d587a4b29c899d875f3e5401eedf3d5`, head `6190671c0758e414886c1c80b3aecfa748020a58f68890072c81335e84ef7a90`. The diagnostic journal has 572 events and 243,558 bytes, SHA-256 `b98846b6ce33c0d943a73437f13ba83390a4c63d3ab3547729b4926d7573bf40`, head `a41a45097e0b13b315a03fc6c5287504a3f6e4b4880d31bf5edee2edc682e660`.

The independently reviewed evaluator passed against immutable baseline gate `34a1b7a8773120169264f5ce500490e87b8118f6ebfca2b8cabe2e6527a6b5e5`, tooling commit `a74cffa59b18305e5eaf4dd4c65382c08bc8a151` with six successful checks, and the fresh admission-time application59c/schema21 runtime. Result `m78-continuation4-baseline-independent-result.json` has SHA-256 `57fc10f6ee4dce55ced4060aa1d41cbd5a125eac3bd58d99bbad7c37ef1daddf`. It confirms all173 source pins, nine historical evidence pins, the retained initial inventory, 328 prior-download comparisons, exact retained M78 export, decoded state and session closure.

The additive closed-admission guard also passed all actual request methods before the result was produced. This supplements the escaped offline-checker gap recorded in `m78-continuation4-baseline-admission-supplement.md`; the frozen original evaluator and gate were not edited.

Status: accepted for this exact baseline. Independent actual-baseline supplement `6937df29bb08b4bd253ceade366c1e19d512e0e256a0090b0d00f688fc1f6ae3` rechecked the immutable inputs and confirmed eight token POSTs and eight logout POSTs. Root accepts that scoped verdict. The 37-operation exercise, restart, read-only revisit and browser demonstration have not run. Scope1 customer release remains incomplete. The new transport completed this baseline; this does not establish the cause of the earlier timeout.
