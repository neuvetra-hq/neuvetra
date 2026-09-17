# M78 current security observations

Observed by root in the signed-in Supabase dashboard on 2026-09-17 UTC (September 16 Pacific). This is a bounded configuration investigation requested by the board, not a forensic finding of misuse.

## Email and current advisor results

The supplied email was dated September 15 and described findings as of September 13. It named Neuvetra and Terrascope with `rls_disabled_in_public`; it did not name individual tables.

- Neuvetra project `icockcoguyadhryzydvl`: completed **Rerun linter**; zero errors, eight warnings, one informational suggestion. The dated critical alert is not reproduced by the refreshed advisor.
- Terrascope project `jfjbiqeplnbxkadqnimt`: completed **Rerun linter**; five errors, zero warnings, zero informational suggestions. All errors are disabled RLS on `public.companies`, `public.company_members`, `public.emission_factors`, `public.ghg_reports`, and `public.users`.

Neuvetra warnings: mutable function search paths for `neuvetra.electricity_source_fixtures`, `public.set_updated_at`, `neuvetra.reject_inventory_history_mutation`, `neuvetra.m67_method`, `neuvetra.m67_limitations`, `neuvetra.m68_limitations`, and `neuvetra.annual_evidence_report_template`; plus disabled leaked-password protection in Auth. These require separate risk/compatibility assessment, not arbitrary changes to released schema20.

## Terrascope first metadata read

Root executed a `BEGIN READ ONLY` catalog query through the project's SQL editor. It joined `pg_class`, `pg_namespace`, `pg_roles`, counted `pg_policy`, and checked effective schema/table privileges. It selected only the five named tables and the three API roles. No application rows were read and no data mutations were attempted.

All 15 result rows (five tables times three roles) showed:

| Property | Result |
| --- | --- |
| Table owner | postgres |
| RLS / force RLS | false / false |
| Policy count | 0 |
| Role | anon, authenticated, or service_role |
| Schema USAGE | true |
| SELECT / INSERT / UPDATE / DELETE | all true |

This confirms a current access-configuration defect in Terrascope. It does not establish that records exist, that anyone accessed them, or that all indirect access paths have been assessed. Dependencies, column grants, other privileges and policies must be checked before a precise non-destructive containment change. The existing Neuvetra project is separate and is not the target of those changes.

No live database configuration has been changed at this checkpoint. Independent security assessment and review are active. Earlier M77 runtime/journal evidence remains untouched.

## Approved containment outcome — 2026-09-17 03:10 UTC

The first execution request was rejected by automatic approval review because investigation authorization did not explicitly cover the exact permission change. No SQL ran on that rejected attempt. The board then explicitly answered **“Approve Terrascope security fix”** for the named five tables and the described loss of unrestricted anonymous/signed-in API access.

Independent native review accepted candidate3 SHA-256 `793a83110db1cf1abe419eab86623e5c032964a94403d1b74cc4535dda2e490d`: 94 checks, 18 targeted negative controls and 20 actual synthetic endpoint-role SELECT/INSERT refusals. The first candidate2 failure remains recorded. Provider hook inspection found the applicable exact `extensions.pgrst_ddl_watch()` only notifies PostgREST to reload its schema; the candidate pins that definition and refuses unknown matching hooks.

Root verified the exact Terrascope dashboard identity and full editor text. Clipboard CRLF bytes normalize to the accepted LF hash. One approved execution returned **“Success. No rows returned.”** Its transaction revoked all table privileges from `anon` and `authenticated` on exactly the five named tables and enabled RLS without FORCE or new policies. No application-row statement, role change or schema change was included.

The subsequent catalog-only query returned all 20 expected table/role pairs: RLS true, FORCE false, zero policies, ACL exactly `{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}`. Anonymous/authenticated roles have no effective table or column privilege; postgres/service_role retain access. The result CSV SHA-256 is `0a559d4f36f9aa079dad4c33b92ed8adae170a687109486aa00ef98738e97ef7`, at `.superpowers/m78-terrascope-post-containment.csv`; execution receipt is `.superpowers/m78-terrascope-containment-result.json`.

Root reran the Terrascope advisor after commitment: **zero errors, zero warnings, five informational “RLS Enabled No Policy” notices**, one for each contained table. These notices reflect intentional denial to ordinary API roles; do not add universal policies to clear them.

This resolves the five named direct table-access configuration defects. It is not a forensic conclusion, a comprehensive indirect-function/API audit, or proof of real-client behavior. No live application records were read to test preservation; the reviewed DDL contained no row writes and the independent synthetic rehearsal verified unchanged records and privileged CRUD. Neuvetra's separate eight warnings remain a bounded hardening backlog; its application/schema20 was not modified.
