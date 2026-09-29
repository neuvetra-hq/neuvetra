# Hosted artifact publisher repair 2 — author report

Task `HOSTED-SETUP-ARTIFACT-PUBLISHER-REPAIR-02`, 2026-09-26. Author `/root/artifact_runner`, software-engineering specialist. The role registry requested `gpt-5.6-sol/high`; the follow-up context did not expose the actual model or effort.

## Preserved independent failures

Both independent FAIL reports remain unchanged and authoritative history:

| Review | Finding | SHA-256 |
| --- | --- | --- |
| `hosted-setup-01-artifact-publisher-independent-review1.md` | PUB-F01 replacement refs; PUB-F02 optional peer handling | `ec9f86ebcc2ab68a3ba3784c63ce3f3626907d4c6f38977f95fb7288cad94c7f` |
| `hosted-setup-01-artifact-publisher-independent-review2.md` | PUB-F03 unauthenticated nested tree contents | `0f9977a48fe3166159015bcada3ceea37396ff7db9d0db79e670dfdb0bbaa6e8` |

QA2 independently confirmed PUB-F01's mechanism and PUB-F02 fixed in repair 1, then demonstrated that a loose nested-tree payload could be copied under its original object filename. The previous publisher authenticated the commit and root tree but trusted `ls-tree -r` for descendants, so it archived and labeled substituted worker bytes as the original reviewed commit. This repair preserves that P1 result and awaits a new independent verdict.

## Frozen repair-2 candidate

| File | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-artifact-publisher.ts` | `17f2f324b965ab84f2b562de96ba91fb9385fce5560bc4c7194bd292604ccf7a` |
| `tools/staging/hosted-setup-artifact-publisher.test.ts` | `9f44b49c119c1505291cd849990fb63e0c9cb08618abdd705c192915ec1c995d` |

Only the assigned publisher source/test and this repair report/run record were authored. No shared Git metadata, provider, database, installed package, or live publication was changed.

## PUB-F03 repair

The publisher no longer uses `ls-tree -r` as the source graph. Starting from the root tree OID parsed from the independently hashed commit bytes, it recursively obtains every reachable tree with `cat-file tree <oid>`. For every tree, it reconstructs the canonical `tree <length>\0<raw bytes>` SHA-1 and requires an exact match to the parent entry's OID before parsing children.

The raw Git tree parser reads each mode, name, NUL boundary, and 20-byte child OID directly. It rejects malformed modes, invalid or duplicate child names, invalid paths, excess depth, and ambiguous leaf paths. Each child tree is verified before its entries enter the preserved path map. Selected regular files are then read by the blob OID from that verified map and their canonical blob SHA-1 is reconstructed. The prior `rev-parse commit:path` lookup was removed because it would retraverse mutable repository objects instead of using the already verified ancestry map.

The no-replacement policy from repair 1 remains on every Git subprocess. Exact optional-peer handling also remains unchanged.

## Adversarial evidence

The new regression reproduces QA2's stock-Git loose-object attack at two depths: `tools` and `tools/staging`. In each disposable repository, a newer tree's compressed payload is copied over the original tree object's stored filename, the checkout is reset to the original HEAD, Git reports a clean checkout and reads the unreviewed worker, and the publisher refuses `ARTIFACT_PUBLISHER_GIT_TREE_IDENTITY_REFUSED` before creating publication output.

Separate direct loose commit and blob substitutions also fail closed. The blob fixture marks the changed worktree file assume-unchanged only inside the disposable repository so the clean-status gate cannot mask the object-identity check; reconstructed blob identity refuses the substituted payload. Git itself refuses the corrupted commit during an earlier exact-head/type operation or the publisher's commit identity check. Existing commit/blob replacement-ref regressions still emit only original reviewed bytes and pass real materializer/verifier composition.

The prepared installed pg 8.23 private closure still publishes without installing or executing lifecycle scripts, with absent explicitly optional `pg-native` omitted. Required, malformed, and present peer controls retain their repair-1 behavior.

## Validation

- Focused publisher suite: **11 pass, 0 fail, 54 assertions**, Bun 1.3.12. Command: `bun test tools/staging/hosted-setup-artifact-publisher.test.ts --timeout 30000`.
- Combined verifier/materializer/publisher suite: **38 pass, 0 fail, 354 assertions**. Command: `bun test tools/staging/hosted-setup-artifact-source.test.ts tools/staging/hosted-setup-artifact-materialize.test.ts tools/staging/hosted-setup-artifact-publisher.test.ts --timeout 30000`.
- Strict TypeScript: **PASS**, exit 0 with no diagnostics. Command: `bun x tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --types bun --skipLibCheck tools/staging/hosted-setup-artifact-publisher.ts tools/staging/hosted-setup-artifact-publisher.test.ts`.

During author test development, the first direct-commit fixture reached Git's earlier `GIT_COMMAND_REFUSED` integrity failure instead of the later publisher-specific commit-hash message; the test now accepts either fail-closed boundary. The first direct-blob fixture was visibly dirty because the corrupted blob changed the worktree hash; the final disposable fixture uses an index assume-unchanged flag to reach and prove the blob-identity guard. The final focused and combined suites were rerun after the last source change.

## Authority and residual limits

The API remains `publishHostedSetupArtifact(paths: ArtifactPublisherPaths, policy: ArtifactPublisherPolicy): Promise<Readonly<ArtifactPublication>>`. Results remain `launchAuthorized:false` and `productionAuthorized:false`. No live artifact was produced.

Canonical Git object reconstruction establishes at-rest commit/tree/blob consistency for the bytes actually consumed on the trusted operator host. It does not attest Git's DLL or operating-system load chain, eliminate SHA-1 collision properties, establish atomic repository/dependency snapshots, or prevent a privileged hostile host from changing inputs between subprocesses. The publisher keeps its verified in-memory tree mapping and hashes every selected blob, so later nested-tree changes cannot redirect an already selected read. Dependency reads and clean-state observations remain point-in-time. Static import and package-declaration closure is not a complete runtime-loaded-code attestation. Externally supplied evidence pins still require a separately authenticated acquisition channel.

Independent review of these exact hashes is required before any authenticated evidence, artifact publication, materialization, or launcher workflow uses this candidate.
