---
id: 2026-04-25-weaviate-retrieval-store
type: decision
status: closed
decided_on: 2026-04-25
decided_by: CEO
created: 2026-04-25
updated: 2026-04-25
related: [terrascope, weaviate]
tags: [tech, data, ai]
---

# Wiki retrieval store: Weaviate

## Context
[[terrascope]] needs both vector retrieval (semantic search over wiki content for the chatbot) and graph relationships (the wiki's `references`, `calculated_by`, etc. relationship fields). Two paths: separate stores (e.g., Pinecone for vector + Neo4j for graph) or a single store that does both.

## Decision
**Weaviate.** Native graph + vector in one store.

## Why
- Single dependency for both retrieval modes.
- The wiki's existing graph structure (typed relationship fields) maps cleanly to Weaviate's cross-references.
- Vector-only stores would force the graph layer to live elsewhere, adding cost/complexity.

## Open follow-ups
- Hosting decision (Cloud vs self-hosted on Railway) — not yet decided. See [[weaviate]].
