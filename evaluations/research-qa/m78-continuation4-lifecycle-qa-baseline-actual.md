# M78 continuation 4 immutable baseline QA supplement

## Verdict

Accepted for the exact closed baseline only. The immutable journal, diagnostics, closed-admission receipt, gate and existing official result match their recorded SHA-256 values. The additive TypeScript verifier parsed the exact diagnostic bytes and found eight token requests and eight logout requests, all using `POST`.

The previously accepted baseline evaluator has an escaped source-level case: a fully rehashed fixture can use `GET` for the token route and still pass that evaluator. The separate closed-admission builder and this independent verifier reject that case. The actual immutable diagnostics do not contain it.

## Scope and limits

- Main journal: 42 events, 9,186,947 bytes, completed at `2026-09-22T22:23:10.489Z`.
- Diagnostics: 572 events, 285 requests, zero request errors, zero application writes, eight closed authentication sessions and zero unknown sessions.
- Gate SHA-256: `34a1b7a8773120169264f5ce500490e87b8118f6ebfca2b8cabe2e6527a6b5e5`.
- The existing official baseline result was read and hashed; its writer was not rerun.
- QA used no network, database or credentials and changed none of the admitted artifacts.
- This receipt does not accept an exercise or full lifecycle.
