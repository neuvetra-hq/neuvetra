-- 0030: Scope 3 completion (Claude, 30 October 2026; Scope 3 completion design D12, sections 3.1-3.9, increment I-02;
-- amended in increment I-02b by the design's section 11 list, AM-01 to AM-19, before 0030 was applied anywhere hosted).
-- Applies after 0029. Hosted 0029 is on hold, so a schema-30 image serves an existing project at 28, 29 or 30.
--
-- Additive only. No existing row is rewritten, moved or deleted, and every existing record, version, head, request and
-- hash stays byte-identical. This migration:
--   0. stops (55000, nothing changed) unless the two collection functions it replaces are exactly 0029's (AM-01);
--   1. widens the record table's kind and scope/kind checks to thirteen more Scope 3 kinds (purchase_spend,
--      purchase_supplier, energy_resold, commuting_average, teleworking, asset_energy, partner_reported, building_average,
--      sold_fuel, sold_energy_product, sold_ghg_product, end_of_life_split, investment), each paired with scope 3;
--   2. replaces collection_assert_activity (same signature): 0029's body, every Scope 1, Scope 2 and 0029 Scope 3 branch
--      unchanged except that the four 0029 payloads also take the optional dataQuality key, business travel takes its v2
--      keys (cabinClass, hotelCountry) and the room-night unit, and each new kind has a branch with exactly the keys, types
--      and limits of validateScope3Payload (scope3-collection-contract.ts) and the normalized units of
--      SCOPE3_COLLECTION_UNITS. Tokens stay any text up to 80 characters, so the adapter can hold an unknown value rather
--      than the database refusing it. Field rules live in small scope3_assert_* helpers;
--   3. replaces save_collection_activity (same signature and grants): scope 3 for every Scope 3 kind, and the electricity
--      ZIP and utility columns filled for electricity only (0027's version check allows them on electricity alone, and
--      several new kinds carry a zip in their payload);
--   4. proves both functions kept their privileges;
--   5. adds category assessments (the structured screening record behind each setup decision), versioned and insert-only
--      per company, reporting year and category, with documented within-category exclusions, and
--      save_scope3_category_assessment;
--   6. adds spend imports (per reporting year) with a fingerprint per imported line, so overlapping exports are held as
--      possible duplicates, and remembered NAICS mappings, with import_scope3_spend (every line through
--      save_collection_activity, in one transaction, idempotent per file; never category 9; every NAICS code in its
--      category's set, scope3_spend_naics_allowed) and save_scope3_spend_mapping;
--   7. adds frozen Scope 3 report versions per reporting year (exact report text and CSV bytes with their SHA-256) and
--      approvals, with prepare_scope3_report and approve_scope3_report; their rows can never change;
--   8. registers the EPA Supply Chain GHG Emission Factors v1.3 CO2e CSV as a method source document. Nothing else in the
--      method store changes: no register approval, no release (methods stay unreleased beta).
-- New tables follow 0027: forced row-level security, company members read through the runtime role, writes only through
-- the security-definer functions, which the runtime may call; the helpers are callable by no application role; both views
-- run with the caller's rights (security_invoker). The reporting year of an assessment, import or report is the year in
-- which the setup version's reporting period ends (period_end_exclusive minus one day); each RPC refuses another.
-- Unchanged: the versions table (apart from its period check, round 2 below), collection_derive_quantity, 0028's
-- electricity trigger, company setup (0023).
-- Round 2 (lane B, 31 October 2026, before any hosted apply): the kind checks are added NOT VALID and then validated
-- (ENG-16); a possible-duplicate mismatch in import_scope3_spend raises 40001 (ENG-10); save_scope3_spend_mapping corrects
-- the mapping's group in one set-based statement (ENG-9); report and CSV texts may be 64 MiB (ENG-3, measured at the line
-- cap); prepare_scope3_report refuses inputs that are not the current heads or not the records the results list (40001,
-- ENG-11) and stores the results' open issues; approve_scope3_report requires an acknowledgement of open issues and an
-- explicit self-approval confirmation, both stored with the approval (owner decision 7).
-- Round 2 integration (31 October 2026, before any hosted apply; owner decision 1, ACC-3): a Scope 3 record's period may
-- end up to 1 January 2027 (the Scope 3 method envelope, 2025 and 2026), in collection_assert_activity and in the version
-- table's 0027 period check (section 1b: found by its definition, re-added by name NOT VALID, then validated); Scope 1 and 2
-- kinds stay inside calendar 2025.
-- Round 2c integration (31 October 2026, before any hosted apply; owner decision): report and CSV texts may be 128 MiB
-- each and a prepare request 255 MiB (measured at the line cap with worst-case commuting records, which 64 MiB refused).
-- Round 3 (lane B, 31 October 2026, before any hosted apply): prepare_scope3_report takes a small jsonb request and
-- assembles the report and CSV texts from chunks the same transaction staged (stage_scope3_report_text, deleted at once), and
-- never parses, re-serialises or re-hashes them (the table's checks hash each once); neither it nor approve_scope3_report
-- reads a stored text back (owner decision 6: memory at the line cap); prepare also refuses (40001) results whose assessments, rejected evidence or previous approved version changed
-- (EN-5). The 3,000-line cap is enforced in SQL (scope3_active_line_count, SQLSTATE 54N30) inside import_scope3_spend and
-- in save_collection_activity for saves that add a Scope 3 line; withdraw_scope3_spend_import withdraws an import's active
-- lines and save_scope3_spend_corrections corrects imported lines in bulk, both through one set-based writer (owner
-- decision 7). Section 1's lock note is corrected (EN-6).
-- Never rerun 0001-0029. No reverse migration is planned.

-- 0. Drift guard (I-02b, AM-01). 0030 replaces collection_assert_activity and save_collection_activity with 0029's
-- bodies plus marked changes, so it may only run over exactly 0029's functions: the same identity arguments, return type
-- and stored source (md5 of pg_proc.prosrc, which PostgreSQL keeps verbatim; the constants are computed from 0029's file
-- by compose_0030.py). A hosted 0029 that was revised, or a function changed by hand, stops here with nothing changed.
do $drift$
declare f record; begin
  for f in select * from (values
    ('neuvetra.collection_assert_activity(jsonb)','a jsonb','void','1ba7ea1d0f8b70db08a3197f0ff25f65'),
    ('neuvetra.save_collection_activity(uuid,uuid,jsonb)','target_company uuid, target_record uuid, request jsonb','record','215dd381925db67f5aaf1276c2e22f83')) v(signature,arguments,result,source_md5) loop
    if to_regprocedure(f.signature) is null or not exists(select 1 from pg_proc p where p.oid=to_regprocedure(f.signature)
      and pg_get_function_identity_arguments(p.oid)=f.arguments and p.prorettype::regtype::text=f.result and md5(p.prosrc)=f.source_md5) then
      raise exception '0030: the collection functions differ from 0029; re-derive 0030 from the applied 0029' using errcode='55000';
    end if;
  end loop;
end $drift$;

-- 1. The record table's kind checks, dropped and re-added by the names 0029 gave them, with the thirteen new kinds, all
-- scope 3. The scope check (1, 2 or 3) is 0029's and stays. A record table that is not exactly 0029's stops here.
do $checks$
begin
  if (select array_agg(conname::text order by conname) from pg_constraint where conrelid='neuvetra.collection_activity_records'::regclass and contype='c')
    is distinct from array['collection_activity_records_kind_check','collection_activity_records_scope_check','collection_activity_records_scope_kind_check'] then
    raise exception '0030 expected the three 0029 scope and kind checks on collection_activity_records' using errcode='55000';
  end if;
end $checks$;
-- Round 2 (ENG-16), corrected in round 3 (EN-6): the widened checks are added NOT VALID and then validated, and every existing
-- row must still pass. The split does not shorten the lock: migratePrivateStagingFromManifest applies all pending migrations
-- in one transaction, so the ACCESS EXCLUSIVE lock the ALTER takes is held until that transaction commits, through both
-- VALIDATE scans (VALIDATE's own SHARE UPDATE EXCLUSIVE lock adds nothing while the stronger lock is held). Writes to the
-- record table wait for the whole apply; at today's staging size that is well under a second (the native rehearsal times
-- the 29->30 apply). The runbook (DESIGN 13.9) says so.
alter table neuvetra.collection_activity_records
  drop constraint collection_activity_records_kind_check,
  drop constraint collection_activity_records_scope_kind_check,
  add constraint collection_activity_records_kind_check check(kind in('natural_gas','distillate_no2','vehicle','fugitive','electricity','transport','waste','business_travel','employee_commuting','purchase_spend','purchase_supplier','energy_resold','commuting_average','teleworking','asset_energy','partner_reported','building_average','sold_fuel','sold_energy_product','sold_ghg_product','end_of_life_split','investment')) not valid,
  add constraint collection_activity_records_scope_kind_check check((scope=1 and kind in('natural_gas','distillate_no2','vehicle','fugitive')) or (scope=2 and kind='electricity') or (scope=3 and kind in('transport','waste','business_travel','employee_commuting','purchase_spend','purchase_supplier','energy_resold','commuting_average','teleworking','asset_energy','partner_reported','building_average','sold_fuel','sold_energy_product','sold_ghg_product','end_of_life_split','investment'))) not valid;
alter table neuvetra.collection_activity_records validate constraint collection_activity_records_kind_check;
alter table neuvetra.collection_activity_records validate constraint collection_activity_records_scope_kind_check;

-- 1b. Round 2 (owner decision 1, ACC-3): the version table's period check. 0027 created it unnamed (period inside calendar
-- 2025 for every kind); it is found by its exact definition (a versions table that does not have exactly that one check
-- stops here, 55000), dropped, and re-added by name with a Scope 3 kind's period allowed to end up to 1 January 2027 (the
-- Scope 3 method envelope, 2025 and 2026) and every Scope 1 and 2 kind unchanged at calendar 2025. Added NOT VALID, then
-- validated (ENG-16; inside the migration transaction, under the ALTER's ACCESS EXCLUSIVE lock, EN-6): every existing
-- version is a 2025 version and passes.
do $period$
declare found_name text; found_count integer; begin
  select count(*),min(conname::text) into found_count,found_name from pg_constraint where conrelid='neuvetra.collection_activity_versions'::regclass and contype='c'
    and pg_get_constraintdef(oid)='CHECK (((period_start >= ''2025-01-01''::date) AND (period_end_exclusive <= ''2026-01-01''::date) AND (period_start < period_end_exclusive)))';
  if found_count<>1 then raise exception '0030 expected exactly one 0027 period check on collection_activity_versions' using errcode='55000'; end if;
  execute format('alter table neuvetra.collection_activity_versions drop constraint %I',found_name);
end $period$;
alter table neuvetra.collection_activity_versions
  add constraint collection_activity_versions_period_check check(period_start>=date '2025-01-01' and period_start<period_end_exclusive
    and period_end_exclusive<=case when payload->>'kind' in('transport','waste','business_travel','employee_commuting','purchase_spend','purchase_supplier','energy_resold','commuting_average','teleworking','asset_energy','partner_reported','building_average','sold_fuel','sold_energy_product','sold_ghg_product','end_of_life_split','investment') then date '2027-01-01' else date '2026-01-01' end) not valid;
alter table neuvetra.collection_activity_versions validate constraint collection_activity_versions_period_check;

-- 2a. Field rules shared by the new payload branches and the new RPCs. Each mirrors one rule of
-- scope3-collection-contract.ts (named in brackets there); all raise 22023, which the route maps to 422.
-- [scope3_assert_text] A JSON string of at most `hi` characters, with at least `lo` once spaces are trimmed (0023's btrim
-- rule), and no control character other than tab, line feed and carriage return; or JSON null when `nullable`.
create function neuvetra.scope3_assert_text(v jsonb,lo integer,hi integer,nullable boolean,what text) returns void language plpgsql immutable set search_path=pg_catalog,neuvetra,pg_temp as $$ begin
  if nullable and v='null'::jsonb then return; end if;
  if jsonb_typeof(v) is distinct from 'string' then raise exception 'invalid Scope 3 %',what using errcode='22023'; end if;
  if length(v#>>'{}')>hi or length(btrim(v#>>'{}'))<lo or (v#>>'{}') ~ '[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]' then raise exception 'invalid Scope 3 %',what using errcode='22023'; end if;
end $$;
-- [scope3_assert_dec] A plain decimal string: up to 12 integer digits and `places` fractional digits (3, or 6 for a
-- supplier factor), no sign, no leading zero.
create function neuvetra.scope3_assert_dec(v jsonb,places integer,nullable boolean,what text) returns void language plpgsql immutable set search_path=pg_catalog,neuvetra,pg_temp as $$ begin
  if nullable and v='null'::jsonb then return; end if;
  if jsonb_typeof(v) is distinct from 'string' or places not in(3,6) then raise exception 'invalid Scope 3 %',what using errcode='22023'; end if;
  if (v#>>'{}') !~ ('^(0|[1-9][0-9]{0,11})(\.[0-9]{1,'||places||'})?$') then raise exception 'invalid Scope 3 %',what using errcode='22023'; end if;
end $$;
-- [scope3_assert_int] A JSON whole number from `lo` to `hi`.
create function neuvetra.scope3_assert_int(v jsonb,lo integer,hi integer,nullable boolean,what text) returns void language plpgsql immutable set search_path=pg_catalog,neuvetra,pg_temp as $$ begin
  if nullable and v='null'::jsonb then return; end if;
  if jsonb_typeof(v) is distinct from 'number' then raise exception 'invalid Scope 3 %',what using errcode='22023'; end if;
  if v::text !~ '^-?(0|[1-9][0-9]{0,8})$' then raise exception 'invalid Scope 3 %',what using errcode='22023'; end if;
  if (v::text)::integer not between lo and hi then raise exception 'invalid Scope 3 %',what using errcode='22023'; end if;
end $$;
-- [scope3_assert_enum] One of the listed strings.
create function neuvetra.scope3_assert_enum(v jsonb,allowed text[],nullable boolean,what text) returns void language plpgsql immutable set search_path=pg_catalog,neuvetra,pg_temp as $$ begin
  if nullable and v='null'::jsonb then return; end if;
  if jsonb_typeof(v) is distinct from 'string' then raise exception 'invalid Scope 3 %',what using errcode='22023'; end if;
  if not ((v#>>'{}')=any(allowed)) then raise exception 'invalid Scope 3 %',what using errcode='22023'; end if;
end $$;
create function neuvetra.scope3_assert_match(v jsonb,pattern text,nullable boolean,what text) returns void language plpgsql immutable set search_path=pg_catalog,neuvetra,pg_temp as $$ begin
  if nullable and v='null'::jsonb then return; end if;
  if jsonb_typeof(v) is distinct from 'string' then raise exception 'invalid Scope 3 %',what using errcode='22023'; end if;
  if (v#>>'{}') !~ pattern then raise exception 'invalid Scope 3 %',what using errcode='22023'; end if;
end $$;
create function neuvetra.scope3_assert_bool(v jsonb,nullable boolean,what text) returns void language plpgsql immutable set search_path=pg_catalog,neuvetra,pg_temp as $$ begin
  if nullable and v='null'::jsonb then return; end if;
  if jsonb_typeof(v) is distinct from 'boolean' then raise exception 'invalid Scope 3 %',what using errcode='22023'; end if;
end $$;
-- A JSON whole number that is one of the listed categories.
create function neuvetra.scope3_assert_category(v jsonb,allowed integer[],what text) returns void language plpgsql immutable set search_path=pg_catalog,neuvetra,pg_temp as $$ begin
  if jsonb_typeof(v) is distinct from 'number' then raise exception 'invalid Scope 3 %',what using errcode='22023'; end if;
  if not (v::text=any(allowed::text[])) then raise exception 'invalid Scope 3 %',what using errcode='22023'; end if;
end $$;
-- A real calendar date written YYYY-MM-DD, from 1900 to 2099 (the years PostgreSQL and JavaScript read alike).
create function neuvetra.scope3_assert_date(v jsonb,what text) returns void language plpgsql stable set search_path=pg_catalog,neuvetra,pg_temp as $$
declare d date; begin
  if jsonb_typeof(v) is distinct from 'string' then raise exception 'invalid Scope 3 %',what using errcode='22023'; end if;
  if (v#>>'{}') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or (v#>>'{}') collate "C"<'1900-01-01' or (v#>>'{}') collate "C">'2099-12-31' then raise exception 'invalid Scope 3 %',what using errcode='22023'; end if;
  begin d:=(v#>>'{}')::date; exception when others then raise exception 'invalid Scope 3 %',what using errcode='22023'; end;
  if to_char(d,'YYYY-MM-DD')<>(v#>>'{}') then raise exception 'invalid Scope 3 %',what using errcode='22023'; end if;
end $$;
-- [scope3_assert_data_quality] DESIGN §3.2: the optional `dataQuality` key of a payload. Absent or null: the method defaults.
create function neuvetra.scope3_assert_data_quality(p jsonb) returns void language plpgsql immutable set search_path=pg_catalog,neuvetra,pg_temp as $$
declare k text; begin
  if not (p ? 'dataQuality') or p->'dataQuality'='null'::jsonb then return; end if;
  perform neuvetra.m71_keys(p->'dataQuality','indicators,activityDataOrigin,basis');
  perform neuvetra.m71_keys(p#>'{dataQuality,indicators}','technological,temporal,geographical,completeness,reliability');
  foreach k in array array['technological','temporal','geographical','completeness','reliability'] loop
    perform neuvetra.scope3_assert_enum(p#>array['dataQuality','indicators',k],array['very_good','good','fair','poor'],true,'data quality rating');
  end loop;
  perform neuvetra.scope3_assert_enum(p#>'{dataQuality,activityDataOrigin}',array['company_records','value_chain_partner','estimate'],true,'activity data origin');
  perform neuvetra.scope3_assert_text(p#>'{dataQuality,basis}',0,500,true,'data quality basis');
end $$;
-- [scope3_assert_location] The electricity record's location (a five-digit ZIP, a subregion of up to 20 characters and an
-- optional utility EIA ID of up to 40), or none at all when the payload's basis or carrier needs no grid location.
create function neuvetra.scope3_assert_location(p jsonb,present boolean) returns void language plpgsql immutable set search_path=pg_catalog,neuvetra,pg_temp as $$ begin
  if not present then
    if p->'zip'<>'null'::jsonb or p->'subregion'<>'null'::jsonb or p->'utilityEiaId'<>'null'::jsonb then raise exception 'invalid Scope 3 grid location' using errcode='22023'; end if;
    return;
  end if;
  perform neuvetra.scope3_assert_match(p->'zip','^[0-9]{5}$',false,'ZIP');
  perform neuvetra.scope3_assert_text(p->'subregion',0,20,false,'subregion');
  perform neuvetra.scope3_assert_text(p->'utilityEiaId',0,40,true,'utility EIA ID');
end $$;
-- [scope3_assert_supersedes_spend] I-02b (AM-07, A22): the spend lines a supplier or partner record supersedes: null, or
-- exactly a supplier name (1-200 characters) and 0-50 distinct mapping keys (SHA-256, lowercase hex).
create function neuvetra.scope3_assert_supersedes_spend(v jsonb) returns void language plpgsql immutable set search_path=pg_catalog,neuvetra,pg_temp as $$ begin
  if v='null'::jsonb then return; end if;
  perform neuvetra.m71_keys(v,'supplierName,mappingKeys');
  perform neuvetra.scope3_assert_text(v->'supplierName',1,200,false,'superseded supplier');
  if jsonb_typeof(v->'mappingKeys') is distinct from 'array' then raise exception 'invalid Scope 3 superseded spend mapping keys' using errcode='22023'; end if;
  if jsonb_array_length(v->'mappingKeys')>50 or exists(select 1 from jsonb_array_elements(v->'mappingKeys') e where jsonb_typeof(e)<>'string' or e#>>'{}' !~ '^[0-9a-f]{64}$')
    or (select count(*) from jsonb_array_elements_text(v->'mappingKeys'))<>(select count(distinct e) from jsonb_array_elements_text(v->'mappingKeys') e) then raise exception 'invalid Scope 3 superseded spend mapping keys' using errcode='22023'; end if;
end $$;
-- [scope3SpendNaicsAllowed] I-02b (AM-05; DESIGN §3.3, B3, B6): whether a remembered mapping or an imported spend line may
-- put a 2017 NAICS-6 code in a category. Categories 1 and 2 take any code (their energy, overlap and trade-sector guards
-- are adapter holds); 3 the fuel proxy set (contingency I-12c); 4 and 9 the freight set; 5 the waste set; 6 the passenger
-- set; any other category, or no code, nothing. Explicit sets, every code in the EPA Supply Chain v1.3 file. A saved
-- record is shape-checked only: a code outside its set is an adapter hold, never a refusal.
create function neuvetra.scope3_spend_naics_allowed(category integer,naics text) returns boolean language sql immutable set search_path=pg_catalog,neuvetra,pg_temp as $$
  select coalesce(case
    when category in(1,2) then true
    when category=3 then naics=any(array['212111','212112','212113','221210','324110'])
    when category in(4,9) then naics=any(array['481112','481212','482111','482112','483111','483113','483211','484110','484121','484122','484210','484220','484230','486110','486210','486910','486990','488111','488119','488190','488210','488310','488320','488330','488390','488410','488490','488510','491110','492110','492210','493110','493120','493130','493190'])
    when category=5 then naics=any(array['221320','562111','562112','562119','562211','562212','562213','562219','562910','562920','562991','562998'])
    when category=6 then naics=any(array['481111','481211','482111','483112','483114','483212','485111','485112','485113','485119','485210','485310','485320','485510','485999','532111','721110','721120','721191','721199'])
    else false end,false)
$$;
-- [scope3_assert_reporting_year] I-02b (AM-03): a reporting year is the calendar year of the last day of the setup
-- version's reporting period (period_end_exclusive minus one day). A setup version that isn't the company's is 23503; a
-- year that isn't 2012-2035 or isn't the setup's (including a setup with no period end) is 22023.
create function neuvetra.scope3_assert_reporting_year(target_company uuid,setup_version uuid,v jsonb) returns integer language plpgsql stable set search_path=pg_catalog,neuvetra,pg_temp as $$
declare setup_year integer; found_setup boolean; begin
  perform neuvetra.scope3_assert_int(v,2012,2035,false,'reporting year');
  select true,extract(year from s.period_end_exclusive-1)::integer into found_setup,setup_year from neuvetra.company_setup_versions s where s.company_id=target_company and s.id=setup_version;
  if found_setup is null then raise exception 'current company setup required; reload setup' using errcode='23503'; end if;
  if setup_year is distinct from (v::text)::integer then raise exception 'Scope 3 reporting year is not the setup reporting period''s year' using errcode='22023'; end if;
  return setup_year;
end $$;
revoke all on function neuvetra.scope3_assert_text(jsonb,integer,integer,boolean,text),neuvetra.scope3_assert_dec(jsonb,integer,boolean,text),neuvetra.scope3_assert_int(jsonb,integer,integer,boolean,text),
  neuvetra.scope3_assert_enum(jsonb,text[],boolean,text),neuvetra.scope3_assert_match(jsonb,text,boolean,text),neuvetra.scope3_assert_bool(jsonb,boolean,text),neuvetra.scope3_assert_category(jsonb,integer[],text),
  neuvetra.scope3_assert_date(jsonb,text),neuvetra.scope3_assert_data_quality(jsonb),neuvetra.scope3_assert_location(jsonb,boolean),
  neuvetra.scope3_assert_supersedes_spend(jsonb),neuvetra.scope3_spend_naics_allowed(integer,text),neuvetra.scope3_assert_reporting_year(uuid,uuid,jsonb) from public,authenticated,neuvetra_runtime;

-- 2. The activity check: 0029's body, every Scope 1, Scope 2 and 0029 branch unchanged except at the marked points.
create or replace function neuvetra.collection_assert_activity(a jsonb) returns void language plpgsql set search_path=pg_catalog,neuvetra,pg_temp as $$
declare q jsonb; p jsonb; x jsonb; k text; start_date date; end_date date; begin
  perform neuvetra.m71_keys(a,'kind,locationId,setupVersionId,sourceId,state,withdrawalReason,quantity,quality,estimateBasis,period,reference,notes,evidenceIds,payload');
  if coalesce(a->>'locationId','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or coalesce(a->>'setupVersionId','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or jsonb_typeof(a->'sourceId') is distinct from 'string' or length(btrim(a->>'sourceId')) not between 1 and 120 then raise exception 'location and source identifiers required' using errcode='22023'; end if;
  if a->>'state' not in('active','withdrawn') or jsonb_typeof(a->'withdrawalReason') not in('string','null') or (a->>'state'='active' and a->'withdrawalReason'<>'null'::jsonb) or (a->>'state'='withdrawn' and coalesce(length(btrim(a->>'withdrawalReason')),0) not between 3 and 2000) then raise exception 'invalid withdrawal state or reason' using errcode='22023'; end if;
  -- 0030: the kind list adds the thirteen completion kinds.
  if a->>'kind' not in('natural_gas','distillate_no2','vehicle','fugitive','electricity','transport','waste','business_travel','employee_commuting','purchase_spend','purchase_supplier','energy_resold','commuting_average','teleworking','asset_energy','partner_reported','building_average','sold_fuel','sold_energy_product','sold_ghg_product','end_of_life_split','investment') or jsonb_typeof(a->'reference') is distinct from 'string' or length(a->>'reference')>1000 or jsonb_typeof(a->'notes') is distinct from 'string' or length(a->>'notes')>4000 then raise exception 'invalid collection activity' using errcode='22023'; end if;
  q:=a->'quantity'; perform neuvetra.m71_keys(q,'originalValue,originalUnit,normalizedValue,normalizedUnit');
  if jsonb_typeof(q->'originalValue') is distinct from 'string' or length(q->>'originalValue')>100 or jsonb_typeof(q->'originalUnit') is distinct from 'string' or length(q->>'originalUnit')>80 or jsonb_typeof(q->'normalizedValue') not in('string','null') or jsonb_typeof(q->'normalizedUnit') not in('string','null') or (q->'normalizedValue'='null'::jsonb)<>(q->'normalizedUnit'='null'::jsonb) then raise exception 'invalid collection quantity' using errcode='22023'; end if;
  if q->>'originalValue' in('','unknown') and q->'normalizedValue'<>'null'::jsonb then raise exception 'unknown quantity cannot be normalized' using errcode='22023'; end if;
  if q->'normalizedValue'<>'null'::jsonb then perform neuvetra.collection_assert_decimal(q->>'normalizedValue'); if length(q->>'normalizedUnit') not between 1 and 80 then raise exception 'invalid normalized unit' using errcode='22023'; end if; end if;
  if q->'normalizedValue'<>'null'::jsonb and ((a->>'kind'='natural_gas' and q->>'normalizedUnit' not in('therm','MMBtu','scf','ccf','mcf')) or (a->>'kind' in('distillate_no2','vehicle') and q->>'normalizedUnit'<>'US_gallon') or (a->>'kind'='fugitive' and q->>'normalizedUnit' not in('kg','lb')) or (a->>'kind'='electricity' and q->>'normalizedUnit' not in('kWh','MWh'))
    or (a->>'kind'='transport' and q->>'normalizedUnit' not in('vehicle-mile','vehicle-km','short ton-mile','tonne-km')) or (a->>'kind'='waste' and q->>'normalizedUnit' not in('short_ton','lb','kg','metric_ton'))
    -- 0030: room-night for business travel (hotel stays), and the normalized units of each completion kind (SCOPE3_COLLECTION_UNITS).
    or (a->>'kind'='business_travel' and q->>'normalizedUnit' not in('mile','km','passenger-mile','passenger-km','vehicle-mile','vehicle-km','room-night')) or (a->>'kind'='employee_commuting' and q->>'normalizedUnit' not in('passenger-mile','passenger-km','vehicle-mile','vehicle-km'))
    or (a->>'kind'='purchase_spend' and q->>'normalizedUnit' not in('USD'))
    or (a->>'kind'='purchase_supplier' and q->>'normalizedUnit' not in('kg','metric_ton','short_ton','lb','unit','kWh','MWh','liter','m3','US_gallon','kg CO2e','metric_ton CO2e'))
    or (a->>'kind'='energy_resold' and q->>'normalizedUnit' not in('kWh','MWh'))
    or (a->>'kind'='commuting_average' and q->>'normalizedUnit' not in('employee'))
    or (a->>'kind'='teleworking' and q->>'normalizedUnit' not in('kWh','MWh','therm','MMBtu','scf'))
    or (a->>'kind'='asset_energy' and q->>'normalizedUnit' not in('kWh','MWh','therm','MMBtu','scf','ccf','mcf','kg','lb'))
    or (a->>'kind'='partner_reported' and q->>'normalizedUnit' not in('kg CO2e','metric_ton CO2e'))
    or (a->>'kind'='building_average' and q->>'normalizedUnit' not in('sqft','m2'))
    or (a->>'kind'='sold_fuel' and q->>'normalizedUnit' not in('scf','US_gallon','short_ton','MMBtu'))
    or (a->>'kind'='sold_energy_product' and q->>'normalizedUnit' not in('unit'))
    or (a->>'kind'='sold_ghg_product' and q->>'normalizedUnit' not in('unit'))
    or (a->>'kind'='end_of_life_split' and q->>'normalizedUnit' not in('short_ton','lb','kg','metric_ton'))
    or (a->>'kind'='investment' and q->>'normalizedUnit' not in('USD'))) then raise exception 'unsupported unit cannot be normalized' using errcode='22023'; end if;
  if a->>'quality' not in('actual','estimated','unknown') or jsonb_typeof(a->'estimateBasis') not in('string','null') or (a->>'quality'='estimated' and coalesce(length(btrim(a->>'estimateBasis')),0)=0) or (a->>'quality'<>'estimated' and a->'estimateBasis'<>'null'::jsonb) then raise exception 'invalid collection quality' using errcode='22023'; end if;
  perform neuvetra.m71_keys(a->'period','start,endExclusive');
  foreach k in array array['start','endExclusive'] loop if coalesce(a#>>array['period',k],'')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'invalid collection date' using errcode='22023'; end if; end loop;
  start_date:=(a#>>'{period,start}')::date; end_date:=(a#>>'{period,endExclusive}')::date;
  -- 0030 (round 2, owner decision 1): a Scope 3 kind's period may end up to 1 January 2027 (the Scope 3 method envelope);
  -- Scope 1 and 2 kinds keep calendar 2025 and 0027's message.
  if a->>'kind' in('transport','waste','business_travel','employee_commuting','purchase_spend','purchase_supplier','energy_resold','commuting_average','teleworking','asset_energy','partner_reported','building_average','sold_fuel','sold_energy_product','sold_ghg_product','end_of_life_split','investment') then
    if start_date<date '2025-01-01' or end_date>date '2027-01-01' or start_date>=end_date then raise exception 'collection period outside 2025 and 2026' using errcode='22023'; end if;
  elsif start_date<date '2025-01-01' or end_date>date '2026-01-01' or start_date>=end_date then raise exception 'collection period outside 2025' using errcode='22023'; end if;
  if jsonb_typeof(a->'evidenceIds') is distinct from 'array' or jsonb_array_length(a->'evidenceIds')>20 or exists(select 1 from jsonb_array_elements(a->'evidenceIds') e where jsonb_typeof(e)<>'string' or e#>>'{}' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') or (select count(*) from jsonb_array_elements_text(a->'evidenceIds'))<>(select count(distinct e) from jsonb_array_elements_text(a->'evidenceIds') e) then raise exception 'invalid collection evidence list' using errcode='22023'; end if;
  p:=a->'payload';
  if (a->>'kind'='vehicle' and a->>'sourceId' is distinct from p->>'vehicleGroupId') or (a->>'kind'='electricity' and a->>'sourceId' is distinct from p->>'meterOrAccountNumber') then raise exception 'source identifier must match payload' using errcode='22023'; end if;
  if a->>'kind'='fugitive' and (q->>'originalUnit' is distinct from p->>'unit' or (q->>'normalizedUnit' is not null and q->>'normalizedUnit' is distinct from p->>'unit')) then raise exception 'refrigerant quantity unit must match terms unit' using errcode='22023'; end if;
  if a->>'kind'='natural_gas' then
    perform neuvetra.m71_keys(p,'heatContent');
    if jsonb_typeof(p->'heatContent') not in('object','null') then raise exception 'invalid heat content' using errcode='22023'; end if;
    if p->'heatContent'<>'null'::jsonb then perform neuvetra.m71_keys(p->'heatContent','value,unit'); perform neuvetra.collection_assert_numeric_input(p#>'{heatContent,value}'); if p#>>'{heatContent,unit}' not in('MMBtu per scf','MMBtu per ccf','MMBtu per mcf','therm per ccf') then raise exception 'invalid heat content unit' using errcode='22023'; end if; end if;
  elsif a->>'kind'='distillate_no2' then
    perform neuvetra.m71_keys(p,'consumption,statedHhvMmbtuPerGallon');
    -- Supplier-stated HHV alone permits six fractional digits; quantities stay at three.
    if jsonb_typeof(p->'statedHhvMmbtuPerGallon') not in('string','null') or (p->'statedHhvMmbtuPerGallon'<>'null'::jsonb and p->>'statedHhvMmbtuPerGallon' !~ '^(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?$') then raise exception 'invalid stated HHV' using errcode='22023'; end if;
    if p#>>'{consumption,basis}'='measured' then perform neuvetra.m71_keys(p->'consumption','basis,gallons'); perform neuvetra.collection_assert_numeric_input(p#>'{consumption,gallons}');
    elsif p#>>'{consumption,basis}'='purchases_only' then perform neuvetra.m71_keys(p->'consumption','basis,purchasedGallons'); perform neuvetra.collection_assert_numeric_input(p#>'{consumption,purchasedGallons}');
    elsif p#>>'{consumption,basis}'='purchases_with_tank_levels' then perform neuvetra.m71_keys(p->'consumption','basis,purchasedGallons,openingGallons,closingGallons'); perform neuvetra.collection_assert_numeric_input(p#>'{consumption,purchasedGallons}'); perform neuvetra.collection_assert_numeric_input(p#>'{consumption,openingGallons}'); perform neuvetra.collection_assert_numeric_input(p#>'{consumption,closingGallons}');
    else raise exception 'invalid distillate basis' using errcode='22023'; end if;
  elsif a->>'kind'='vehicle' then
    perform neuvetra.m71_keys(p,'vehicleGroupId,fuel,vehicleType,modelYear,gallons,vehicleCount,miles,fuelEconomy'); perform neuvetra.collection_assert_numeric_input(p->'gallons');
    if jsonb_typeof(p->'vehicleGroupId') is distinct from 'string' or length(btrim(p->>'vehicleGroupId')) not between 1 and 120 or jsonb_typeof(p->'fuel') is distinct from 'string' or length(btrim(p->>'fuel'))=0 or jsonb_typeof(p->'vehicleType') is distinct from 'string' or length(btrim(p->>'vehicleType'))=0 or coalesce(p->>'modelYear','')!~'^[0-9]{4}$' or (p->>'modelYear')::integer not between 1900 and 2026 or jsonb_typeof(p->'vehicleCount') not in('number','null') or jsonb_typeof(p->'miles') not in('object','null') or jsonb_typeof(p->'fuelEconomy') not in('object','null') then raise exception 'invalid vehicle activity' using errcode='22023'; end if;
    if p->'miles'<>'null'::jsonb then perform neuvetra.m71_keys(p->'miles','value,basis'); perform neuvetra.collection_assert_numeric_input(p#>'{miles,value}'); end if;
    if p->'fuelEconomy'<>'null'::jsonb then perform neuvetra.m71_keys(p->'fuelEconomy','mpg,source'); perform neuvetra.collection_assert_numeric_input(p#>'{fuelEconomy,mpg}'); end if;
  elsif a->>'kind'='fugitive' then
    perform neuvetra.m71_keys(p,'gas,unit,terms,insideBoundary,maintainsRefrigerantStock,retrofitInPeriod,contractorRecordsComplete,eventChronologyComplete'); perform neuvetra.m71_keys(p->'terms','PN,CN,PS,CD,RD');
    if p->>'gas' not in('HFC-134a','HFC-227ea','R-404A','R-407C','R-410A','R-507A','R-22','R-12','R-502') or p->>'unit' not in('kg','lb') or jsonb_typeof(p->'insideBoundary') not in('boolean','null') or jsonb_typeof(p->'maintainsRefrigerantStock') not in('boolean','null') or jsonb_typeof(p->'retrofitInPeriod') not in('boolean','null') or jsonb_typeof(p->'contractorRecordsComplete') is distinct from 'boolean' or jsonb_typeof(p->'eventChronologyComplete') is distinct from 'boolean' then raise exception 'invalid fugitive activity' using errcode='22023'; end if;
    foreach k in array array['PN','CN','PS','CD','RD'] loop perform neuvetra.collection_assert_numeric_input(p#>array['terms',k]); end loop;
  elsif a->>'kind'='transport' then
    -- validateScope3Payload: category 4 or 9; vehicle any text up to 80 characters; load basis dedicated, shared or not yet known.
    -- 0030: the optional dataQuality key (DESIGN §3.2).
    perform neuvetra.m71_keys(p-'dataQuality','category,vehicle,loadBasis,thirdPartyFacilities'); perform neuvetra.scope3_assert_data_quality(p);
    if jsonb_typeof(p->'category') is distinct from 'number' or p->>'category' not in('4','9') or jsonb_typeof(p->'vehicle') is distinct from 'string' or length(p->>'vehicle')>80
      or (p->'loadBasis'<>'null'::jsonb and coalesce(p->>'loadBasis','') not in('dedicated_vehicle','shared_vehicle')) or coalesce(p->>'thirdPartyFacilities','') not in('none','present_not_included','unknown') or jsonb_typeof(p->'thirdPartyFacilities') is distinct from 'string' then raise exception 'invalid transport activity' using errcode='22023'; end if;
  elsif a->>'kind'='waste' then
    perform neuvetra.m71_keys(p-'dataQuality','category,material,treatment'); perform neuvetra.scope3_assert_data_quality(p);
    if jsonb_typeof(p->'category') is distinct from 'number' or p->>'category' not in('5','12') or jsonb_typeof(p->'material') is distinct from 'string' or length(p->>'material')>80 or jsonb_typeof(p->'treatment') is distinct from 'string' or length(p->>'treatment')>80 then raise exception 'invalid waste activity' using errcode='22023'; end if;
  elsif a->>'kind'='business_travel' then
    -- 0030: v2 adds cabinClass and hotelCountry (both or neither) and the optional dataQuality key.
    if (p-'dataQuality') ? 'cabinClass' or (p-'dataQuality') ? 'hotelCountry' then
      perform neuvetra.m71_keys(p-'dataQuality','mode,passengerSegments,haulBasis,cabinClass,hotelCountry');
      perform neuvetra.scope3_assert_enum(p->'cabinClass',array['economy','premium_economy','business','first','unknown'],true,'cabin class');
      perform neuvetra.scope3_assert_match(p->'hotelCountry','^[A-Z]{2}$',true,'hotel country');
    else perform neuvetra.m71_keys(p-'dataQuality','mode,passengerSegments,haulBasis'); end if;
    perform neuvetra.scope3_assert_data_quality(p);
    if jsonb_typeof(p->'mode') is distinct from 'string' or length(p->>'mode')>80
      or (p->'passengerSegments'<>'null'::jsonb and (jsonb_typeof(p->'passengerSegments') is distinct from 'number' or coalesce(p->>'passengerSegments','') !~ '^[1-9][0-9]{0,7}$' or (p->>'passengerSegments')::bigint>10000000))
      or (p->'haulBasis'<>'null'::jsonb and (jsonb_typeof(p->'haulBasis') is distinct from 'string' or length(p->>'haulBasis')>200)) then raise exception 'invalid business travel activity' using errcode='22023'; end if;
  elsif a->>'kind'='employee_commuting' then
    perform neuvetra.m71_keys(p-'dataQuality','mode'); perform neuvetra.scope3_assert_data_quality(p);
    if jsonb_typeof(p->'mode') is distinct from 'string' or length(p->>'mode')>80 then raise exception 'invalid commuting activity' using errcode='22023'; end if;
  -- 0030: the thirteen Scope 3 completion kinds, each mirroring validateScope3Payload (scope3-collection-contract.ts) key for key.
  elsif a->>'kind'='purchase_spend' then
    -- I-02b (AM-04): categories 1-6 and 9; years 2012-2035; the category 9 attestation and estimate basis; the line date;
    -- the possible duplicate and its confirmation.
    perform neuvetra.m71_keys(p-'dataQuality','category,naicsCode,dollarYear,marginChoice,boughtAtFactoryGate,capitalFullCost,taxTreatment,supplierName,glAccount,description,categoryConfirmed,activityOverlap,importId,importRow,mappingSource,paidByReportingCompany,spendEstimateBasis,lineDate,possibleDuplicateOf,duplicateConfirmedDistinct');
    perform neuvetra.scope3_assert_data_quality(p);
    perform neuvetra.scope3_assert_category(p->'category',array[1,2,3,4,5,6,9],'spend category');
    perform neuvetra.scope3_assert_match(p->'naicsCode','^[0-9]{6}$',true,'NAICS code');
    perform neuvetra.scope3_assert_int(p->'dollarYear',2012,2035,true,'dollar year');
    perform neuvetra.scope3_assert_enum(p->'marginChoice',array['with_margins','without_margins'],false,'margin choice');
    perform neuvetra.scope3_assert_bool(p->'boughtAtFactoryGate',false,'bought at factory gate');
    perform neuvetra.scope3_assert_bool(p->'capitalFullCost',true,'capital full cost');
    perform neuvetra.scope3_assert_enum(p->'taxTreatment',array['excludes_sales_tax','includes_sales_tax','unknown'],false,'tax treatment');
    perform neuvetra.scope3_assert_text(p->'supplierName',0,200,false,'supplier name');
    perform neuvetra.scope3_assert_text(p->'glAccount',0,120,false,'GL account');
    perform neuvetra.scope3_assert_text(p->'description',1,200,false,'description');
    perform neuvetra.scope3_assert_bool(p->'categoryConfirmed',false,'category confirmed');
    perform neuvetra.scope3_assert_enum(p->'activityOverlap',array['none_confirmed','unknown'],false,'activity overlap');
    perform neuvetra.scope3_assert_match(p->'importId','^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',true,'import ID');
    perform neuvetra.scope3_assert_int(p->'importRow',1,9999999,true,'import row');
    if (p->'importId'='null'::jsonb)<>(p->'importRow'='null'::jsonb) then raise exception 'invalid Scope 3 import reference' using errcode='22023'; end if;
    perform neuvetra.scope3_assert_enum(p->'mappingSource',array['file','memory','user','unmatched'],false,'mapping source');
    -- Category 9 is transport the reporting company did not pay for (Scope 3 Standard Table 5.7): entered by hand, never
    -- imported, with the attestation and the basis of the estimate; no other category has either.
    perform neuvetra.scope3_assert_bool(p->'paidByReportingCompany',true,'paid by reporting company');
    perform neuvetra.scope3_assert_text(p->'spendEstimateBasis',3,300,true,'spend estimate basis');
    if (p->>'category'='9')<>(p->'paidByReportingCompany'<>'null'::jsonb) or (p->>'category'='9')<>(p->'spendEstimateBasis'<>'null'::jsonb) then raise exception 'invalid Scope 3 category 9 spend' using errcode='22023'; end if;
    if p->>'category'='9' and p->'importId'<>'null'::jsonb then raise exception 'invalid Scope 3 category 9 spend' using errcode='22023'; end if;
    if p->'lineDate'<>'null'::jsonb then perform neuvetra.scope3_assert_date(p->'lineDate','line date'); end if;
    if p->'possibleDuplicateOf'<>'null'::jsonb then
      perform neuvetra.m71_keys(p->'possibleDuplicateOf','importId,row');
      perform neuvetra.scope3_assert_match(p#>'{possibleDuplicateOf,importId}','^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',false,'possible duplicate import ID');
      perform neuvetra.scope3_assert_int(p#>'{possibleDuplicateOf,row}',1,9999999,false,'possible duplicate row');
    end if;
    perform neuvetra.scope3_assert_bool(p->'duplicateConfirmedDistinct',false,'duplicate confirmed distinct');
  elsif a->>'kind'='purchase_supplier' then
    -- I-02b (AM-07): the factor origin, the hybrid boundary and its upstream coverage, the spend it supersedes; years 2012-2035.
    perform neuvetra.m71_keys(p-'dataQuality','category,supplierName,product,basis,factorValue,factorUnit,allocationBasis,allocationNumerator,allocationDenominator,boundary,gwpBasis,verification,dataYear,factorOrigin,hybridUpstreamCoveredBy,supersedesSpend');
    perform neuvetra.scope3_assert_data_quality(p);
    perform neuvetra.scope3_assert_category(p->'category',array[1,2],'supplier category');
    perform neuvetra.scope3_assert_text(p->'supplierName',1,200,false,'supplier name');
    perform neuvetra.scope3_assert_text(p->'product',1,200,false,'product');
    perform neuvetra.scope3_assert_enum(p->'basis',array['product_factor','allocated_total'],false,'supplier basis');
    -- A product factor has a value and a unit; an allocated total has neither.
    if p->>'basis'='product_factor' then
      perform neuvetra.scope3_assert_dec(p->'factorValue',6,false,'factor value');
      perform neuvetra.scope3_assert_text(p->'factorUnit',1,80,false,'factor unit');
    elsif p->'factorValue'<>'null'::jsonb or p->'factorUnit'<>'null'::jsonb then raise exception 'invalid Scope 3 allocated total' using errcode='22023'; end if;
    perform neuvetra.scope3_assert_enum(p->'allocationBasis',array['supplier_allocated','revenue','physical','other'],false,'allocation basis');
    -- The share is a numerator and a denominator, except when the supplier already allocated the figure.
    if p->>'allocationBasis'='supplier_allocated' then
      if p->'allocationNumerator'<>'null'::jsonb or p->'allocationDenominator'<>'null'::jsonb then raise exception 'invalid Scope 3 supplier allocation' using errcode='22023'; end if;
    else
      perform neuvetra.scope3_assert_dec(p->'allocationNumerator',3,false,'allocation numerator');
      perform neuvetra.scope3_assert_dec(p->'allocationDenominator',3,false,'allocation denominator');
    end if;
    perform neuvetra.scope3_assert_enum(p->'boundary',array['cradle_to_gate','other','supplier_scope1_2_only'],false,'boundary');
    perform neuvetra.scope3_assert_enum(p->'hybridUpstreamCoveredBy',array['other_records','none'],true,'hybrid upstream coverage');
    if (p->>'boundary'='supplier_scope1_2_only')<>(p->'hybridUpstreamCoveredBy'<>'null'::jsonb) then raise exception 'invalid Scope 3 hybrid boundary' using errcode='22023'; end if;
    perform neuvetra.scope3_assert_enum(p->'gwpBasis',array['AR4','AR5','AR6','unknown'],false,'GWP basis');
    perform neuvetra.scope3_assert_enum(p->'verification',array['third_party_verified','unverified'],false,'verification');
    perform neuvetra.scope3_assert_int(p->'dataYear',2012,2035,false,'data year');
    perform neuvetra.scope3_assert_enum(p->'factorOrigin',array['supplier_primary','secondary_database'],false,'factor origin');
    perform neuvetra.scope3_assert_supersedes_spend(p->'supersedesSpend');
  elsif a->>'kind'='energy_resold' then
    -- I-02b (AM-11): whether the resold energy is kept out of the company's Scope 2 records.
    perform neuvetra.m71_keys(p-'dataQuality','gridBasis,zip,subregion,utilityEiaId,resoldEnergyNotInScope2');
    perform neuvetra.scope3_assert_data_quality(p);
    perform neuvetra.scope3_assert_enum(p->'gridBasis',array['subregion','us_average'],false,'grid basis');
    perform neuvetra.scope3_assert_location(p,p->>'gridBasis'='subregion');
    perform neuvetra.scope3_assert_bool(p->'resoldEnergyNotInScope2',false,'resold energy kept out of Scope 2');
  elsif a->>'kind'='commuting_average' then
    -- I-02b (AM-10): the overlap attestation with distance-based commuting records.
    perform neuvetra.m71_keys(p-'dataQuality','workingDays,modes,sharesBasis,distanceBasis,activityOverlap');
    perform neuvetra.scope3_assert_data_quality(p);
    perform neuvetra.scope3_assert_int(p->'workingDays',1,366,false,'working days');
    if jsonb_typeof(p->'modes') is distinct from 'array' then raise exception 'invalid Scope 3 commuting modes' using errcode='22023'; end if;
    if jsonb_array_length(p->'modes') not between 1 and 10 then raise exception 'invalid Scope 3 commuting modes' using errcode='22023'; end if;
    for x in select value from jsonb_array_elements(p->'modes') loop
      perform neuvetra.m71_keys(x,'mode,sharePercent,oneWayDistance,distanceUnit,occupancy');
      perform neuvetra.scope3_assert_text(x->'mode',0,80,false,'commuting mode');
      perform neuvetra.scope3_assert_dec(x->'sharePercent',3,false,'mode share');
      perform neuvetra.scope3_assert_dec(x->'oneWayDistance',3,false,'one-way distance');
      perform neuvetra.scope3_assert_enum(x->'distanceUnit',array['mile','km'],false,'distance unit');
      perform neuvetra.scope3_assert_dec(x->'occupancy',3,true,'occupancy');
      if x->'occupancy'<>'null'::jsonb and (x->>'occupancy')::numeric<1 then raise exception 'invalid Scope 3 occupancy' using errcode='22023'; end if;
    end loop;
    perform neuvetra.scope3_assert_text(p->'sharesBasis',3,300,false,'shares basis');
    perform neuvetra.scope3_assert_text(p->'distanceBasis',3,300,false,'distance basis');
    perform neuvetra.scope3_assert_enum(p->'activityOverlap',array['none_confirmed','unknown'],false,'activity overlap');
  elsif a->>'kind'='teleworking' then
    perform neuvetra.m71_keys(p-'dataQuality','carrier,zip,subregion,utilityEiaId,baselineBasis');
    perform neuvetra.scope3_assert_data_quality(p);
    perform neuvetra.scope3_assert_enum(p->'carrier',array['electricity','natural_gas'],false,'teleworking carrier');
    perform neuvetra.scope3_assert_location(p,p->>'carrier'='electricity');
    perform neuvetra.scope3_assert_text(p->'baselineBasis',3,300,false,'baseline basis');
  elsif a->>'kind'='asset_energy' then
    perform neuvetra.m71_keys(p-'dataQuality','category,carrier,assetLabel,counterpartyName,leaseType,noOperationalControlBasis,zip,subregion,utilityEiaId,refrigerantGas,allocation');
    perform neuvetra.scope3_assert_data_quality(p);
    -- I-02b (AM-09): also categories 4 and 9 (third-party warehouses and distribution centres).
    perform neuvetra.scope3_assert_category(p->'category',array[4,8,9,10,13,14],'asset category');
    perform neuvetra.scope3_assert_enum(p->'carrier',array['electricity','natural_gas','refrigerant'],false,'asset carrier');
    perform neuvetra.scope3_assert_text(p->'assetLabel',1,200,false,'asset label');
    perform neuvetra.scope3_assert_text(p->'counterpartyName',0,200,false,'counterparty');
    perform neuvetra.scope3_assert_enum(p->'leaseType',array['operating','finance'],true,'lease type');
    perform neuvetra.scope3_assert_text(p->'noOperationalControlBasis',0,500,true,'operational control basis');
    perform neuvetra.scope3_assert_location(p,p->>'carrier'='electricity');
    if p->>'carrier'='refrigerant' then perform neuvetra.scope3_assert_text(p->'refrigerantGas',0,80,false,'refrigerant');
    elsif p->'refrigerantGas'<>'null'::jsonb then raise exception 'invalid Scope 3 refrigerant' using errcode='22023'; end if;
    if p->'allocation'<>'null'::jsonb then
      perform neuvetra.m71_keys(p->'allocation','reportingArea,buildingArea,occupancyPercent,areaUnit');
      perform neuvetra.scope3_assert_dec(p#>'{allocation,reportingArea}',3,false,'reporting area');
      perform neuvetra.scope3_assert_dec(p#>'{allocation,buildingArea}',3,false,'building area');
      perform neuvetra.scope3_assert_dec(p#>'{allocation,occupancyPercent}',3,false,'occupancy percent');
      perform neuvetra.scope3_assert_enum(p#>'{allocation,areaUnit}',array['sqft','m2'],false,'area unit');
    end if;
  elsif a->>'kind'='partner_reported' then
    -- I-02b (AM-08): also categories 4, 5, 9 and 12 (carriers, 3PLs and waste contractors), and the spend it supersedes.
    perform neuvetra.m71_keys(p-'dataQuality','category,counterpartyName,scope2Basis,allocationBasis,allocationNumerator,allocationDenominator,leaseType,noOperationalControlBasis,gwpBasis,verification,periodMatches,supersedesSpend');
    perform neuvetra.scope3_assert_data_quality(p);
    perform neuvetra.scope3_assert_category(p->'category',array[4,5,8,9,10,12,13,14],'partner category');
    perform neuvetra.scope3_assert_text(p->'counterpartyName',1,200,false,'counterparty');
    perform neuvetra.scope3_assert_enum(p->'scope2Basis',array['location','market','unknown'],false,'Scope 2 basis');
    perform neuvetra.scope3_assert_enum(p->'allocationBasis',array['area','volume','count','revenue','mass','exclusive','other'],false,'allocation basis');
    -- An asset used only by the reporting company takes the whole figure; any other basis is a numerator over a denominator.
    if p->>'allocationBasis'='exclusive' then
      if p->'allocationNumerator'<>'null'::jsonb or p->'allocationDenominator'<>'null'::jsonb then raise exception 'invalid Scope 3 exclusive allocation' using errcode='22023'; end if;
    else
      perform neuvetra.scope3_assert_dec(p->'allocationNumerator',3,false,'allocation numerator');
      perform neuvetra.scope3_assert_dec(p->'allocationDenominator',3,false,'allocation denominator');
    end if;
    perform neuvetra.scope3_assert_enum(p->'leaseType',array['operating','finance'],true,'lease type');
    perform neuvetra.scope3_assert_text(p->'noOperationalControlBasis',0,500,true,'operational control basis');
    perform neuvetra.scope3_assert_enum(p->'gwpBasis',array['AR4','AR5','AR6','unknown'],false,'GWP basis');
    perform neuvetra.scope3_assert_enum(p->'verification',array['third_party_verified','unverified'],false,'verification');
    perform neuvetra.scope3_assert_bool(p->'periodMatches',false,'period matches');
    perform neuvetra.scope3_assert_supersedes_spend(p->'supersedesSpend');
  elsif a->>'kind'='building_average' then
    perform neuvetra.m71_keys(p-'dataQuality','category,cbecsActivity,usesNaturalGas,gridBasis,zip,subregion,utilityEiaId,coveredDays,leaseType,noOperationalControlBasis');
    perform neuvetra.scope3_assert_data_quality(p);
    perform neuvetra.scope3_assert_category(p->'category',array[8,13,14],'building category');
    perform neuvetra.scope3_assert_text(p->'cbecsActivity',0,80,false,'building activity');
    perform neuvetra.scope3_assert_enum(p->'usesNaturalGas',array['yes','no','unknown'],false,'uses natural gas');
    perform neuvetra.scope3_assert_enum(p->'gridBasis',array['subregion','us_average'],false,'grid basis');
    perform neuvetra.scope3_assert_location(p,p->>'gridBasis'='subregion');
    -- I-02b (AM-14): a leap year has 366 days.
    perform neuvetra.scope3_assert_int(p->'coveredDays',1,366,false,'covered days');
    perform neuvetra.scope3_assert_enum(p->'leaseType',array['operating','finance'],true,'lease type');
    perform neuvetra.scope3_assert_text(p->'noOperationalControlBasis',0,500,true,'operational control basis');
  elsif a->>'kind'='sold_fuel' then
    perform neuvetra.m71_keys(p-'dataQuality','fuel,combustedInUse');
    perform neuvetra.scope3_assert_data_quality(p);
    perform neuvetra.scope3_assert_text(p->'fuel',0,80,false,'fuel');
    perform neuvetra.scope3_assert_enum(p->'combustedInUse',array['yes','no_feedstock'],false,'combusted in use');
  elsif a->>'kind'='sold_energy_product' then
    perform neuvetra.m71_keys(p-'dataQuality','productLabel,lifetimeBasis,lifetimeQuantity,energyPerBasis,energyCarrier,energyUnit,useRegion,lifetimeSource');
    perform neuvetra.scope3_assert_data_quality(p);
    perform neuvetra.scope3_assert_text(p->'productLabel',1,200,false,'product');
    perform neuvetra.scope3_assert_enum(p->'lifetimeBasis',array['years','uses'],false,'lifetime basis');
    perform neuvetra.scope3_assert_dec(p->'lifetimeQuantity',3,false,'lifetime');
    perform neuvetra.scope3_assert_dec(p->'energyPerBasis',3,false,'energy per year or use');
    perform neuvetra.scope3_assert_text(p->'energyCarrier',0,80,false,'energy carrier');
    perform neuvetra.scope3_assert_text(p->'energyUnit',0,80,false,'energy unit');
    perform neuvetra.scope3_assert_text(p->'useRegion',0,80,false,'use region');
    perform neuvetra.scope3_assert_text(p->'lifetimeSource',3,300,false,'lifetime source');
  elsif a->>'kind'='sold_ghg_product' then
    -- I-02b (AM-12): the use-phase release percent is required with its basis (no 100% default).
    perform neuvetra.m71_keys(p-'dataQuality','productLabel,gas,chargePerUnit,chargeUnit,useReleasePercent,releaseBasis');
    perform neuvetra.scope3_assert_data_quality(p);
    perform neuvetra.scope3_assert_text(p->'productLabel',1,200,false,'product');
    perform neuvetra.scope3_assert_text(p->'gas',0,80,false,'gas');
    perform neuvetra.scope3_assert_dec(p->'chargePerUnit',3,false,'charge per unit');
    perform neuvetra.scope3_assert_enum(p->'chargeUnit',array['kg','lb'],false,'charge unit');
    perform neuvetra.scope3_assert_dec(p->'useReleasePercent',3,false,'use-phase release percent');
    if (p->>'useReleasePercent')::numeric>100 then raise exception 'invalid Scope 3 use-phase release percent' using errcode='22023'; end if;
    perform neuvetra.scope3_assert_text(p->'releaseBasis',3,300,false,'release basis');
  elsif a->>'kind'='end_of_life_split' then
    -- I-02b (AM-13): the product label, to match category 11 records of the same product.
    perform neuvetra.m71_keys(p-'dataQuality','material,basis,split,splitBasis,productLabel');
    perform neuvetra.scope3_assert_data_quality(p);
    perform neuvetra.scope3_assert_text(p->'material',0,80,false,'material');
    perform neuvetra.scope3_assert_enum(p->'basis',array['sold_products','packaging'],false,'end-of-life basis');
    if p->'split'<>'null'::jsonb then
      perform neuvetra.m71_keys(p->'split','recycled,landfilled,combusted,composted,anaerobic_digestion_dry,anaerobic_digestion_wet');
      foreach k in array array['recycled','landfilled','combusted','composted','anaerobic_digestion_dry','anaerobic_digestion_wet'] loop perform neuvetra.scope3_assert_dec(p->'split'->k,3,false,'treatment share'); end loop;
    end if;
    perform neuvetra.scope3_assert_text(p->'splitBasis',3,300,true,'split basis');
    perform neuvetra.scope3_assert_text(p->'productLabel',0,200,false,'product');
  elsif a->>'kind'='investment' then
    perform neuvetra.m71_keys(p-'dataQuality','investeeName,holdingType,path,attribution,investeeEmissions,emissionsVerified,revenue,revenueYear,naicsCode,initialSponsor,projectedAnnual,lifetimeYears,snapshotDate,gwpBasis');
    perform neuvetra.scope3_assert_data_quality(p);
    perform neuvetra.scope3_assert_text(p->'investeeName',1,200,false,'investee');
    perform neuvetra.scope3_assert_enum(p->'holdingType',array['equity_listed','equity_unlisted','jv_associate','debt_known_use','project_finance','debt_general','other'],false,'holding type');
    perform neuvetra.scope3_assert_enum(p->'path',array['investee_reported','project_reported','revenue_eeio'],false,'investment path');
    if jsonb_typeof(p->'attribution')='object' and p#>>'{attribution,basis}'='outstanding_over_denominator' then
      perform neuvetra.m71_keys(p->'attribution','basis,denominatorType,denominator');
      perform neuvetra.scope3_assert_enum(p#>'{attribution,denominatorType}',array['evic','total_equity_plus_debt','total_project_cost'],false,'attribution denominator');
      perform neuvetra.scope3_assert_dec(p#>'{attribution,denominator}',3,false,'attribution denominator');
    else
      perform neuvetra.m71_keys(p->'attribution','basis,percent');
      perform neuvetra.scope3_assert_enum(p#>'{attribution,basis}',array['equity_share_percent'],false,'attribution basis');
      perform neuvetra.scope3_assert_dec(p#>'{attribution,percent}',3,false,'equity share');
    end if;
    perform neuvetra.scope3_assert_dec(p->'investeeEmissions',3,true,'investee emissions');
    perform neuvetra.scope3_assert_bool(p->'emissionsVerified',true,'emissions verified');
    perform neuvetra.scope3_assert_dec(p->'revenue',3,true,'revenue');
    perform neuvetra.scope3_assert_int(p->'revenueYear',2012,2035,true,'revenue year');
    perform neuvetra.scope3_assert_match(p->'naicsCode','^[0-9]{6}$',true,'NAICS code');
    perform neuvetra.scope3_assert_bool(p->'initialSponsor',false,'initial sponsor');
    perform neuvetra.scope3_assert_dec(p->'projectedAnnual',3,true,'projected annual emissions');
    perform neuvetra.scope3_assert_int(p->'lifetimeYears',1,100,true,'lifetime years');
    perform neuvetra.scope3_assert_date(p->'snapshotDate','snapshot date');
    perform neuvetra.scope3_assert_enum(p->'gwpBasis',array['AR4','AR5','AR6','unknown'],false,'GWP basis');
  else
    perform neuvetra.m71_keys(p,'meterOrAccountNumber,utilityName,site,zip,subregion,utilityEiaId,instruments');
    if coalesce(p->>'zip','')!~'^[0-9]{5}$' or jsonb_typeof(p->'utilityEiaId') not in('string','null') or jsonb_typeof(p->'instruments') is distinct from 'array' or jsonb_array_length(p->'instruments')>100 then raise exception 'invalid electricity activity' using errcode='22023'; end if;
    for x in select value from jsonb_array_elements(p->'instruments') loop
      perform neuvetra.m71_keys(x,'type,mwh,qualityCriteriaMet,vintageYear,evidenceReference,generationTechnology,rateLbPerMwh'); perform neuvetra.collection_assert_numeric_input(x->'mwh');
      if x->>'type' not in('energy_attribute_certificate','power_purchase_agreement','green_tariff','supplier_specific_rate') or jsonb_typeof(x->'qualityCriteriaMet') is distinct from 'boolean' or coalesce(x->>'vintageYear','')!~'^[0-9]{4}$' or (x->>'vintageYear')::integer not between 1000 and 9999 or jsonb_typeof(x->'evidenceReference') not in('string','null') or (x->'evidenceReference'<>'null'::jsonb and coalesce(x->>'evidenceReference','')!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') or x->>'generationTechnology' not in('wind','solar_photovoltaic','hydro','nuclear','geothermal','natural_gas','coal','oil','biomass','biogas','landfill_gas','mixed','unknown') or jsonb_typeof(x->'rateLbPerMwh') not in('object','null') then raise exception 'invalid electricity instrument' using errcode='22023'; end if;
      if x->'rateLbPerMwh'<>'null'::jsonb then perform neuvetra.m71_keys(x->'rateLbPerMwh','co2,ch4,n2o'); perform neuvetra.collection_assert_numeric_input(x#>'{rateLbPerMwh,co2}'); if x#>'{rateLbPerMwh,ch4}'<>'null'::jsonb then perform neuvetra.collection_assert_numeric_input(x#>'{rateLbPerMwh,ch4}'); end if; if x#>'{rateLbPerMwh,n2o}'<>'null'::jsonb then perform neuvetra.collection_assert_numeric_input(x#>'{rateLbPerMwh,n2o}'); end if; end if;
      if x->'evidenceReference'<>'null'::jsonb and not (a->'evidenceIds' ? (x->>'evidenceReference')) then raise exception 'instrument evidence must be linked' using errcode='22023'; end if;
    end loop;
  end if;
end $$;

-- 3. The save function: 0029's body (0027's, with scope 3 for Scope 3 kinds) with the marked expressions changed.
create or replace function neuvetra.save_collection_activity(target_company uuid,target_record uuid,request jsonb)
returns table(record_id uuid,version_id uuid,replayed boolean) language plpgsql security definer set search_path=pg_catalog,neuvetra,pg_temp as $$
#variable_conflict use_column
declare actor uuid:=auth.uid(); a jsonb; old neuvetra.collection_activity_requests%rowtype; head neuvetra.collection_activity_heads%rowtype; rec neuvetra.collection_activity_records%rowtype; fingerprint text; new_version uuid:=gen_random_uuid(); next_revision integer; evidence text; instrument jsonb; n bigint; begin
  if actor is null or not neuvetra.has_staging_access() or not neuvetra.can_manage_company(target_company) then raise exception 'collection activity unavailable' using errcode='42501'; end if;
  perform neuvetra.m71_keys(request,'idempotencyKey,expectedRevision,expectedVersionId,correctionReason,activity');
  if coalesce(request->>'idempotencyKey','')!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or coalesce(request->>'expectedRevision','')!~'^[0-9]{1,4}$' or jsonb_typeof(request->'expectedVersionId') not in('string','null') or jsonb_typeof(request->'correctionReason') not in('string','null') or octet_length(request::text)>150000 then raise exception 'invalid collection request' using errcode='22023'; end if;
  a:=request->'activity'; perform neuvetra.collection_assert_activity(a);
  a:=neuvetra.collection_derive_quantity(a); request:=jsonb_set(request,'{activity}',a);
  fingerprint:=neuvetra.m67_hash(jsonb_build_object('operation','save_collection_activity','companyId',target_company,'recordId',target_record,'actorId',actor,'request',request-'idempotencyKey'));
  -- Serialize before looking up the receipt: a concurrent exact replay may have
  -- been waiting on this company lock and must observe the committed request.
  perform id from neuvetra.companies where id=target_company for update;
  select * into old from neuvetra.collection_activity_requests where company_id=target_company and idempotency_key=(request->>'idempotencyKey')::uuid;
  if found then if old.actor_id<>actor or old.request_sha256<>fingerprint or old.record_id<>target_record then raise exception 'collection idempotency conflict' using errcode='23505'; end if; record_id:=old.record_id; version_id:=old.version_id; replayed:=true; return next; return; end if;
  if not exists(select 1 from neuvetra.company_setup_heads h join neuvetra.company_setup_locations l on l.company_id=h.company_id and l.version_id=h.version_id where h.company_id=target_company and h.version_id=(a->>'setupVersionId')::uuid and l.id=(a->>'locationId')::uuid) then raise exception 'current company setup location required; reload setup' using errcode='23503'; end if;
  select * into rec from neuvetra.collection_activity_records where id=target_record and company_id=target_company;
  if not found then
    if request->>'expectedRevision'<>'0' or request->'expectedVersionId'<>'null'::jsonb or request->'correctionReason'<>'null'::jsonb then raise exception 'invalid first collection version' using errcode='22023'; end if;
    -- 0030 (changed expression): scope 3 for every Scope 3 kind of 0029 and 0030.
    insert into neuvetra.collection_activity_records(id,company_id,scope,kind,created_by) values(target_record,target_company,case when a->>'kind'='electricity' then 2 when a->>'kind' in('transport','waste','business_travel','employee_commuting','purchase_spend','purchase_supplier','energy_resold','commuting_average','teleworking','asset_energy','partner_reported','building_average','sold_fuel','sold_energy_product','sold_ghg_product','end_of_life_split','investment') then 3 else 1 end,a->>'kind',actor);
  elsif rec.kind<>a->>'kind' then raise exception 'collection record kind cannot change' using errcode='22023'; end if;
  select * into head from neuvetra.collection_activity_heads where record_id=target_record and company_id=target_company for update;
  if (request->>'expectedRevision')::integer<>coalesce(head.revision,0) or request->'expectedVersionId' is distinct from coalesce(to_jsonb(head.version_id::text),'null'::jsonb) then raise exception 'collection changed; reload before saving' using errcode='23505'; end if;
  next_revision:=coalesce(head.revision,0)+1;
  if next_revision=1 and a->>'state'='withdrawn' then raise exception 'save record before withdrawing it' using errcode='22023'; end if;
  if (next_revision=1 and request->'correctionReason'<>'null'::jsonb) or (next_revision>1 and coalesce(length(btrim(request->>'correctionReason')),0)<3) then raise exception 'collection correction reason required' using errcode='22023'; end if;
  for evidence in select value from jsonb_array_elements_text(a->'evidenceIds') loop if not exists(select 1 from neuvetra.collection_evidence_objects where company_id=target_company and id=evidence::uuid) then raise exception 'collection evidence unavailable' using errcode='23503'; end if; if exists(select 1 from neuvetra.collection_evidence_quarantine_events where company_id=target_company and evidence_id=evidence::uuid and status='rejected') then raise exception 'rejected evidence cannot be linked' using errcode='22023'; end if; end loop;
  -- 0030 (changed expressions): the electricity ZIP and utility columns are filled for electricity only. Several 0030 kinds
  -- carry a zip and utilityEiaId in their payload, and 0027's version check allows those columns on electricity alone.
  insert into neuvetra.collection_activity_versions(id,record_id,company_id,revision,previous_version_id,correction_reason,setup_version_id,location_id,source_id,state,withdrawal_reason,original_quantity,original_unit,normalized_quantity,normalized_unit,quality,estimate_basis,period_start,period_end_exclusive,reference,notes,inside_boundary,maintains_refrigerant_stock,retrofit_in_period,electricity_zip,utility_eia_id,payload,payload_sha256,created_by)
  values(new_version,target_record,target_company,next_revision,head.version_id,request->>'correctionReason',(a->>'setupVersionId')::uuid,(a->>'locationId')::uuid,a->>'sourceId',a->>'state',a->>'withdrawalReason',a#>>'{quantity,originalValue}',a#>>'{quantity,originalUnit}',(a#>>'{quantity,normalizedValue}')::numeric,a#>>'{quantity,normalizedUnit}',a->>'quality',a->>'estimateBasis',(a#>>'{period,start}')::date,(a#>>'{period,endExclusive}')::date,a->>'reference',a->>'notes',(a#>>'{payload,insideBoundary}')::boolean,(a#>>'{payload,maintainsRefrigerantStock}')::boolean,(a#>>'{payload,retrofitInPeriod}')::boolean,case when a->>'kind'='electricity' then a#>>'{payload,zip}' end,case when a->>'kind'='electricity' then a#>>'{payload,utilityEiaId}' end,a,neuvetra.m67_hash(a),actor);
  insert into neuvetra.collection_activity_evidence_links(company_id,version_id,evidence_id) select target_company,new_version,value::uuid from jsonb_array_elements_text(a->'evidenceIds');
  if a->>'kind'='electricity' then
    for instrument,n in select value,ordinality from jsonb_array_elements(a#>'{payload,instruments}') with ordinality loop
      insert into neuvetra.collection_electricity_instruments(company_id,version_id,ordinal,instrument_type,mwh,quality_criteria_met,vintage_year,evidence_id,generation_technology,rate_co2_lb_per_mwh,rate_ch4_lb_per_mwh,rate_n2o_lb_per_mwh)
      values(target_company,new_version,n,instrument->>'type',case when instrument->>'mwh' ~ '^(0|[1-9][0-9]{0,11})(\.[0-9]{1,3})?$' then (instrument->>'mwh')::numeric end,(instrument->>'qualityCriteriaMet')::boolean,(instrument->>'vintageYear')::integer,(instrument->>'evidenceReference')::uuid,instrument->>'generationTechnology',case when instrument#>>'{rateLbPerMwh,co2}' ~ '^(0|[1-9][0-9]{0,11})(\.[0-9]{1,3})?$' then (instrument#>>'{rateLbPerMwh,co2}')::numeric end,case when instrument#>>'{rateLbPerMwh,ch4}' ~ '^(0|[1-9][0-9]{0,11})(\.[0-9]{1,3})?$' then (instrument#>>'{rateLbPerMwh,ch4}')::numeric end,case when instrument#>>'{rateLbPerMwh,n2o}' ~ '^(0|[1-9][0-9]{0,11})(\.[0-9]{1,3})?$' then (instrument#>>'{rateLbPerMwh,n2o}')::numeric end);
    end loop;
  end if;
  insert into neuvetra.collection_activity_heads values(target_record,target_company,new_version,next_revision) on conflict(record_id,company_id) do update set version_id=excluded.version_id,revision=excluded.revision;
  insert into neuvetra.collection_activity_requests values(target_company,(request->>'idempotencyKey')::uuid,actor,fingerprint,target_record,new_version);
  -- 0030 (round 3, owner decision 7): a save that adds a Scope 3 line (a new active Scope 3 record, or a withdrawn one made
  -- active again) must keep the company within MAX_SCOPE3_LINES (3,000 active lines, derived category 3 lines included),
  -- else 54N30 and nothing is saved. The lines import_scope3_spend saves are checked once for the whole file by the import
  -- (it names its import in a transaction-local setting). Scope 1 and 2 saves are never refused for the Scope 3 cap.
  if a->>'state'='active' and a->>'kind' in('transport','waste','business_travel','employee_commuting','purchase_spend','purchase_supplier','energy_resold','commuting_average','teleworking','asset_energy','partner_reported','building_average','sold_fuel','sold_energy_product','sold_ghg_product','end_of_life_split','investment') and (next_revision=1 or exists(select 1 from neuvetra.collection_activity_versions pv where pv.company_id=target_company and pv.id=head.version_id and pv.state='withdrawn'))
    and (a#>>'{payload,importId}' is null or a#>>'{payload,importId}' is distinct from current_setting('neuvetra.scope3_import_id',true))
    and neuvetra.scope3_active_line_count(target_company)>3000 then raise exception 'Scope 3 line budget exceeded' using errcode='54N30'; end if;
  record_id:=target_record; version_id:=new_version; replayed:=false; return next;
end $$;

-- 4. CREATE OR REPLACE keeps each function's owner and privileges. Prove it, as 0029 did: the runtime may call only the
-- save function, and neither function is open to public or authenticated.
do $grants$
begin
  if not has_function_privilege('neuvetra_runtime','neuvetra.save_collection_activity(uuid,uuid,jsonb)','execute')
    or has_function_privilege('authenticated','neuvetra.save_collection_activity(uuid,uuid,jsonb)','execute')
    or has_function_privilege('neuvetra_runtime','neuvetra.collection_assert_activity(jsonb)','execute')
    or has_function_privilege('authenticated','neuvetra.collection_assert_activity(jsonb)','execute')
    or exists(select 1 from pg_proc p, aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
      where p.oid in('neuvetra.save_collection_activity(uuid,uuid,jsonb)'::regprocedure,'neuvetra.collection_assert_activity(jsonb)'::regprocedure) and acl.grantee=0 and acl.privilege_type='EXECUTE')
  then raise exception '0030 changed the collection function privileges' using errcode='42501'; end if;
end $grants$;

-- 5-7 share one immutability rule: rows are inserted by the security-definer functions below and never updated, deleted
-- or truncated, even by the operator (the report bytes an approver saw must never change; DESIGN A16).
create function neuvetra.scope3_reject_history_mutation() returns trigger language plpgsql set search_path=pg_catalog,neuvetra,pg_temp as $$ begin
  raise exception 'Scope 3 history is immutable' using errcode='55000';
end $$;
revoke all on function neuvetra.scope3_reject_history_mutation() from public,authenticated,neuvetra_runtime;
-- Every new RPC holds the actor's staging-access and owner/admin membership rows until commit, as company setup does
-- (0023, BF1), so a revocation or downgrade cannot commit while the write is in flight.
create function neuvetra.scope3_manager_lock(target_company uuid,what text) returns uuid language plpgsql security definer set search_path=pg_catalog,neuvetra,pg_temp as $$
declare actor uuid:=auth.uid(); begin
  if actor is null or not neuvetra.has_staging_access() or not neuvetra.can_manage_company(target_company) then raise exception '% unavailable',what using errcode='42501'; end if;
  perform 1 from neuvetra.staging_access where user_id=actor and company_id=target_company and active for share;
  if not found then raise exception '% unavailable',what using errcode='42501'; end if;
  perform 1 from neuvetra.company_members where user_id=actor and company_id=target_company and role in('owner','admin') for share;
  if not found then raise exception '% unavailable',what using errcode='42501'; end if;
  return actor;
end $$;
revoke all on function neuvetra.scope3_manager_lock(uuid,text) from public,authenticated,neuvetra_runtime;
-- Linked evidence must be the company's own and never rejected by quarantine review (as for collection records).
create function neuvetra.scope3_assert_evidence(target_company uuid,ids jsonb) returns void language plpgsql stable security definer set search_path=pg_catalog,neuvetra,pg_temp as $$
declare evidence text; begin
  for evidence in select value from jsonb_array_elements_text(ids) loop
    if not exists(select 1 from neuvetra.collection_evidence_objects where company_id=target_company and id=evidence::uuid) then raise exception 'Scope 3 evidence unavailable' using errcode='23503'; end if;
    if exists(select 1 from neuvetra.collection_evidence_quarantine_events where company_id=target_company and evidence_id=evidence::uuid and status='rejected') then raise exception 'rejected evidence cannot be linked' using errcode='22023'; end if;
  end loop;
end $$;
revoke all on function neuvetra.scope3_assert_evidence(uuid,jsonb) from public,authenticated,neuvetra_runtime;
-- A list of distinct lowercase UUID strings, at most `max` long.
create function neuvetra.scope3_assert_uuid_list(v jsonb,max integer,what text) returns void language plpgsql immutable set search_path=pg_catalog,neuvetra,pg_temp as $$ begin
  if jsonb_typeof(v) is distinct from 'array' then raise exception 'invalid Scope 3 %',what using errcode='22023'; end if;
  if jsonb_array_length(v)>max or exists(select 1 from jsonb_array_elements(v) e where jsonb_typeof(e)<>'string' or e#>>'{}' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
    or (select count(*) from jsonb_array_elements_text(v))<>(select count(distinct e) from jsonb_array_elements_text(v) e) then raise exception 'invalid Scope 3 %',what using errcode='22023'; end if;
end $$;
revoke all on function neuvetra.scope3_assert_uuid_list(jsonb,integer,text) from public,authenticated,neuvetra_runtime;

-- 5. Category assessments: the structured screening record behind each setup decision (DESIGN §3.5, A9, D5). The decision
-- itself stays in company setup (0023); this is a versioned, insert-only record per company, reporting year and category
-- (I-02b, AM-03: screening is per inventory year). It may document allow-listed within-category exclusions (AM-17, A26).
create table neuvetra.scope3_category_assessments (
  id uuid primary key,
  company_id uuid not null references neuvetra.companies(id),
  reporting_year integer not null check(reporting_year between 2012 and 2035),
  category integer not null check(category between 1 and 15),
  revision integer not null check(revision between 1 and 1000),
  previous_id uuid,
  setup_version_id uuid not null,
  reason_code text check(reason_code in('no_leased_assets','leases_in_scope1_2_by_boundary','lessor_assets_in_scope1_2','no_sold_physical_products','no_intermediate_products_sold','no_energy_or_ghg_use_phase','not_franchisor','no_required_investment_types','no_transport_or_distribution','other','immaterial_estimated','data_unavailable','intermediate_unknown_end_use')),
  criteria jsonb not null check(jsonb_typeof(criteria)='object'),
  activities_included text not null check(length(activities_included)<=2000),
  justification text not null check(length(justification)<=4000),
  magnitude_kind text check(magnitude_kind in('estimated','not_quantifiable')),
  magnitude_t_co2e text check(magnitude_t_co2e ~ '^(0|[1-9][0-9]{0,11})(\.[0-9]{1,3})?$'),
  magnitude_basis text not null check(length(magnitude_basis)<=1000),
  not_quantifiable_reason text not null check(length(not_quantifiable_reason)<=1000),
  planned_method_types text[] not null check(cardinality(planned_method_types)<=5 and planned_method_types <@ array['activity_average_data','spend_based','supplier_specific','partner_reported','proxy']),
  energy_resale text check(energy_resale in('none','resells_energy')),
  evidence_ids uuid[] not null check(cardinality(evidence_ids)<=20),
  within_category_exclusions jsonb not null check(jsonb_typeof(within_category_exclusions)='array' and jsonb_array_length(within_category_exclusions)<=20),
  correction_reason text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default clock_timestamp(),
  unique(id,company_id), unique(id,company_id,reporting_year), unique(company_id,reporting_year,category,revision),
  foreign key(previous_id,company_id,reporting_year) references neuvetra.scope3_category_assessments(id,company_id,reporting_year),
  foreign key(setup_version_id,company_id) references neuvetra.company_setup_versions(id,company_id),
  check((revision=1 and previous_id is null and correction_reason is null) or (revision>1 and previous_id is not null and length(btrim(correction_reason)) between 3 and 2000)),
  check(energy_resale is null or category=3),
  check((magnitude_kind is not distinct from 'estimated')=(magnitude_t_co2e is not null)),
  check(magnitude_kind is not distinct from 'estimated' or magnitude_basis=''),
  check(case when magnitude_kind is not distinct from 'not_quantifiable' then length(btrim(not_quantifiable_reason))>=3 else not_quantifiable_reason='' end)
);
create table neuvetra.scope3_assessment_requests (
  company_id uuid not null references neuvetra.companies(id),
  idempotency_key uuid not null,
  actor_id uuid not null references auth.users(id),
  request_sha256 text not null check(request_sha256 ~ '^[0-9a-f]{64}$'),
  assessment_id uuid not null,
  primary key(company_id,idempotency_key),
  foreign key(assessment_id,company_id) references neuvetra.scope3_category_assessments(id,company_id)
);
-- The latest revision per company, reporting year and category. security_invoker: the base table's company read policy
-- applies to the caller (DESIGN B2; the final privilege block proves the option is set).
create view neuvetra.scope3_category_assessment_heads with (security_invoker=true) as
  select distinct on (a.company_id,a.reporting_year,a.category) a.* from neuvetra.scope3_category_assessments a order by a.company_id,a.reporting_year,a.category,a.revision desc;

-- The assessment contract (scope3-assessment-contract.ts validateScope3Assessment).
create function neuvetra.scope3_assert_assessment(a jsonb) returns void language plpgsql immutable set search_path=pg_catalog,neuvetra,pg_temp as $$
declare k text; x jsonb; begin
  perform neuvetra.m71_keys(a,'category,reportingYear,setupVersionId,reasonCode,criteria,activitiesIncluded,justification,magnitudeKind,magnitudeTCo2e,magnitudeBasis,notQuantifiableReason,plannedMethodTypes,energyResale,evidenceIds,withinCategoryExclusions');
  perform neuvetra.scope3_assert_int(a->'category',1,15,false,'assessment category');
  perform neuvetra.scope3_assert_int(a->'reportingYear',2012,2035,false,'reporting year');
  perform neuvetra.scope3_assert_match(a->'setupVersionId','^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',false,'setup version');
  perform neuvetra.scope3_assert_enum(a->'reasonCode',array['no_leased_assets','leases_in_scope1_2_by_boundary','lessor_assets_in_scope1_2','no_sold_physical_products','no_intermediate_products_sold','no_energy_or_ghg_use_phase','not_franchisor','no_required_investment_types','no_transport_or_distribution','other','immaterial_estimated','data_unavailable','intermediate_unknown_end_use'],true,'reason code');
  -- Scope 3 Standard Table 6.1 relevance criteria.
  perform neuvetra.m71_keys(a->'criteria','size,influence,risk,stakeholders,outsourcing,sectorGuidance,other,otherText');
  foreach k in array array['size','influence','risk','stakeholders','outsourcing','sectorGuidance','other'] loop perform neuvetra.scope3_assert_bool(a->'criteria'->k,false,'relevance criterion'); end loop;
  perform neuvetra.scope3_assert_text(a#>'{criteria,otherText}',0,300,false,'other criterion');
  if a#>>'{criteria,other}'='false' and a#>>'{criteria,otherText}'<>'' then raise exception 'invalid Scope 3 other criterion' using errcode='22023'; end if;
  perform neuvetra.scope3_assert_text(a->'activitiesIncluded',0,2000,false,'activities included');
  perform neuvetra.scope3_assert_text(a->'justification',0,4000,false,'justification');
  perform neuvetra.scope3_assert_enum(a->'magnitudeKind',array['estimated','not_quantifiable'],true,'magnitude kind');
  perform neuvetra.scope3_assert_dec(a->'magnitudeTCo2e',3,true,'estimated magnitude');
  if (a->>'magnitudeKind' is not distinct from 'estimated')<>(a->'magnitudeTCo2e'<>'null'::jsonb) then raise exception 'invalid Scope 3 estimated magnitude' using errcode='22023'; end if;
  perform neuvetra.scope3_assert_text(a->'magnitudeBasis',0,1000,false,'magnitude basis');
  if a->>'magnitudeKind' is distinct from 'estimated' and a->>'magnitudeBasis'<>'' then raise exception 'invalid Scope 3 magnitude basis' using errcode='22023'; end if;
  if a->>'magnitudeKind' is not distinct from 'not_quantifiable' then perform neuvetra.scope3_assert_text(a->'notQuantifiableReason',3,1000,false,'not-quantifiable reason');
  else perform neuvetra.scope3_assert_text(a->'notQuantifiableReason',0,0,false,'not-quantifiable reason'); end if;
  if jsonb_typeof(a->'plannedMethodTypes') is distinct from 'array' then raise exception 'invalid Scope 3 planned method types' using errcode='22023'; end if;
  if jsonb_array_length(a->'plannedMethodTypes')>5 or exists(select 1 from jsonb_array_elements(a->'plannedMethodTypes') e where jsonb_typeof(e)<>'string' or not (e#>>'{}'=any(array['activity_average_data','spend_based','supplier_specific','partner_reported','proxy'])))
    or (select count(*) from jsonb_array_elements_text(a->'plannedMethodTypes'))<>(select count(distinct e) from jsonb_array_elements_text(a->'plannedMethodTypes') e) then raise exception 'invalid Scope 3 planned method types' using errcode='22023'; end if;
  perform neuvetra.scope3_assert_enum(a->'energyResale',array['none','resells_energy'],true,'energy resale');
  if a->'energyResale'<>'null'::jsonb and a->>'category'<>'3' then raise exception 'invalid Scope 3 energy resale' using errcode='22023'; end if;
  perform neuvetra.scope3_assert_uuid_list(a->'evidenceIds',20,'evidence list');
  -- I-02b (AM-17, A26): within-category exclusions, only of the allow-listed partial-boundary notes (SCOPE3_EXCLUDABLE_NOTES),
  -- one per note, each with a justification and an estimated magnitude or "not quantifiable".
  if jsonb_typeof(a->'withinCategoryExclusions') is distinct from 'array' then raise exception 'invalid Scope 3 within-category exclusions' using errcode='22023'; end if;
  if jsonb_array_length(a->'withinCategoryExclusions')>20 then raise exception 'invalid Scope 3 within-category exclusions' using errcode='22023'; end if;
  for x in select value from jsonb_array_elements(a->'withinCategoryExclusions') loop
    perform neuvetra.m71_keys(x,'noteCode,justification,magnitudeKind,magnitudeTCo2e,basis');
    perform neuvetra.scope3_assert_enum(x->'noteCode',array['nuclear_biomass_byproduct_fuels_upstream_excluded','third_party_facilities_not_included'],false,'within-category exclusion note');
    perform neuvetra.scope3_assert_text(x->'justification',3,1000,false,'within-category exclusion justification');
    perform neuvetra.scope3_assert_enum(x->'magnitudeKind',array['estimated','not_quantifiable'],false,'within-category exclusion magnitude kind');
    perform neuvetra.scope3_assert_dec(x->'magnitudeTCo2e',3,true,'within-category exclusion magnitude');
    if (x->>'magnitudeKind'='estimated')<>(x->'magnitudeTCo2e'<>'null'::jsonb) then raise exception 'invalid Scope 3 within-category exclusion magnitude' using errcode='22023'; end if;
    perform neuvetra.scope3_assert_text(x->'basis',0,1000,false,'within-category exclusion basis');
  end loop;
  if (select count(*) from jsonb_array_elements(a->'withinCategoryExclusions'))<>(select count(distinct e->>'noteCode') from jsonb_array_elements(a->'withinCategoryExclusions') e) then raise exception 'invalid Scope 3 within-category exclusions' using errcode='22023'; end if;
end $$;
revoke all on function neuvetra.scope3_assert_assessment(jsonb) from public,authenticated,neuvetra_runtime;

-- The same optimistic-revision and idempotency pattern as save_collection_activity. I-02b (AM-03): the expected revision,
-- the previous revision and the heads are per reporting year, which must be the year of the setup version's period.
create function neuvetra.save_scope3_category_assessment(target_company uuid,request jsonb)
returns table(assessment_id uuid,revision integer,replayed boolean) language plpgsql security definer set search_path=pg_catalog,neuvetra,pg_temp as $$
#variable_conflict use_column
declare actor uuid; a jsonb; old neuvetra.scope3_assessment_requests%rowtype; head neuvetra.scope3_category_assessments%rowtype; fingerprint text; new_id uuid:=gen_random_uuid(); next_revision integer; begin
  actor:=neuvetra.scope3_manager_lock(target_company,'Scope 3 assessment');
  perform neuvetra.m71_keys(request,'idempotencyKey,expectedRevision,correctionReason,assessment');
  if coalesce(request->>'idempotencyKey','')!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or jsonb_typeof(request->'expectedRevision') is distinct from 'number' or coalesce(request->>'expectedRevision','')!~'^[0-9]{1,4}$' or jsonb_typeof(request->'correctionReason') not in('string','null') or octet_length(request::text)>150000 then raise exception 'invalid Scope 3 assessment request' using errcode='22023'; end if;
  perform neuvetra.scope3_assert_text(request->'correctionReason',0,2000,true,'correction reason');
  a:=request->'assessment'; perform neuvetra.scope3_assert_assessment(a);
  fingerprint:=neuvetra.m67_hash(jsonb_build_object('operation','save_scope3_category_assessment','companyId',target_company,'actorId',actor,'request',request-'idempotencyKey'));
  perform id from neuvetra.companies where id=target_company for update;
  select * into old from neuvetra.scope3_assessment_requests where company_id=target_company and idempotency_key=(request->>'idempotencyKey')::uuid;
  if found then
    if old.actor_id<>actor or old.request_sha256<>fingerprint then raise exception 'Scope 3 assessment idempotency conflict' using errcode='23505'; end if;
    select x.revision into next_revision from neuvetra.scope3_category_assessments x where x.id=old.assessment_id and x.company_id=target_company;
    assessment_id:=old.assessment_id; revision:=next_revision; replayed:=true; return next; return;
  end if;
  if not exists(select 1 from neuvetra.company_setup_heads h where h.company_id=target_company and h.version_id=(a->>'setupVersionId')::uuid) then raise exception 'current company setup required; reload setup' using errcode='23503'; end if;
  perform neuvetra.scope3_assert_reporting_year(target_company,(a->>'setupVersionId')::uuid,a->'reportingYear');
  select * into head from neuvetra.scope3_category_assessments x where x.company_id=target_company and x.reporting_year=(a->>'reportingYear')::integer and x.category=(a->>'category')::integer order by x.revision desc limit 1;
  if (request->>'expectedRevision')::integer<>coalesce(head.revision,0) then raise exception 'Scope 3 assessment changed; reload before saving' using errcode='23505'; end if;
  next_revision:=coalesce(head.revision,0)+1;
  if next_revision>1000 then raise exception 'Scope 3 assessment history capacity reached' using errcode='54000'; end if;
  if (next_revision=1 and request->'correctionReason'<>'null'::jsonb) or (next_revision>1 and coalesce(length(btrim(request->>'correctionReason')),0)<3) then raise exception 'Scope 3 assessment correction reason required' using errcode='22023'; end if;
  perform neuvetra.scope3_assert_evidence(target_company,a->'evidenceIds');
  insert into neuvetra.scope3_category_assessments(id,company_id,reporting_year,category,revision,previous_id,setup_version_id,reason_code,criteria,activities_included,justification,magnitude_kind,magnitude_t_co2e,magnitude_basis,not_quantifiable_reason,planned_method_types,energy_resale,evidence_ids,within_category_exclusions,correction_reason,created_by)
  values(new_id,target_company,(a->>'reportingYear')::integer,(a->>'category')::integer,next_revision,head.id,(a->>'setupVersionId')::uuid,a->>'reasonCode',a->'criteria',a->>'activitiesIncluded',a->>'justification',a->>'magnitudeKind',a->>'magnitudeTCo2e',a->>'magnitudeBasis',a->>'notQuantifiableReason',
    array(select jsonb_array_elements_text(a->'plannedMethodTypes')),a->>'energyResale',array(select e::uuid from jsonb_array_elements_text(a->'evidenceIds') e),a->'withinCategoryExclusions',request->>'correctionReason',actor);
  insert into neuvetra.scope3_assessment_requests values(target_company,(request->>'idempotencyKey')::uuid,actor,fingerprint,new_id);
  assessment_id:=new_id; revision:=next_revision; replayed:=false; return next;
end $$;
revoke all on function neuvetra.save_scope3_category_assessment(uuid,jsonb) from public,authenticated,neuvetra_runtime;
grant execute on function neuvetra.save_scope3_category_assessment(uuid,jsonb) to neuvetra_runtime;

-- 6. Spend import (DESIGN §3.6, D9): one row per imported file (the file is collection evidence with the same SHA-256),
-- and versioned NAICS mappings remembered per company (mapping key = SHA-256 of the normalized GL account, vendor and
-- description, computed by the shared parser).
create table neuvetra.scope3_spend_imports (
  id uuid primary key,
  company_id uuid not null references neuvetra.companies(id),
  reporting_year integer not null check(reporting_year between 2012 and 2035),
  file_sha256 text not null check(file_sha256 ~ '^[0-9a-f]{64}$'),
  file_name text not null check(length(btrim(file_name)) between 1 and 255),
  evidence_id uuid not null,
  location_id uuid not null,
  setup_version_id uuid not null,
  row_count integer not null check(row_count between 1 and 2000),
  file_totals jsonb not null check(jsonb_typeof(file_totals)='object'),
  non_numeric_rows integer not null check(non_numeric_rows between 0 and row_count),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default clock_timestamp(),
  unique(id,company_id), unique(company_id,file_sha256),
  foreign key(evidence_id,company_id) references neuvetra.collection_evidence_objects(id,company_id),
  foreign key(setup_version_id,company_id,location_id) references neuvetra.company_setup_locations(version_id,company_id,id)
);
create table neuvetra.scope3_spend_mapping_versions (
  id uuid primary key,
  company_id uuid not null references neuvetra.companies(id),
  mapping_key_sha256 text not null check(mapping_key_sha256 ~ '^[0-9a-f]{64}$'),
  gl_account text not null check(length(gl_account)<=120),
  vendor text not null check(length(vendor)<=200),
  description text not null check(length(description)<=200),
  category integer not null check(category in(1,2,3,4,5,6)),
  naics_code text not null check(naics_code ~ '^[0-9]{6}$'),
  margin_choice text not null check(margin_choice in('with_margins','without_margins')),
  revision integer not null check(revision between 1 and 1000),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default clock_timestamp(),
  unique(id,company_id), unique(company_id,mapping_key_sha256,revision),
  -- I-02b (AM-06): a remembered mapping never assigns category 9, and its code is in the category's set.
  check(neuvetra.scope3_spend_naics_allowed(category,naics_code))
);
create view neuvetra.scope3_spend_mapping_heads with (security_invoker=true) as
  select distinct on (m.company_id,m.mapping_key_sha256) m.* from neuvetra.scope3_spend_mapping_versions m order by m.company_id,m.mapping_key_sha256,m.revision desc;
-- I-02b (AM-16, A29): one row per imported line with its fingerprint (SHA-256 of the line ID, date, vendor, amount and
-- currency; scope3SpendLineFingerprintInput), so the same line in two overlapping exports, or twice in one file, is found
-- server-side and held as a possible duplicate instead of being counted twice.
create table neuvetra.scope3_spend_import_lines (
  company_id uuid not null references neuvetra.companies(id),
  import_id uuid not null,
  row_number integer not null check(row_number between 1 and 9999999),
  line_fingerprint text not null check(line_fingerprint ~ '^[0-9a-f]{64}$'),
  record_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key(import_id,row_number),
  foreign key(import_id,company_id) references neuvetra.scope3_spend_imports(id,company_id),
  foreign key(record_id,company_id) references neuvetra.collection_activity_records(id,company_id)
);
create index scope3_spend_import_lines_fingerprint on neuvetra.scope3_spend_import_lines(company_id,line_fingerprint);

-- Round 3 (owner decision 7, EN-3): the active Scope 3 lines of a company, counted as the results route lists them
-- (scope3ResultLines): one per Scope 3 record that is not withdrawn and, when the current setup includes category 3, three
-- per electricity record (3C, 3C upstream, 3B), one per natural gas, No. 2 distillate and vehicle record (3A) and one more
-- per resold-energy record. MAX_SCOPE3_LINES (3,000) is enforced with it inside the import transaction and for record saves
-- that add a Scope 3 line, with SQLSTATE 54N30 (line budget exceeded), which every route answers as line_budget_exceeded.
create function neuvetra.scope3_active_line_count(target_company uuid) returns integer language sql stable security definer set search_path=pg_catalog,neuvetra,pg_temp as $$
  select coalesce(sum(case when r.scope=3 then 1+case when r.kind='energy_resold' and c.yes then 1 else 0 end
    when c.yes and r.kind='electricity' then 3 when c.yes and r.kind in('natural_gas','distillate_no2','vehicle') then 1 else 0 end),0)::integer
  -- Each record's head and head version by their unique keys (LATERAL ... LIMIT 1), never a join the planner can turn into a
  -- per-row scan of the company's versions on statistics that do not know a new company (EN-1's pattern).
  from neuvetra.collection_activity_records r
    cross join lateral (select h.version_id from neuvetra.collection_activity_heads h where h.record_id=r.id and h.company_id=r.company_id limit 1) h
    cross join lateral (select v.state from neuvetra.collection_activity_versions v where v.id=h.version_id and v.company_id=r.company_id limit 1) v,
    (select exists(select 1 from neuvetra.company_setup_heads sh join neuvetra.company_setup_screening s on s.company_id=sh.company_id and s.version_id=sh.version_id
      where sh.company_id=target_company and s.scope=3 and s.category='fuel_and_energy_related_activities' and s.state='yes') yes) c
  where r.company_id=target_company and v.state<>'withdrawn'
$$;
revoke all on function neuvetra.scope3_active_line_count(uuid) from public,authenticated,neuvetra_runtime;

-- Saves every line of one file through save_collection_activity, in one transaction: one bad line saves nothing. The
-- same file again (same SHA-256) for the same reporting year returns the first import and saves nothing; for another year
-- it is refused (23505). The rows must reconcile: per currency, the file total equals the sum of the saved amounts that
-- are plain decimals, and the other rows are counted as non-numeric. I-02b: the reporting year is the setup's (AM-03); no
-- line is category 9 and every NAICS code is in its category's set (AM-04, AM-06); each line's fingerprint is stored and
-- its possibleDuplicateOf must be the earliest earlier occurrence of that fingerprint (AM-16).
create function neuvetra.import_scope3_spend(target_company uuid,request jsonb)
returns table(import_id uuid,replayed boolean,saved integer) language plpgsql security definer set search_path=pg_catalog,neuvetra,pg_temp as $$
#variable_conflict use_column
declare actor uuid; existing neuvetra.scope3_spend_imports%rowtype; r record; x jsonb; n bigint; act jsonb; count_saved integer:=0; was_replayed boolean; numeric_amount text:='^-?(0|[1-9][0-9]{0,11})(\.[0-9]{1,3})?$'; expected jsonb; begin
  actor:=neuvetra.scope3_manager_lock(target_company,'Scope 3 spend import');
  if octet_length(request::text)>8388608 then raise exception 'Scope 3 spend import too large' using errcode='54000'; end if;
  perform neuvetra.m71_keys(request,'importId,fileSha256,fileName,evidenceId,locationId,setupVersionId,reportingYear,rowCount,fileTotals,nonNumericRows,rows');
  perform neuvetra.scope3_assert_int(request->'reportingYear',2012,2035,false,'reporting year');
  perform neuvetra.scope3_assert_match(request->'importId','^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',false,'import ID');
  perform neuvetra.scope3_assert_match(request->'fileSha256','^[0-9a-f]{64}$',false,'file SHA-256');
  perform neuvetra.scope3_assert_text(request->'fileName',1,255,false,'file name');
  perform neuvetra.scope3_assert_match(request->'evidenceId','^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',false,'evidence ID');
  perform neuvetra.scope3_assert_match(request->'locationId','^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',false,'location ID');
  perform neuvetra.scope3_assert_match(request->'setupVersionId','^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',false,'setup version');
  perform neuvetra.scope3_assert_int(request->'rowCount',1,2000,false,'row count');
  perform neuvetra.scope3_assert_int(request->'nonNumericRows',0,(request->>'rowCount')::integer,false,'non-numeric rows');
  if jsonb_typeof(request->'fileTotals') is distinct from 'object' then raise exception 'invalid Scope 3 file totals' using errcode='22023'; end if;
  for r in select key,value from jsonb_each(request->'fileTotals') loop
    if length(r.key) not between 1 and 80 or r.key ~ '[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]' then raise exception 'invalid Scope 3 file totals' using errcode='22023'; end if;
    perform neuvetra.scope3_assert_match(r.value,'^-?(0|[1-9][0-9]{0,15})(\.[0-9]{1,3})?$',false,'file total');
  end loop;
  if jsonb_typeof(request->'rows') is distinct from 'array' then raise exception 'invalid Scope 3 import rows' using errcode='22023'; end if;
  if jsonb_array_length(request->'rows')<>(request->>'rowCount')::integer then raise exception 'invalid Scope 3 import rows' using errcode='22023'; end if;
  -- Every line is a spend line of this import, at its row, at the import's location, against the import's setup version.
  for x,n in select value,ordinality from jsonb_array_elements(request->'rows') with ordinality loop
    perform neuvetra.m71_keys(x,'recordId,request,lineFingerprint');
    perform neuvetra.scope3_assert_match(x->'recordId','^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',false,'record ID');
    perform neuvetra.scope3_assert_match(x->'lineFingerprint','^[0-9a-f]{64}$',false,'line fingerprint');
    act:=x#>'{request,activity}';
    if jsonb_typeof(act) is distinct from 'object' or act->>'kind' is distinct from 'purchase_spend' or act->>'locationId' is distinct from request->>'locationId' or act->>'setupVersionId' is distinct from request->>'setupVersionId'
      or act#>>'{payload,importId}' is distinct from request->>'importId' or act#>>'{payload,importRow}' is distinct from n::text then raise exception 'Scope 3 import row % does not belong to this import',n using errcode='22023'; end if;
    -- Category 9 is never the ledger's (AM-04); a mapped code is in its category's set (AM-06).
    if act#>'{payload,category}'='9'::jsonb then raise exception 'Scope 3 import row % is category 9, which is entered by hand',n using errcode='22023'; end if;
    if jsonb_typeof(act#>'{payload,naicsCode}')='string' and act#>>'{payload,category}' in('3','4','5','6') and not neuvetra.scope3_spend_naics_allowed((act#>>'{payload,category}')::integer,act#>>'{payload,naicsCode}') then
      raise exception 'Scope 3 import row % has a NAICS code outside its category',n using errcode='22023'; end if;
  end loop;
  -- Reconciliation (D9): activity amounts, exact decimal sums.
  if (select count(*) from jsonb_array_elements(request->'rows') e where coalesce(e#>>'{request,activity,quantity,originalValue}','') !~ numeric_amount)<>(request->>'nonNumericRows')::integer
    or exists(select 1 from (select e#>>'{request,activity,quantity,originalUnit}' currency,sum((e#>>'{request,activity,quantity,originalValue}')::numeric) total from jsonb_array_elements(request->'rows') e
        where coalesce(e#>>'{request,activity,quantity,originalValue}','') ~ numeric_amount group by 1) s
      full join jsonb_each_text(request->'fileTotals') f on f.key=s.currency where s.currency is null or f.key is null or s.total<>f.value::numeric)
  then raise exception 'Scope 3 spend import does not reconcile with the file totals' using errcode='22023'; end if;
  perform id from neuvetra.companies where id=target_company for update;
  select * into existing from neuvetra.scope3_spend_imports where company_id=target_company and file_sha256=request->>'fileSha256';
  if found then
    if existing.reporting_year<>(request->>'reportingYear')::integer then raise exception 'Scope 3 spend file already imported for reporting year %',existing.reporting_year using errcode='23505'; end if;
    import_id:=existing.id; replayed:=true; saved:=0; return next; return;
  end if;
  perform neuvetra.scope3_assert_reporting_year(target_company,(request->>'setupVersionId')::uuid,request->'reportingYear');
  -- The uploaded file is the import's evidence: the company's own, the same bytes, and not rejected.
  if not exists(select 1 from neuvetra.collection_evidence_objects where company_id=target_company and id=(request->>'evidenceId')::uuid and sha256=request->>'fileSha256') then raise exception 'Scope 3 spend import evidence unavailable' using errcode='23503'; end if;
  perform neuvetra.scope3_assert_evidence(target_company,jsonb_build_array(request->'evidenceId'));
  insert into neuvetra.scope3_spend_imports(id,company_id,reporting_year,file_sha256,file_name,evidence_id,location_id,setup_version_id,row_count,file_totals,non_numeric_rows,created_by)
  values((request->>'importId')::uuid,target_company,(request->>'reportingYear')::integer,request->>'fileSha256',request->>'fileName',(request->>'evidenceId')::uuid,(request->>'locationId')::uuid,(request->>'setupVersionId')::uuid,(request->>'rowCount')::integer,request->'fileTotals',(request->>'nonNumericRows')::integer,actor);
  -- Round 3 (owner decision 7): save_collection_activity leaves the line budget of this import's own lines to the check below
  -- (once for the whole file, not once per line); the transaction-local setting names the import.
  perform set_config('neuvetra.scope3_import_id',request->>'importId',true);
  for x,n in select value,ordinality from jsonb_array_elements(request->'rows') with ordinality loop
    -- The earliest earlier occurrence of this line's fingerprint: a line of an earlier import of the company (by import
    -- time, import ID and row), else an earlier row of this file (already inserted below), else none.
    select jsonb_build_object('importId',l.import_id::text,'row',l.row_number) into expected from neuvetra.scope3_spend_import_lines l join neuvetra.scope3_spend_imports i on i.id=l.import_id and i.company_id=l.company_id
      where l.company_id=target_company and l.line_fingerprint=x->>'lineFingerprint' order by (l.import_id=(request->>'importId')::uuid),i.created_at,l.import_id,l.row_number limit 1;
    if not found then expected:='null'::jsonb; end if;
    -- Round 2 (ENG-10): 40001, so the caller retries on the SQLSTATE (another import committed between its read and this call), never on the message.
    if coalesce(x#>'{request,activity,payload,possibleDuplicateOf}','null'::jsonb) is distinct from expected then raise exception 'Scope 3 import row % has the wrong possible duplicate',n using errcode='40001'; end if;
    select s.replayed into was_replayed from neuvetra.save_collection_activity(target_company,(x->>'recordId')::uuid,x->'request') s;
    if not was_replayed then count_saved:=count_saved+1; end if;
    insert into neuvetra.scope3_spend_import_lines(company_id,import_id,row_number,line_fingerprint,record_id) values(target_company,(request->>'importId')::uuid,n::integer,x->>'lineFingerprint',(x->>'recordId')::uuid);
  end loop;
  perform set_config('neuvetra.scope3_import_id','',true);
  -- Round 3 (owner decision 7, EN-3): the line cap, under the company lock, for the whole file: two imports that each fit
  -- the budget the API read can no longer both commit past it.
  if neuvetra.scope3_active_line_count(target_company)>3000 then raise exception 'Scope 3 line budget exceeded' using errcode='54N30'; end if;
  import_id:=(request->>'importId')::uuid; replayed:=false; saved:=count_saved; return next;
end $$;
revoke all on function neuvetra.import_scope3_spend(uuid,jsonb) from public,authenticated,neuvetra_runtime;
grant execute on function neuvetra.import_scope3_spend(uuid,jsonb) to neuvetra_runtime;

-- Round 3 (owner decision 7; lane C's bulk actions): the one set-based writer of corrected Scope 3 spend versions, shared by
-- the mapping save, "withdraw this import" and the bulk line corrections. `todo` lists {recordId, versionId, revision,
-- activity}: each line's head version as read (already locked and checked by the caller under the company lock) and its
-- next activity. It applies the rules save_collection_activity applies to a correction (the activity contract, the current
-- setup version and location, no rejected evidence), then writes every version, evidence link, head and request receipt in
-- one statement and returns how many versions it wrote. Not callable by the runtime (only through the RPCs below).
create function neuvetra.scope3_write_spend_versions(target_company uuid,actor uuid,todo jsonb,reason text) returns integer language plpgsql security definer set search_path=pg_catalog,neuvetra,pg_temp as $$
#variable_conflict use_column
declare item jsonb; n integer; begin
  -- The rules save_collection_activity applies to a correction: the activity contract, the current setup version and
  -- location, and no rejected evidence.
  for item in select value from jsonb_array_elements(todo) loop perform neuvetra.collection_assert_activity(item->'activity'); end loop;
  if exists(select 1 from jsonb_array_elements(todo) t where not exists(select 1 from neuvetra.company_setup_heads h join neuvetra.company_setup_locations l on l.company_id=h.company_id and l.version_id=h.version_id
    where h.company_id=target_company and h.version_id=(t#>>'{activity,setupVersionId}')::uuid and l.id=(t#>>'{activity,locationId}')::uuid)) then raise exception 'current company setup location required; reload setup' using errcode='23503'; end if;
  if exists(select 1 from jsonb_array_elements(todo) t, jsonb_array_elements_text(t#>'{activity,evidenceIds}') ev join neuvetra.collection_evidence_quarantine_events q on q.company_id=target_company and q.evidence_id=ev::uuid and q.status='rejected') then
    raise exception 'rejected evidence cannot be linked' using errcode='22023'; end if;
  -- One statement: every corrected version, its evidence links, the heads and the request receipts (as save_collection_activity writes them).
  with t as materialized (
    select (x->>'recordId')::uuid record_id,(x->>'versionId')::uuid old_version,(x->>'revision')::integer old_revision,neuvetra.collection_derive_quantity(x->'activity') a,gen_random_uuid() new_version,gen_random_uuid() idem
    from jsonb_array_elements(todo) x
  ), versions as (
    insert into neuvetra.collection_activity_versions(id,record_id,company_id,revision,previous_version_id,correction_reason,setup_version_id,location_id,source_id,state,withdrawal_reason,original_quantity,original_unit,normalized_quantity,normalized_unit,quality,estimate_basis,period_start,period_end_exclusive,reference,notes,inside_boundary,maintains_refrigerant_stock,retrofit_in_period,electricity_zip,utility_eia_id,payload,payload_sha256,created_by)
    select t.new_version,t.record_id,target_company,t.old_revision+1,t.old_version,reason,(a->>'setupVersionId')::uuid,(a->>'locationId')::uuid,a->>'sourceId',a->>'state',a->>'withdrawalReason',a#>>'{quantity,originalValue}',a#>>'{quantity,originalUnit}',(a#>>'{quantity,normalizedValue}')::numeric,a#>>'{quantity,normalizedUnit}',
      a->>'quality',a->>'estimateBasis',(a#>>'{period,start}')::date,(a#>>'{period,endExclusive}')::date,a->>'reference',a->>'notes',(a#>>'{payload,insideBoundary}')::boolean,(a#>>'{payload,maintainsRefrigerantStock}')::boolean,(a#>>'{payload,retrofitInPeriod}')::boolean,null,null,a,neuvetra.m67_hash(a),actor
    from t returning id,record_id,revision,payload
  ), links as (
    insert into neuvetra.collection_activity_evidence_links(company_id,version_id,evidence_id) select target_company,v.id,ev::uuid from versions v, jsonb_array_elements_text(v.payload->'evidenceIds') ev
  ), heads as (
    insert into neuvetra.collection_activity_heads select v.record_id,target_company,v.id,v.revision from versions v on conflict(record_id,company_id) do update set version_id=excluded.version_id,revision=excluded.revision
  ), receipts as (
    insert into neuvetra.collection_activity_requests select target_company,t.idem,actor,neuvetra.m67_hash(jsonb_build_object('operation','save_collection_activity','companyId',target_company,'recordId',t.record_id,'actorId',actor,
      'request',jsonb_build_object('expectedRevision',t.old_revision,'expectedVersionId',t.old_version::text,'correctionReason',reason,'activity',t.a))),t.record_id,t.new_version from t
  )
  select count(*) into n from versions;
  return n;
end $$;
revoke all on function neuvetra.scope3_write_spend_versions(uuid,uuid,jsonb,text) from public,authenticated,neuvetra_runtime;

-- Round 2 (ENG-9): the mapping and its group correction in one call, under one company lock. `corrections` lists the
-- group's imported lines (the shared parser computes the mapping key, which SQL does not repeat) with the head version
-- each was read at. Every listed line whose mapping differs gets one new version (the same activity with the payload's
-- category, NAICS code, margin choice and mappingSource 'user', plus the optional attestations), and all of those versions,
-- their evidence links, heads and request receipts are written by one set-based statement. A listed line that changed
-- since it was read refuses the whole save (23505); one that is not an active imported spend line whose mapping the file
-- did not state is refused (22023); nothing is saved then.
create function neuvetra.save_scope3_spend_mapping(target_company uuid,request jsonb)
returns table(mapping_id uuid,revision integer,corrected integer,unchanged integer) language plpgsql security definer set search_path=pg_catalog,neuvetra,pg_temp as $$
#variable_conflict use_column
declare actor uuid; m jsonb; att jsonb; current_revision integer; new_id uuid:=gen_random_uuid(); reason text; todo jsonb; x jsonb; listed integer; n_corrected integer;
  uuid_re text:='^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'; begin
  actor:=neuvetra.scope3_manager_lock(target_company,'Scope 3 spend mapping');
  if octet_length(request::text)>4194304 then raise exception 'Scope 3 spend mapping too large' using errcode='54000'; end if;
  perform neuvetra.m71_keys(request,'expectedRevision,mapping,corrections,attestations');
  perform neuvetra.scope3_assert_int(request->'expectedRevision',0,999,false,'expected revision');
  m:=request->'mapping';
  perform neuvetra.m71_keys(m,'mappingKeySha256,glAccount,vendor,description,category,naicsCode,marginChoice');
  perform neuvetra.scope3_assert_match(m->'mappingKeySha256','^[0-9a-f]{64}$',false,'mapping key');
  perform neuvetra.scope3_assert_text(m->'glAccount',0,120,false,'GL account');
  perform neuvetra.scope3_assert_text(m->'vendor',0,200,false,'vendor');
  perform neuvetra.scope3_assert_text(m->'description',0,200,false,'description');
  perform neuvetra.scope3_assert_category(m->'category',array[1,2,3,4,5,6],'spend category');
  perform neuvetra.scope3_assert_match(m->'naicsCode','^[0-9]{6}$',false,'NAICS code');
  if not neuvetra.scope3_spend_naics_allowed((m->>'category')::integer,m->>'naicsCode') then raise exception 'invalid Scope 3 spend mapping: NAICS code outside its category' using errcode='22023'; end if;
  perform neuvetra.scope3_assert_enum(m->'marginChoice',array['with_margins','without_margins'],false,'margin choice');
  att:=request->'attestations';
  perform neuvetra.m71_keys(att,'categoryConfirmed,activityOverlapConfirmed');
  if jsonb_typeof(att->'categoryConfirmed') not in('boolean','null') or jsonb_typeof(att->'activityOverlapConfirmed') not in('boolean','null') then raise exception 'invalid Scope 3 spend mapping attestations' using errcode='22023'; end if;
  if jsonb_typeof(request->'corrections') is distinct from 'array' or jsonb_array_length(request->'corrections')>20000
    or exists(select 1 from jsonb_array_elements(request->'corrections') e where jsonb_typeof(e) is distinct from 'object' or (select string_agg(k,',' order by k) from jsonb_object_keys(e) k) is distinct from 'expectedVersionId,recordId'
      or jsonb_typeof(e->'recordId') is distinct from 'string' or jsonb_typeof(e->'expectedVersionId') is distinct from 'string' or e->>'recordId' !~ uuid_re or e->>'expectedVersionId' !~ uuid_re)
    or (select count(distinct e->>'recordId') from jsonb_array_elements(request->'corrections') e)<>jsonb_array_length(request->'corrections') then raise exception 'invalid Scope 3 spend mapping corrections' using errcode='22023'; end if;
  perform id from neuvetra.companies where id=target_company for update;
  select max(x.revision) into current_revision from neuvetra.scope3_spend_mapping_versions x where x.company_id=target_company and x.mapping_key_sha256=m->>'mappingKeySha256';
  if (request->>'expectedRevision')::integer<>coalesce(current_revision,0) then raise exception 'Scope 3 spend mapping changed; reload before saving' using errcode='23505'; end if;
  insert into neuvetra.scope3_spend_mapping_versions(id,company_id,mapping_key_sha256,gl_account,vendor,description,category,naics_code,margin_choice,revision,created_by)
  values(new_id,target_company,m->>'mappingKeySha256',m->>'glAccount',m->>'vendor',m->>'description',(m->>'category')::integer,m->>'naicsCode',m->>'marginChoice',coalesce(current_revision,0)+1,actor);
  -- The listed lines exactly as read: each still at the head version it was read at (else 23505), and an active imported
  -- spend line whose mapping the file did not state (else 22023).
  listed:=jsonb_array_length(request->'corrections');
  if (select count(*) from jsonb_array_elements(request->'corrections') e join neuvetra.collection_activity_heads h on h.company_id=target_company and h.record_id=(e->>'recordId')::uuid and h.version_id=(e->>'expectedVersionId')::uuid)<>listed then
    raise exception 'Scope 3 spend lines changed; reload before mapping' using errcode='23505'; end if;
  if exists(select 1 from jsonb_array_elements(request->'corrections') e join neuvetra.collection_activity_versions v on v.company_id=target_company and v.id=(e->>'expectedVersionId')::uuid
    where v.payload->>'kind' is distinct from 'purchase_spend' or v.state<>'active' or jsonb_typeof(v.payload#>'{payload,importId}') is distinct from 'string' or v.payload#>>'{payload,mappingSource}' is not distinct from 'file') then
    raise exception 'invalid Scope 3 spend mapping correction' using errcode='22023'; end if;
  -- Each line's corrected activity; lines already equal to the mapping (and the attestations) are left as they are.
  select coalesce(jsonb_agg(jsonb_build_object('recordId',c.record_id,'versionId',c.version_id,'revision',c.revision,'activity',c.b) order by c.record_id),'[]'::jsonb) into todo from (
    select v.record_id,v.id version_id,v.revision,v.payload a,
      jsonb_set(v.payload,'{payload}',(v.payload->'payload')||jsonb_build_object('category',(m->>'category')::integer,'naicsCode',m->>'naicsCode','marginChoice',m->>'marginChoice','mappingSource','user')
        ||case when att->'categoryConfirmed'='null'::jsonb then '{}'::jsonb else jsonb_build_object('categoryConfirmed',att->'categoryConfirmed') end
        ||case when att->'activityOverlapConfirmed'='null'::jsonb then '{}'::jsonb else jsonb_build_object('activityOverlap',case when (att->>'activityOverlapConfirmed')::boolean then 'none_confirmed' else 'unknown' end) end) b
    from jsonb_array_elements(request->'corrections') e join neuvetra.collection_activity_versions v on v.company_id=target_company and v.id=(e->>'expectedVersionId')::uuid) c where c.b is distinct from c.a;
  reason:=format('Mapped to NAICS %s (category %s, %s) by spend mapping revision %s.',m->>'naicsCode',m->>'category',replace(m->>'marginChoice','_',' '),coalesce(current_revision,0)+1);
  n_corrected:=neuvetra.scope3_write_spend_versions(target_company,actor,todo,reason);
  mapping_id:=new_id; revision:=coalesce(current_revision,0)+1; corrected:=n_corrected; unchanged:=listed-n_corrected; return next;
end $$;
revoke all on function neuvetra.save_scope3_spend_mapping(uuid,jsonb) from public,authenticated,neuvetra_runtime;
grant execute on function neuvetra.save_scope3_spend_mapping(uuid,jsonb) to neuvetra_runtime;

-- Round 3 (owner decision 7, EN-3): "withdraw this import". Every line of the import that is still active gets one new
-- version, withdrawn with the reason given (against the current setup version, at the line's location), through the shared
-- set-based writer under the company lock; lines already withdrawn are left as they are. Returns both counts. A file can
-- then be imported again only as different bytes (the same bytes replay the import, which stays in the history).
create function neuvetra.withdraw_scope3_spend_import(target_company uuid,request jsonb)
returns table(import_id uuid,withdrawn integer,already_withdrawn integer) language plpgsql security definer set search_path=pg_catalog,neuvetra,pg_temp as $$
#variable_conflict use_column
declare actor uuid; todo jsonb; setup_head uuid; listed integer; n integer; reason text; begin
  actor:=neuvetra.scope3_manager_lock(target_company,'Scope 3 spend import withdrawal');
  perform neuvetra.m71_keys(request,'importId,reason');
  perform neuvetra.scope3_assert_match(request->'importId','^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',false,'import ID');
  perform neuvetra.scope3_assert_text(request->'reason',3,2000,false,'withdrawal reason');
  perform id from neuvetra.companies where id=target_company for update;
  if not exists(select 1 from neuvetra.scope3_spend_imports i where i.company_id=target_company and i.id=(request->>'importId')::uuid) then raise exception 'Scope 3 spend import unavailable' using errcode='23503'; end if;
  select h.version_id into setup_head from neuvetra.company_setup_heads h where h.company_id=target_company;
  select count(*) into listed from neuvetra.scope3_spend_import_lines l where l.company_id=target_company and l.import_id=(request->>'importId')::uuid;
  select coalesce(jsonb_agg(jsonb_build_object('recordId',v.record_id,'versionId',v.id,'revision',v.revision,'activity',
      v.payload||jsonb_build_object('state','withdrawn','withdrawalReason',request->>'reason','setupVersionId',setup_head::text)) order by l.row_number),'[]'::jsonb) into todo
    from neuvetra.scope3_spend_import_lines l
    cross join lateral (select h.version_id from neuvetra.collection_activity_heads h where h.record_id=l.record_id and h.company_id=target_company limit 1) h
    cross join lateral (select v.* from neuvetra.collection_activity_versions v where v.id=h.version_id and v.company_id=target_company limit 1) v
    where l.company_id=target_company and l.import_id=(request->>'importId')::uuid and v.state='active';
  reason:=format('Withdrawn with spend import %s: %s',request->>'importId',btrim(request->>'reason'));
  n:=neuvetra.scope3_write_spend_versions(target_company,actor,todo,left(reason,2000));
  import_id:=(request->>'importId')::uuid; withdrawn:=n; already_withdrawn:=listed-n; return next;
end $$;
revoke all on function neuvetra.withdraw_scope3_spend_import(uuid,jsonb) from public,authenticated,neuvetra_runtime;
grant execute on function neuvetra.withdraw_scope3_spend_import(uuid,jsonb) to neuvetra_runtime;

-- Round 3 (for lane C's bulk actions, e.g. one currency conversion applied to every held line in that currency): a bulk
-- correction of imported spend lines. `corrections` lists {recordId, expectedVersionId, activity}: each line must still be
-- at the version it was read at (else 23505) and be an active imported spend line, and its new activity must keep the
-- line's identity (kind purchase_spend, import ID and row, source ID) (else 22023); everything else is the caller's,
-- checked by the activity contract. Lines whose activity is unchanged are left as they are. One reason for the whole save.
-- Written by the shared set-based writer under the company lock; no line is added, so the line budget cannot grow.
create function neuvetra.save_scope3_spend_corrections(target_company uuid,request jsonb)
returns table(corrected integer,unchanged integer) language plpgsql security definer set search_path=pg_catalog,neuvetra,pg_temp as $$
#variable_conflict use_column
declare actor uuid; todo jsonb; listed integer; n integer; uuid_re text:='^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'; begin
  actor:=neuvetra.scope3_manager_lock(target_company,'Scope 3 spend correction');
  if octet_length(request::text)>8388608 then raise exception 'Scope 3 spend correction too large' using errcode='54000'; end if;
  perform neuvetra.m71_keys(request,'reason,corrections');
  perform neuvetra.scope3_assert_text(request->'reason',3,2000,false,'correction reason');
  if jsonb_typeof(request->'corrections') is distinct from 'array' or jsonb_array_length(request->'corrections') not between 1 and 3000
    or exists(select 1 from jsonb_array_elements(request->'corrections') e where jsonb_typeof(e) is distinct from 'object' or (select string_agg(k,',' order by k) from jsonb_object_keys(e) k) is distinct from 'activity,expectedVersionId,recordId'
      or e->>'recordId' !~ uuid_re or e->>'expectedVersionId' !~ uuid_re or jsonb_typeof(e->'activity') is distinct from 'object')
    or (select count(distinct e->>'recordId') from jsonb_array_elements(request->'corrections') e)<>jsonb_array_length(request->'corrections') then raise exception 'invalid Scope 3 spend corrections' using errcode='22023'; end if;
  perform id from neuvetra.companies where id=target_company for update;
  listed:=jsonb_array_length(request->'corrections');
  if (select count(*) from jsonb_array_elements(request->'corrections') e join neuvetra.collection_activity_heads h on h.company_id=target_company and h.record_id=(e->>'recordId')::uuid and h.version_id=(e->>'expectedVersionId')::uuid)<>listed then
    raise exception 'Scope 3 spend lines changed; reload before correcting' using errcode='23505'; end if;
  if exists(select 1 from jsonb_array_elements(request->'corrections') e join neuvetra.collection_activity_versions v on v.company_id=target_company and v.id=(e->>'expectedVersionId')::uuid
    where v.payload->>'kind' is distinct from 'purchase_spend' or v.state<>'active' or jsonb_typeof(v.payload#>'{payload,importId}') is distinct from 'string'
      or e#>>'{activity,kind}' is distinct from 'purchase_spend' or e#>'{activity,payload,importId}' is distinct from v.payload#>'{payload,importId}'
      or e#>'{activity,payload,importRow}' is distinct from v.payload#>'{payload,importRow}' or e#>'{activity,sourceId}' is distinct from v.payload->'sourceId') then
    raise exception 'invalid Scope 3 spend correction' using errcode='22023'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('recordId',v.record_id,'versionId',v.id,'revision',v.revision,'activity',e->'activity') order by v.record_id),'[]'::jsonb) into todo
    from jsonb_array_elements(request->'corrections') e join neuvetra.collection_activity_versions v on v.company_id=target_company and v.id=(e->>'expectedVersionId')::uuid
    where neuvetra.collection_derive_quantity(e->'activity') is distinct from v.payload;
  n:=neuvetra.scope3_write_spend_versions(target_company,actor,todo,btrim(request->>'reason'));
  corrected:=n; unchanged:=listed-n; return next;
end $$;
revoke all on function neuvetra.save_scope3_spend_corrections(uuid,jsonb) from public,authenticated,neuvetra_runtime;
grant execute on function neuvetra.save_scope3_spend_corrections(uuid,jsonb) to neuvetra_runtime;

-- 7. Frozen report versions and their approval (DESIGN §3.7, A16, D8). The exact report text (canonical JSON of the
-- Scope 3 results response) and CSV bytes are stored with their SHA-256, which the table itself recomputes; an approval
-- names the hash the approver saw.
create table neuvetra.scope3_report_versions (
  id uuid primary key,
  company_id uuid not null references neuvetra.companies(id),
  reporting_year integer not null check(reporting_year between 2012 and 2035),
  revision integer not null check(revision between 1 and 1000),
  previous_id uuid,
  setup_version_id uuid not null,
  reason text check(length(reason)<=2000),
  -- Round 2 (ENG-3, owner decision 10): measured against the line cap, so a company at the cap can always freeze; the
  -- route refuses anything larger before calling (report_too_large). Round 2c integration (owner decision): 128 MiB each.
  -- The largest at 3,000 active lines (MAX_SCOPE3_LINES; withdrawn lines are not listed) are ten-mode average commuting
  -- records with every free-text field at its maximum, 20 evidence files each and the longest numbers: 83.9 MB of report
  -- text and 68.2 MB of CSV (about 28.0 kB and 22.7 kB a line), over round 2's 64 MiB.
  report_text text not null check(octet_length(report_text) between 2 and 134217728),
  report_sha256 text not null check(report_sha256=encode(sha256(convert_to(report_text,'UTF8')),'hex')),
  csv_text text not null check(octet_length(csv_text)<=134217728),
  csv_sha256 text not null check(csv_sha256=encode(sha256(convert_to(csv_text,'UTF8')),'hex')),
  engine_sha256 text not null check(engine_sha256 ~ '^[0-9a-f]{64}$'),
  register_sha256s jsonb not null check(jsonb_typeof(register_sha256s)='object'),
  input_version_ids uuid[] not null check(cardinality(input_version_ids)<=20000),
  -- Round 3 (owner decision 6): what the next version's change log reads from this one (scope3ReportChangeLogBasis: its
  -- registers, methods, coverage and per line the identity, version, outcome, mapping and total), canonical JSON written
  -- from the same document as report_text at prepare time. The next prepare reads this (about 0.3 kB a line) instead of
  -- parsing the whole report text (83 MB at the line cap). Fixed with the row like every other column.
  change_log_basis text not null check(octet_length(change_log_basis) between 2 and 16777216),
  -- Round 2 (owner decision 7): the readiness the frozen results state (results.readiness.openIssues, copied at prepare):
  -- an approval of a version with open issues must acknowledge them.
  open_issues jsonb not null check(jsonb_typeof(open_issues)='array' and jsonb_array_length(open_issues)<=100),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default clock_timestamp(),
  unique(id,company_id), unique(id,company_id,report_sha256), unique(id,company_id,reporting_year), unique(company_id,reporting_year,revision),
  foreign key(previous_id,company_id,reporting_year) references neuvetra.scope3_report_versions(id,company_id,reporting_year),
  foreign key(setup_version_id,company_id) references neuvetra.company_setup_versions(id,company_id),
  check((revision=1 and previous_id is null) or (revision>1 and previous_id is not null and length(btrim(reason)) between 3 and 2000))
);
create table neuvetra.scope3_report_requests (
  company_id uuid not null references neuvetra.companies(id),
  idempotency_key uuid not null,
  actor_id uuid not null references auth.users(id),
  request_sha256 text not null check(request_sha256 ~ '^[0-9a-f]{64}$'),
  version_id uuid not null,
  primary key(company_id,idempotency_key),
  foreign key(version_id,company_id) references neuvetra.scope3_report_versions(id,company_id)
);
create table neuvetra.scope3_report_approvals (
  version_id uuid primary key,
  company_id uuid not null,
  report_sha256 text not null,
  approved_by uuid not null references auth.users(id),
  approved_at timestamptz not null default clock_timestamp(),
  self_approved boolean not null,
  -- Round 2 (owner decision 7, ACC-10): the open issues the approver acknowledged (the version's own list; null when it had
  -- none) and the explicit confirmation a self-approval requires (a control exception, printed and exported).
  acknowledged_open_issues jsonb check(acknowledged_open_issues is null or (jsonb_typeof(acknowledged_open_issues)='array' and jsonb_array_length(acknowledged_open_issues) between 1 and 100)),
  self_approval_confirmed boolean not null check(self_approval_confirmed=self_approved),
  unique(version_id,company_id),
  foreign key(version_id,company_id,report_sha256) references neuvetra.scope3_report_versions(id,company_id,report_sha256)
);

-- Round 3 (owner decision 6, EN-2): a version's two texts reach the database in chunks, each its own small statement inside
-- the prepare transaction, so neither the API nor a backend ever holds a 150 MB bind message (a backend reads a whole
-- message into one buffer that grows by doubling: 256 MB for the two texts at the line cap, before any copy of them).
-- prepare_scope3_report assembles each text from its chunks, stores the version and deletes the chunks in the same
-- transaction, so a chunk never outlives the transaction that staged it. No application role can read or write the table
-- (forced row-level security, no privileges); only these two functions touch it.
create table neuvetra.scope3_report_text_chunks (
  company_id uuid not null references neuvetra.companies(id),
  idempotency_key uuid not null,
  kind text not null check(kind in('report','csv')),
  ordinal integer not null check(ordinal between 0 and 4095),
  chunk text not null check(octet_length(chunk) between 1 and 8388608),
  created_by uuid not null references auth.users(id),
  primary key(company_id,idempotency_key,kind,ordinal)
);
alter table neuvetra.scope3_report_text_chunks enable row level security;
alter table neuvetra.scope3_report_text_chunks force row level security;
revoke all on neuvetra.scope3_report_text_chunks from public,authenticated,neuvetra_runtime;
create function neuvetra.stage_scope3_report_text(target_company uuid,request jsonb,chunk text)
returns void language plpgsql security definer set search_path=pg_catalog,neuvetra,pg_temp as $$
declare actor uuid; begin
  actor:=neuvetra.scope3_manager_lock(target_company,'Scope 3 report');
  perform neuvetra.m71_keys(request,'idempotencyKey,kind,ordinal');
  perform neuvetra.scope3_assert_match(request->'idempotencyKey','^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',false,'idempotency key');
  perform neuvetra.scope3_assert_enum(request->'kind',array['report','csv'],false,'text kind');
  perform neuvetra.scope3_assert_int(request->'ordinal',0,4095,false,'chunk ordinal');
  if chunk is null or octet_length(chunk) not between 1 and 8388608 then raise exception 'invalid Scope 3 report text chunk' using errcode='22023'; end if;
  insert into neuvetra.scope3_report_text_chunks(company_id,idempotency_key,kind,ordinal,chunk,created_by) values(target_company,(request->>'idempotencyKey')::uuid,request->>'kind',(request->>'ordinal')::integer,chunk,actor);
end $$;
revoke all on function neuvetra.stage_scope3_report_text(uuid,jsonb,text) from public,authenticated,neuvetra_runtime;
grant execute on function neuvetra.stage_scope3_report_text(uuid,jsonb,text) to neuvetra_runtime;

-- Round 3 (owner decision 6, EN-2): the report and CSV texts are assembled from the chunks this transaction staged under the
-- request's idempotency key (stage_scope3_report_text), never sent inside the jsonb request, and this function never
-- parses, re-serialises or re-hashes them: the table's CHECK constraints hash each text once on insert (a text that does
-- not match its hash is refused there, 23514), and the readiness gate arrives as a small field of the request (the API
-- takes it from the same results it froze into the report). At the line cap one backend reached about 2.6 GB with the texts
-- in the jsonb (round 2); the native budget test holds it under 1 GB.
-- Round 3 (EN-5): the results must still be current when frozen for the assessments (the latest assessment of every
-- category of the year), the evidence (no file linked by an input version was rejected since) and the change-log basis
-- (the previous approved version is still the year's latest approved one): otherwise 40001, as for the records.
create function neuvetra.prepare_scope3_report(target_company uuid,request jsonb)
returns table(version_id uuid,revision integer,replayed boolean) language plpgsql security definer set search_path=pg_catalog,neuvetra,pg_temp set plan_cache_mode='force_generic_plan' as $$
#variable_conflict use_column
declare actor uuid; old neuvetra.scope3_report_requests%rowtype; head_id uuid; head_revision integer; fingerprint text; new_id uuid:=gen_random_uuid(); next_revision integer; r record; k text; issues jsonb; category3 boolean;
  report_text text; csv_text text; uuid_re text:='^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'; begin
  actor:=neuvetra.scope3_manager_lock(target_company,'Scope 3 report');
  -- The request holds only small fields (at most 20,000 input version ids).
  if octet_length(request::text)>4194304 then raise exception 'Scope 3 report too large' using errcode='54000'; end if;
  perform neuvetra.m71_keys(request,'idempotencyKey,expectedRevision,reason,reportingYear,companyId,reportSha256,csvSha256,engineSha256,registerSha256s,inputVersionIds,setupVersionId,readiness,assessmentIds,rejectedEvidenceIds,previousApprovedVersionId,changeLogBasis');
  if jsonb_typeof(request->'changeLogBasis') is distinct from 'string' or left(request->>'changeLogBasis',1)<>'{' then raise exception 'invalid Scope 3 report change-log basis' using errcode='22023'; end if;
  perform neuvetra.scope3_assert_int(request->'reportingYear',2012,2035,false,'reporting year');
  perform neuvetra.scope3_assert_match(request->'idempotencyKey',uuid_re,false,'idempotency key');
  -- The two texts this transaction staged under the key, assembled in chunk order, then the chunks are gone. Each text at
  -- most 128 MiB (the table's limit); chunks must be numbered 0..n-1 without a gap.
  if exists(select 1 from (select kind,count(*) n,max(ordinal) m from neuvetra.scope3_report_text_chunks where company_id=target_company and idempotency_key=(request->>'idempotencyKey')::uuid group by kind) c where c.n<>c.m+1) then
    raise exception 'invalid Scope 3 report text chunks' using errcode='22023'; end if;
  select string_agg(c.chunk,'' order by c.ordinal) into report_text from neuvetra.scope3_report_text_chunks c where c.company_id=target_company and c.idempotency_key=(request->>'idempotencyKey')::uuid and c.kind='report';
  select string_agg(c.chunk,'' order by c.ordinal) into csv_text from neuvetra.scope3_report_text_chunks c where c.company_id=target_company and c.idempotency_key=(request->>'idempotencyKey')::uuid and c.kind='csv';
  delete from neuvetra.scope3_report_text_chunks c where c.company_id=target_company and c.idempotency_key=(request->>'idempotencyKey')::uuid;
  csv_text:=coalesce(csv_text,'');
  if report_text is null or octet_length(report_text) not between 2 and 134217728 or octet_length(csv_text)>134217728 then raise exception 'Scope 3 report too large' using errcode='54000'; end if;
  perform neuvetra.scope3_assert_int(request->'expectedRevision',0,999,false,'expected revision');
  perform neuvetra.scope3_assert_text(request->'reason',0,2000,true,'reason');
  foreach k in array array['reportSha256','csvSha256','engineSha256'] loop perform neuvetra.scope3_assert_match(request->k,'^[0-9a-f]{64}$',false,'SHA-256'); end loop;
  -- The report is a JSON object about this company (the API builds it from this company's results; a cheap textual check,
  -- never a parse of the report).
  if request->>'companyId' is distinct from target_company::text or left(report_text,1)<>'{' or right(report_text,1)<>'}' or strpos(report_text,'"companyId":"'||target_company::text||'"')=0 then raise exception 'Scope 3 report is not about this company' using errcode='22023'; end if;
  -- Round 2 (owner decision 7): the results' readiness: `ready` exactly when there is no open issue; each issue a category
  -- and one of the gate codes, once. Round 3: sent beside the texts (the same object the report text holds).
  issues:=request#>'{readiness,openIssues}';
  if jsonb_typeof(request->'readiness') is distinct from 'object' or (select string_agg(k2,',' order by k2) from jsonb_object_keys(request->'readiness') k2) is distinct from 'openIssues,ready'
    or jsonb_typeof(issues) is distinct from 'array' or jsonb_typeof(request#>'{readiness,ready}') is distinct from 'boolean' or (request#>>'{readiness,ready}')::boolean<>(jsonb_array_length(issues)=0) or jsonb_array_length(issues)>100
    or exists(select 1 from jsonb_array_elements(issues) e where jsonb_typeof(e) is distinct from 'object' or (select string_agg(k2,',' order by k2) from jsonb_object_keys(e) k2) is distinct from 'category,code'
      or jsonb_typeof(e->'category') is distinct from 'number' or e->>'category' !~ '^([1-9]|1[0-5])$' or e->>'code' is null or e->>'code' not in('input_needed','screening_conflict','needs_review','assessment_missing','included_category_has_no_records'))
    or (select count(distinct e) from jsonb_array_elements(issues) e)<>jsonb_array_length(issues) then raise exception 'invalid Scope 3 report readiness' using errcode='22023'; end if;
  if jsonb_typeof(request->'registerSha256s') is distinct from 'object' then raise exception 'invalid Scope 3 register list' using errcode='22023'; end if;
  if (select count(*) from jsonb_object_keys(request->'registerSha256s')) not between 1 and 10 then raise exception 'invalid Scope 3 register list' using errcode='22023'; end if;
  for r in select key,value from jsonb_each(request->'registerSha256s') loop
    if r.key !~ '^[a-z][a-z0-9_]{0,39}$' then raise exception 'invalid Scope 3 register list' using errcode='22023'; end if;
    perform neuvetra.scope3_assert_match(r.value,'^[0-9a-f]{64}$',false,'register SHA-256');
  end loop;
  perform neuvetra.scope3_assert_uuid_list(request->'inputVersionIds',20000,'input versions');
  perform neuvetra.scope3_assert_uuid_list(request->'assessmentIds',15,'assessments');
  perform neuvetra.scope3_assert_uuid_list(request->'rejectedEvidenceIds',20000,'rejected evidence');
  perform neuvetra.scope3_assert_match(request->'previousApprovedVersionId',uuid_re,true,'previous approved version');
  perform neuvetra.scope3_assert_match(request->'setupVersionId',uuid_re,false,'setup version');
  -- The texts are covered by their hashes, which are in the request, so the fingerprint stays small.
  fingerprint:=neuvetra.m67_hash(jsonb_build_object('operation','prepare_scope3_report','companyId',target_company,'actorId',actor,'request',request-'idempotencyKey'));
  perform id from neuvetra.companies where id=target_company for update;
  select * into old from neuvetra.scope3_report_requests where company_id=target_company and idempotency_key=(request->>'idempotencyKey')::uuid;
  if found then
    if old.actor_id<>actor or old.request_sha256<>fingerprint then raise exception 'Scope 3 report idempotency conflict' using errcode='23505'; end if;
    select x.revision into next_revision from neuvetra.scope3_report_versions x where x.id=old.version_id and x.company_id=target_company;
    version_id:=old.version_id; revision:=next_revision; replayed:=true; return next; return;
  end if;
  if not exists(select 1 from neuvetra.company_setup_heads h where h.company_id=target_company and h.version_id=(request->>'setupVersionId')::uuid) then raise exception 'current company setup required; reload setup' using errcode='23503'; end if;
  if exists(select 1 from jsonb_array_elements_text(request->'inputVersionIds') e where not exists(select 1 from neuvetra.collection_activity_versions v where v.company_id=target_company and v.id=e::uuid)) then raise exception 'Scope 3 report input version unavailable' using errcode='23503'; end if;
  -- Round 2 (ENG-11): the results must still be current when frozen. Every input version is still its record's head, and
  -- the inputs name exactly the records the results route lists: every Scope 3 record that is not withdrawn and, when the
  -- setup includes category 3, every electricity, natural gas, No. 2 distillate and vehicle record that is not withdrawn
  -- (their 3A, 3B and 3C lines). Otherwise a record was added, edited or withdrawn after the results were read: 40001, so
  -- the caller prepares again from fresh results.
  if exists(select 1 from jsonb_array_elements_text(request->'inputVersionIds') e join neuvetra.collection_activity_versions v on v.company_id=target_company and v.id=e::uuid
    left join neuvetra.collection_activity_heads h on h.company_id=target_company and h.record_id=v.record_id where h.version_id is distinct from v.id) then
    raise exception 'Scope 3 records changed after the results were read' using errcode='40001'; end if;
  category3:=exists(select 1 from neuvetra.company_setup_screening s where s.company_id=target_company and s.version_id=(request->>'setupVersionId')::uuid and s.scope=3 and s.category='fuel_and_energy_related_activities' and s.state='yes');
  if (select coalesce(array_agg(x.record_id order by x.record_id),'{}') from (select distinct v.record_id from jsonb_array_elements_text(request->'inputVersionIds') e join neuvetra.collection_activity_versions v on v.company_id=target_company and v.id=e::uuid) x)
    is distinct from (select coalesce(array_agg(r.id order by r.id),'{}') from neuvetra.collection_activity_records r join neuvetra.collection_activity_heads h on h.company_id=r.company_id and h.record_id=r.id
      join neuvetra.collection_activity_versions v on v.company_id=r.company_id and v.id=h.version_id
      where r.company_id=target_company and v.state<>'withdrawn' and (r.scope=3 or (category3 and r.kind in('electricity','natural_gas','distillate_no2','vehicle')))) then
    raise exception 'Scope 3 records changed after the results were read' using errcode='40001'; end if;
  -- I-02b (AM-03): revisions per reporting year, which must be the setup's.
  perform neuvetra.scope3_assert_reporting_year(target_company,(request->>'setupVersionId')::uuid,request->'reportingYear');
  -- Round 3 (EN-5): the latest assessment of every category of the year is the one the results used.
  if (select coalesce(array_agg(a.id::text order by a.id::text),'{}') from neuvetra.scope3_category_assessment_heads a where a.company_id=target_company and a.reporting_year=(request->>'reportingYear')::integer)
    is distinct from (select coalesce(array_agg(e order by e),'{}') from jsonb_array_elements_text(request->'assessmentIds') e) then
    raise exception 'Scope 3 assessments changed after the results were read' using errcode='40001'; end if;
  -- Round 3 (EN-5): the files the input versions link that are rejected are exactly those the results saw rejected
  -- (rejection is terminal, so a difference means a file was rejected after the read).
  if (select coalesce(array_agg(distinct l.evidence_id::text order by l.evidence_id::text),'{}') from jsonb_array_elements_text(request->'inputVersionIds') e
      join neuvetra.collection_activity_evidence_links l on l.company_id=target_company and l.version_id=e::uuid
      where exists(select 1 from neuvetra.collection_evidence_quarantine_events q where q.company_id=target_company and q.evidence_id=l.evidence_id and q.status='rejected'))
    is distinct from (select coalesce(array_agg(e order by e),'{}') from jsonb_array_elements_text(request->'rejectedEvidenceIds') e) then
    raise exception 'Scope 3 evidence status changed after the results were read' using errcode='40001'; end if;
  -- Round 3 (EN-2): the year's head by its id and revision only (a whole-row read would detoast its two texts).
  select x.id,x.revision into head_id,head_revision from neuvetra.scope3_report_versions x where x.company_id=target_company and x.reporting_year=(request->>'reportingYear')::integer order by x.revision desc limit 1;
  if (request->>'expectedRevision')::integer<>coalesce(head_revision,0) then raise exception 'Scope 3 report changed; reload before saving' using errcode='23505'; end if;
  -- Round 3 (EN-5): the change log was computed against the year's latest approved version (or none); still so under the lock.
  if (select x.id::text from neuvetra.scope3_report_versions x join neuvetra.scope3_report_approvals a on a.version_id=x.id and a.company_id=x.company_id
      where x.company_id=target_company and x.reporting_year=(request->>'reportingYear')::integer order by x.revision desc limit 1) is distinct from request->>'previousApprovedVersionId' then
    raise exception 'Scope 3 approved version changed after the results were read' using errcode='40001'; end if;
  next_revision:=coalesce(head_revision,0)+1;
  if next_revision>1000 then raise exception 'Scope 3 report history capacity reached' using errcode='54000'; end if;
  if next_revision>1 and coalesce(length(btrim(request->>'reason')),0)<3 then raise exception 'Scope 3 report reason required' using errcode='22023'; end if;
  insert into neuvetra.scope3_report_versions(id,company_id,reporting_year,revision,previous_id,setup_version_id,reason,report_text,report_sha256,csv_text,csv_sha256,engine_sha256,register_sha256s,input_version_ids,change_log_basis,open_issues,created_by)
  values(new_id,target_company,(request->>'reportingYear')::integer,next_revision,head_id,(request->>'setupVersionId')::uuid,request->>'reason',report_text,request->>'reportSha256',csv_text,request->>'csvSha256',request->>'engineSha256',request->'registerSha256s',
    array(select e::uuid from jsonb_array_elements_text(request->'inputVersionIds') e),request->>'changeLogBasis',issues,actor);
  insert into neuvetra.scope3_report_requests values(target_company,(request->>'idempotencyKey')::uuid,actor,fingerprint,new_id);
  version_id:=new_id; revision:=next_revision; replayed:=false; return next;
end $$;
revoke all on function neuvetra.prepare_scope3_report(uuid,jsonb) from public,authenticated,neuvetra_runtime;
grant execute on function neuvetra.prepare_scope3_report(uuid,jsonb) to neuvetra_runtime;

-- Approval names the report hash the approver saw: a different hash is refused (23505, report changed); a version
-- already approved returns that approval. can_manage_company (owner or admin) is the strictest management check the
-- schema has (0001, 0009); self-approval is allowed and recorded.
-- Round 2 (owner decision 7, UX-10, ACC-10): a version whose frozen results have open issues is approved only with
-- `acknowledgeOpenIssues: true` (the version's list is stored with the approval); a self-approval only with
-- `confirmSelfApproval: true` (stored, a control exception). Either flag set when it does not apply is refused (22023);
-- a missing acknowledgement or confirmation is refused with 23514.
create function neuvetra.approve_scope3_report(target_company uuid,request jsonb)
returns table(version_id uuid,approved_by uuid,approved_at timestamptz,self_approved boolean,replayed boolean) language plpgsql security definer set search_path=pg_catalog,neuvetra,pg_temp as $$
#variable_conflict use_column
declare actor uuid; v record; prior neuvetra.scope3_report_approvals%rowtype; stamp timestamptz:=clock_timestamp(); begin
  actor:=neuvetra.scope3_manager_lock(target_company,'Scope 3 report approval');
  perform neuvetra.m71_keys(request,'versionId,reportSha256,acknowledgeOpenIssues,confirmSelfApproval');
  if jsonb_typeof(request->'acknowledgeOpenIssues') is distinct from 'boolean' or jsonb_typeof(request->'confirmSelfApproval') is distinct from 'boolean' then raise exception 'invalid Scope 3 report approval' using errcode='22023'; end if;
  perform neuvetra.scope3_assert_match(request->'versionId','^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',false,'report version');
  perform neuvetra.scope3_assert_match(request->'reportSha256','^[0-9a-f]{64}$',false,'report SHA-256');
  perform id from neuvetra.companies where id=target_company for update;
  -- Round 3 (EN-2): the columns the approval needs, never the two texts (a whole-row read detoasts them).
  select x.id,x.report_sha256,x.open_issues,x.created_by into v from neuvetra.scope3_report_versions x where x.id=(request->>'versionId')::uuid and x.company_id=target_company;
  if not found then raise exception 'Scope 3 report version unavailable' using errcode='23503'; end if;
  if v.report_sha256<>request->>'reportSha256' then raise exception 'Scope 3 report changed' using errcode='23505'; end if;
  select * into prior from neuvetra.scope3_report_approvals x where x.version_id=v.id and x.company_id=target_company;
  if found then version_id:=prior.version_id; approved_by:=prior.approved_by; approved_at:=prior.approved_at; self_approved:=prior.self_approved; replayed:=true; return next; return; end if;
  if (request->>'acknowledgeOpenIssues')::boolean and jsonb_array_length(v.open_issues)=0 then raise exception 'Scope 3 report has no open issues to acknowledge' using errcode='22023'; end if;
  if (request->>'confirmSelfApproval')::boolean and v.created_by<>actor then raise exception 'Scope 3 report approval is not a self-approval' using errcode='22023'; end if;
  if jsonb_array_length(v.open_issues)>0 and not (request->>'acknowledgeOpenIssues')::boolean then raise exception 'Scope 3 report has open issues; acknowledge them to approve' using errcode='23514'; end if;
  if v.created_by=actor and not (request->>'confirmSelfApproval')::boolean then raise exception 'Scope 3 report self-approval must be confirmed' using errcode='23514'; end if;
  insert into neuvetra.scope3_report_approvals(version_id,company_id,report_sha256,approved_by,approved_at,self_approved,acknowledged_open_issues,self_approval_confirmed)
  values(v.id,target_company,v.report_sha256,actor,stamp,v.created_by=actor,case when jsonb_array_length(v.open_issues)>0 then v.open_issues end,v.created_by=actor);
  version_id:=v.id; approved_by:=actor; approved_at:=stamp; self_approved:=v.created_by=actor; replayed:=false; return next;
end $$;
revoke all on function neuvetra.approve_scope3_report(uuid,jsonb) from public,authenticated,neuvetra_runtime;
grant execute on function neuvetra.approve_scope3_report(uuid,jsonb) to neuvetra_runtime;

-- Row-level security as for the collection tables (0027): forced, read by company members through the runtime role,
-- written only through the functions above. Every table is insert-only.
do $$ declare t text; begin
  foreach t in array array['scope3_category_assessments','scope3_assessment_requests','scope3_spend_imports','scope3_spend_import_lines','scope3_spend_mapping_versions','scope3_report_versions','scope3_report_requests','scope3_report_approvals'] loop
    execute format('alter table neuvetra.%I enable row level security',t);
    execute format('alter table neuvetra.%I force row level security',t);
    execute format('revoke all on neuvetra.%I from public,authenticated,neuvetra_runtime',t);
    execute format('grant select on neuvetra.%I to neuvetra_runtime',t);
    execute format('create policy scope3_member_read on neuvetra.%I for select to neuvetra_runtime using(neuvetra.is_company_member(company_id))',t);
    execute format('create trigger scope3_history_immutable before update or delete on neuvetra.%I for each row execute function neuvetra.scope3_reject_history_mutation()',t);
    execute format('create trigger scope3_history_no_truncate before truncate on neuvetra.%I for each statement execute function neuvetra.scope3_reject_history_mutation()',t);
  end loop;
  foreach t in array array['scope3_category_assessment_heads','scope3_spend_mapping_heads'] loop
    execute format('revoke all on neuvetra.%I from public,authenticated,neuvetra_runtime',t);
    execute format('grant select on neuvetra.%I to neuvetra_runtime',t);
  end loop;
end $$;

-- Prove the new objects' privileges: forced row-level security on every new table; both views run with the caller's rights
-- (security_invoker, so the tables' company read policy applies through them; DESIGN B2, AM-02); the runtime reads tables
-- and views and calls only the eight RPCs (round 3 adds withdraw_scope3_spend_import, save_scope3_spend_corrections and
-- stage_scope3_report_text); round 3's text-chunk table is forced RLS with no application privileges at all; nothing is open to public, anon or authenticated; every other scope3_ function
-- (the helpers, including scope3_spend_naics_allowed) is callable by no application role (AM-18).
do $grants$
declare t text; f text; r text; begin
  foreach t in array array['scope3_category_assessments','scope3_assessment_requests','scope3_spend_imports','scope3_spend_import_lines','scope3_spend_mapping_versions','scope3_report_versions','scope3_report_requests','scope3_report_approvals'] loop
    if not exists(select 1 from pg_class c where c.oid=('neuvetra.'||t)::regclass and c.relkind='r' and c.relrowsecurity and c.relforcerowsecurity) then raise exception '0030 table % lacks forced row-level security',t using errcode='42501'; end if;
  end loop;
  if not exists(select 1 from pg_class c where c.oid='neuvetra.scope3_report_text_chunks'::regclass and c.relrowsecurity and c.relforcerowsecurity)
    or has_table_privilege('neuvetra_runtime','neuvetra.scope3_report_text_chunks','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then raise exception '0030 text chunks are open' using errcode='42501'; end if;
  foreach t in array array['scope3_category_assessment_heads','scope3_spend_mapping_heads'] loop
    if not exists(select 1 from pg_class c where c.oid=('neuvetra.'||t)::regclass and c.relkind='v' and 'security_invoker=true'=any(coalesce(c.reloptions,'{}'::text[]))) then raise exception '0030 view % is not security_invoker',t using errcode='42501'; end if;
  end loop;
  foreach t in array array['scope3_category_assessments','scope3_assessment_requests','scope3_spend_imports','scope3_spend_import_lines','scope3_spend_mapping_versions','scope3_report_versions','scope3_report_requests','scope3_report_approvals','scope3_category_assessment_heads','scope3_spend_mapping_heads'] loop
    if not has_table_privilege('neuvetra_runtime','neuvetra.'||t,'SELECT') or has_table_privilege('neuvetra_runtime','neuvetra.'||t,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then raise exception '0030 runtime privileges on % are wrong',t using errcode='42501'; end if;
    foreach r in array array['authenticated','anon'] loop
      if exists(select 1 from pg_roles where rolname=r) and has_table_privilege(r,'neuvetra.'||t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then raise exception '0030 table % is open to %',t,r using errcode='42501'; end if;
    end loop;
    if exists(select 1 from pg_class c, aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) acl where c.oid=('neuvetra.'||t)::regclass and acl.grantee=0) then raise exception '0030 table % is open to public',t using errcode='42501'; end if;
  end loop;
  foreach f in array array['neuvetra.save_scope3_category_assessment(uuid,jsonb)','neuvetra.import_scope3_spend(uuid,jsonb)','neuvetra.save_scope3_spend_mapping(uuid,jsonb)','neuvetra.prepare_scope3_report(uuid,jsonb)','neuvetra.stage_scope3_report_text(uuid,jsonb,text)','neuvetra.approve_scope3_report(uuid,jsonb)','neuvetra.withdraw_scope3_spend_import(uuid,jsonb)','neuvetra.save_scope3_spend_corrections(uuid,jsonb)'] loop
    if not has_function_privilege('neuvetra_runtime',f,'execute') then raise exception '0030 runtime cannot call %',f using errcode='42501'; end if;
  end loop;
  -- Every other 0030 function (all are named scope3_*): no application role, and not public.
  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='neuvetra' and p.proname like 'scope3\_%') < 18 then raise exception '0030 helper functions missing' using errcode='42501'; end if;
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='neuvetra' and p.proname like 'scope3\_%' loop
    if has_function_privilege('neuvetra_runtime',f,'execute') then raise exception '0030 runtime can call %',f using errcode='42501'; end if;
  end loop;
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='neuvetra' and (p.proname like 'scope3\_%' or p.oid in('neuvetra.save_scope3_category_assessment(uuid,jsonb)'::regprocedure,'neuvetra.import_scope3_spend(uuid,jsonb)'::regprocedure,
    'neuvetra.save_scope3_spend_mapping(uuid,jsonb)'::regprocedure,'neuvetra.prepare_scope3_report(uuid,jsonb)'::regprocedure,'neuvetra.stage_scope3_report_text(uuid,jsonb,text)'::regprocedure,'neuvetra.approve_scope3_report(uuid,jsonb)'::regprocedure,
    'neuvetra.withdraw_scope3_spend_import(uuid,jsonb)'::regprocedure,'neuvetra.save_scope3_spend_corrections(uuid,jsonb)'::regprocedure)) loop
    foreach r in array array['authenticated','anon'] loop
      if exists(select 1 from pg_roles where rolname=r) and has_function_privilege(r,f,'execute') then raise exception '0030 function % is open to %',f,r using errcode='42501'; end if;
    end loop;
    if exists(select 1 from pg_proc p, aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl where p.oid=f::regprocedure and acl.grantee=0 and acl.privilege_type='EXECUTE') then raise exception '0030 function % is open to public',f using errcode='42501'; end if;
  end loop;
end $grants$;

-- 8. The EPA Supply Chain GHG Emission Factors v1.3 CO2e file, as staged in the research folder on 8 September 2026
-- (123,481 bytes). The table has no licence column and allows three source uses, so the licence is recorded in the edition.
insert into neuvetra.method_source_documents(id,publisher,title,edition,url,retrieved_on,sha256,bytes,media_type,source_use) values
('30000000-0000-4000-8000-000000000001','U.S. EPA Office of Research and Development',
 'Supply Chain Greenhouse Gas Emission Factors for US Industries and Commodities (SupplyChainGHGEmissionFactors_v1.3.0_NAICS_CO2e_USD2022.csv)',
 'v1.3.0, 5 July 2024 (doi 10.23719/1531143); licence: EPA ScienceHub, public domain, https://pasteur.epa.gov/license/sciencehub-license.html',
 'https://pasteur.epa.gov/uploads/10.23719/1531143/SupplyChainGHGEmissionFactors_v1.3.0_NAICS_CO2e_USD2022.csv','2026-09-08',
 '6025a14c4fe16675735efba1683030e4d36011e3973f3c4261f8231aa69c002f',123481,'text/csv','numeric_values_with_citation');
