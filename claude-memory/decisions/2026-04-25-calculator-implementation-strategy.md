---
id: 2026-04-25-calculator-implementation-strategy
type: decision
status: open
created: 2026-04-25
updated: 2026-04-25
related: [terrascope]
tags: [tech, calculator]
---

# Open: Terrascope calculator — Python canonical, TS canonical, or parallel?

## Context
The same 4 GHG calculation methodologies exist twice in [[terrascope]]:
- **Python:** `Neuvetra\ghg-kb\calculations\` — reference spec, 33 tests passing. (Top-level since 2026-04-26; was `Terrascope\ghg-kb\calculations\`.)
- **TypeScript:** `Terrascope\code\packages\calculator\src\methodologies\` — runtime, 9 test files passing.

Maintaining both without explicit canonicalization is drift-prone.

## Options
1. **Python canonical, TS generated/derived** — one source of truth, automated codegen, but tooling cost.
2. **TS canonical, Python deprecated** — one stack, simpler ops, but Python is the natural fit for scientific calc and was built first.
3. **Parallel with sync discipline** — keep both, lint each release for divergence, pin test cases in methodology page frontmatter (already done partially).

## Status
Open. Locked architectural commitment in [[terrascope]] (LLM never does arithmetic) is neutral on which language is canonical.

## Next
- CTO hat: cost out option 1 (codegen pipeline).
- Decide before any new methodology is added (currently 4; planned 6+).
