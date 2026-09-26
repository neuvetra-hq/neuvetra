# Postcommit observation and same-image resume

This is an operator-host helper for the existing one-transaction schema-23
upgrade. Importing `tools/staging/hosted-setup-postcommit-live.ts` is inert. It
does not approve the migration, derive the schema-22 baseline independently,
release accounting methods, or authorize launch. Independent source review and
the upstream backup/restore/fingerprint gates still apply.

1. Retain one protected private evidence directory for this transaction. Pin the
   exact worker outcome JSON and complete transaction journal bytes externally.
   The worker must have completed upgrade mode. The journal must retain the
   native `exclusiveUpgradeJournal` envelopes and trailing newlines: each has
   profile, one-based sequence, previous-entry SHA-256, event `data`, and its
   canonical body SHA-256. The helper verifies every link before reading the
   four events, which must end in `hosted_setup_schema23_commit_resolved`.
   Bare events, truncation, altered envelopes and broken chains are refused.
   A pending, killed,
   refused, or uncertain worker cannot use this path, even if a commit marker
   was later found. Reconcile such cases separately without automatic replay.
2. Call `observeHostedSetupPostcommit` with those two `PinnedArtifact` values,
   the accepted exact-image deployment binding, accepted stop and its hash,
   distinct operator/observer IDs, fixed Railway capture options, exact hosted
   project TLS options, and the evidence directory. Omit the test runtime.
   Credentials belong only in the in-memory database options, never in evidence.
3. The observer reconstructs the transaction result and checks its byte hash
   against the completed worker. It captures the exact stopped image twice,
   opens two fresh read-only database transactions through the dedicated
   PostgreSQL client, and captures the stopped image twice again. Both database
   fingerprints must equal the transaction's `afterFingerprintSha256`, including
   rows, receipt, catalog and sequence state. It writes
   `<transactionReceiptSha256>.observation.json` plus a durable journal.
4. An independent reviewer inspects that observation, the authenticated capture
   provenance, original worker/journal and preservation evidence. The reviewer
   supplies a compact JSON `PostcommitReview` artifact with the exported review
   profile, `verdict: "accepted"`, exact observation byte hash, reviewer ID,
   canonical UTC `reviewedUtc`, and `materialFindingsOpen: 0`. No helper creates
   this decision. The reviewer must differ from operator and observer.
5. Call `resumeHostedSetupAfterPostcommit` with pinned observation and review
   bytes and independently established policy pins/identities. Policy must also
   reference existing explicit resume authority and bind it to the transaction
   receipt and exact image digest. A hash or review alone is not authority.
   Use the same private directory and omit the test runtime.
6. Resume reserves `<transactionReceiptSha256>.resume.journal.jsonl` exclusively
   before any provider read, checks fresh stopped captures, reopens the database
   for another exact schema-23 fingerprint, and checks another stopped pair.
   Within five minutes of the review it makes one pinned-CLI scale-to-one call,
   then verifies two fresh running captures against the accepted image. It
   writes `<transactionReceiptSha256>.resume.json` only for a verified result.

The observer and resume calls are single-use within the retained directory.
Never substitute a new directory, delete a journal, or turn a failure into an
automatic retry. Pre-scale failure leaves this helper's stop intact. Any scale,
receipt, or journal-finalization uncertainty means **do not retry**; independently
inspect the provider and retain the original attempt. Do not infer that an
uncertain scale means zero running instances. Read the complete journal and
require successful function completion before accepting a saved receipt.

These are point-in-time observations, not a global database-writer fence.
Provider/operator changes between the last check and scale remain a trusted-host
operational boundary. Provider authentication, actor identity, evidence pins,
authority, private directory retention and reviewed executable bytes are
operator responsibilities. The helper uses the existing fixed capture and TLS
client defaults; injected runtime callbacks are exclusively a synthetic test
seam. It neither accepts plugin paths nor loads executable code from evidence.
