# M62 technical handoff — calculation-spec readiness

Date: 2026-09-14

## Delivered boundary

The calculation-spec loader now distinguishes executable specifications from explicitly deferred drafts. Existing specifications default to executable. A deferred specification must name controlled blockers and is rejected by the normal `load_spec()` runtime path. The explicit `include_deferred=True` inspection path retains its metadata and cases for readiness reporting.

The harness runs all executable cases through the pre-existing value, unit, factor, provenance, and methodology-version assertions. Each deferred case remains a separately identified pytest skip with its blocker reason. Separate guards require at least one executable specification and one executable case, so an all-deferred or empty catalog cannot pass only because pytest skipped the declarations.

Executable expected values and tolerances are validated before parameterization. `TBD`, numeric strings, booleans, NaN, and infinity fail for executable values; tolerances must be finite and non-negative. A deferred status without blockers also fails.

## Changed paths

- `.github/workflows/verify.yml`
- `ghg-kb/calculations/spec_loader.py`
- `ghg-kb/calculations/tests/test_harness.py`
- `ghg-kb/calculations/tests/test_spec_readiness.py`
- `ghg-kb/docs/specs/calculation-spec-schema.md`
- `ghg-kb/calculations/README.md`

The coordinator separately owns the mobile methodology readiness declaration and related domain notes. The accounting disposition is recorded in `docs/research/m62-accounting-disposition.md`. It classifies all three mobile cases as deferred: the calculation module is absent; asserted factor IDs do not resolve; current processed factors, schema, resolver filters, and the CNG unit path cannot satisfy the cases; and the available source material is not approved for runtime use. No calculation implementation, factor record, factor release, source corpus, or production runtime changed in this technical patch.

## Reproduction

From the repository root:

```bash
bun run test:ghg
```

For named deferred reasons:

```bash
cd ghg-kb
python -m pytest calculations/tests -q -rs
```

Observed locally on 2026-09-14 with Python 3.14.7, Pint 0.26, pytest 9.1.1, and PyYAML 6.0.3:

- `bun run test:ghg` — 43 passed, 3 skipped in 0.47 seconds.
- `python -m pytest calculations/tests/test_spec_readiness.py -q -rs` — 9 passed in 0.09 seconds.
- `python -m pytest calculations/tests/test_harness.py -q -rs` — 13 passed, 3 separately identified deferred skips in 0.33 seconds.
- `python -m pytest calculations/tests -q -rs` — 43 passed, 3 separately identified deferred skips in 0.49 seconds.
- `git diff --check -- <M62 technical paths>` — passed with no whitespace errors.

The 11 existing executable spec cases still run through every pre-existing value, unit, factor, methodology, and provenance assertion. The three mobile cases are the only deferred parameters.

The GitHub workflow pins Python 3.12, Pint 0.26, pytest 9.1.1, and PyYAML 6.0.3, then invokes the repository's `bun run test:ghg` script in a dedicated `ghg-calculations` job. This local result does not establish the GitHub job outcome; exact remote CI remains required after publication.

## Release limits

Deferred metadata is an availability statement, not accounting approval. The mobile-combustion draft remains unavailable until its implementation exists, its required reviewed factors are released, and all expected values are approved and finite. This milestone does not change current product factor or methodology releases, connect a provider, migrate storage, merge the pull request, or deploy the application. Independent QA must review the integrated version before merge readiness is claimed.
