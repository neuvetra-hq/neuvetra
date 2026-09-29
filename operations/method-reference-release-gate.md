# Method-reference source gate

The checkpoint CI run may omit the private source originals. In that mode, `method-reference.test.ts` and `method-engine-consistency.test.ts` announce `SKIPPED` and exit successfully. That result checks packaging and the other suites; it is **not** a method-release review.

Before a method review or release, set both `NEUVETRA_METHOD_SOURCES_DIR` to the approved, verified source-original directories and `NEUVETRA_METHOD_SOURCES_REQUIRED=1`. Run both suites in `packages/neuvetra-database/src/` and retain their results with the source hashes and review decision. An absent or invalid source directory, a skip, or any test failure fails this gate. The environment switch is a test guard; it does not authorize or perform a database method release. Separate accounting, source, and operational release approvals remain required.
