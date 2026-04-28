---
id: karpathy-autoresearch
type: topic
status: active
created: 2026-04-27
updated: 2026-04-27
related: [karpathy-llm-wiki]
discussed_in: [2026-04-27-karpathy-frameworks-conv]
sources: [2026-04-27-karpathy-frameworks-conv]
tags: [methodology, optimization, experimentation, eval, autonomous-agents, foundational]
---

# Karpathy's autoresearch model

External methodology by Andrej Karpathy. **Foundational primitive for every Neuvetra optimization or measurement system.** Whenever a problem can be reduced to "modify an artifact, measure the result, keep-or-discard," reach for this shape first.

Source: [github.com/karpathy/autoresearch](https://github.com/karpathy/autoresearch).

## When to activate this guidance

Whenever the conversation touches:
- **Optimizing anything against a metric** — wiki rules, agent prompts, RAG retrieval strategy, calculation methodologies, marketing copy templates.
- **A/B-style iteration** — "let's try a different way and see which is better."
- **Measurable improvement** — "how do we know if this is better?" "how do we tell which version wins?"
- **Autonomous overnight runs** — "let it run while I sleep and show me the results."
- **The phrases:** "let's run experiments," "let's measure it," "let's find the optimal X," "different methods for Y," "auto-tune," "autoresearch."

When this is in scope, propose the **autoresearch shape** before bespoke designs. The discipline is the value.

## The model in one paragraph

Give an AI agent a small but real iteration target, a fixed harness with a single scalar metric, a fixed time budget per experiment, and let it run autonomously. It modifies *one* mutable artifact, runs the harness, checks if the metric improved, keeps (advance the git branch) or discards (`git reset`), and repeats — indefinitely. The human wakes up to a log of experiments and (hopefully) a better artifact.

## The five primitives

1. **Fixed harness** (Karpathy: `prepare.py`). The eval. Untouchable. Holds the metric. Holds the time budget.
2. **One mutable file** (Karpathy: `train.py`). The thing under experiment. The agent edits *only* this. Diffs reviewable.
3. **One scalar metric** (Karpathy: `val_bpb`, lower is better). Non-negotiable. Comparable across all experiments.
4. **Git as state**. Each experiment = a commit on a dedicated branch. Improvement = advance. Regression = `git reset`. The branch *is* the experiment log.
5. **Autonomous loop**. Modify → commit → run → measure → keep/discard → forever, until the human stops it. **Do not pause to ask permission.** Karpathy is explicit: NEVER STOP.

Plus a fixed time budget (Karpathy: 5 minutes wall-clock) so all experiments compare apples-to-apples regardless of what the agent changes, and a `results.tsv` append-only log (commit hash, score, status, description).

## The constraint stack

The genius is the **stack of constraints**: one file, one metric, one budget, one loop, one branch. Everything else is fair game. Constraints make the experiments comparable; freedom inside the constraints lets the agent be creative.

## When it doesn't apply

The pattern fails where the metric is itself the question — taste calls, brand voice, "does this feel right." Anything that requires a human's judgment to score can't be put in a loop. Bring those to humans, not autoresearch.

Signal that autoresearch is wrong: when you can't write down the scalar that decides keep-vs-discard.

## How it composes with [[karpathy-llm-wiki]]

The two frameworks pair naturally. The LLM Wiki model gives you a *structured artifact* (the wiki). Autoresearch gives you an *optimization engine* over a mutable artifact + scalar metric. Compose them:

```
karpathy-llm-wiki              karpathy-autoresearch
─────────────────              ─────────────────────
Wiki schema/rules    ←──   "train.py" (the mutable file)
Wiki output (built)  ←──   experiment output
Golden Q&A set       ←──   "prepare.py" (fixed harness, scoring)
Composite score      ←──   "val_bpb" (the scalar)
This CLAUDE.md       ←──   "program.md" (agent skill)
```

The wiki-eval system the CEO sketched on 2026-04-27 (`f(raw, process) → wiki → score(wiki, golden_questions)`) is *exactly* this composition.

## Where to apply at Neuvetra

Anywhere with **a measurable scalar + a mutable artifact**. Default candidates:

1. **Wiki rules** — schema, heading structures, edge types, ingest discipline. **First target** by CEO direction (2026-04-27). Score against golden Q&A.
2. **Agent system prompts** ([[site-chat-backend]] greeter + future specialists). Score against benchmark conversations with LLM-as-judge.
3. **Calculation methodologies** in [[terrascope]]. Score against expected emissions on canonical test cases (already exist as pytest specs).
4. **RAG retrieval strategy** — chunking, embedding model, top-k. Score precision@k against golden citations.
5. **Marketing / sales copy templates** — once we have any traffic. Score against conversion proxies (LLM-as-judge if no live signal).

## Where it does NOT belong at Neuvetra

- Brand voice, logo, design system — taste calls. Humans only.
- Decisions involving customer relationships or ethics — humans only.
- Anything where the cost of a wrong "keep" is high and unrecoverable. Autoresearch is fine for low-stakes iteration; not for production-critical changes that ship without human review.

## Tactical adoption rule

**Don't build "the autoresearch platform for Neuvetra" upfront.** That is the failure mode. Replicate Karpathy's exact stack for **one** target first — wiki rules, by current direction — and run one full overnight loop end-to-end. Once that works, copy the pattern to the next target. Each new target = a new harness + a new mutable file + the same loop discipline.

## Karpathy's specific design choices worth keeping

- **Single file mutable.** Diffs stay reviewable. Don't let scope creep into "agent edits ten files."
- **Fixed time budget per experiment.** Comparability matters more than optimal use of compute.
- **`results.tsv` left untracked by git.** The branch carries the durable record; the TSV is a working log.
- **`uv run train.py > run.log 2>&1`** style — redirect output to a file, NEVER let it flood the agent's context. Read with `grep` for the metric line.
- **Crashes treated charitably for typos, ruthlessly for bad ideas.** Don't get stuck debugging a fundamentally broken experiment — log "crash," move on.
- **Simplicity tiebreaker.** Equal score + simpler code = keep the simpler one. A "0 improvement, much simpler" change is a win.

## Related

- [[karpathy-llm-wiki]] — the structural counterpart; what this loop optimizes.
- [[2026-04-27-karpathy-frameworks-conv]] — raw record of the day this guidance was formalized.
