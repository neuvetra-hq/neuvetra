# Data-flow and cloud-connection audit

**Latest follow-up:** Pinecone sign-in completed after the read-only assessment below. The accessible Neuvetra Inc. / Default project had no indexes; the coordinator created the empty development index `neuvetra-ghg-dev`. No source or synthetic records were uploaded. New server-key creation was rejected by automatic approval review because the current plan permits only broad full-project keys. Supabase metadata access works, but dashboard/project-role verification and application integration remain pending. See the [dated resource record](../../operations/cloud-development.json); the earlier inspection findings below retain their original scope.

Audit date: 2026-09-08. Read-only inspection of legacy `rag-pipeline` at commit `2adfaca51fae3681ea030bbdefc60e1e6edcec82`, plus the current Neuvetra passage experiment. No credentials, live indexes, model APIs or production systems were accessed. No legacy modules were imported or tests run. The legacy checkout has no `AGENTS.md`; its README/PROJECT descriptions were read as historical claims, then checked against code.

**The current passage experiment reads local evidence and calls Anthropic. It is not connected to Pinecone or Supabase. The next integration will use cloud services, following the user's updated direction.**

The user subsequently chose cloud Pinecone and Supabase. The local options below are the completed feasibility assessment, not an instruction to continue local-stack setup. No emulator harness, Compose file or local setup document was created.

## Current Neuvetra flow

Downloaded originals outside Git → offline catalog integrity checks → independently reviewed release containing source/extraction hashes and complete passage spans → local release verification → semantic planning over all 18 approved passage cards → dependency expansion → drafting → fresh support/completeness review → local validation and cited display.

The catalog builder verifies hashes, sizes and approved local paths; it does not approve sources or create embeddings/indexes (`tools/research/build_catalog.py:99,136,237`). The answering service uses the approved passage release directly, not the whole downloaded catalog (`apps/site-api/src/research-passages/release.ts:103`; `service.ts:30,82,97`). There is **no Pinecone or embedding step** in this experiment. Sources, application/UI and validation run locally; actual answering calls the fixed Anthropic endpoint (`provider.ts:61`). Current stage profiles are Sonnet 5 for planning and Opus 5 for drafting/review (`provider.ts:21`). The disabled/mock paths test software behavior, not real answer quality. The experiment remains private and fallible.

## Legacy flow and dependencies

Paths in this table refer to the separate `rag-pipeline` checkout at the commit above.

| Step | Implemented path | Local/cloud behavior |
|---|---|---|
| PDF extraction | `parse_pdf.py:67,112` | Docling/OCR converts files to local Markdown. Model assets and platform OCR dependencies need separate setup. The alternate Marker script loads models and optionally calls OpenAI with `--use-llm` (`parse_pdf_marker.py:60,74`). |
| Chunking | `tools/chunk_markdown.py:26,31,199,238` | Local heading/sentence chunking, target 1,000 tokens and 12% overlap, with JSONL metadata. Paths are hardcoded; chunks do not carry the new release's approved exact-span/source-hash contract. |
| Embedding and ingestion | `ingest_to_pinecone.py:92,101,280,300` | OpenAI embeddings → Pinecone index creation/upserts. The script performs work at module top level, including a write/delete dimension probe. |
| Query/retrieval | `rag_core/retrieval/retriever.py:781`; `pinecone_wrapper.py:229,352` | OpenAI query embedding → Pinecone → local similarity/MMR. Compression makes additional embedding calls for the query and each candidate text (`retriever.py:480,491`). |
| Metadata/context | `rag_core/ingest/enrich.py:25,43`; `retrieval/context_pack.py:112,156,267` | Local manifest enrichment and numbered citations. Context is shortened by character and token limits. Optional waterfall retrieval can relax thresholds and search the global namespace (`retriever.py:642,808`). |
| Answer/API | `rag_core/service/qa_chain.py:51,187`; `service/api.py:43` | OpenAI chat completion, JSON parsing and citation-number resolution; FastAPI initializes the cloud-dependent chain on startup. |

The legacy `PineconeAdapter` serves metadata-maintenance operations (`scripts/enrich_metadata.py:34`); answer retrieval instead uses `DirectPineconeStore`. Replacing one adapter does not replace all ingestion/retrieval paths.

Local evidence: `doc_manifest.json` contains one 2004 Corporate Standard record, with `is_latest:false`; the shipped `chunked/ghg_protocol_chunks.jsonl` contains 186 records. `PROJECT.md` describes 185 vectors in a named cloud namespace. **Live index contents, dimensions, freshness, ownership and availability were not verified.** Numerous downloaded/parsed files do not establish that those files were ingested or approved.

The coordinator's name-only check of the latest supplied `C:/Users/nimab/Neuvetra/env.json.txt` found `ANTHROPIC_API_KEY`, but no assignments named `OPENAI_API_KEY`, `PINECONE_API_KEY`, `PINECONE_INDEX_HOST` or `PINECONE_INDEX_NAME`. This describes that particular export, not every credential store or account, and does not validate a credential. Earlier export assessments are not evidence about this latest file. This audit did not read the export or any secret value.

**Coordinator connectivity follow-up, September 9 at approximately 03:47 UTC:** narrowly selected Supabase credentials from that export were used for two read-only metadata requests to `icockcoguyadhryzydvl.supabase.co`. `/rest/v1/` returned HTTP 200 with `/` and `/users` as its exposed resource paths; `/storage/v1/bucket` returned HTTP 200 and an empty bucket list. No customer rows were requested and no writes occurred. This establishes connectivity for those credentials/endpoints, not the contents of unexposed schemas, project ownership, tenant policy correctness or an integrated GHG source store. Both account dashboards still required sign-in during inspection. Secret values were not displayed or retained in this repository.

## Local setup gaps

- **Ingestion is unsafe to use as a local smoke test unchanged.** It constructs a cloud control-plane client, lists/creates indexes, ignores `PINECONE_INDEX_HOST`, and writes/deletes its probe before validating the input JSONL (`ingest_to_pinecone.py:92–168`). There is no dry-run or main guard. A local data-plane host alone cannot redirect these operations.
- **Retrieval has a useful injection point.** `EnhancedRetriever` accepts embeddings and a vector store; `QAChain` accepts a client and retriever. Its default Pinecone data connection honors `PINECONE_INDEX_HOST` (`retriever.py:794`). Neither the configuration nor the shipped runtime supplies a local embedding or generation adapter.
- **Embedding dimensions can diverge.** Ingestion passes the configured dimensions to OpenAI (`ingest_to_pinecone.py:283`); query construction omits that parameter (`retriever.py:782`). A reduced-dimension index can therefore mismatch query vectors. Any new embedding model requires a separate index with matching model/version/dimensions and re-embedding.
- **Installation is not yet reproduced.** Python >=3.10 is declared; the lock contains Pinecone 6.0.2, OpenAI 2.6.1 and Docling 2.60.0. Ingestion imports `pinecone.grpc`, while the project declares plain `pinecone`, not its gRPC extra. Marker is also imported by an optional script but absent from project dependencies. Some lock root-requirement metadata differs from `pyproject.toml`; a fresh locked install must be checked, not assumed.
- **The default test command is not guaranteed offline.** `tests/test_smoke.py:4` calls the real `answer()` without an integration marker. Excluding marked integration tests does not exclude it. Use explicit mocked tests/network denial before enabling any real provider.
- **Local success would not certify the old answer/security contract.** It strips invalid citation numbers without withholding the prose (`prompting/output_schema.py:92`), has no independent claim-support gate, returns exception text (`qa_chain.py:146`), accepts caller metadata filters and defaults to broad API binding/CORS. Namespace selection is not authenticated tenant isolation. These behaviors should not replace the current reviewed-source controls.

## Cloud connection status after the updated direction

| Connection | Actual gap and development boundary |
|---|---|
| Pinecone | Latest supplied export lacks the named key/index/host assignments above. Root must verify account access, select an explicit development index/namespace and inspect its model/dimensions/content before writes. The historical `neuvetra-kb` name is not authorization to overwrite an existing index. No live index was verified. |
| Embeddings | Legacy ingestion requires OpenAI access, absent under that key name in the latest export. Alternatively select a supported embedding provider explicitly, then use the identical model/version/dimensions for ingestion and queries. Current Anthropic answering access alone does not supply this missing embedding integration. |
| Supabase | The current passage service imports no Supabase/database client; approved records and originals are loaded from local files. The coordinator's metadata probes above established API access; development/production project role, unexposed schemas, restricted runtime identity and a GHG storage/ingestion contract remain unverified. Successful service-role access does not test row-level security. |
| Application wiring | Neither creating cloud resources nor adding keys connects the current engine: it still plans over the complete local approved catalog. A retrieval adapter, pinned record/source resolution, ingestion job and explicit persistence/approval boundaries must be implemented and tested. Supabase can hold the catalog/review metadata and ingestion state; Pinecone should index approved passages, not become the authority for approval. This is a proposed integration, not implemented behavior. |

Use isolated development resources and preserve the current reviewed-source checks. Verify retrieval, exact ID/source resolution and source status before enabling answer generation. Production deployment, tenant security and migration remain separate acceptance steps.

## Smallest safe local integration path (feasibility only)

1. Run a **separate synthetic storage harness** against a loopback-only Pinecone index emulator, using fixed vectors and no real keys or environment loading. Check upsert/fetch/query, metadata filtering, namespace separation and reproducible reseeding. Do not import the legacy ingestion script. This proves storage plumbing only.
2. Add a small explicit adapter around the approved release: retain release/source/passage IDs and hashes, enforce release filters in the server, retrieve candidates and resolve their complete text/dependencies from the pinned release. Keep Pinecone as an index of approved content, never the authority for source approval or tenant access. Preserve the current answering/validation gates.
3. For offline semantic retrieval, inject a separately selected, locally installed embedding model and build an isolated matching-dimension index. Measure retrieval recall and missing-context behavior independently. For offline generation, a local model/provider adapter and fresh semantic evaluation are additional work; a mock is not a substitute for that evaluation.
4. Before cloud cutover, separately validate authentication, tenant authorization, persistence/rebuilds, cloud API compatibility and live index contents. Local emulation cannot prove those properties.

Pinecone officially provides Docker-only Local emulators with API `2025-01` support and Python SDK 6.x or later. The single-index emulator exposes precreated indexes; the database emulator also supports index lifecycle operations. Local data is in memory and disappears on stop; authentication is ignored, indexes are limited to 100,000 records, and namespace-management APIs, object-store import, backups, Inference and Assistant are unsupported. It is a development emulator, not self-hosted production Pinecone. [Official local-development documentation](https://docs.pinecone.io/guides/operations/local-development).

The coordinator reports that the authorized WSL installation attempt failed with `Class not registered / Wsl/CallMsi/Install/REGDB_E_CLASSNOTREG`. Local-stack work was stopped when the user chose cloud services. This audit does not claim Docker, model weights or the legacy dependency environment have been installed or successfully exercised.
