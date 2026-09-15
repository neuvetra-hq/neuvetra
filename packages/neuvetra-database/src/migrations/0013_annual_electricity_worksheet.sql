-- Additive M67 annual manual profile; no M63-M66 migration or record changes.
create function neuvetra.m67_canonical(value jsonb) returns text
language plpgsql immutable set search_path=pg_catalog,neuvetra,pg_temp as $$
declare result text;
begin
 if jsonb_typeof(value)='object' then
  select '{'||coalesce(string_agg(to_json(key)::text||':'||neuvetra.m67_canonical(v),',' order by key collate "C"),'')||'}' into result from jsonb_each(value) as item(key,v);return result;
 elsif jsonb_typeof(value)='array' then
  select '['||coalesce(string_agg(neuvetra.m67_canonical(v),',' order by ord),'')||']' into result from jsonb_array_elements(value) with ordinality as item(v,ord);return result;
 end if;
 return value::text;
end $$;
create function neuvetra.m67_hash(value jsonb) returns text language sql immutable set search_path=pg_catalog,neuvetra,pg_temp as $$ select encode(sha256(convert_to(neuvetra.m67_canonical(value),'utf8')),'hex') $$;
create function neuvetra.m67_quantity(milli numeric) returns jsonb language plpgsql immutable set search_path=pg_catalog,neuvetra,pg_temp as $$
declare scaled numeric:=milli*1950402888; q numeric; rem numeric; exact_total text; display_total text;
begin
 exact_total:=rtrim(rtrim((scaled*0.0000000000001)::numeric(24,13)::text,'0'),'.');q:=div(scaled,1000000000);rem:=mod(scaled,1000000000);
 if rem>500000000 or (rem=500000000 and mod(q,2)=1) then q:=q+1;end if;
 display_total:=(q*0.0001)::numeric(16,4)::text;
 return jsonb_build_object('quantityKwh',(milli*0.001)::numeric(12,3)::text,'quantityMwh',(milli*0.000001)::numeric(12,6)::text,'total',jsonb_build_object('unrounded',exact_total,'display',display_total,'unit','kg CO2e','rounding','half_even_4dp'));
end $$;
create function neuvetra.m67_calculate_months(input jsonb) returns jsonb language plpgsql immutable set search_path=pg_catalog,neuvetra,pg_temp as $$
declare row jsonb; idx integer:=0; expected_month text; raw text; milli numeric; sum_milli numeric:=0; known integer:=0; months jsonb:='[]'::jsonb; missing jsonb:='[]'::jsonb; calculated jsonb;
begin
 if jsonb_typeof(input) is distinct from 'array' then raise exception 'invalid annual month array' using errcode='22023';end if;
 if jsonb_array_length(input)<>12 then raise exception 'invalid annual month count' using errcode='22023';end if;
 for row in select value from jsonb_array_elements(input) loop
  idx:=idx+1;expected_month:='2023-'||lpad(idx::text,2,'0');
  if jsonb_typeof(row) is distinct from 'object' then raise exception 'invalid annual month' using errcode='22023';end if;
  if (select array_agg(key order by key) from jsonb_object_keys(row) key) is distinct from array['month','quantityKwh']::text[] or row->>'month' is distinct from expected_month or jsonb_typeof(row->'month') is distinct from 'string' then raise exception 'invalid annual month' using errcode='22023';end if;
  if row->'quantityKwh'='null'::jsonb then
   months:=months||jsonb_build_array(jsonb_build_object('month',expected_month,'quantityKwh',null,'quantityMwh',null,'total',null));missing:=missing||jsonb_build_array(expected_month);
  else
   raw:=row->>'quantityKwh';
   if jsonb_typeof(row->'quantityKwh') is distinct from 'string' or char_length(raw)>11 or raw !~ '^(0|[1-9][0-9]{0,6})(\.[0-9]{1,3})?$' or raw ~ '[^0-9.]' then raise exception 'invalid annual quantity' using errcode='22023';end if;
   if raw::numeric>1000000 then raise exception 'invalid annual monthly limit' using errcode='22023';end if;
   milli:=raw::numeric*1000;sum_milli:=sum_milli+milli;known:=known+1;calculated:=neuvetra.m67_quantity(milli);
   months:=months||jsonb_build_array(calculated||jsonb_build_object('month',expected_month));
  end if;
 end loop;
 if known=0 or sum_milli>12000000000 then raise exception 'enter at least one annual month' using errcode='22023';end if;
 return neuvetra.m67_quantity(sum_milli)||jsonb_build_object('months',months,'coverage',jsonb_build_object('knownMonths',known,'missingMonths',missing,'electricityComplete',known=12));
end $$;
revoke all on function neuvetra.m67_canonical(jsonb),neuvetra.m67_hash(jsonb),neuvetra.m67_quantity(numeric),neuvetra.m67_calculate_months(jsonb) from public,authenticated;
create table neuvetra.annual_electricity_worksheet_versions (
 id uuid primary key, company_id uuid not null references neuvetra.companies(id), version integer not null check(version>0),
 previous_version_id uuid, payload jsonb not null, input_sha256 text not null, result_sha256 text not null,
 operation_fingerprint text not null, created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 unique(id,company_id), unique(company_id,version), unique(company_id,operation_fingerprint),
 foreign key(previous_version_id,company_id) references neuvetra.annual_electricity_worksheet_versions(id,company_id),
 check(input_sha256~'^[0-9a-f]{64}$' and result_sha256~'^[0-9a-f]{64}$' and operation_fingerprint~'^[0-9a-f]{64}$')
);
create table neuvetra.annual_electricity_worksheet_reviews (
 id uuid primary key, company_id uuid not null, version_id uuid not null, payload jsonb not null,
 decision_sha256 text not null check(decision_sha256~'^[0-9a-f]{64}$'), operation_fingerprint text not null,
 reviewed_by uuid not null references auth.users(id), reviewed_at timestamptz not null default now(),
 unique(id,company_id), unique(company_id,version_id), unique(company_id,operation_fingerprint),
 foreign key(version_id,company_id) references neuvetra.annual_electricity_worksheet_versions(id,company_id)
);
create table neuvetra.annual_electricity_worksheet_requests (
 company_id uuid not null references neuvetra.companies(id), idempotency_key uuid not null, operation_fingerprint text not null,
 kind text not null check(kind in('save','review')), record_id uuid not null, primary key(company_id,idempotency_key)
);
create table neuvetra.annual_electricity_worksheet_audit (
 id uuid primary key, company_id uuid not null references neuvetra.companies(id), record_id uuid not null,
 kind text not null check(kind in('save','review')), record_sha256 text not null, actor_id uuid not null references auth.users(id),
 created_at timestamptz not null default now(), unique(company_id,kind,record_id)
);
do $$ declare relation text; begin
 foreach relation in array array['annual_electricity_worksheet_versions','annual_electricity_worksheet_reviews','annual_electricity_worksheet_requests','annual_electricity_worksheet_audit'] loop
  execute format('alter table neuvetra.%I enable row level security',relation);
  execute format('alter table neuvetra.%I force row level security',relation);
  execute format('create policy m67_member_read on neuvetra.%I for select to authenticated using(neuvetra.is_company_member(company_id))',relation);
  execute format('grant select on neuvetra.%I to authenticated',relation);
  execute format('revoke all on neuvetra.%I from public',relation);
  execute format('create trigger m67_immutable before update or delete on neuvetra.%I for each row execute function neuvetra.reject_inventory_history_mutation()',relation);
  if exists(select 1 from pg_roles where rolname='neuvetra_runtime') then
   execute format('create policy m67_runtime_read on neuvetra.%I for select to neuvetra_runtime using(neuvetra.is_company_member(company_id))',relation);
   execute format('grant select on neuvetra.%I to neuvetra_runtime',relation);
   execute format('revoke all on neuvetra.%I from authenticated',relation);
  end if;
 end loop;
end $$;


create function neuvetra.m67_method() returns jsonb language sql immutable as $$ select '{"id":"scope2-location-based-egrid-subregion","version":"2023-r2-camx-v1","factorId":"epa-egrid2023-r2-camx-total-output","factorVersion":"eGRID2023-revision-2","factorValue":"195.0402888","factorUnit":"kg CO2e/MWh","sourceSha256":"3dfbbcf2f949d58d5b2dbee3aab8150bd04a0c8ebb730ba1cd37a013bd4450ab","sheet":"SRL23","cell":"AI6","classification":"development_candidate","policy":"m67-accounting-policy-v1","accountingProfile":"manual-synthetic-2023-camx-monthly-kwh-v1","factorCandidateSha256":"8770ae6238df8525e5250850fab248c934be33f459ed19cc1fa24bd0718cb356","gwpPolicySha256":"fd9fd8973012da1a232dad7fc00db3013194751a92b34ab21dfd4f7b2c5148c5","reviewedEngineSha256":"4ad28f3877d13f238bbbf7e8bfb1fc6241922b9def73712ec1b02fd80b51b82c"}'::jsonb $$;
create function neuvetra.m67_limitations() returns jsonb language sql immutable as $$ select '["synthetic_manual_input","no_bills_linked_to_annual_worksheet","overall_inventory_incomplete","calendar_2023_camx_single_facility_only","missing_months_not_zero","market_based_scope2_not_included","factor_and_method_not_released","scope_1_and_scope_3_not_assessed","no_assurance"]'::jsonb $$;
revoke all on function neuvetra.m67_method(),neuvetra.m67_limitations() from public,authenticated;
create function neuvetra.lock_annual_electricity_report_read(target_company uuid) returns boolean
language plpgsql security definer set search_path=pg_catalog,neuvetra,pg_temp as $$ begin
 if not neuvetra.is_company_member(target_company) then return false;end if;
 perform id from neuvetra.companies where id=target_company for share;
 return found and neuvetra.is_company_member(target_company);
end $$;
revoke all on function neuvetra.lock_annual_electricity_report_read(uuid) from public;
grant execute on function neuvetra.lock_annual_electricity_report_read(uuid) to authenticated;
create function neuvetra.save_annual_electricity_worksheet(target_company uuid,request jsonb,correction boolean) returns uuid
language plpgsql security definer set search_path=pg_catalog,neuvetra,pg_temp as $$
declare actor uuid:=neuvetra.current_user_id();calculated jsonb;effective jsonb;input_body jsonb;result_body jsonb;body jsonb;normalized_request jsonb;prior record;predecessor record;new_id uuid;seq integer;fingerprint text;input_hash text;result_hash text;captured timestamptz;captured_text text;reason text;
begin
 if actor is null or not neuvetra.can_manage_company(target_company) then raise exception 'workspace not found' using errcode='42501';end if;
 perform id from neuvetra.companies where id=target_company for update;
 if not neuvetra.can_manage_company(target_company) then raise exception 'workspace not found' using errcode='42501';end if;
 if correction is null or jsonb_typeof(request) is distinct from 'object' then raise exception 'invalid annual request' using errcode='22023';end if;
 if (select array_agg(key order by key) from jsonb_object_keys(request) key) is distinct from (case when correction then array['companyLabel','correctionReason','expectedResultSha256','expectedVersionId','facilityLabel','geography','idempotencyKey','months','unit','year'] else array['companyLabel','facilityLabel','geography','idempotencyKey','months','unit','year'] end) then raise exception 'invalid annual request keys' using errcode='22023';end if;
 if exists(select 1 from jsonb_each(request) where key not in('year','months') and jsonb_typeof(value)<>'string') or request->'year' is distinct from '2023'::jsonb or request->>'geography'<>'CAMX' or request->>'unit'<>'kWh' or request->>'idempotencyKey' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'invalid annual context' using errcode='22023';end if;
 if request->>'companyLabel' !~ '^[ -~]{1,100}$' or request->>'companyLabel'<>btrim(request->>'companyLabel') or request->>'facilityLabel' !~ '^[ -~]{1,100}$' or request->>'facilityLabel'<>btrim(request->>'facilityLabel') then raise exception 'invalid annual label' using errcode='22023';end if;
 calculated:=neuvetra.m67_calculate_months(request->'months');
 effective:=jsonb_build_object('companyLabel',request->>'companyLabel','facilityLabel',request->>'facilityLabel','year',2023,'geography','CAMX','unit','kWh','evidenceBasis','synthetic_manual_without_linked_bills','months',(select jsonb_agg(jsonb_build_object('month',value->>'month','quantityKwh',value->'quantityKwh') order by ord) from jsonb_array_elements(calculated->'months') with ordinality t(value,ord)));
 if correction then
  reason:=request->>'correctionReason';
  if reason !~ '^[ -~]+$' or char_length(reason) not between 1 and 500 or reason<>btrim(reason) or request->>'expectedVersionId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or request->>'expectedResultSha256' !~ '^[0-9a-f]{64}$' then raise exception 'invalid annual correction' using errcode='22023';end if;
 end if;
 normalized_request:=(request-'idempotencyKey')||jsonb_build_object('months',effective->'months','year',2023);
 fingerprint:=neuvetra.m67_hash(jsonb_build_object('actor',actor,'operation','save','correction',correction,'request',normalized_request));
 select * into prior from neuvetra.annual_electricity_worksheet_requests where company_id=target_company and idempotency_key=(request->>'idempotencyKey')::uuid;
 if found then
  if prior.kind<>'save' or prior.operation_fingerprint<>fingerprint then raise exception 'annual request conflicts' using errcode='23505';end if;return prior.record_id;
 end if;
 select id into new_id from neuvetra.annual_electricity_worksheet_versions where company_id=target_company and operation_fingerprint=fingerprint;
 if found then insert into neuvetra.annual_electricity_worksheet_requests values(target_company,(request->>'idempotencyKey')::uuid,fingerprint,'save',new_id);return new_id;end if;
 select * into predecessor from neuvetra.annual_electricity_worksheet_versions where company_id=target_company order by version desc limit 1;
 if correction then
  if not found or predecessor.id is distinct from (request->>'expectedVersionId')::uuid or predecessor.result_sha256 is distinct from request->>'expectedResultSha256' then raise exception 'annual correction conflicts' using errcode='23505';end if;
  if jsonb_build_object('companyLabel',predecessor.payload->>'companyLabel','facilityLabel',predecessor.payload->>'facilityLabel','year',2023,'geography','CAMX','unit','kWh','evidenceBasis','synthetic_manual_without_linked_bills','months',(select jsonb_agg(jsonb_build_object('month',value->>'month','quantityKwh',value->'quantityKwh') order by ord) from jsonb_array_elements(predecessor.payload->'months') with ordinality t(value,ord)))=effective then raise exception 'annual correction is a no-op' using errcode='23505';end if;
  seq:=predecessor.version+1;
 else
  if found then raise exception 'annual worksheet already exists' using errcode='23505';end if;seq:=1;
 end if;
 new_id:=gen_random_uuid();captured:=date_trunc('milliseconds',clock_timestamp());captured_text:=to_char(captured at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 input_body:=effective||jsonb_build_object('profile','neuvetra.synthetic.annual-electricity-worksheet.v1','companyId',target_company,'id',new_id,'version',seq,'previousVersionId',predecessor.id,'createdBy',actor,'createdAt',captured_text,'correctionReason',reason);
 input_hash:=neuvetra.m67_hash(input_body);
 result_body:=calculated||jsonb_build_object('inputSha256',input_hash,'method',neuvetra.m67_method(),'limitations',neuvetra.m67_limitations(),'synthetic',true,'complete',false,'releaseEligible',false,'assurance','none');result_hash:=neuvetra.m67_hash(result_body);
 body:=(input_body-'profile'-'companyId')||calculated||jsonb_build_object('inputSha256',input_hash,'resultSha256',result_hash,'method',neuvetra.m67_method());
 insert into neuvetra.annual_electricity_worksheet_versions values(new_id,target_company,seq,predecessor.id,body,input_hash,result_hash,fingerprint,actor,captured);
 insert into neuvetra.annual_electricity_worksheet_requests values(target_company,(request->>'idempotencyKey')::uuid,fingerprint,'save',new_id);
 insert into neuvetra.annual_electricity_worksheet_audit values(gen_random_uuid(),target_company,new_id,'save',result_hash,actor,captured);return new_id;
end $$;
create function neuvetra.review_annual_electricity_worksheet(target_company uuid,request jsonb) returns uuid
language plpgsql security definer set search_path=pg_catalog,neuvetra,pg_temp as $$
declare actor uuid:=neuvetra.current_user_id();v record;prior record;review_id uuid;fingerprint text;digest text;body jsonb;captured timestamptz;captured_text text;
begin
 if actor is null or not neuvetra.can_manage_company(target_company) then raise exception 'workspace not found' using errcode='42501';end if;
 perform id from neuvetra.companies where id=target_company for update;
 if not neuvetra.can_manage_company(target_company) then raise exception 'workspace not found' using errcode='42501';end if;
 if jsonb_typeof(request) is distinct from 'object' then raise exception 'invalid annual review' using errcode='22023';end if;
 if (select array_agg(key order by key) from jsonb_object_keys(request) key) is distinct from array['acknowledgedLimitations','decision','expectedResultSha256','idempotencyKey','note','versionId']::text[] or exists(select 1 from jsonb_each(request) where key not in('note','acknowledgedLimitations') and jsonb_typeof(value)<>'string') then raise exception 'invalid annual review' using errcode='22023';end if;
 if request->>'versionId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or request->>'idempotencyKey' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or request->>'expectedResultSha256' !~ '^[0-9a-f]{64}$' then raise exception 'invalid annual review binding' using errcode='22023';end if;
 if request->>'decision'='accept_bounded_internal_draft' then
  if request->'note' is distinct from 'null'::jsonb or request->'acknowledgedLimitations' is distinct from neuvetra.m67_limitations() then raise exception 'invalid annual acceptance' using errcode='22023';end if;
 elsif request->>'decision'='changes_requested' then
  if jsonb_typeof(request->'note') is distinct from 'string' or request->>'note' !~ '^[ -~]+$' or char_length(request->>'note') not between 1 and 500 or request->>'note'<>btrim(request->>'note') or request->'acknowledgedLimitations' is distinct from '[]'::jsonb then raise exception 'invalid annual change request' using errcode='22023';end if;
 else raise exception 'invalid annual decision' using errcode='22023';end if;
 select * into v from neuvetra.annual_electricity_worksheet_versions where company_id=target_company and id=(request->>'versionId')::uuid;
 if not found or v.result_sha256 is distinct from request->>'expectedResultSha256' or v.created_by=actor then raise exception 'annual review conflicts' using errcode='23505';end if;
 fingerprint:=neuvetra.m67_hash(jsonb_build_object('actor',actor,'operation','review','request',request-'idempotencyKey'));
 select * into prior from neuvetra.annual_electricity_worksheet_requests where company_id=target_company and idempotency_key=(request->>'idempotencyKey')::uuid;
 if found then if prior.kind<>'review' or prior.operation_fingerprint<>fingerprint then raise exception 'annual request conflicts' using errcode='23505';end if;return prior.record_id;end if;
 select id into review_id from neuvetra.annual_electricity_worksheet_reviews where company_id=target_company and operation_fingerprint=fingerprint;
 if found then insert into neuvetra.annual_electricity_worksheet_requests values(target_company,(request->>'idempotencyKey')::uuid,fingerprint,'review',review_id);return review_id;end if;
 if exists(select 1 from neuvetra.annual_electricity_worksheet_versions where company_id=target_company and version>v.version) or exists(select 1 from neuvetra.annual_electricity_worksheet_reviews where company_id=target_company and version_id=v.id) then raise exception 'annual review conflicts' using errcode='23505';end if;
 review_id:=gen_random_uuid();captured:=date_trunc('milliseconds',clock_timestamp());captured_text:=to_char(captured at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 body:=jsonb_build_object('id',review_id,'versionId',v.id,'resultSha256',v.result_sha256,'decision',request->>'decision','note',request->'note','acknowledgedLimitations',request->'acknowledgedLimitations','reviewerId',actor,'reviewedAt',captured_text);
 digest:=neuvetra.m67_hash(body||jsonb_build_object('profile','neuvetra.synthetic.annual-electricity-worksheet.v1','companyId',target_company));body:=body||jsonb_build_object('decisionSha256',digest);
 insert into neuvetra.annual_electricity_worksheet_reviews values(review_id,target_company,v.id,body,digest,fingerprint,actor,captured);
 insert into neuvetra.annual_electricity_worksheet_requests values(target_company,(request->>'idempotencyKey')::uuid,fingerprint,'review',review_id);
 insert into neuvetra.annual_electricity_worksheet_audit values(gen_random_uuid(),target_company,review_id,'review',digest,actor,captured);return review_id;
end $$;
revoke all on function neuvetra.save_annual_electricity_worksheet(uuid,jsonb,boolean),neuvetra.review_annual_electricity_worksheet(uuid,jsonb) from public,authenticated;
do $$ begin if exists(select 1 from pg_roles where rolname='neuvetra_runtime') then
 grant execute on function neuvetra.save_annual_electricity_worksheet(uuid,jsonb,boolean),neuvetra.review_annual_electricity_worksheet(uuid,jsonb),neuvetra.lock_annual_electricity_report_read(uuid) to neuvetra_runtime;
 revoke all on function neuvetra.lock_annual_electricity_report_read(uuid) from authenticated;
end if;end $$;

create table neuvetra.annual_electricity_reports (
 id uuid primary key, company_id uuid not null references neuvetra.companies(id), source_version_id uuid not null,
 source_input_sha256 text not null, source_result_sha256 text not null, review_id uuid, review_sha256 text,
 template_version text not null, template_sha256 text not null, source_snapshot jsonb not null,
 report_bytes bytea not null, report_sha256 text not null, report_byte_length integer not null check(report_byte_length between 1 and 98304),
 operation_fingerprint text not null, created_by uuid not null references auth.users(id), created_at timestamptz not null,
 unique(id,company_id),unique(company_id,operation_fingerprint),
 foreign key(source_version_id,company_id) references neuvetra.annual_electricity_worksheet_versions(id,company_id),
 foreign key(review_id,company_id) references neuvetra.annual_electricity_worksheet_reviews(id,company_id),
 check((review_id is null)=(review_sha256 is null)),
 check(source_input_sha256~'^[0-9a-f]{64}$' and source_result_sha256~'^[0-9a-f]{64}$' and template_sha256~'^[0-9a-f]{64}$' and report_sha256~'^[0-9a-f]{64}$' and operation_fingerprint~'^[0-9a-f]{64}$'),
 check(octet_length(report_bytes)=report_byte_length and encode(sha256(report_bytes),'hex')=report_sha256)
);
create table neuvetra.annual_electricity_report_requests (
 company_id uuid not null, idempotency_key uuid not null, operation_fingerprint text not null, report_id uuid not null,
 requested_by uuid not null references auth.users(id), primary key(company_id,idempotency_key),
 foreign key(report_id,company_id) references neuvetra.annual_electricity_reports(id,company_id)
);
create table neuvetra.annual_electricity_report_audit (
 id uuid primary key, company_id uuid not null, report_id uuid not null, actor_id uuid not null references auth.users(id),
 event_meta jsonb not null, created_at timestamptz not null, unique(company_id,report_id),
 foreign key(report_id,company_id) references neuvetra.annual_electricity_reports(id,company_id)
);
do $$ declare relation text; begin
 foreach relation in array array['annual_electricity_reports','annual_electricity_report_requests','annual_electricity_report_audit'] loop
  execute format('alter table neuvetra.%I enable row level security',relation);
  execute format('alter table neuvetra.%I force row level security',relation);
  execute format('create policy m67_report_member_read on neuvetra.%I for select to authenticated using(neuvetra.is_company_member(company_id))',relation);
  execute format('grant select on neuvetra.%I to authenticated',relation);
  execute format('revoke all on neuvetra.%I from public',relation);
  execute format('create trigger m67_report_immutable before update or delete on neuvetra.%I for each row execute function neuvetra.reject_inventory_history_mutation()',relation);
  if exists(select 1 from pg_roles where rolname='neuvetra_runtime') then
   execute format('create policy m67_report_runtime_read on neuvetra.%I for select to neuvetra_runtime using(neuvetra.is_company_member(company_id))',relation);
   execute format('grant select on neuvetra.%I to neuvetra_runtime',relation);
   execute format('revoke all on neuvetra.%I from authenticated',relation);
  end if;
 end loop;
end $$;
create function neuvetra.annual_electricity_report_template() returns text language sql immutable set search_path=pg_catalog as $function$ select $template$<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Synthetic annual electricity worksheet report — {{companyLabel}}</title>
<style>body{font:16px/1.55 system-ui,sans-serif;color:#182820;max-width:850px;margin:32px auto;padding:0 22px}h1{font-size:1.85rem;line-height:1.2}h2{font-size:1.2rem;margin-top:1.8rem}p,li,dd{overflow-wrap:anywhere}dl{display:grid;grid-template-columns:minmax(110px,1fr) minmax(0,3fr);gap:6px 18px}dt{font-weight:650}dd{margin:0;min-width:0}.notice{border:2px solid #927130;background:#fff8e8;padding:14px}.subtotal{font-size:2rem;font-weight:750;margin-bottom:0}.mono{font:12px/1.55 ui-monospace,monospace;overflow-wrap:anywhere;white-space:pre-wrap}.review-note{white-space:pre-wrap;border-left:3px solid #a1aea5;padding-left:12px}.print-status{display:none}.muted{color:#405248}a{color:#16553b}@media(max-width:500px){body{padding:0 14px}dl{display:block}dd{margin:2px 0 12px}}@page{size:auto;margin:24mm 15mm 22mm;@top-center{content:"Draft · Synthetic · Incomplete company inventory · Unreleased · No assurance";font:700 8pt/1.2 system-ui,sans-serif;color:#182820;vertical-align:middle}@bottom-center{content:"Draft · Synthetic · Incomplete company inventory · Unreleased · No assurance · Page " counter(page);font:700 8pt/1.2 system-ui,sans-serif;color:#182820;vertical-align:middle}}@media print{body{font-size:10pt;margin:0;max-width:none;padding:0}h1{font-size:21pt}h2{break-after:avoid}p,li,dd{orphans:3;widows:3}.notice{background:white}.subtotal{font-size:24pt}.mono{font-size:8pt}dl{display:block}dt{margin-top:7px}dd{margin-left:0}a{color:inherit;text-decoration:none}}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:.8rem}th,td{border:1px solid #a1aea5;padding:5px;text-align:left;vertical-align:top;overflow-wrap:anywhere}thead{display:table-header-group}tr{break-inside:avoid}@media print{table{font-size:8pt}th,td{padding:4px}}
</style></head><body>
<header class="print-status print-header">Draft · Synthetic · Incomplete company inventory · Unreleased · No assurance</header><footer class="print-status print-footer">Draft · Synthetic · Incomplete company inventory · Unreleased · No assurance · Calendar 2023 CAMX, one fictional facility</footer>
<main><p>Neuvetra · Saved worksheet snapshot</p><h1>Synthetic annual electricity worksheet report</h1><div class="notice"><strong>Draft · Synthetic · Incomplete company inventory · Unreleased · No assurance</strong><br>Fictional manual data for private testing. No bill evidence, filing approval or professional assurance.</div>
<h2>{{subtotalLabel}}</h2><p><strong>{{knownMonths}} of 12 months entered</strong>. {{coverageNote}}</p><p>Months not entered: {{missingMonths}}</p><p class="subtotal">{{display}} kg CO2e</p><p>Exact subtotal before display rounding: <strong>{{unrounded}} kg CO2e</strong></p><dl><dt>Fictional company</dt><dd>{{companyLabel}}</dd><dt>Fictional facility</dt><dd>{{facilityLabel}}</dd><dt>Period</dt><dd>January 1–December 31, 2023</dd><dt>Declared geography</dt><dd>United States · California · CAMX</dd><dt>Boundary</dt><dd>Operational control · Location-based Scope 2</dd><dt>Activity</dt><dd>Grid-delivered purchased electricity consumed by the reporting company</dd><dt>Manual quantity</dt><dd>{{quantityKwh}} kWh</dd><dt>Converted quantity</dt><dd>{{quantityMwh}} MWh · 1 MWh = 1,000 kWh</dd><dt>Evidence</dt><dd>Synthetic manual annual entries — no linked bill evidence</dd></dl>
<p>The subtotal is rounded after summing exact monthly values. Displayed monthly amounts may not sum to the displayed subtotal. Display uses four decimal places, half to even, with no intermediate rounding. Decimal precision does not establish measurement certainty.</p>
<h2>Monthly manual entries</h2><p>Not entered means missing input. Explicit zero is an entered manual assertion, not missing data.</p><table><thead><tr><th scope="col">Month</th><th scope="col">Input state</th><th scope="col">kWh</th><th scope="col">MWh</th><th scope="col">Exact kg CO2e</th><th scope="col">Displayed kg CO2e</th></tr></thead><tbody><tr><th scope="row">January 2023</th><td>{{month01State}}</td><td>{{month01QuantityKwh}}</td><td>{{month01QuantityMwh}}</td><td>{{month01Unrounded}}</td><td>{{month01Display}}</td></tr><tr><th scope="row">February 2023</th><td>{{month02State}}</td><td>{{month02QuantityKwh}}</td><td>{{month02QuantityMwh}}</td><td>{{month02Unrounded}}</td><td>{{month02Display}}</td></tr><tr><th scope="row">March 2023</th><td>{{month03State}}</td><td>{{month03QuantityKwh}}</td><td>{{month03QuantityMwh}}</td><td>{{month03Unrounded}}</td><td>{{month03Display}}</td></tr><tr><th scope="row">April 2023</th><td>{{month04State}}</td><td>{{month04QuantityKwh}}</td><td>{{month04QuantityMwh}}</td><td>{{month04Unrounded}}</td><td>{{month04Display}}</td></tr><tr><th scope="row">May 2023</th><td>{{month05State}}</td><td>{{month05QuantityKwh}}</td><td>{{month05QuantityMwh}}</td><td>{{month05Unrounded}}</td><td>{{month05Display}}</td></tr><tr><th scope="row">June 2023</th><td>{{month06State}}</td><td>{{month06QuantityKwh}}</td><td>{{month06QuantityMwh}}</td><td>{{month06Unrounded}}</td><td>{{month06Display}}</td></tr><tr><th scope="row">July 2023</th><td>{{month07State}}</td><td>{{month07QuantityKwh}}</td><td>{{month07QuantityMwh}}</td><td>{{month07Unrounded}}</td><td>{{month07Display}}</td></tr><tr><th scope="row">August 2023</th><td>{{month08State}}</td><td>{{month08QuantityKwh}}</td><td>{{month08QuantityMwh}}</td><td>{{month08Unrounded}}</td><td>{{month08Display}}</td></tr><tr><th scope="row">September 2023</th><td>{{month09State}}</td><td>{{month09QuantityKwh}}</td><td>{{month09QuantityMwh}}</td><td>{{month09Unrounded}}</td><td>{{month09Display}}</td></tr><tr><th scope="row">October 2023</th><td>{{month10State}}</td><td>{{month10QuantityKwh}}</td><td>{{month10QuantityMwh}}</td><td>{{month10Unrounded}}</td><td>{{month10Display}}</td></tr><tr><th scope="row">November 2023</th><td>{{month11State}}</td><td>{{month11QuantityKwh}}</td><td>{{month11QuantityMwh}}</td><td>{{month11Unrounded}}</td><td>{{month11Display}}</td></tr><tr><th scope="row">December 2023</th><td>{{month12State}}</td><td>{{month12QuantityKwh}}</td><td>{{month12QuantityMwh}}</td><td>{{month12Unrounded}}</td><td>{{month12Display}}</td></tr></tbody></table><p>Annual entries are manual and have no linked bill evidence. The separate January bill-linked worksheet does not provide evidence or approval for this annual worksheet.</p>
<h2>Worksheet review captured for this report</h2><p><strong>{{reviewSummary}}</strong></p><p>This is a snapshot of a worksheet decision, not approval of the report presentation, verification of manual inputs or assurance.</p><dl><dt>Reviewed source</dt><dd>Worksheet version {{sourceVersion}} · {{sourceVersionId}}</dd><dt>Result fingerprint</dt><dd class="mono">{{resultSha256}}</dd><dt>Manager reference</dt><dd class="mono">{{reviewerId}}</dd><dt>Decision time (UTC)</dt><dd>{{reviewedAt}}</dd><dt>Decision ID</dt><dd class="mono">{{reviewId}}</dd><dt>Decision fingerprint</dt><dd class="mono">{{reviewSha256}}</dd><dt>Acknowledgments</dt><dd>{{reviewAcknowledgments}}</dd></dl><p class="review-note">{{reviewNote}}</p><p class="muted">Review state was captured at {{createdAt}}. Later worksheet decisions and corrections do not change this report.</p>
<h2>Source and correction history</h2><dl><dt>Worksheet version</dt><dd>{{sourceVersion}} · {{sourceVersionId}}</dd><dt>Saved (UTC)</dt><dd>{{sourceCreatedAt}}</dd><dt>Source creator</dt><dd class="mono">{{sourceCreatedBy}}</dd><dt>Predecessor</dt><dd class="mono">{{previousVersionId}}</dd><dt>Correction reason</dt><dd>{{correctionReason}}</dd><dt>Tenant binding</dt><dd class="mono">{{companyId}}</dd><dt>Input fingerprint</dt><dd class="mono">{{inputSha256}}</dd><dt>Result fingerprint</dt><dd class="mono">{{resultSha256}}</dd></dl>
<h2>Pinned method and source</h2><p>The same annual 2023 CAMX regional average factor is applied to each entered month. It is not a month-specific factor. Missing months are not filled, estimated, prorated or annualized. Full electricity month coverage does not establish a complete company inventory.</p><dl><dt>Method</dt><dd>{{methodId}} · {{methodVersion}}</dd><dt>Candidate factor</dt><dd>{{factorId}} · {{factorVersion}}</dd><dt>Rate</dt><dd>{{factorValue}} kg CO2e/MWh</dd><dt>Workbook locator</dt><dd>EPA eGRID2023 metric workbook, revision 2 · SRL23!AI6 · annual total-output CO2e rate; A6=2023, B6=CAMX, C6=WECC California</dd><dt>Workbook fingerprint</dt><dd class="mono">{{sourceSha256}}</dd><dt>Candidate fingerprint</dt><dd class="mono">{{factorCandidateSha256}}</dd><dt>GWP policy</dt><dd>AR5 · 100 years · without climate-carbon feedbacks; CO2 1, CH4 28, N2O 265</dd><dt>GWP fingerprint</dt><dd class="mono">{{gwpPolicySha256}}</dd><dt>Reviewed engine fingerprint</dt><dd class="mono">{{reviewedEngineSha256}}</dd></dl><p><a href="https://www.epa.gov/system/files/documents/2025-06/egrid2023_data_metric_rev2.xlsx" rel="noreferrer">EPA source workbook</a> · <a href="https://www.epa.gov/system/files/documents/2025-01/egrid2023_technical_guide.pdf" rel="noreferrer">EPA technical guide, page 12, section 3.1.1.2 / Table 3-1</a></p><p>The existing reviewed candidate decimal normalization is retained. No factor or method is released by this report.</p>
<h2>Incomplete coverage and limitations</h2><ul><li>Annual entries are manual and have no linked bill evidence. The separate January bill-linked worksheet does not provide evidence or approval for this annual worksheet.</li><li>The overall company inventory is incomplete. Missing months are not zero consumption. Other facilities and sources are not assessed.</li><li>This worksheet covers calendar 2023 CAMX electricity for one fictional facility only. Twelve entered months establish electricity period coverage only.</li><li>Market-based Scope 2 is not included.</li><li>The factor and method are unreleased development candidates.</li><li>Scope 1 and Scope 3 are not assessed.</li><li>No assurance, verification, certification or filing approval is provided. Release eligibility remains false.</li></ul>
<h2>Report identity</h2><dl><dt>Report ID</dt><dd class="mono">{{reportId}}</dd><dt>Captured (UTC)</dt><dd>{{createdAt}}</dd><dt>Report creator</dt><dd class="mono">{{createdBy}}</dd><dt>Report profile</dt><dd>{{profile}}</dd><dt>Template version</dt><dd>{{templateVersion}}</dd><dt>Template fingerprint</dt><dd class="mono">{{templateSha256}}</dd><dt>Snapshot identity fingerprint</dt><dd class="mono">{{identitySha256}}</dd></dl><p class="muted">The snapshot identity fingerprint binds the company, worksheet input/result, captured review and template. The authenticated application receipt records the SHA-256 of all UTF-8 HTML bytes; this document does not embed its own byte hash. Browser print/PDF layout and bytes may vary and are not covered by the HTML hash. This report identifies its saved source version and does not claim that it remains the latest worksheet.</p>
</main></body></html>
$template$::text $function$;
revoke all on function neuvetra.annual_electricity_report_template() from public,authenticated;

create function neuvetra.render_annual_electricity_report(report_id uuid,company uuid,creator uuid,captured text,source jsonb,identity_sha text) returns bytea
language plpgsql immutable set search_path=pg_catalog,neuvetra,pg_temp as $$
declare result text:=neuvetra.annual_electricity_report_template(); values_map jsonb; item record; escaped text; r jsonb:=source->'review'; m jsonb:=source->'method'; month_row jsonb; month_index integer:=0; month_prefix text;
begin
 values_map:=jsonb_build_object(
 'subtotalLabel',case when (source#>>'{coverage,electricityComplete}')::boolean then 'Full-year electricity subtotal — all 12 months entered' else 'Entered-month electricity subtotal' end,
 'knownMonths',source#>>'{coverage,knownMonths}','coverageNote',case when (source#>>'{coverage,electricityComplete}')::boolean then 'Full electricity period coverage for this fictional facility; the overall company inventory remains incomplete.' else 'This subtotal excludes months not entered.' end,
 'missingMonths',coalesce((select string_agg(value,', ' order by ord) from jsonb_array_elements_text(source#>'{coverage,missingMonths}') with ordinality t(value,ord)),'None — all 12 months entered'))||jsonb_build_object(
 'companyLabel',source->>'companyLabel','facilityLabel',source->>'facilityLabel','display',source#>>'{total,display}','unrounded',source#>>'{total,unrounded}','quantityKwh',source->>'quantityKwh','quantityMwh',source->>'quantityMwh',
 'reviewSummary',case when r='null'::jsonb then 'No worksheet review was recorded when this report was created.' when r->>'decision'='accept_bounded_internal_draft' then 'The worksheet version was accepted for bounded internal use.' else 'A manager requested changes to this worksheet version.' end,
 'sourceVersion',source->>'version','sourceVersionId',source->>'id','resultSha256',source->>'resultSha256','reviewerId',coalesce(r->>'reviewerId','Not recorded at capture'),'reviewedAt',coalesce(r->>'reviewedAt','Not recorded at capture'),'reviewId',coalesce(r->>'id','None at capture'),'reviewSha256',coalesce(r->>'decisionSha256','None at capture'),
 'reviewAcknowledgments',coalesce((select string_agg(value,', ' order by ord) from jsonb_array_elements_text(case when r='null'::jsonb then '[]'::jsonb else r->'acknowledgedLimitations' end) with ordinality a(value,ord)),'No acceptance acknowledgments'),
 'reviewNote',coalesce(r->>'note','No change-request note at capture'),'createdAt',captured,'sourceCreatedAt',source->>'createdAt','sourceCreatedBy',source->>'createdBy','previousVersionId',coalesce(source->>'previousVersionId','None — initial saved version'),'correctionReason',coalesce(source->>'correctionReason','Initial saved version — no correction'),'companyId',company::text,'inputSha256',source->>'inputSha256',
 'methodId',m->>'id','methodVersion',m->>'version','factorId',m->>'factorId','factorVersion',m->>'factorVersion','factorValue',m->>'factorValue','sourceSha256',m->>'sourceSha256','factorCandidateSha256',m->>'factorCandidateSha256','gwpPolicySha256',m->>'gwpPolicySha256','reviewedEngineSha256',m->>'reviewedEngineSha256',
 'reportId',report_id::text,'createdBy',creator::text,'profile','neuvetra.synthetic.annual-electricity-report.v1','templateVersion','m67-calendar-2023-camx-report-v1','templateSha256',encode(sha256(convert_to(neuvetra.annual_electricity_report_template(),'utf8')),'hex'),'identitySha256',identity_sha);
 for month_row in select value from jsonb_array_elements(source->'months') loop
  month_index:=month_index+1;month_prefix:='month'||lpad(month_index::text,2,'0');
  values_map:=values_map||jsonb_build_object(month_prefix||'State',case when month_row->'quantityKwh'='null'::jsonb then 'Not entered' when month_row->>'quantityKwh'='0.000' then 'Entered zero' else 'Entered' end,month_prefix||'QuantityKwh',coalesce(month_row->>'quantityKwh','Not entered'),month_prefix||'QuantityMwh',coalesce(month_row->>'quantityMwh','Not entered'),month_prefix||'Unrounded',coalesce(month_row#>>'{total,unrounded}','Not entered'),month_prefix||'Display',coalesce(month_row#>>'{total,display}','Not entered'));
 end loop;
 for item in select key,value from jsonb_each_text(values_map) loop
  if item.value is null then raise exception 'report source is invalid' using errcode='22023';end if;
  escaped:=replace(replace(replace(replace(replace(replace(replace(item.value,'&','&amp;'),'<','&lt;'),'>','&gt;'),'"','&quot;'),'''','&#39;'),'{','&#123;'),'}','&#125;');
  result:=replace(result,'{{'||item.key||'}}',escaped);
 end loop;
 if result ~ '\{\{[a-zA-Z0-9]+\}\}' then raise exception 'unresolved report template';end if;
 return convert_to(result,'utf8');
end $$;
revoke all on function neuvetra.render_annual_electricity_report(uuid,uuid,uuid,text,jsonb,text) from public,authenticated;

create function neuvetra.create_annual_electricity_report(target_company uuid,request jsonb) returns uuid
language plpgsql security definer set search_path=pg_catalog,neuvetra,pg_temp as $$
declare actor uuid:=neuvetra.current_user_id(); v record; r record; prior record; source jsonb; report_id uuid; fingerprint text;
 template_sha text:=encode(sha256(convert_to(neuvetra.annual_electricity_report_template(),'utf8')),'hex'); captured timestamptz; captured_text text; content bytea; content_sha text; meta jsonb;
begin
 if actor is null or not neuvetra.can_manage_company(target_company) then raise exception 'workspace not found' using errcode='42501';end if;
 perform id from neuvetra.companies where id=target_company for update;
 if not neuvetra.can_manage_company(target_company) then raise exception 'workspace not found' using errcode='42501';end if;
 if jsonb_typeof(request) is distinct from 'object' or (select array_agg(key order by key) from jsonb_object_keys(request) key) is distinct from array['expectedInputSha256','expectedResultSha256','expectedReviewId','expectedReviewSha256','idempotencyKey','sourceVersionId']::text[] then raise exception 'invalid report request' using errcode='22023';end if;
 if exists(select 1 from jsonb_each(request) where key not in('expectedReviewId','expectedReviewSha256') and jsonb_typeof(value)<>'string') or request->>'sourceVersionId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or request->>'idempotencyKey' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or request->>'expectedInputSha256' !~ '^[0-9a-f]{64}$' or request->>'expectedResultSha256' !~ '^[0-9a-f]{64}$' then raise exception 'invalid report request' using errcode='22023';end if;
 if not ((request->'expectedReviewId'='null'::jsonb and request->'expectedReviewSha256'='null'::jsonb) or (jsonb_typeof(request->'expectedReviewId')='string' and jsonb_typeof(request->'expectedReviewSha256')='string' and request->>'expectedReviewId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and request->>'expectedReviewSha256' ~ '^[0-9a-f]{64}$')) then raise exception 'invalid review binding' using errcode='22023';end if;
 select * into v from neuvetra.annual_electricity_worksheet_versions where company_id=target_company and id=(request->>'sourceVersionId')::uuid;
 if not found or v.input_sha256 is distinct from request->>'expectedInputSha256' or v.result_sha256 is distinct from request->>'expectedResultSha256' then raise exception 'report source conflicts' using errcode='23505';end if;
 fingerprint:=neuvetra.m67_hash(jsonb_build_object('profile','neuvetra.synthetic.annual-electricity-report.v1','companyId',target_company,'sourceVersionId',v.id,'inputSha256',v.input_sha256,'resultSha256',v.result_sha256,'reviewId',request->'expectedReviewId','reviewSha256',request->'expectedReviewSha256','templateVersion','m67-calendar-2023-camx-report-v1','templateSha256',template_sha));
 select * into prior from neuvetra.annual_electricity_report_requests where company_id=target_company and idempotency_key=(request->>'idempotencyKey')::uuid;
 if found then
  if prior.operation_fingerprint<>fingerprint then raise exception 'report request conflicts' using errcode='23505';end if;
  return prior.report_id;
 end if;
 select id into report_id from neuvetra.annual_electricity_reports where company_id=target_company and operation_fingerprint=fingerprint;
 if found then
  insert into neuvetra.annual_electricity_report_requests values(target_company,(request->>'idempotencyKey')::uuid,fingerprint,report_id,actor);
  return report_id;
 end if;
 select * into r from neuvetra.annual_electricity_worksheet_reviews where company_id=target_company and version_id=v.id;
 if r.id is distinct from (request->>'expectedReviewId')::uuid or r.decision_sha256 is distinct from request->>'expectedReviewSha256' then raise exception 'report review snapshot changed' using errcode='23505';end if;
 source:=v.payload||jsonb_build_object('createdAt',to_char(v.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'review',case when r.id is null then 'null'::jsonb else r.payload||jsonb_build_object('reviewedAt',to_char(r.reviewed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) end);
 report_id:=gen_random_uuid();captured:=date_trunc('milliseconds',clock_timestamp());captured_text:=to_char(captured at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 content:=neuvetra.render_annual_electricity_report(report_id,target_company,actor,captured_text,source,fingerprint);
 content_sha:=encode(sha256(content),'hex');
 insert into neuvetra.annual_electricity_reports values(report_id,target_company,v.id,v.input_sha256,v.result_sha256,r.id,r.decision_sha256,'m67-calendar-2023-camx-report-v1',template_sha,source,content,content_sha,octet_length(content),fingerprint,actor,captured);
 insert into neuvetra.annual_electricity_report_requests values(target_company,(request->>'idempotencyKey')::uuid,fingerprint,report_id,actor);
 meta:=jsonb_build_object('profile','neuvetra.synthetic.annual-electricity-report.v1','reportId',report_id,'sourceVersionId',v.id,'inputSha256',v.input_sha256,'resultSha256',v.result_sha256,'reviewId',r.id,'reviewSha256',r.decision_sha256,'templateVersion','m67-calendar-2023-camx-report-v1','templateSha256',template_sha,'reportSha256',content_sha,'reportByteLength',octet_length(content),'identitySha256',fingerprint);
 insert into neuvetra.annual_electricity_report_audit values(gen_random_uuid(),target_company,report_id,actor,meta,captured);
 return report_id;
end $$;
revoke all on function neuvetra.create_annual_electricity_report(uuid,jsonb) from public,authenticated;
do $$ begin
 if exists(select 1 from pg_roles where rolname='neuvetra_runtime') then
  grant execute on function neuvetra.lock_annual_electricity_report_read(uuid),neuvetra.create_annual_electricity_report(uuid,jsonb) to neuvetra_runtime;
  revoke all on function neuvetra.lock_annual_electricity_report_read(uuid) from authenticated;
 end if;
end $$;

