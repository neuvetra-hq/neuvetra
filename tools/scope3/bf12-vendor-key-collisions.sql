-- BF-12 QA (accounting audit B-2): read-only exports for tools/scope3/bf12-vendor-key-collisions.ts.
-- SELECT statements only: nothing here writes, locks for update or calls a function with side effects.
-- The supplier-name (vendor) key itself is computed by the script with the product's own TypeScript function: PostgreSQL's
-- lower() and regex classes follow the database collation and ctype, not Unicode as JavaScript applies them, so a SQL copy
-- of the key could disagree on non-ASCII names.
--
-- Run each statement with psql in unaligned, tuples-only mode, one JSON object per line, for example:
--   psql "$READ_ONLY_URL" -At -v ON_ERROR_STOP=1 -c "<statement 1>" > bf12-lines.jsonl
--   psql "$READ_ONLY_URL" -At -v ON_ERROR_STOP=1 -c "<statement 2>" > bf12-versions.jsonl
-- then: bun tools/scope3/bf12-vendor-key-collisions.ts bf12-lines.jsonl bf12-versions.jsonl

-- 1. bf12-lines.jsonl: the current version of every active spend line, supplier figure and partner figure.
select json_build_object('companyId', v.company_id, 'recordId', v.record_id, 'kind', r.kind, 'sourceId', v.source_id,
  'periodStart', v.period_start, 'periodEndExclusive', v.period_end_exclusive, 'payload', v.payload->'payload')
from neuvetra.collection_activity_heads h
join neuvetra.collection_activity_versions v on v.id = h.version_id and v.company_id = h.company_id
join neuvetra.collection_activity_records r on r.id = h.record_id and r.company_id = h.company_id
where r.kind in ('purchase_spend', 'purchase_supplier', 'partner_reported') and v.state = 'active';

-- 2. bf12-versions.jsonl (optional, for the kg column): each company's newest frozen Scope 3 version's change-log basis,
--    which holds each line's outcome and total. No live total is stored in the database.
select json_build_object('companyId', s.company_id, 'reportingYear', s.reporting_year, 'revision', s.revision, 'basis', s.change_log_basis::json)
from neuvetra.scope3_report_versions s
where s.revision = (select max(x.revision) from neuvetra.scope3_report_versions x where x.company_id = s.company_id and x.reporting_year = s.reporting_year);
