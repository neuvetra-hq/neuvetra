# Conversations

**Working artifacts**, not the durable audit trail. One file per material C-level chat session. Filename `YYYY-MM-DD-slug.md`. Append `-pt2` or `-HHMM` for same-day collisions.

## Lifecycle (per `wiki/CLAUDE.md` § Wiki Lifecycle Policy A — adopted 2026-04-25)

```
write → synthesize → verify → DELETE
```

A raw conversation file lives only long enough to drive synthesis. Once the synthesis is verified — every Decision raised, Action item, Open question, and material Topic accounted for in the wiki (meeting note, typed-bucket page, or log entry) — the file is deleted. The log entry retains the raw ID as a historical anchor; the meeting note carries everything material.

Citing a deleted raw ID is by design. The wiki has many "leaf" anchors that point to no file; they identify the historical event without storing the bytes.

## Frontmatter (during the working lifecycle)

Frontmatter uses **bare IDs** — never wrap them in `[[ ]]`. The `[[id]]` wikilink syntax is body-only.

```yaml
---
id: 2026-04-25-slug-conv
type: conversation
title: "Conversation: <topic>"
status: shipped
created: 2026-04-25
updated: 2026-04-25
hats: [CPO, CTO]
related: [2026-04-25-meeting-slug, 2026-04-25-decision-slug]
sources: []   # external sources referenced during the conversation
---
```

## Heading structure (during the working lifecycle)

```markdown
## Metadata
## Topics covered
## Key statements
## Files referenced
## Decisions raised
## Action items
## Open questions
```

See `wiki\CLAUDE.md` § Page Heading Structures → `conversation` for the canonical version.

## Rules

- **Don't edit a conversation file during its working lifecycle.** If something is missed, fix the synthesis instead.
- **One session per file.** Don't merge sessions.
- **Be rich during the working lifecycle.** Capture statements per participant (`**CEO:**`, `**CPO:**`, etc.), files referenced, decisions raised. The synthesis in `meetings/` and the typed buckets must be re-derivable from this file's content while it exists.
- **Verify before delete.** If you can't account for everything material from the raw in the wiki, the raw stays until you can. See `wiki/CLAUDE.md` § Workflow 1 step 8.
