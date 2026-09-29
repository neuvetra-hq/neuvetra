-- Global method reference data (board decision 2026-09-26, section 6). Not tenant data.
-- Append-only: rows are written only by the operator loader/release functions below
-- (owner or BYPASSRLS role); the runtime role can only read, and only what a release exposes.
-- No existing table, row or function is changed. M80's scope1_beta_release_records stays as is
-- (its save path asserts exactly four rows); new releases record which held row they supersede,
-- validated in release_method_version rather than by a foreign key, so no trigger is added to that table.

create table neuvetra.method_source_documents(
  id uuid primary key,
  publisher text not null check(length(btrim(publisher)) between 1 and 200),
  title text not null check(length(btrim(title)) between 1 and 300),
  edition text not null check(length(btrim(edition)) between 1 and 200),
  url text not null check(url ~ '^https://[^[:space:]]+$' and length(url)<=500),
  retrieved_on date not null,
  sha256 text not null unique check(sha256 ~ '^[0-9a-f]{64}$'),
  bytes bigint not null check(bytes > 0),
  media_type text not null check(media_type in('application/pdf','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/csv')),
  source_use text not null check(source_use in('numeric_values_with_citation','lookup_data_with_citation','private_reference_copy_only')),
  created_at timestamptz not null default clock_timestamp(),
  unique(id,sha256)
);

-- Verified copies (private bucket, off-machine backup, operator workstation). The copy must carry the document hash.
create table neuvetra.method_source_copies(
  id uuid primary key,
  source_document_id uuid not null,
  location_kind text not null check(location_kind in('private_bucket','offsite_backup','operator_local')),
  locator text not null check(length(btrim(locator)) between 1 and 500),
  verified_sha256 text not null,
  verified_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  foreign key(source_document_id,verified_sha256) references neuvetra.method_source_documents(id,sha256),
  check(location_kind<>'private_bucket' or locator ~ ('^method-sources/'||verified_sha256||'\.(pdf|xlsx|csv)$'))
);

-- A verified register may be loaded only if a reviewed migration approved its exact bytes.
create table neuvetra.method_register_approvals(
  register_sha256 text primary key check(register_sha256 ~ '^[0-9a-f]{64}$'),
  register_schema text not null check(register_schema='neuvetra.verified-factor-register.v1'),
  scope integer not null check(scope between 1 and 3),
  source_document_sha256 text not null references neuvetra.method_source_documents(sha256),
  entry_count integer not null check(entry_count between 1 and 5000),
  decision_sha256 text not null check(decision_sha256 ~ '^[0-9a-f]{64}$'),
  decision_reference text not null check(length(btrim(decision_reference)) between 1 and 300),
  approved_by text not null check(length(btrim(approved_by)) between 1 and 200),
  approved_on date not null,
  unique(register_sha256,scope)
);

-- QA F06: releases may cite only a decision approved for releasing methods on that exact register.
-- A later decision is appended as a new row; nothing is updated.
create table neuvetra.method_release_decisions(
  register_sha256 text not null references neuvetra.method_register_approvals(register_sha256),
  decision_sha256 text not null check(decision_sha256 ~ '^[0-9a-f]{64}$'),
  decision_reference text not null check(length(btrim(decision_reference)) between 1 and 300),
  approved_by text not null check(length(btrim(approved_by)) between 1 and 200),
  approved_on date not null,
  primary key(register_sha256,decision_sha256)
);

-- Which M80 held record each new profile may supersede (QA re-review P3-1): a release can consume only its own.
create table neuvetra.method_legacy_supersessions(
  legacy_record_id uuid primary key,
  profile_id text not null unique check(profile_id ~ '^[a-z0-9][a-z0-9._-]{2,120}$')
);

create table neuvetra.method_factor_sets(
  id uuid primary key,
  register_sha256 text not null unique references neuvetra.method_register_approvals(register_sha256),
  source_document_id uuid not null references neuvetra.method_source_documents(id),
  verified_by text not null check(length(btrim(verified_by)) between 1 and 300),
  verification_method text not null check(length(btrim(verification_method)) between 1 and 2000),
  loaded_at timestamptz not null default clock_timestamp()
);

create table neuvetra.method_factor_values(
  factor_set_id uuid not null references neuvetra.method_factor_sets(id),
  factor_key text not null check(length(factor_key) between 1 and 200 and factor_key=btrim(factor_key)),
  table_label text not null check(length(btrim(table_label)) between 1 and 200),
  sheet text not null check(length(btrim(sheet)) between 1 and 200),
  value_cell text not null check(value_cell ~ '^[A-Z]{1,3}[1-9][0-9]{0,5}$'),
  label_cells jsonb not null check(jsonb_typeof(label_cells)='array' and jsonb_array_length(label_cells) between 1 and 10),
  label text not null check(length(btrim(label)) between 1 and 300),
  value_text text not null constraint method_factor_values_value_text_check check(value_text ~ '^(0|[1-9][0-9]{0,11})(\.[0-9]{1,12})?$'),
  unit text not null check(length(btrim(unit)) between 1 and 100),
  fuel text check(fuel is null or length(btrim(fuel)) between 1 and 100),
  vehicle_type text check(vehicle_type is null or length(btrim(vehicle_type)) between 1 and 100),
  model_year_band text check(model_year_band is null or model_year_band ~ '^(≤[0-9]{4}|[0-9]{4}(-[0-9]{4})?)$'),
  source_document_sha256 text not null references neuvetra.method_source_documents(sha256),
  primary key(factor_set_id,factor_key),
  unique(factor_set_id,factor_key,value_text)
);

create table neuvetra.method_gwp_sets(
  id text primary key check(id ~ '^[A-Z0-9][A-Z0-9-]{1,39}$'),
  assessment text not null check(length(btrim(assessment)) between 1 and 200),
  horizon_years integer not null check(horizon_years in(20,100))
);

-- The GWP value must be the exact register value of its source cell (composite FK includes value_text).
create table neuvetra.method_gwp_values(
  gwp_set_id text not null references neuvetra.method_gwp_sets(id),
  gas text not null check(length(btrim(gas)) between 1 and 60),
  factor_set_id uuid not null,
  factor_key text not null,
  value_text text not null,
  composition text check(composition is null or length(btrim(composition)) between 1 and 300),
  primary key(gwp_set_id,gas,factor_set_id),
  foreign key(factor_set_id,factor_key,value_text) references neuvetra.method_factor_values(factor_set_id,factor_key,value_text)
);

create table neuvetra.method_constants(
  register_sha256 text not null references neuvetra.method_register_approvals(register_sha256),
  id text not null check(id ~ '^[a-z][a-z0-9_]{1,60}$'),
  value_text text not null check(value_text ~ '^(0|[1-9][0-9]{0,11})(\.[0-9]{1,12})?$'),
  unit text not null check(length(btrim(unit)) between 1 and 100),
  basis text not null check(length(btrim(basis)) between 1 and 1000),
  source_document_sha256 text references neuvetra.method_source_documents(sha256),
  primary key(register_sha256,id)
);

-- A method version binds formula, admission and estimate rules, an exact engine and the exact factor rows it uses.
create table neuvetra.method_versions(
  id text primary key check(id ~ '^[a-z0-9][a-z0-9._-]{2,120}$'),
  profile_id text not null check(profile_id ~ '^[a-z0-9][a-z0-9._-]{2,120}$'),
  scope integer not null constraint method_versions_scope_check check(scope in(1,2)),
  family text not null constraint method_versions_family_check check(family in('stationary_combustion','mobile_combustion','fugitive','purchased_electricity')),
  title text not null check(length(btrim(title)) between 1 and 300),
  formula text not null check(length(btrim(formula)) between 1 and 4000),
  engine_path text not null check(engine_path ~ '^apps/site-api/src/calculation/[A-Za-z0-9_./-]{1,200}$' and engine_path !~ '\.\.'),
  engine_sha256 text not null check(engine_sha256 ~ '^[0-9a-f]{64}$'),
  register_sha256 text not null references neuvetra.method_register_approvals(register_sha256),
  factor_set_id uuid not null references neuvetra.method_factor_sets(id),
  gwp_set_id text not null references neuvetra.method_gwp_sets(id),
  admission_rules jsonb not null check(jsonb_typeof(admission_rules)='array' and jsonb_array_length(admission_rules) between 1 and 100),
  estimate_rules jsonb not null check(jsonb_typeof(estimate_rules)='array' and jsonb_array_length(estimate_rules)<=100),
  reporting_period_start date not null,
  reporting_period_end_exclusive date not null,
  created_at timestamptz not null default clock_timestamp(),
  check(reporting_period_start<reporting_period_end_exclusive),
  unique(id,factor_set_id),
  unique(id,engine_sha256,register_sha256),
  -- A register is approved for one scope, so its release decision can only ever release methods of that scope.
  foreign key(register_sha256,scope) references neuvetra.method_register_approvals(register_sha256,scope)
);

create table neuvetra.method_version_factors(
  method_version_id text not null,
  factor_set_id uuid not null,
  factor_key text not null,
  primary key(method_version_id,factor_key),
  foreign key(method_version_id,factor_set_id) references neuvetra.method_versions(id,factor_set_id),
  foreign key(factor_set_id,factor_key) references neuvetra.method_factor_values(factor_set_id,factor_key)
);

create table neuvetra.method_version_constants(
  method_version_id text not null references neuvetra.method_versions(id),
  register_sha256 text not null,
  constant_id text not null,
  primary key(method_version_id,constant_id),
  foreign key(register_sha256,constant_id) references neuvetra.method_constants(register_sha256,id)
);

-- Codex T01: "latest review" means the last one recorded, never a timestamp comparison. review_seq is assigned by
-- the insert trigger below only after it holds the profile's release lock, so for one profile it follows commit order
-- and never ties, whichever way the row is inserted. created_at is kept for display only.
create table neuvetra.method_reviews(
  id uuid primary key,
  review_seq bigint not null unique,
  method_version_id text not null,
  engine_sha256 text not null,
  register_sha256 text not null,
  reviewer text not null check(length(btrim(reviewer)) between 1 and 200),
  reviewer_type text not null check(reviewer_type in('ai_independent','human_qualified','independent_qa')),
  reviewed_on date not null,
  verdict text not null check(verdict in('pass','fail')),
  report_sha256 text not null check(report_sha256 ~ '^[0-9a-f]{64}$'),
  scope text not null check(length(btrim(scope)) between 1 and 2000),
  created_at timestamptz not null default clock_timestamp(),
  foreign key(method_version_id,engine_sha256,register_sha256) references neuvetra.method_versions(id,engine_sha256,register_sha256)
);
create sequence neuvetra.method_review_seq;
-- Every insert, through record_method_review or directly by an operator, takes the same per-profile advisory lock as
-- release_method_version and only then draws review_seq; a supplied value is overwritten. Reviews of one profile
-- therefore commit in review_seq order, and a review and a release of that profile never interleave.
create function neuvetra.method_review_order() returns trigger
language plpgsql set search_path=pg_catalog,neuvetra,pg_temp as $$
declare profile text;
begin
  -- Refuse here rather than leave it to the foreign key, so no row can ever be inserted without the lock.
  select v.profile_id into profile from neuvetra.method_versions v where v.id=new.method_version_id;
  if not found then raise exception 'method version not registered' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('neuvetra.method_releases:'||profile,0));
  new.review_seq := nextval('neuvetra.method_review_seq');
  return new;
end $$;
revoke all on function neuvetra.method_review_order() from public,authenticated,neuvetra_runtime;
create trigger method_reviews_order before insert on neuvetra.method_reviews for each row execute function neuvetra.method_review_order();

-- Releases are append-only. A new row supersedes the latest row of the same profile (a release or a withdrawal).
-- QA F02: each profile is one linear chain, enforced by constraints rather than by timing: one root per profile
-- (partial unique index), each row superseded at most once (unique) and only by a row of the same profile
-- (composite FK). A profile therefore has exactly one latest row and at most one current release even when two
-- operators race; the function also serialises each profile with an advisory lock so the loser gets a clear error.
create table neuvetra.method_releases(
  id uuid primary key,
  profile_id text not null,
  method_version_id text not null,
  status text not null check(status in('released_beta','withdrawn')),
  supersedes_release_id uuid unique,
  supersedes_legacy_record_id uuid unique,
  engine_sha256 text not null,
  register_sha256 text not null,
  decision_sha256 text not null check(decision_sha256 ~ '^[0-9a-f]{64}$'),
  released_by text not null check(length(btrim(released_by)) between 1 and 200),
  output_label text not null check(output_label='Draft — prepared with Neuvetra beta methods; not externally assured'),
  effective_at timestamptz not null default clock_timestamp(),
  unique(id,profile_id),
  foreign key(supersedes_release_id,profile_id) references neuvetra.method_releases(id,profile_id),
  foreign key(method_version_id,engine_sha256,register_sha256) references neuvetra.method_versions(id,engine_sha256,register_sha256),
  foreign key(register_sha256,decision_sha256) references neuvetra.method_release_decisions(register_sha256,decision_sha256)
);
create unique index method_releases_one_chain_per_profile on neuvetra.method_releases(profile_id) where supersedes_release_id is null;

create view neuvetra.method_current_releases with (security_invoker=true) as
  select r.* from neuvetra.method_releases r
  where r.status='released_beta' and not exists(select 1 from neuvetra.method_releases n where n.supersedes_release_id=r.id);

-- Every write is recorded with a digest of the inserted row and the database role that wrote it.
create table neuvetra.method_reference_audit(
  id bigint generated always as identity primary key,
  table_name text not null,
  row_sha256 text not null check(row_sha256 ~ '^[0-9a-f]{64}$'),
  written_by text not null default current_user,
  session_user_name text not null default session_user,
  written_at timestamptz not null default clock_timestamp()
);
create function neuvetra.method_reference_audit_row() returns trigger
language plpgsql set search_path=pg_catalog,neuvetra,pg_temp as $$
begin
  insert into neuvetra.method_reference_audit(table_name,row_sha256) values(tg_table_name,encode(sha256(convert_to(to_jsonb(new)::text,'UTF8')),'hex'));
  return null;
end $$;
revoke all on function neuvetra.method_reference_audit_row() from public,authenticated,neuvetra_runtime;

do $$ declare t text; begin
  foreach t in array array['method_source_documents','method_source_copies','method_register_approvals','method_release_decisions','method_legacy_supersessions','method_factor_sets','method_factor_values','method_gwp_sets','method_gwp_values','method_constants','method_versions','method_version_factors','method_version_constants','method_reviews','method_releases','method_reference_audit'] loop
    execute format('alter table neuvetra.%I enable row level security',t);
    execute format('alter table neuvetra.%I force row level security',t);
    execute format('revoke all on neuvetra.%I from public,authenticated,neuvetra_runtime',t);
    execute format('create trigger %I before update or delete on neuvetra.%I for each row execute function neuvetra.reject_inventory_history_mutation()',t||'_immutable',t);
    execute format('create trigger %I before truncate on neuvetra.%I for each statement execute function neuvetra.reject_inventory_history_mutation()',t||'_no_truncate',t);
    if t<>'method_reference_audit' then
      execute format('create trigger %I after insert on neuvetra.%I for each row execute function neuvetra.method_reference_audit_row()',t||'_audit',t);
    end if;
  end loop;
end $$;
revoke all on sequence neuvetra.method_reference_audit_id_seq,neuvetra.method_review_seq from public,authenticated,neuvetra_runtime;
revoke all on neuvetra.method_current_releases from public,authenticated,neuvetra_runtime;

-- Runtime reads: citations and release status for any admitted user; factor values, GWPs, constants
-- and method versions only when a released_beta row exposes them. Copies and audit stay operator-only.
create policy method_ref_read on neuvetra.method_source_documents for select to neuvetra_runtime using(neuvetra.has_staging_access());
create policy method_ref_read on neuvetra.method_register_approvals for select to neuvetra_runtime using(neuvetra.has_staging_access());
create policy method_ref_read on neuvetra.method_release_decisions for select to neuvetra_runtime using(neuvetra.has_staging_access());
create policy method_ref_read on neuvetra.method_factor_sets for select to neuvetra_runtime using(neuvetra.has_staging_access());
create policy method_ref_read on neuvetra.method_gwp_sets for select to neuvetra_runtime using(neuvetra.has_staging_access());
create policy method_ref_read on neuvetra.method_releases for select to neuvetra_runtime using(neuvetra.has_staging_access());
create policy method_ref_read on neuvetra.method_versions for select to neuvetra_runtime using(neuvetra.has_staging_access()
  and exists(select 1 from neuvetra.method_releases r where r.method_version_id=method_versions.id and r.status='released_beta'));
create policy method_ref_read on neuvetra.method_reviews for select to neuvetra_runtime using(neuvetra.has_staging_access()
  and exists(select 1 from neuvetra.method_releases r where r.method_version_id=method_reviews.method_version_id and r.status='released_beta'));
create policy method_ref_read on neuvetra.method_version_factors for select to neuvetra_runtime using(neuvetra.has_staging_access()
  and exists(select 1 from neuvetra.method_releases r where r.method_version_id=method_version_factors.method_version_id and r.status='released_beta'));
create policy method_ref_read on neuvetra.method_version_constants for select to neuvetra_runtime using(neuvetra.has_staging_access()
  and exists(select 1 from neuvetra.method_releases r where r.method_version_id=method_version_constants.method_version_id and r.status='released_beta'));
create policy method_ref_read on neuvetra.method_factor_values for select to neuvetra_runtime using(neuvetra.has_staging_access()
  and exists(select 1 from neuvetra.method_version_factors f join neuvetra.method_releases r on r.method_version_id=f.method_version_id
    where f.factor_set_id=method_factor_values.factor_set_id and f.factor_key=method_factor_values.factor_key and r.status='released_beta'));
create policy method_ref_read on neuvetra.method_gwp_values for select to neuvetra_runtime using(neuvetra.has_staging_access()
  and exists(select 1 from neuvetra.method_version_factors f join neuvetra.method_releases r on r.method_version_id=f.method_version_id
    where f.factor_set_id=method_gwp_values.factor_set_id and f.factor_key=method_gwp_values.factor_key and r.status='released_beta'));
create policy method_ref_read on neuvetra.method_constants for select to neuvetra_runtime using(neuvetra.has_staging_access()
  and exists(select 1 from neuvetra.method_version_constants c join neuvetra.method_releases r on r.method_version_id=c.method_version_id
    where c.register_sha256=method_constants.register_sha256 and c.constant_id=method_constants.id and r.status='released_beta'));
grant select on neuvetra.method_source_documents,neuvetra.method_register_approvals,neuvetra.method_release_decisions,neuvetra.method_factor_sets,neuvetra.method_factor_values,
  neuvetra.method_gwp_sets,neuvetra.method_gwp_values,neuvetra.method_constants,neuvetra.method_versions,neuvetra.method_version_factors,
  neuvetra.method_version_constants,neuvetra.method_reviews,neuvetra.method_releases,neuvetra.method_current_releases to neuvetra_runtime;

-- Seeded after the audit triggers exist, so this row is audited like every other insert (QA observation).
insert into neuvetra.method_gwp_sets(id,assessment,horizon_years) values('AR5-100','IPCC Fifth Assessment Report (AR5)',100);

-- The seven originals the 2026-09-26 method review verified (hashes match the M79 packet pins).
insert into neuvetra.method_source_documents(id,publisher,title,edition,url,retrieved_on,sha256,bytes,media_type,source_use) values
('24000000-0000-4000-8000-000000000001','U.S. EPA Center for Corporate Climate Leadership','GHG Emission Factors Hub (workbook)','January 2025','https://www.epa.gov/system/files/other-files/2025-01/ghg-emission-factors-hub-2025.xlsx','2026-09-08','43afb91d79b2ae765b3a447549d9e1021a144a407cec5eb804be9fcf69a668a7',1014275,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','numeric_values_with_citation'),
('24000000-0000-4000-8000-000000000002','U.S. EPA Center for Corporate Climate Leadership','GHG Emission Factors Hub (PDF)','January 2025','https://www.epa.gov/system/files/documents/2025-01/ghg-emission-factors-hub-2025.pdf','2026-09-08','5d07c678fae6783623acb1e23faa4a7c46268ee6c5a0654c9e49c50de7caf924',478277,'application/pdf','numeric_values_with_citation'),
('24000000-0000-4000-8000-000000000003','U.S. EPA Center for Corporate Climate Leadership','Direct Emissions from Stationary Combustion Sources','December 2023','https://www.epa.gov/sites/default/files/2020-12/documents/stationaryemissions.pdf','2026-09-08','9e9899f728932125543d85f97f71f11d4928580e7ca17ae9858f4c34d0a9c124',632187,'application/pdf','numeric_values_with_citation'),
('24000000-0000-4000-8000-000000000004','U.S. EPA Center for Corporate Climate Leadership','Direct Emissions from Mobile Combustion Sources','December 2023','https://www.epa.gov/sites/default/files/2020-12/documents/mobileemissions.pdf','2026-09-08','f80e3400d2485d4e253211cfb69a923e16920d393da21f6991cbaed493804402',600190,'application/pdf','numeric_values_with_citation'),
('24000000-0000-4000-8000-000000000005','U.S. EPA Center for Corporate Climate Leadership','Direct Fugitive Emissions from Refrigeration, Air Conditioning, Fire Suppression, and Industrial Gases','December 2023','https://www.epa.gov/sites/default/files/2020-12/documents/fugitiveemissions.pdf','2026-09-08','fb3dd5c9677096094c2acef769c7fe2fb90def6feac403cf9c817f5810928d88',525314,'application/pdf','numeric_values_with_citation'),
('24000000-0000-4000-8000-000000000006','Greenhouse Gas Protocol (WRI/WBCSD)','Required Greenhouse Gases in Inventories','2013 amendment','https://ghgprotocol.org/sites/default/files/2022-12/Required%20gases%20and%20GWP%20values_0.pdf','2026-09-08','2bc8b42d4cb94d1f74ae477f3bfaf3eb7ab55f216f575050ebdd67c9447a3a7f',258571,'application/pdf','private_reference_copy_only'),
('24000000-0000-4000-8000-000000000007','Greenhouse Gas Protocol (WRI/WBCSD)','A Corporate Accounting and Reporting Standard (Revised Edition)','Revised edition','https://ghgprotocol.org/sites/default/files/standards/ghg-protocol-revised.pdf','2026-09-08','cfcda4dd20a0b0936b30e5e5c7c635c26efdfa770d29c1004f549bf082c0fe3c',3680902,'application/pdf','private_reference_copy_only'),
-- Scope 2 (verified 2026-09-27). eGRID2023 rev2 is EPA's latest edition as of that date; eGRID2024 is not published by EPA.
('24000000-0000-4000-8000-000000000008','U.S. EPA','eGRID2023 data file, revision 2','eGRID2023 rev2 (data year 2023), released 2025-06-12','https://www.epa.gov/system/files/documents/2025-06/egrid2023_data_rev2.xlsx','2026-09-08','895cd81dd8662406189ad8adf5a2578dcb362cdb5cff7cca81b10ee6bd2447c6',21213301,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','numeric_values_with_citation'),
('24000000-0000-4000-8000-000000000009','U.S. EPA (USEPA/power-profiler, MIT license)','Power Profiler ZIP code to eGRID subregion and utility lookup (zip.csv; CRLF as published, stored LF in the repo)','eGRID2023 update, commit f42f155cd9657f237a875a8a358abeefcb6e3d63 (2025-01-22)','https://raw.githubusercontent.com/USEPA/power-profiler/f42f155cd9657f237a875a8a358abeefcb6e3d63/app/data/zip.csv','2026-09-27','33d33352c4563c8524862b94ab8e948a7b75c8ee42da5c92cce2b4d47801f523',3210525,'text/csv','lookup_data_with_citation');

-- Loading approval only. Using any value in a result still requires a reviewed released_beta row.
insert into neuvetra.method_register_approvals(register_sha256,register_schema,scope,source_document_sha256,entry_count,decision_sha256,decision_reference,approved_by,approved_on) values
('f5351cd375a54072c03061dc3fab6740bed1cf78e05db9de575dca7f2d5c0c02','neuvetra.verified-factor-register.v1',1,'43afb91d79b2ae765b3a447549d9e1021a144a407cec5eb804be9fcf69a668a7',265,
 '6c0d52b56e63651afe2d80a70a5c3dd9b5bb85e9f917137df3d4a6ae0a50a9c6','notes/decisions/2026-09-26-method-review-and-board-decisions.md','Nima (board, release owner)','2026-09-26'),
('0626e6d3ba44f2e1f4ad53173fafebbb073c72c6d5a2a98021e0810039f9a13b','neuvetra.verified-factor-register.v1',2,'895cd81dd8662406189ad8adf5a2578dcb362cdb5cff7cca81b10ee6bd2447c6',84,
 '6c0d52b56e63651afe2d80a70a5c3dd9b5bb85e9f917137df3d4a6ae0a50a9c6','notes/decisions/2026-09-26-method-review-and-board-decisions.md section 7.3; notes/briefs/2026-09-27-scope1-2-work-split.md','Nima (board, release owner)','2026-09-27');

-- The four M80 held candidates and the profiles that replace them.
insert into neuvetra.method_legacy_supersessions(legacy_record_id,profile_id) values
('81000000-0000-4000-8000-000000000001','scope1.stationary.natural_gas'),('81000000-0000-4000-8000-000000000002','scope1.mobile.onroad_diesel'),
('81000000-0000-4000-8000-000000000003','scope1.stationary.distillate_no2'),('81000000-0000-4000-8000-000000000004','scope1.fugitive');

-- Release authority (QA F06): a release must cite a decision bound to its exact register. Same board decision here.
insert into neuvetra.method_release_decisions(register_sha256,decision_sha256,decision_reference,approved_by,approved_on) values
('f5351cd375a54072c03061dc3fab6740bed1cf78e05db9de575dca7f2d5c0c02','6c0d52b56e63651afe2d80a70a5c3dd9b5bb85e9f917137df3d4a6ae0a50a9c6','notes/decisions/2026-09-26-method-review-and-board-decisions.md','Nima (board, release owner)','2026-09-26'),
('0626e6d3ba44f2e1f4ad53173fafebbb073c72c6d5a2a98021e0810039f9a13b','6c0d52b56e63651afe2d80a70a5c3dd9b5bb85e9f917137df3d4a6ae0a50a9c6','notes/decisions/2026-09-26-method-review-and-board-decisions.md section 7.3; notes/briefs/2026-09-27-scope1-2-work-split.md','Nima (board, release owner)','2026-09-27');

-- Operator-only register loader. Hashes the exact text it receives; only an approved register loads, once.
-- QA F03: the operator must also pass the original source files the register cites (its workbook and any
-- per-entry or per-constant source); each is hashed here and must match its registered SHA-256 and size.
create function neuvetra.load_method_register(register_text text, originals bytea[]) returns uuid
language plpgsql set search_path=pg_catalog,neuvetra,pg_temp as $$
declare
  digest text := encode(sha256(convert_to(register_text,'UTF8')),'hex');
  approval neuvetra.method_register_approvals%rowtype; reg jsonb; doc neuvetra.method_source_documents%rowtype;
  set_id uuid := gen_random_uuid(); e jsonb; c jsonb; k text; allowed text[]; loaded integer := 0;
  supplied text[]; cited text[]; missing text;
begin
  select * into approval from neuvetra.method_register_approvals where register_sha256=digest;
  if not found then raise exception 'method register is not approved' using errcode='42501'; end if;
  if exists(select 1 from neuvetra.method_factor_sets where register_sha256=digest) then raise exception 'method register already loaded' using errcode='23505'; end if;
  reg := register_text::jsonb;
  if jsonb_typeof(reg) is distinct from 'object' or (select array_agg(key order by key) from jsonb_object_keys(reg) key) is distinct from array['constants','entries','method','schema','source','verifiedBy']
    or reg->>'schema' is distinct from approval.register_schema then raise exception 'invalid method register shape' using errcode='22023'; end if;
  select * into doc from neuvetra.method_source_documents where sha256=approval.source_document_sha256;
  if reg#>>'{source,sha256}' is distinct from doc.sha256 or (reg#>>'{source,bytes}')::bigint is distinct from doc.bytes or reg#>>'{source,url}' is distinct from doc.url
    then raise exception 'method register source does not match the registered document' using errcode='22023'; end if;
  if jsonb_typeof(reg->'entries') is distinct from 'array' or jsonb_array_length(reg->'entries')<>approval.entry_count then raise exception 'method register entry count mismatch' using errcode='22023'; end if;
  if jsonb_typeof(reg->'constants') is distinct from 'array' then raise exception 'invalid method register constants' using errcode='22023'; end if;
  -- Every cited original must be supplied byte for byte (SHA-256 and length) before anything is inserted.
  select coalesce(array_agg(encode(sha256(o),'hex')||':'||octet_length(o)),'{}') into supplied from unnest(coalesce(originals,'{}'::bytea[])) o where o is not null;
  select array_agg(distinct x) into cited from (
    select approval.source_document_sha256 x
    union all select v->>'sourceSha256' from jsonb_array_elements(reg->'entries') v where jsonb_typeof(v->'sourceSha256')='string'
    union all select v->>'sourceSha256' from jsonb_array_elements(reg->'constants') v where jsonb_typeof(v->'sourceSha256')='string') s;
  select c2 into missing from unnest(cited) c2 where not exists(select 1 from neuvetra.method_source_documents d where d.sha256=c2 and d.sha256||':'||d.bytes=any(supplied)) limit 1;
  if missing is not null then raise exception 'method register source original missing or altered: %',missing using errcode='22023'; end if;
  insert into neuvetra.method_factor_sets(id,register_sha256,source_document_id,verified_by,verification_method) values(set_id,digest,doc.id,reg->>'verifiedBy',reg->>'method');
  for e in select value from jsonb_array_elements(reg->'entries') loop
    allowed := array['id','label','labelCells','sheet','table','unit','value','valueCell','fuel','modelYear','vehicleType','gwpSet','composition','sourceSha256'];
    if jsonb_typeof(e) is distinct from 'object' or exists(select 1 from jsonb_object_keys(e) key where key<>all(allowed))
      or exists(select 1 from unnest(array['id','label','labelCells','sheet','table','unit','value','valueCell']) key where jsonb_typeof(e->key) is null)
      or exists(select 1 from jsonb_each(e) x where x.key<>'labelCells' and jsonb_typeof(x.value)<>'string')
      or ((e ? 'vehicleType') <> (e ? 'modelYear')) or ((e ? 'vehicleType') <> (e ? 'fuel')) or ((e ? 'composition') and not (e ? 'gwpSet'))
      then raise exception 'invalid method register entry' using errcode='22023'; end if;
    -- An entry may cite a different registered document (e.g. AR5 GWPs copied from the Hub register).
    insert into neuvetra.method_factor_values(factor_set_id,factor_key,table_label,sheet,value_cell,label_cells,label,value_text,unit,fuel,vehicle_type,model_year_band,source_document_sha256)
      values(set_id,e->>'id',e->>'table',e->>'sheet',e->>'valueCell',e->'labelCells',e->>'label',e->>'value',e->>'unit',e->>'fuel',e->>'vehicleType',e->>'modelYear',coalesce(e->>'sourceSha256',doc.sha256));
    if e ? 'gwpSet' then
      insert into neuvetra.method_gwp_values(gwp_set_id,gas,factor_set_id,factor_key,value_text,composition) values(e->>'gwpSet',e->>'label',set_id,e->>'id',e->>'value',e->>'composition');
    end if;
    loaded := loaded + 1;
  end loop;
  for c in select value from jsonb_array_elements(reg->'constants') loop
    if jsonb_typeof(c) is distinct from 'object' or exists(select 1 from jsonb_object_keys(c) key where key<>all(array['id','value','unit','basis','sourceSha256']))
      or exists(select 1 from jsonb_each(c) x where jsonb_typeof(x.value)<>'string') then raise exception 'invalid method register constant' using errcode='22023'; end if;
    insert into neuvetra.method_constants(register_sha256,id,value_text,unit,basis,source_document_sha256) values(digest,c->>'id',c->>'value',c->>'unit',c->>'basis',c->>'sourceSha256');
  end loop;
  if loaded<>approval.entry_count then raise exception 'method register entry count mismatch' using errcode='22023'; end if;
  return set_id;
end $$;

-- Operator-only: register a method version with its exact factor and constant links.
create function neuvetra.register_method_version(v jsonb) returns void
language plpgsql set search_path=pg_catalog,neuvetra,pg_temp as $$
declare set_id uuid; k text;
begin
  perform neuvetra.m71_keys(v,'id,profileId,scope,family,title,formula,enginePath,engineSha256,registerSha256,gwpSetId,admissionRules,estimateRules,reportingPeriod,factorKeys,constantIds');
  perform neuvetra.m71_keys(v->'reportingPeriod','start,endExclusive');
  select id into set_id from neuvetra.method_factor_sets where register_sha256=v->>'registerSha256';
  if not found then raise exception 'method register not loaded' using errcode='22023'; end if;
  if jsonb_typeof(v->'factorKeys') is distinct from 'array' or jsonb_array_length(v->'factorKeys') not between 1 and 500
    or jsonb_typeof(v->'constantIds') is distinct from 'array' or jsonb_typeof(v->'scope') is distinct from 'number' then raise exception 'invalid method version' using errcode='22023'; end if;
  insert into neuvetra.method_versions(id,profile_id,scope,family,title,formula,engine_path,engine_sha256,register_sha256,factor_set_id,gwp_set_id,admission_rules,estimate_rules,reporting_period_start,reporting_period_end_exclusive)
    values(v->>'id',v->>'profileId',(v->>'scope')::integer,v->>'family',v->>'title',v->>'formula',v->>'enginePath',v->>'engineSha256',v->>'registerSha256',set_id,v->>'gwpSetId',v->'admissionRules',v->'estimateRules',(v#>>'{reportingPeriod,start}')::date,(v#>>'{reportingPeriod,endExclusive}')::date);
  for k in select jsonb_array_elements_text(v->'factorKeys') loop
    insert into neuvetra.method_version_factors(method_version_id,factor_set_id,factor_key) values(v->>'id',set_id,k);
  end loop;
  for k in select jsonb_array_elements_text(v->'constantIds') loop
    insert into neuvetra.method_version_constants(method_version_id,register_sha256,constant_id) values(v->>'id',v->>'registerSha256',k);
  end loop;
end $$;

-- Operator-only release. Requires that the latest recorded method review (AI independent or human qualified) and
-- the latest recorded independent QA review for this exact engine and register both pass, a release decision bound to that
-- register (QA F06), and must supersede the latest row of the profile's chain when one exists (QA F02).
create function neuvetra.release_method_version(r jsonb) returns uuid
language plpgsql set search_path=pg_catalog,neuvetra,pg_temp as $$
declare v neuvetra.method_versions%rowtype; latest neuvetra.method_releases%rowtype; new_id uuid := gen_random_uuid();
begin
  perform neuvetra.m71_keys(r,'methodVersionId,status,supersedesReleaseId,supersedesLegacyRecordId,decisionSha256,releasedBy');
  select * into v from neuvetra.method_versions where id=r->>'methodVersionId';
  if not found then raise exception 'method version not registered' using errcode='22023'; end if;
  -- Serialise every release transition and every review of this profile, including the first one.
  perform pg_advisory_xact_lock(hashtextextended('neuvetra.method_releases:'||v.profile_id,0));
  -- Codex T01: under READ COMMITTED each statement below takes a fresh snapshot after the lock, so it sees every
  -- review committed while this call waited. A REPEATABLE READ or SERIALIZABLE snapshot could predate them.
  if current_setting('transaction_isolation')<>'read committed' then
    raise exception 'method releases must run at READ COMMITTED isolation' using errcode='25000'; end if;
  if r->>'status' not in('released_beta','withdrawn') then raise exception 'invalid release status' using errcode='22023'; end if;
  if not exists(select 1 from neuvetra.method_release_decisions d where d.register_sha256=v.register_sha256 and d.decision_sha256=r->>'decisionSha256') then
    raise exception 'release decision is not approved for this register' using errcode='42501'; end if;
  -- The latest recorded review of each group decides (review_seq, never created_at or id): a later fail always blocks.
  if r->>'status'='released_beta' and (
      (select w.verdict from neuvetra.method_reviews w where w.method_version_id=v.id and w.engine_sha256=v.engine_sha256 and w.register_sha256=v.register_sha256
        and w.reviewer_type in('ai_independent','human_qualified') order by w.review_seq desc limit 1) is distinct from 'pass'
      or (select w.verdict from neuvetra.method_reviews w where w.method_version_id=v.id and w.engine_sha256=v.engine_sha256 and w.register_sha256=v.register_sha256
        and w.reviewer_type='independent_qa' order by w.review_seq desc limit 1) is distinct from 'pass') then
    raise exception 'method release requires passing method and QA reviews' using errcode='42501'; end if;
  if r->'supersedesLegacyRecordId'<>'null'::jsonb and not exists(select 1 from neuvetra.scope1_beta_release_records l
      join neuvetra.method_legacy_supersessions m on m.legacy_record_id=l.id and m.profile_id=v.profile_id
      where l.id::text=r->>'supersedesLegacyRecordId' and l.status='held_candidate') then
    raise exception 'legacy record must be the held candidate this profile replaces' using errcode='22023'; end if;
  select * into latest from neuvetra.method_releases m where m.profile_id=v.profile_id
    and not exists(select 1 from neuvetra.method_releases n where n.supersedes_release_id=m.id);
  if (latest.id is null and r->'supersedesReleaseId'<>'null'::jsonb) or (latest.id is not null and (r->>'supersedesReleaseId') is distinct from latest.id::text) then
    raise exception 'release must supersede the latest release of this profile' using errcode='23505'; end if;
  if r->>'status'='withdrawn' and (latest.id is null or latest.status<>'released_beta') then raise exception 'nothing to withdraw' using errcode='22023'; end if;
  insert into neuvetra.method_releases(id,profile_id,method_version_id,status,supersedes_release_id,supersedes_legacy_record_id,engine_sha256,register_sha256,decision_sha256,released_by,output_label)
    values(new_id,v.profile_id,v.id,r->>'status',(r->>'supersedesReleaseId')::uuid,(r->>'supersedesLegacyRecordId')::uuid,v.engine_sha256,v.register_sha256,r->>'decisionSha256',r->>'releasedBy',
      'Draft — prepared with Neuvetra beta methods; not externally assured');
  return new_id;
end $$;

-- Operator-only review record for an exact engine and register. The insert trigger takes the profile's release lock
-- and then assigns review_seq, so reviews and releases of one profile are ordered by commit (Codex T01).
create function neuvetra.record_method_review(w jsonb) returns uuid
language plpgsql set search_path=pg_catalog,neuvetra,pg_temp as $$
declare v neuvetra.method_versions%rowtype; new_id uuid := gen_random_uuid();
begin
  perform neuvetra.m71_keys(w,'methodVersionId,reviewer,reviewerType,reviewedOn,verdict,reportSha256,scope');
  select * into v from neuvetra.method_versions where id=w->>'methodVersionId';
  if not found then raise exception 'method version not registered' using errcode='22023'; end if;
  insert into neuvetra.method_reviews(id,method_version_id,engine_sha256,register_sha256,reviewer,reviewer_type,reviewed_on,verdict,report_sha256,scope)
    values(new_id,v.id,v.engine_sha256,v.register_sha256,w->>'reviewer',w->>'reviewerType',(w->>'reviewedOn')::date,w->>'verdict',w->>'reportSha256',w->>'scope');
  return new_id;
end $$;

revoke all on function neuvetra.load_method_register(text,bytea[]),neuvetra.register_method_version(jsonb),neuvetra.release_method_version(jsonb),neuvetra.record_method_review(jsonb)
  from public,authenticated,neuvetra_runtime;
