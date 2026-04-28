# Raw

Immutable inputs to the C-level wiki. **Read, never modify.**

## Subfolders

- `conversations/` — chat-session dumps. One file per session. Filename `YYYY-MM-DD-slug.md`. Frontmatter `type: conversation`. Heading structure defined in `wiki\CLAUDE.md` § Page Heading Structures → `conversation`.
- `inbox/` — unclassified pasted notes, links, screenshots, attachments awaiting triage. Empty most of the time.

## Why this exists

The wiki is a synthesis. The raw layer is the audit trail. If a curated wiki claim ever feels wrong, the raw input that produced it should still exist and either contradict or confirm.

**Never edit a raw file once written.** If something was missed or wrong, append a new conversation file or fix the synthesis in `meetings/` / `decisions/` / etc.

See `wiki\CLAUDE.md` Workflow 1 — INGEST for how raw becomes wiki.

## Mirrors the GHG-KB pattern

The Terrascope GHG knowledge base (`Neuvetra\ghg-kb\raw\`, top-level since 2026-04-26) uses the same raw → wiki two-layer split. Patterns intentionally consistent across stores.
