# Neuvetra board update

**The synthetic cloud evidence test passed. The greenhouse-gas answering application still needs separate integration and quality work.**

- **Completed:** Private Supabase storage, an isolated research schema, two ordinary test accounts and six Pinecone records are connected. The API retains its existing schemas and adds the research schema with scoped permissions.
- **Verified:** All three frozen questions returned the correct account's source passages with exact references. All 22 access checks passed, including cross-account and anonymous denials, inactive-record exclusion and blocked attempts to grant extra access. Independent review and local checks pass: 46 database tests / 464 assertions, 53 Python tests and strict TypeScript checking.
- **Demo:** [Open the recorded results](http://127.0.0.1:5186/demo.html), or [the saved HTML](../evaluations/cloud-integration/demo.html). Account filters and expandable citations show actual retrieved results. Data is clearly fictional; the report does not submit live questions or generate answers.
- **Decisions:** Corrected database JSON double encoding, modern Supabase key handling and structured missing-resource responses. Preserved failed attempts and code versions. Source approval, access checks and answer quality remain separate gates.
- **Security:** Anonymous access to seven legacy tables is contained. Authenticated/backend grants were preserved; legacy signed-in authorization and privileged API routes still need work. New-schema tests do not certify those older services.
- **Next:** Review real-source processing permissions, ingest a small approved corpus, connect retrieval to the application and resolve the failed answer-quality gate. Keep PR #2 unmerged. No production cutover or calculations release occurred.

The user's explicit approval for the two test accounts, private bucket and API addition is fulfilled; the setup hold is resolved. Separate Supabase GitHub-email OAuth was not granted or needed. Fictional builds expire September 10 at 05:30 UTC; renewal and cleanup are not automated.

[Cloud state and evidence](cloud-development.json) · [Independent QA](../docs/research/cloud-integration-qa.md) · [Task ledger](status.json) · [PR #2](https://github.com/neuvetra-hq/neuvetra/pull/2)

September 8, 2026 Pacific / September 9 UTC. This checkpoint is prepared for the existing PR; remote CI for these changes is pending publication. Earlier commits `636dc7e` and `73f647b` passed their recorded checks. Answering remains stopped: the latest eight-question experiment had two independently sound answers, one deficient released answer and five withheld answers. Cloud storage success does not change that result. See [the answer investigation](../docs/milestones/m2-passage-retrieval.md).
