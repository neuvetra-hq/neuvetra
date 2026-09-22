# Continuation3 failed baseline: root disposition

September 22, 2026. Root accepts independent reconciliation result `261e4fccf8f85fc7cb99205357baf30346852eb3930d5760984bb471bb3aafe3`, snapshot `8ddf868c767466748d05881e3c7523dab9975bb4a2f022eb87140d28d528fcc3`, by `/root/resume_release`. The baseline itself FAILED and must never be reset or retried.

Root session76557 exited1. Main24 events SHA `0204a7e93849b305bafc45b79232b3af588619fcb851752d2ef541869d584012`, head `7dc4b514e0dbcf0d29c857d146f6db709d9317fdfd0dc69a6be50c19acb1cbfa`. Diagnostics62 events SHA `8b45e72d193d9f3c2b6a03c63c75e61a8055223862f13b297c9b4d26725972c1`, head `0dc8e2b0b40fd10b183579a19748e117d6ec5d68c98a69d2fdfb6f4b25bb6f65`. Ordinal26 coverage-export GET produced a timeout after30,007ms without response headers. All four main test sessions have logout204 outcomes, unknown0, zero application POSTs and no legacy sessions. Cleanup must not be repeated.

Scoped provider HTTP observations and application completion logs show the three neighboring coverage-export completions at roughly3.2-3.3seconds and no later matching completion in the collected window. Log absence cannot establish where the failed request stopped, prove non-arrival or exclude incomplete provider logging. No server/database cause is established. Read-only code tracing identifies repeated readiness/authentication/integrity work, but that does not prove it caused this timeout.

Root's credential-free readiness probes on installed Bun1.3.12 completed6/6 default-pooling and6/6 explicit-close requests successfully. This small sample neither reproduces nor rules out intermittent transport failure. A separate bounded loopback experiment investigates connection reuse; no timeout, integrity, authorization or application behavior is changed by these observations. Do not rerun the long baseline without a separately reviewed concrete next attempt.

The independently accepted source, six remote checks and runtime remain valid at their recorded times. They do not establish successful baseline,37writes,restart/revisit,browser closure or Scope1 customer release.
