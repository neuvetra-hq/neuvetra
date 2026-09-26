# Hosted artifact publisher repair 1 — author report

Task `HOSTED-SETUP-ARTIFACT-PUBLISHER-REPAIR-01`, 2026-09-26. Author `/root/artifact_runner`, software-engineering specialist. The role registry requested `gpt-5.6-sol/high`; this follow-up ran in an existing context whose actual model and effort were not observable.

## Preserved first review

The independent first review remains a **FAIL** with two open findings: `evaluations/research-qa/hosted-setup-01-artifact-publisher-independent-review1.md`, SHA-256 `ec9f86ebcc2ab68a3ba3784c63ce3f3626907d4c6f38977f95fb7288cad94c7f`. This repair does not replace or reinterpret that evidence. It is candidate rework awaiting targeted independent review.

## Frozen repair candidate

| File | SHA-256 |
| --- | --- |
| `tools/staging/hosted-setup-artifact-publisher.ts` | `44a0e4d55cffa07d0a30a1b1a9f39e4b9abc2df1e67ad303242d28622fa62ad9` |
| `tools/staging/hosted-setup-artifact-publisher.test.ts` | `85ea9d13b9379bb93c300cd1a1139165176374eaa6a1213ae916af88c473de2e` |

Only the assigned publisher source/test and this report/run record were authored in this repair. No shared repository Git metadata, provider, database, installed package, or live artifact was changed.

## PUB-F01 repair: original Git object semantics

Every publisher Git subprocess now supplies both the literal `--no-replace-objects` option and `GIT_NO_REPLACE_OBJECTS=1`. It disables system/global configuration, optional locks, filesystem monitoring, untracked cache, and index preloading for the read. The environment is reduced to the Windows system root plus those fixed Git controls. Repository-local replacement refs can therefore remain present without changing any publisher object read.

The publisher no longer accepts Git's name resolution alone as object identity. It reads the exact expected commit with `cat-file`, independently reconstructs the canonical `commit <length>\0<bytes>` SHA-1, parses its tree identity, reads that tree object and reconstructs its canonical SHA-1, then binds each selected path to the tree entry's blob identity. Each blob is read by object ID and its canonical SHA-1 is reconstructed before its bytes enter the source archive. The clean-worktree checks use the same no-replacement policy before source reading, before output creation, and after exclusive output writes.

The adversarial regression creates both commit replacement and worker-blob replacement refs. Ordinary Git demonstrably returns the unreviewed worker in each fixture. The repaired publisher emits only the original reviewed worker bytes, and each publication passes the real materializer/verifier round trip. The synthetic repository fixes `core.autocrlf=false` locally so its clean state is independent of the machine's user-level Git configuration.

## PUB-F02 repair: explicitly optional peers

Dependency traversal now parses `peerDependenciesMeta`. A missing peer is optional only when the same package declares the peer and its exact metadata object contains `optional: true`. Unknown peer-metadata names, extra metadata fields, non-boolean optional values, malformed ranges, missing required peers, and incomplete present packages fail closed. Present optional peers receive the same regular-file, link, path, version, archive, and complete-private-root checks as every other included package. Declared dependencies and optional-dependency packages in this fixed prepared closure remain mandatory inputs.

The repaired suite copies the repository's installed pg 8.23 package graph into a disposable private root without package installation or lifecycle execution. Its absent, explicitly optional `pg-native` peer is accepted and omitted. Synthetic controls cover absent optional, present optional, absent required, and malformed metadata cases.

## Validation

- Focused publisher suite: **9 pass, 0 fail, 40 assertions**, Bun 1.3.12. Command: `bun test tools/staging/hosted-setup-artifact-publisher.test.ts --timeout 30000`.
- Combined verifier/materializer/publisher suite: **36 pass, 0 fail, 340 assertions**. Command: `bun test tools/staging/hosted-setup-artifact-source.test.ts tools/staging/hosted-setup-artifact-materialize.test.ts tools/staging/hosted-setup-artifact-publisher.test.ts --timeout 30000`.
- Strict TypeScript: **PASS**, exit 0 with no diagnostics. Command: `bun x tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --types bun --skipLibCheck tools/staging/hosted-setup-artifact-publisher.ts tools/staging/hosted-setup-artifact-publisher.test.ts`.

The first repair-suite invocation found that the replacement fixture inherited the host's line-ending conversion policy, so the hardened publisher correctly saw the reset checkout as dirty. The fixture now pins its local line-ending policy. A targeted rerun passed before both complete final suites were run from the final candidate.

## Authority and remaining limits

The public API remains `publishHostedSetupArtifact(paths: ArtifactPublisherPaths, policy: ArtifactPublisherPolicy): Promise<Readonly<ArtifactPublication>>`. A successful result continues to report `launchAuthorized:false` and `productionAuthorized:false`. It creates offline archives and a publication receipt; it grants no launch, migration, provider, database, or production authority.

This implementation trusts the pinned Git executable and operator host. Reconstructing Git object IDs protects against replacement-ref interpretation but does not attest the executable's DLL or operating-system load chain, eliminate SHA-1 collision limits, create an atomic repository/dependency filesystem snapshot, or establish a hostile-host lease. Separate subprocesses and dependency reads retain point-in-time/TOCTOU limits. Static import scanning and declared package closure do not claim complete runtime-loaded-code attestation. Evidence documents and their hashes are independently supplied; this producer validates their binding and freshness but does not authenticate their acquisition channel.

No real publication was attempted. The integrated worker/bindings/runner closure must first exist in one clean independently reviewed commit, the prepared private dependency root and executable/config pins must be independently acquired, and this exact repaired candidate must pass independent re-review.
