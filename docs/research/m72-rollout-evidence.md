# M72 existing-host rollout evidence

## Product direction

California corporate reporting remains the first product focus. The board clarified that this priority should follow accounting logic: relevant Nevada, Canadian or other operations can remain within a company's inventory boundary. Separate regional reporting products follow the California MVP. This rollout is a synthetic coverage-register increment; it does not produce a complete corporate inventory or external assurance.

## Observed recovery and migration

- Fresh schema14 application backup: 62 tables, 165 original rows. Encrypted archive SHA-256 `1363f9bd0c4cc0dd007c7dcc3ff89db9c7cf1faa06826597a74c8c1ab8d46bfd`; raw dump SHA-256 `9bb40e7ac1f6e871e462b26944bd218d78f3a421dab9ba15acf219d468aa05a2`.
- Independent exact-archive restoration into a new isolated loopback PostgreSQL cluster preserved application rows, catalog, ownership, runtime permissions, role flags and memberships. Restricted-runtime records and downloads matched the hosted baseline. Provider Auth accounts, passwords, sessions, provider configuration and storage are excluded; UUID dependencies are local stubs. DPAPI recovery requires the same Windows identity/profile.
- The first backup encryption helper attempt failed before producing an archive. A process-only execution-policy fix and authorized same-identity execution produced the verified backup. Sandbox restore failure occurred before database creation; the authorized retry passed.
- Backup preceded maintenance. The migration locked all original application tables and required an exact match to the restored backup before any migration change. This detects intervening writes rather than assuming none occurred.
- Root stopped only existing deployment `314fed59-b935-46ff-94b5-20b1394e81f2`. Provider active deployments became empty and origin `/ready` returned HTTP404 before the maintenance gate was set.
- Reviewed migration0015 committed at `2026-09-15T13:46:59.802Z`. All 165 original rows were preserved with multiplicity; the migration receipt was appended and five empty corporate tables added. Roles, memberships and default ACLs were unchanged. Independent reviewers inspected the underlying receipt values.

## Deployment

The published application commit `ecfedcbfb27b18a1ebebfd960314d68299cb4a28` passed all six required checks before deployment. The existing service was reconnected to `codex/corporate-mvp`. That action triggered deployment `da0a050a-7ce0-42b3-acfc-900c8416b56b` from the same exact commit. The superseded duplicate build was canceled.

Deployment succeeded with image digest `sha256:7e8d7e0549ba1ed66f7414f1f227c01bba77a51a43e0120fba8a58ea3aa44799`; origin readiness reported schema15 and verified legacy containment. The prior schema14 image cannot serve after migration15. Recovery after committed15 means retrying the reviewed schema15 commit or reviewing a repaired schema15 candidate. Before a committed migration, read-only proof of unchanged14 would permit the exact prior image. An uncertain commit must be inspected first.

## Acceptance still in progress

The hosted exercise passed 108 stages, including 12 application POST attempts covering successful writes, retries and refusals. Two saved versions retained all 15 Scope 3 categories and unresolved findings; the second version received a separate non-contributor review. Both exports matched independently recomputed bytes. The 17 legacy record hashes and 16 downloads matched the baseline. All four acquired test Auth sessions were closed. The actual service restart returned success and schema15 readiness recovered; the read-only revisit passed with zero application POSTs, exact saved-register and export equality, unchanged legacy records and all acquired test sessions closed.

Chrome paused visual automation because an extension panel was open; no fresh hosted visual success is claimed. Earlier M71 local browser evidence remains historical. Final publication and the visual demonstration remain separate gates. No milestone-complete claim follows from deployment or API checks alone.
