---
id: 2026-04-27-karpathy-frameworks-conv
type: conversation
date: 2026-04-27
status: archived
created: 2026-04-27
updated: 2026-04-27
hats: [cpo, cto]
related: [karpathy-llm-wiki, karpathy-autoresearch]
tags: [methodology, wiki-design, optimization, eval, karpathy]
---

# Karpathy frameworks adopted as Neuvetra guidance — raw conversation 2026-04-27

Raw record of the conversation in which the CEO directed Claude to memorize two Karpathy frameworks as foundational guidance for all future Neuvetra wiki and optimization work. Synthesis lives in `[[karpathy-llm-wiki]]` and `[[karpathy-autoresearch]]`.

## Metadata

- Hats worn: CPO (framework selection, Neuvetra-fit framing), CTO (wiki audit, mapping to existing systems).
- Channel: Claude Code at `c:\Users\nimab\Neuvetra\Site`.
- Span: single session, post-Site-deploy. Conversation began with a high-level walkthrough of the Site chat backend, drifted into the GHG KB, and culminated in the CEO formalizing two external frameworks as Neuvetra guidance.

## Topics covered

1. **Site chat backend walkthrough** — confirmed M1 shipped state (Vercel AI SDK + XState skeleton + Langfuse OTel + Eden→fetch on web + Site live at `https://www.neuvetra.ai`). No new ground; just orientation for the day.

2. **GHG KB walkthrough** — high-level four-layer view (`raw/`, `wiki/`, `factors/`, `calculations/`), 120 wiki pages, Workflow 1/2/3, typed-edge graph structure. Confirmed the GHG KB still tracks the Karpathy wiki model verbatim.

3. **Schema-extensibility question.** CEO asked how hard it would be to add a new edge type (e.g. `conflicts_with`, `enforced_by`) to the wiki graph in the future. Answer: very cheap today (no exporter exists yet — markdown + frontmatter only); the cost rises once Weaviate export lands. Recommended designing the future exporter as a registry pattern (`edge_type_map: { ... }`) so new edges stay one-line forever.

4. **Wiki-eval-as-experiment-loop concept.** CEO described the conceptual model: `f(raw, process) → wiki → score(wiki, golden_questions)`. Wants numeric metrics on **effectiveness, speed, relevance, connectedness** so different "processes" (rules / schema / heading structures / edge types) can be A/B-tested. Mapped each dimension to known RAG eval metrics (LLM-as-judge accuracy, latency from Langfuse, precision@k, graph health from LINT). Verdict: standard pattern, mechanically easy, hard part is curating the golden Q&A set (~50–100 questions tagged with expected page citations). One-time cost.

5. **Autoresearch introduced.** CEO surfaced [github.com/karpathy/autoresearch](https://github.com/karpathy/autoresearch) as the missing piece for the wiki-eval experiment loop. Read the README and `program.md`. Identified the five primitives: fixed harness + single mutable file + single scalar metric + git-as-state + autonomous loop. Mapped onto the wiki-eval system from §4 — same shape exactly: `prepare.py` ↔ golden Q&A scoring, `train.py` ↔ wiki rules / schema, `program.md` ↔ our `CLAUDE.md`, `val_bpb` ↔ composite wiki score, `results.tsv` ↔ same.

6. **Memorize directive.** CEO closed the cycle with a save instruction: memorize both Karpathy frameworks (the LLM Wiki gist and the autoresearch repo) as foundational guidance. Whenever the CEO talks about wikis / RAG / knowledge bases, the LLM Wiki model should be active context. Whenever the CEO talks about optimization / iteration / measuring-and-improving, autoresearch should be active context. Save them so future-Claude knows about them without re-reading.

## Key statements

- *"Look at it as well one more time and see how closely we are still following this model for our wiki."* — CEO, on the Karpathy LLM Wiki gist applied to the GHG KB.
- *"I really really like his idea."* — CEO, on autoresearch.
- *"I want to add this auto researcher Karpathy's auto research to one of your knowledge bases or skills so that whenever I talk about it you exactly know what we're talking about."*
- *"Make sure that we both know about these two guidance and guidelines and whenever I'm talking about it you make sure that you know about it."*
- *"If I'm not talking about it, make sure that if we are talking about the wiki style or the rack [RAG] system things that we wanted to build, these two are always in mind and we can talk about it and implement them the way that they describe them."*

## Files / URLs referenced

- Karpathy gist (LLM Wiki model): https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
- Karpathy autoresearch repo: https://github.com/karpathy/autoresearch
- `Neuvetra/ghg-kb/CLAUDE.md` — audited against the LLM Wiki model.
- `Neuvetra/ghg-kb/wiki/index.md` — 120-page inventory.

## Decisions raised

1. **Two Karpathy frameworks adopted as standing Neuvetra guidance.** The LLM Wiki model and autoresearch are both saved as `topic` pages in `claude-memory/topics/`. Future sessions should activate them automatically when the conversation touches their respective domains (wiki design / RAG / KBs for the first; optimization / iteration / measurable improvement for the second).
2. **Default first target for autoresearch** = wiki processing rules. The wiki-eval system (§4) is the most measurable, most leveraged candidate for the loop. Build that first; generalize from there.

## Action items

- ☐ Build the wiki-eval harness (golden Q&A set + scoring code) — independent prereq for any autoresearch loop on the wiki.
- ☐ When designing the Weaviate exporter, build the edge-type map as a registry so new typed edges stay one-line.
- ☐ Re-audit periodically: are we still tracking the Karpathy LLM Wiki model, or have we drifted? Schedule into LINT cadence.

## Open questions

- Which wiki to run the first autoresearch loop on — `ghg-kb/` (most mature, biggest leverage on Terrascope), `claude-memory/` (most reflexive — using autoresearch to optimize how we save things), or `neuvetra-kb/` (most direct revenue impact via chatbot conversion)?
- Compute substrate for the autoresearch loop — Karpathy's repo assumes a single H100. Our analog ("re-process wiki + re-score 100 Q&A") is a CPU + LLM-API workload, not GPU. Likely runs on a Railway worker or local laptop overnight.
- Does the autoresearch pattern want its own dedicated repo per target (one `autoresearch-ghg-kb-rules/` repo per Karpathy's "single-file mutable" discipline), or do we co-locate the harness inside each KB folder?
