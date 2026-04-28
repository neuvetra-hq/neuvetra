# `raw/conversations/`

Mirror of CEO authoring conversations that produced public-KB content. One file per session.

**Filename:** `YYYY-MM-DD-slug.md`. Frontmatter: `type: conversation`, `id:`, `sources_for: [list of page ids this conversation authored or amended]`.

## Lifecycle (Policy A — same as `Neuvetra/claude-memory/raw/conversations/`)

These are working artifacts, not the audit trail. The audit trail lives in `wiki/log.md`.

```
write raw → synthesize into wiki page(s) → verify the synthesis is complete → delete the raw
```

The log entry retains the trace via the `sources:` field on the synthesized pages plus the log line itself. Deleting the raw after verification is correct and expected.

## Why This Exists

Even though the CEO talks to me directly (no PDFs to ingest, no inbox), keeping a raw mirror lets:
1. Future Claude verify a synthesized page against the original conversation when something looks off.
2. The `sources:` array on every wiki page point to a real artifact (until the raw is deleted; thereafter `sources:` references a deleted id, which is fine — the log entry is the durable record).
3. LINT spot-check whether public-safe filtering happened correctly between conversation and synthesis.

## What Goes Here

Only conversations triggered by **public-KB triggers** ("let's update our users", "publish this", etc., per `CLAUDE.md` § Trigger Vocabulary). Memory triggers ("save this", "log this") write to `Neuvetra/claude-memory/raw/conversations/` instead. Never bridge.
