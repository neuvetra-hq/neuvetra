# Exact-image live stop — repair 1 author handoff

2026-09-26. Root authored this repair after the preserved independent Candidate 1 FAIL in `hosted-setup-01-live-stop-independent-review1.md`. This candidate has not been independently accepted and must not be used to stop the live service until exact-byte QA passes.

Frozen candidate SHA-256:

- `tools/staging/hosted-setup-live-stop.ts`: `25b536f42c5dce785c9d2a8af25358ba26784df9b127459ff541d0b45b70f45a`
- `tools/staging/hosted-setup-live-stop.test.ts`: `282a812a7206682302e209270d70882b9c00c90f9b64b3ebbc4a8eeb9d697733`

Repair maps to the four original findings:

- LIVE-STOP-F01: snapshot top-level request data before the first await and retain the original WeakMap-issued binding identity through consumption, journal and stopped verification.
- LIVE-STOP-F02: reject accessor/unsupported request and transport shapes; snapshot transport and runtime methods; the default scale path hashes and executes the same local executable path.
- LIVE-STOP-F03: reserve both journal and receipt with exclusive create before provider capture. A pre-existing receipt refuses before scale. Incomplete reserved receipts remain empty while the journal records refusal/uncertainty.
- LIVE-STOP-F04: record scale start/response clocks and require stopped observations to start after the running preflight and no earlier than the scale response.

Focused Bun tests: 6 passed, 29 assertions. Scoped strict TypeScript: passed. These are local synthetic tests only; no Railway scale, database write, provider mutation or live stop occurred. Independent QA should replay its original four reproducers against these exact bytes and challenge reservation/chronology behavior. The function still returns an uncertain outcome after any attempted scale failure and never retries automatically.
