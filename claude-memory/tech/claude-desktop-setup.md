---
id: claude-desktop-setup
type: tech
status: active
created: 2026-04-25
updated: 2026-04-25
related: [stack, terrascope, frontdesk, ceo]
tags: [tech, tooling, claude-code]
---

# Claude Desktop Setup

How [[ceo]] works with Claude Desktop on Neuvetra. Claude Code remains the primary tool for repo work; Desktop is for chats, brainstorming, and lightweight reads.

## Filesystem MCP

Claude Desktop cannot see local files by default. The filesystem MCP server exposes whitelisted folders to Desktop so it can read `CLAUDE.md` cascades and the wiki.

Config lives at `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "C:\\Users\\nimab\\Neuvetra"]
    }
  }
}
```

Whitelist root is `C:\Users\nimab\Neuvetra` — covers all sub-projects. Requires Node on PATH. Restart Desktop fully (tray → Quit) after editing.

## Desktop projects

Four sibling Desktop projects, each pointed at its folder with a custom instructions block that tells Claude what to read first:

| Project | Folder | Purpose |
|---|---|---|
| **Neuvetra** | `Neuvetra\` | Strategic / cross-product work; reads C-level wiki |
| **Terrascope** | `Neuvetra\Terrascope\` | GHG product work; reads project + status + code memory |
| **FrontDesk** | `Neuvetra\FrontDesk\` | Voice receptionist product work |
| **GHG KB** | `Neuvetra\ghg-kb\` (top-level since 2026-04-26; was `Neuvetra\Terrascope\ghg-kb\`) | KB ingest / curation; integrity-guardian rules apply |

Each project's instructions tell Claude to read the relevant `CLAUDE.md` files in cascade order before answering. Source-of-truth instruction blocks live inline in the Desktop project settings (not version-controlled).

## When to use which tool

- **Claude Code** — anything touching the repo, the wiki, or CLAUDE.md updates. Cascading CLAUDE.md works automatically; no project setup needed.
- **Claude Desktop** — quick reads, brainstorming, drafting docs / emails, voice mode. The `Neuvetra` project is the default for strategic chat; descend to product-specific projects when work is scoped.

## Open questions

- *(none currently)*

## Next

- Revisit the GHG KB project instructions when the integrity-guardian rules in `Terrascope\status.md` get formalized into `Neuvetra\ghg-kb\CLAUDE.md`.
- **Filesystem MCP root:** Claude Desktop's filesystem-MCP scope is `Neuvetra\` and remains correct after the 2026-04-26 elevation; only the GHG KB project's path-pin in its custom instructions needs updating from `Neuvetra\Terrascope\ghg-kb\` to `Neuvetra\ghg-kb\`.
