---
id: weaviate
type: tech
status: active
created: 2026-04-25
updated: 2026-04-25
related: [stack, terrascope, 2026-04-25-weaviate-retrieval-store]
tags: [tech, data, ai]
---

# Weaviate

Vector + graph store for [[terrascope]] wiki retrieval. Native graph and vector in one engine — picked for that combo. See [[2026-04-25-weaviate-retrieval-store]].

## Used by
- [[terrascope]] only — GHG KB RAG and graph relationships.
- [[frontdesk]] does not use Weaviate (no knowledge base yet).

## Architecture role
The Terrascope GHG KB (`Neuvetra\ghg-kb\`) exports to Weaviate; the chatbot uses Weaviate (vector + graph) AND [[supabase]] (structured factor lookup) as two parallel retrieval paths.

## Status
- Decision locked 2026-04-25. Implementation not yet wired in code.

## Next
- Wire export pipeline from `Neuvetra\ghg-kb\` to Weaviate.
- Decide hosting — Weaviate Cloud vs self-hosted on Railway.
