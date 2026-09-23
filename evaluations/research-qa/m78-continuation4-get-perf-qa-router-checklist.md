# M78 isolated GET dispatch candidate — independent QA checklist

This checklist is an acceptance plan for a future frozen source candidate. It is not evidence that the current draft passes, and it does not authorize a native, hosted or database run.

## Exact direct-read behavior

- For valid version metadata, `inventory-export` and `proof`, call `findScope1Version` exactly once and do not call `findScope1`.
- For valid report metadata, `download`, `snapshot` and `proof`, call `findScope1Report` exactly once and do not call `findScope1`.
- Compare status, body bytes and security/download headers with the accepted pre-change route for both `process-screen` and `scope1-inventory` families.
- Verify returned company, stream, family and requested identity before releasing any direct result bytes. A result from another company, stream, family or identity must never be returned.
- Root register reads and statement downloads retain exactly one `findScope1`; all POST routes, management authorization and writers remain unchanged.

## Fallback and refusal semantics

- When a direct getter returns `null`, await the root fallback inside the route's `try` block. A rejected fallback must be translated by the existing `42501`, capacity, input and default `503` error mapping instead of escaping as a rejected route promise.
- When a direct getter returns a non-null record with a wrong company, stream, family or identity, use the same root fallback needed to distinguish a wrong-stream request from a missing specific record. Do not return a specific version/report 404 solely from the mismatched direct value.
- If the root is absent, or the selected family stream does not equal the requested stream, return the generic `404 {error:"Scope 1 record not found."}`.
- If the root proves that the requested stream belongs to the selected family but the requested direct record is absent or invalid, return the specific version/report 404.
- Exercise wrong-tenant, other-family stream, unknown stream, unknown identity, malformed UUID and corrupt direct-result cases for both families.

## Authorization and error ordering

- Missing or invalid bearer token returns 401 before any database getter.
- Staging refusal returns 403 before any root or direct getter; POST management refusal remains 403.
- Wrong origin and unsupported method retain current statuses and do not invoke a writer.
- Direct and fallback getter rejection with `42501` maps to 403; `54000`/`54001` maps to the existing 422 history-capacity response; recognized invalid-input SQLSTATEs map to 422; unrecognized/corrupt failures map to 503.
- Assert zero write-method calls across every GET success and refusal case.

## Evidence required for acceptance

- Bind review to an immutable candidate snapshot and exact source/test hashes.
- Use actual `createM78Routes` with promise-returning fake getters. Include at least one asynchronously rejected fallback; synchronous stubs cannot prove `await`/`try` behavior.
- Preserve the original candidate failure tests for the missing `await` and wrong-family fallback defects. A repaired candidate must make those tests pass without weakening expected messages or call counts.
- Run the route suite, strict targeted TypeScript and the smallest relevant existing M78 route tests. Record exact tests/assertions and exclusions.
- Treat this as source preparation only. A later isolated native comparison must pin the complete current reader source closure before and after, use a finite exact SQL template inventory, preserve base-table digests, and retain sample-count and hosted-cause limitations.
