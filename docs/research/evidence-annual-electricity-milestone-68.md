# M68 — annual electricity with supporting bills

## Authorization and outcome

The board accepted M67's workflow without personally auditing every number and explicitly authorized this implementation, independent review, rolling PR4 publication and deployment to the existing Railway/Supabase infrastructure. The copied M67 acceptance record retains its original historical proposal wording; this instruction supersedes that proposal gate. No application review, accounting-method release, customer readiness or assurance follows from workflow acceptance.

One fictional company can enter monthly electricity, select an exact saved annual version, attach the supported fictional bills to their actual month, inspect missing or conflicting evidence, obtain a different manager's bounded review and create a traceable frozen draft. This increment reuses M66 source intake and M67 deterministic arithmetic.

## Bounded acceptance criteria

- **AC01 — exact annual input:** Select an immutable M67 annual version by identity and hashes. Show its twelve entered/missing/explicit-zero states and exact deterministic subtotal. New annual quantities require a new saved annual version; changing the selected version creates a new evidence version.
- **AC02 — retained bills:** Explicitly link tenant-owned supported M66 PDFs, preserve their original bytes/hash/page, and expose authenticated verified downloads. The two approved fixtures both cover January 1–31, 2023; they cannot support February–December. Arbitrary PDFs, OCR, allocations and new source/factor releases are outside scope.
- **AC03 — honest coverage:** Distinguish entered months, months with attached documents and unresolved evidence gaps. Twelve entered months do not imply twelve evidenced months or a complete inventory. No document and unknown consumption remain distinct; zero consumption does not waive missing evidence.
- **AC04 — conflicts:** Refuse duplicate source identities/bytes explicitly. Distinct bills for the same period remain a visible overlap; never add their printed quantities or infer independent consumption. Show printed/manual quantity disagreement and require an explanation without describing the explanation as verification or resolution of the underlying discrepancy.
- **AC05 — immutable lifecycle:** Source selection, explanation-only and annual-version-only changes create successor versions with reasons; canonical identical requests are no-ops. Preserve retry/concurrency behavior, earlier source bytes, M63–M67 rows, reviews and reports. No old review is inherited. A different authorized manager reviews the exact new evidence version.
- **AC06 — frozen draft:** A new report captures the exact annual snapshot, bill snapshots, gaps/conflicts, correction and review state. Verify identity, bytes and lineage on read. Later corrections/reviews cannot change a prior report. Open/download/print entry points preserve synthetic/incomplete/unreleased/no-assurance wording.
- **AC07 — integrated boundaries:** Independently challenge native PostgreSQL persistence, API/browser decoders, tenant/role/refusal paths, stale actor responses, source-only/reason-only correction, overlapping evidence and coordinated tampering. Preserve first failures and distinguish automated checks from browser observations.
- **AC08 — delivery:** Publish only reviewed changes through existing draft PR4, verify exact remote head and six checks, retain a fresh encrypted backup, deploy the tested additive schema/image on existing infrastructure, verify restart/readback and demonstrate the hosted workflow before dependent product work.

## Ownership and parallelism

M68 root owns UI, integration, safe operators, shared operational records, publication and deployment. A bounded CTO/database specialist owns backend implementation; independent accounting and QA run sequentially within the allocated single specialist slot. Requested registered compute and unknown observed metrics are recorded separately. RAG readiness runs independently in task 01a0a2ea-42d4-7f22-82be-6ddf6dba1aa9, owns disjoint files and hands reviewed commits to this publisher. It does not advance a dependent milestone past M68 board feedback.

## First review gates

Technical contract and accounting/evidence rules precede backend implementation. Independent integrated QA precedes publication and deployment. Frozen historical evidence remains untouched. No new subscription, PR, merge, customer data or persistent worker is authorized by this increment.
