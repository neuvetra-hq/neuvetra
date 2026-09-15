-- Additive M68 evidence overlay; retains all M66/M67 source and annual records.
create table neuvetra.annual_electricity_evidence_versions (
 id uuid primary key, company_id uuid not null references neuvetra.companies(id), version integer not null check(version>0),
 previous_version_id uuid, payload jsonb not null, input_sha256 text not null, result_sha256 text not null,
 operation_fingerprint text not null, created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 unique(id,company_id), unique(company_id,version), unique(company_id,operation_fingerprint),
 foreign key(previous_version_id,company_id) references neuvetra.annual_electricity_evidence_versions(id,company_id),
 check(input_sha256~'^[0-9a-f]{64}$' and result_sha256~'^[0-9a-f]{64}$' and operation_fingerprint~'^[0-9a-f]{64}$')
);
create table neuvetra.annual_electricity_evidence_reviews (
 id uuid primary key, company_id uuid not null, version_id uuid not null, payload jsonb not null,
 decision_sha256 text not null check(decision_sha256~'^[0-9a-f]{64}$'), operation_fingerprint text not null,
 reviewed_by uuid not null references auth.users(id), reviewed_at timestamptz not null default now(),
 unique(id,company_id), unique(company_id,version_id), unique(company_id,operation_fingerprint),
 foreign key(version_id,company_id) references neuvetra.annual_electricity_evidence_versions(id,company_id)
);
create table neuvetra.annual_electricity_evidence_requests (
 company_id uuid not null references neuvetra.companies(id), idempotency_key uuid not null, operation_fingerprint text not null,
 kind text not null check(kind in('save','review')), record_id uuid not null, primary key(company_id,idempotency_key)
);
create table neuvetra.annual_electricity_evidence_audit (
 id uuid primary key, company_id uuid not null references neuvetra.companies(id), record_id uuid not null,
 kind text not null check(kind in('save','review')), record_sha256 text not null, actor_id uuid not null references auth.users(id),
 created_at timestamptz not null default now(), unique(company_id,kind,record_id)
);
do $$ declare relation text; begin
 foreach relation in array array['annual_electricity_evidence_versions','annual_electricity_evidence_reviews','annual_electricity_evidence_requests','annual_electricity_evidence_audit'] loop
  execute format('alter table neuvetra.%I enable row level security',relation);
  execute format('alter table neuvetra.%I force row level security',relation);
  execute format('create policy m68_member_read on neuvetra.%I for select to authenticated using(neuvetra.is_company_member(company_id))',relation);
  execute format('grant select on neuvetra.%I to authenticated',relation);
  execute format('revoke all on neuvetra.%I from public',relation);
  execute format('create trigger m68_immutable before update or delete on neuvetra.%I for each row execute function neuvetra.reject_inventory_history_mutation()',relation);
  if exists(select 1 from pg_roles where rolname='neuvetra_runtime') then
   execute format('create policy m68_runtime_read on neuvetra.%I for select to neuvetra_runtime using(neuvetra.is_company_member(company_id))',relation);
   execute format('grant select on neuvetra.%I to neuvetra_runtime',relation);
   execute format('revoke all on neuvetra.%I from authenticated',relation);
  end if;
 end loop;
end $$;


create function neuvetra.m68_limitations() returns jsonb language sql immutable as $$ select '["synthetic_manual_confirmation","document_attachment_not_verification","only_january_2023_bill_fixtures_supported","overlapping_documents_not_summed","overall_inventory_incomplete","calendar_2023_camx_single_facility_only","missing_months_not_zero","market_based_scope2_not_included","factor_and_method_not_released","scope_1_and_scope_3_not_assessed","no_assurance"]'::jsonb $$;
revoke all on function neuvetra.m68_limitations() from public,authenticated;
create function neuvetra.lock_annual_evidence_report_read(target_company uuid) returns boolean
language plpgsql security definer set search_path=pg_catalog,neuvetra,pg_temp as $$ begin
 if not neuvetra.is_company_member(target_company) then return false;end if;
 perform id from neuvetra.companies where id=target_company for share;
 return found and neuvetra.is_company_member(target_company);
end $$;
revoke all on function neuvetra.lock_annual_evidence_report_read(uuid) from public;
grant execute on function neuvetra.lock_annual_evidence_report_read(uuid) to authenticated;
create function neuvetra.m68_effective(payload jsonb) returns jsonb language sql immutable set search_path=pg_catalog,neuvetra,pg_temp as $$
 select jsonb_build_object('annualVersionId',payload#>>'{annual,id}','expectedAnnualInputSha256',payload#>>'{annual,inputSha256}','expectedAnnualResultSha256',payload#>>'{annual,resultSha256}','links',coalesce((select jsonb_agg(jsonb_build_object('month',value->>'month','sourceId',value#>>'{source,id}','expectedSourceSha256',value#>>'{source,sha256}','sourcePage',1,'manualConfirmation',true,'quantityDifferenceReason',value->'quantityDifferenceReason') order by value#>>'{source,id}') from jsonb_array_elements(payload->'links')),'[]'::jsonb))
$$;
revoke all on function neuvetra.m68_effective(jsonb) from public,authenticated;
create function neuvetra.save_annual_electricity_evidence(target_company uuid,request jsonb,correction boolean) returns uuid
language plpgsql security definer set search_path=pg_catalog,neuvetra,pg_temp as $$
declare actor uuid:=neuvetra.current_user_id();effective jsonb;input_body jsonb;result_body jsonb;body jsonb;normalized_request jsonb;prior record;predecessor record;annual_row record;source_row record;new_id uuid;seq integer;fingerprint text;input_hash text;result_hash text;captured timestamptz;captured_text text;reason text;link jsonb;links jsonb:='[]'::jsonb;source jsonb;annual jsonb;coverage jsonb;ids text[]:='{}';hashes text[]:='{}';differs boolean:=false;manual text;link_count integer;
begin
 if actor is null or not neuvetra.can_manage_company(target_company) then raise exception 'workspace not found' using errcode='42501';end if;
 perform id from neuvetra.companies where id=target_company for update;
 if not neuvetra.can_manage_company(target_company) then raise exception 'workspace not found' using errcode='42501';end if;
 if correction is null or jsonb_typeof(request) is distinct from 'object' then raise exception 'invalid evidence request' using errcode='22023';end if;
 if (select array_agg(key order by key) from jsonb_object_keys(request) key) is distinct from (case when correction then array['annualVersionId','correctionReason','expectedAnnualInputSha256','expectedAnnualResultSha256','expectedResultSha256','expectedVersionId','idempotencyKey','links'] else array['annualVersionId','expectedAnnualInputSha256','expectedAnnualResultSha256','idempotencyKey','links'] end) then raise exception 'invalid evidence request keys' using errcode='22023';end if;
 if exists(select 1 from jsonb_each(request) where key<>'links' and jsonb_typeof(value)<>'string') or request->>'annualVersionId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or request->>'idempotencyKey' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or request->>'expectedAnnualInputSha256' !~ '^[0-9a-f]{64}$' or request->>'expectedAnnualResultSha256' !~ '^[0-9a-f]{64}$' or jsonb_typeof(request->'links') is distinct from 'array' then raise exception 'invalid evidence binding' using errcode='22023';end if;
 if jsonb_array_length(request->'links')>2 then raise exception 'too many source links' using errcode='22023';end if;
 select * into annual_row from neuvetra.annual_electricity_worksheet_versions where company_id=target_company and id=(request->>'annualVersionId')::uuid;
 if not found or annual_row.input_sha256 is distinct from request->>'expectedAnnualInputSha256' or annual_row.result_sha256 is distinct from request->>'expectedAnnualResultSha256' then raise exception 'annual version unavailable or changed' using errcode='23505';end if;
 annual:=annual_row.payload||jsonb_build_object('review',null);manual:=annual#>>'{months,0,quantityKwh}';
 captured:=date_trunc('milliseconds',clock_timestamp());captured_text:=to_char(captured at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 for link in select value from jsonb_array_elements(request->'links') order by value->>'sourceId' loop
  if jsonb_typeof(link) is distinct from 'object' or (select array_agg(key order by key) from jsonb_object_keys(link) key) is distinct from array['expectedSourceSha256','manualConfirmation','month','quantityDifferenceReason','sourceId','sourcePage'] then raise exception 'invalid evidence link' using errcode='22023';end if;
  if link->'month' is distinct from '"2023-01"'::jsonb or link->'sourcePage' is distinct from '1'::jsonb or link->'manualConfirmation' is distinct from 'true'::jsonb or jsonb_typeof(link->'sourceId') is distinct from 'string' or link->>'sourceId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or jsonb_typeof(link->'expectedSourceSha256') is distinct from 'string' or link->>'expectedSourceSha256' !~ '^[0-9a-f]{64}$' or manual is null then raise exception 'only entered January can receive supported bills' using errcode='22023';end if;
  if link->>'sourceId'=any(ids) or link->>'expectedSourceSha256'=any(hashes) then raise exception 'duplicate bill source or bytes' using errcode='22023';end if;
  ids:=array_append(ids,link->>'sourceId');hashes:=array_append(hashes,link->>'expectedSourceSha256');
  select * into source_row from neuvetra.electricity_sources where company_id=target_company and id=(link->>'sourceId')::uuid;
  if not found or source_row.sha256 is distinct from link->>'expectedSourceSha256' then raise exception 'source unavailable' using errcode='22023';end if;
  -- Full allowlist/retained-byte closure is also checked by the reader in this transaction.
  if source_row.sha256 not in('0a97cd0976c03af0776214fc19bdc3d4f0c00e9c835f3e116574a6f375c8e135','83e000a95f9e2f95473dc2cba18be0fc36810b24b9288f59b5aceb3a5ec0430f') or encode(sha256(source_row.original_bytes),'hex')<>source_row.sha256 or octet_length(source_row.original_bytes)<>source_row.byte_length then raise exception 'unsupported source bytes' using errcode='22023';end if;
  if manual=source_row.printed_quantity_kwh then
   if link->'quantityDifferenceReason' is distinct from 'null'::jsonb then raise exception 'matching quantity requires null discrepancy reason' using errcode='22023';end if;
  else
   if jsonb_typeof(link->'quantityDifferenceReason') is distinct from 'string' or link->>'quantityDifferenceReason' !~ '^[ -~]+$' or char_length(link->>'quantityDifferenceReason') not between 1 and 500 or link->>'quantityDifferenceReason'<>btrim(link->>'quantityDifferenceReason') then raise exception 'discrepancy explanation required' using errcode='22023';end if;differs:=true;
  end if;
  source:=jsonb_build_object('id',source_row.id,'companyId',target_company,'fixtureId',source_row.fixture_id,'originalName',source_row.original_name,'mediaType',source_row.media_type,'byteLength',source_row.byte_length,'sha256',source_row.sha256,'printedQuantityKwh',source_row.printed_quantity_kwh,'uploadedBy',source_row.uploaded_by,'uploadedAt',to_char(source_row.uploaded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
  links:=links||jsonb_build_array(jsonb_build_object('month','2023-01','source',source,'page',1,'periodStart','2023-01-01','periodEnd','2023-01-31','confirmedBy',actor,'confirmedAt',captured_text,'quantityDifferenceReason',link->'quantityDifferenceReason'));
 end loop;
 effective:=neuvetra.m68_effective(jsonb_build_object('annual',annual,'links',links));
 if correction then
  reason:=request->>'correctionReason';
  if reason !~ '^[ -~]+$' or char_length(reason) not between 1 and 500 or reason<>btrim(reason) or request->>'expectedVersionId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or request->>'expectedResultSha256' !~ '^[0-9a-f]{64}$' then raise exception 'invalid evidence correction' using errcode='22023';end if;
 end if;
 normalized_request:=(request-'idempotencyKey')||effective;
 fingerprint:=neuvetra.m67_hash(jsonb_build_object('actor',actor,'operation','save','correction',correction,'request',normalized_request));
 select * into prior from neuvetra.annual_electricity_evidence_requests where company_id=target_company and idempotency_key=(request->>'idempotencyKey')::uuid;
 if found then if prior.kind<>'save' or prior.operation_fingerprint<>fingerprint then raise exception 'evidence request conflicts' using errcode='23505';end if;return prior.record_id;end if;
 select id into new_id from neuvetra.annual_electricity_evidence_versions where company_id=target_company and operation_fingerprint=fingerprint;
 if found then insert into neuvetra.annual_electricity_evidence_requests values(target_company,(request->>'idempotencyKey')::uuid,fingerprint,'save',new_id);return new_id;end if;
 select * into predecessor from neuvetra.annual_electricity_evidence_versions where company_id=target_company order by version desc limit 1;
 if correction then
  if not found or predecessor.id is distinct from (request->>'expectedVersionId')::uuid or predecessor.result_sha256 is distinct from request->>'expectedResultSha256' then raise exception 'evidence correction conflicts' using errcode='23505';end if;
  if neuvetra.m68_effective(predecessor.payload)=effective then raise exception 'evidence correction is a no-op' using errcode='23505';end if;seq:=predecessor.version+1;
 else if found then raise exception 'evidence already exists' using errcode='23505';end if;seq:=1;end if;
 link_count:=jsonb_array_length(links);
 coverage:=jsonb_build_object('enteredMonths',annual#>'{coverage,knownMonths}','missingInputMonths',annual#>'{coverage,missingMonths}','linkedDocumentMonths',case when link_count>0 then 1 else 0 end,'unambiguousDocumentMonths',case when link_count=1 then 1 else 0 end,'missingDocumentMonths',(select jsonb_agg('2023-'||lpad(n::text,2,'0') order by n) from generate_series(case when link_count=0 then 1 else 2 end,12) n),'overlappingDocumentMonths',case when link_count>1 then '["2023-01"]'::jsonb else '[]'::jsonb end,'quantityDifferenceMonths',case when differs then '["2023-01"]'::jsonb else '[]'::jsonb end);
 new_id:=gen_random_uuid();
 input_body:=effective||jsonb_build_object('profile','neuvetra.synthetic.annual-electricity-evidence.v1','companyId',target_company,'id',new_id,'version',seq,'previousVersionId',predecessor.id,'createdBy',actor,'createdAt',captured_text,'correctionReason',reason);input_hash:=neuvetra.m67_hash(input_body);
 result_body:=jsonb_build_object('inputSha256',input_hash,'annual',annual,'links',links,'coverage',coverage,'limitations',neuvetra.m68_limitations(),'synthetic',true,'complete',false,'releaseEligible',false,'assurance','none');result_hash:=neuvetra.m67_hash(result_body);
 body:=(input_body-'profile'-'companyId'-'annualVersionId'-'expectedAnnualInputSha256'-'expectedAnnualResultSha256')||jsonb_build_object('annual',annual,'links',links,'coverage',coverage,'inputSha256',input_hash,'resultSha256',result_hash);
 insert into neuvetra.annual_electricity_evidence_versions values(new_id,target_company,seq,predecessor.id,body,input_hash,result_hash,fingerprint,actor,captured);
 insert into neuvetra.annual_electricity_evidence_requests values(target_company,(request->>'idempotencyKey')::uuid,fingerprint,'save',new_id);
 insert into neuvetra.annual_electricity_evidence_audit values(gen_random_uuid(),target_company,new_id,'save',result_hash,actor,captured);return new_id;
end $$;
create function neuvetra.review_annual_electricity_evidence(target_company uuid,request jsonb) returns uuid
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
  if request->'note' is distinct from 'null'::jsonb or request->'acknowledgedLimitations' is distinct from neuvetra.m68_limitations() then raise exception 'invalid annual acceptance' using errcode='22023';end if;
 elsif request->>'decision'='changes_requested' then
  if jsonb_typeof(request->'note') is distinct from 'string' or request->>'note' !~ '^[ -~]+$' or char_length(request->>'note') not between 1 and 500 or request->>'note'<>btrim(request->>'note') or request->'acknowledgedLimitations' is distinct from '[]'::jsonb then raise exception 'invalid annual change request' using errcode='22023';end if;
 else raise exception 'invalid annual decision' using errcode='22023';end if;
 select * into v from neuvetra.annual_electricity_evidence_versions where company_id=target_company and id=(request->>'versionId')::uuid;
 if not found or v.result_sha256 is distinct from request->>'expectedResultSha256' or v.created_by=actor then raise exception 'annual review conflicts' using errcode='23505';end if;
 fingerprint:=neuvetra.m67_hash(jsonb_build_object('actor',actor,'operation','review','request',request-'idempotencyKey'));
 select * into prior from neuvetra.annual_electricity_evidence_requests where company_id=target_company and idempotency_key=(request->>'idempotencyKey')::uuid;
 if found then if prior.kind<>'review' or prior.operation_fingerprint<>fingerprint then raise exception 'annual request conflicts' using errcode='23505';end if;return prior.record_id;end if;
 select id into review_id from neuvetra.annual_electricity_evidence_reviews where company_id=target_company and operation_fingerprint=fingerprint;
 if found then insert into neuvetra.annual_electricity_evidence_requests values(target_company,(request->>'idempotencyKey')::uuid,fingerprint,'review',review_id);return review_id;end if;
 if exists(select 1 from neuvetra.annual_electricity_evidence_versions where company_id=target_company and version>v.version) or exists(select 1 from neuvetra.annual_electricity_evidence_reviews where company_id=target_company and version_id=v.id) then raise exception 'annual review conflicts' using errcode='23505';end if;
 review_id:=gen_random_uuid();captured:=date_trunc('milliseconds',clock_timestamp());captured_text:=to_char(captured at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 body:=jsonb_build_object('id',review_id,'versionId',v.id,'resultSha256',v.result_sha256,'decision',request->>'decision','note',request->'note','acknowledgedLimitations',request->'acknowledgedLimitations','reviewerId',actor,'reviewedAt',captured_text);
 digest:=neuvetra.m67_hash(body||jsonb_build_object('profile','neuvetra.synthetic.annual-electricity-evidence.v1','companyId',target_company));body:=body||jsonb_build_object('decisionSha256',digest);
 insert into neuvetra.annual_electricity_evidence_reviews values(review_id,target_company,v.id,body,digest,fingerprint,actor,captured);
 insert into neuvetra.annual_electricity_evidence_requests values(target_company,(request->>'idempotencyKey')::uuid,fingerprint,'review',review_id);
 insert into neuvetra.annual_electricity_evidence_audit values(gen_random_uuid(),target_company,review_id,'review',digest,actor,captured);return review_id;
end $$;
revoke all on function neuvetra.save_annual_electricity_evidence(uuid,jsonb,boolean),neuvetra.review_annual_electricity_evidence(uuid,jsonb) from public,authenticated;
do $$ begin if exists(select 1 from pg_roles where rolname='neuvetra_runtime') then
 grant execute on function neuvetra.save_annual_electricity_evidence(uuid,jsonb,boolean),neuvetra.review_annual_electricity_evidence(uuid,jsonb),neuvetra.lock_annual_evidence_report_read(uuid) to neuvetra_runtime;
 revoke all on function neuvetra.lock_annual_evidence_report_read(uuid) from authenticated;
end if;end $$;

create table neuvetra.annual_evidence_reports (
 id uuid primary key, company_id uuid not null references neuvetra.companies(id), source_version_id uuid not null,
 source_input_sha256 text not null, source_result_sha256 text not null, review_id uuid, review_sha256 text,
 template_version text not null, template_sha256 text not null, source_snapshot jsonb not null,
 report_bytes bytea not null, report_sha256 text not null, report_byte_length integer not null check(report_byte_length between 1 and 98304),
 operation_fingerprint text not null, created_by uuid not null references auth.users(id), created_at timestamptz not null,
 unique(id,company_id),unique(company_id,operation_fingerprint),
 foreign key(source_version_id,company_id) references neuvetra.annual_electricity_evidence_versions(id,company_id),
 foreign key(review_id,company_id) references neuvetra.annual_electricity_evidence_reviews(id,company_id),
 check((review_id is null)=(review_sha256 is null)),
 check(source_input_sha256~'^[0-9a-f]{64}$' and source_result_sha256~'^[0-9a-f]{64}$' and template_sha256~'^[0-9a-f]{64}$' and report_sha256~'^[0-9a-f]{64}$' and operation_fingerprint~'^[0-9a-f]{64}$'),
 check(octet_length(report_bytes)=report_byte_length and encode(sha256(report_bytes),'hex')=report_sha256)
);
create table neuvetra.annual_evidence_report_requests (
 company_id uuid not null, idempotency_key uuid not null, operation_fingerprint text not null, report_id uuid not null,
 requested_by uuid not null references auth.users(id), primary key(company_id,idempotency_key),
 foreign key(report_id,company_id) references neuvetra.annual_evidence_reports(id,company_id)
);
create table neuvetra.annual_evidence_report_audit (
 id uuid primary key, company_id uuid not null, report_id uuid not null, actor_id uuid not null references auth.users(id),
 event_meta jsonb not null, created_at timestamptz not null, unique(company_id,report_id),
 foreign key(report_id,company_id) references neuvetra.annual_evidence_reports(id,company_id)
);
do $$ declare relation text; begin
 foreach relation in array array['annual_evidence_reports','annual_evidence_report_requests','annual_evidence_report_audit'] loop
  execute format('alter table neuvetra.%I enable row level security',relation);
  execute format('alter table neuvetra.%I force row level security',relation);
  execute format('create policy m68_report_member_read on neuvetra.%I for select to authenticated using(neuvetra.is_company_member(company_id))',relation);
  execute format('grant select on neuvetra.%I to authenticated',relation);
  execute format('revoke all on neuvetra.%I from public',relation);
  execute format('create trigger m68_report_immutable before update or delete on neuvetra.%I for each row execute function neuvetra.reject_inventory_history_mutation()',relation);
  if exists(select 1 from pg_roles where rolname='neuvetra_runtime') then
   execute format('create policy m68_report_runtime_read on neuvetra.%I for select to neuvetra_runtime using(neuvetra.is_company_member(company_id))',relation);
   execute format('grant select on neuvetra.%I to neuvetra_runtime',relation);
   execute format('revoke all on neuvetra.%I from authenticated',relation);
  end if;
 end loop;
end $$;
create function neuvetra.annual_evidence_report_template() returns text language sql immutable as $function$ select $template$<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Synthetic annual electricity and bill evidence</title><style>body{font:16px/1.5 system-ui,sans-serif;color:#182820;max-width:900px;margin:30px auto;padding:0 22px}h1{font-size:1.8rem}h2{font-size:1.2rem;margin-top:1.8rem}p,dd,td{overflow-wrap:anywhere}dl{display:grid;grid-template-columns:160px minmax(0,1fr);gap:7px 18px}dt{font-weight:650}dd{margin:0}.notice{border:2px solid #927130;padding:14px}.subtotal{font-size:2rem;font-weight:700}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:.85rem}th,td{border:1px solid #a1aea5;padding:5px;text-align:left;vertical-align:top}thead{display:table-header-group}tr{break-inside:avoid}.identity{font-size:.75rem}.note{white-space:pre-wrap}@media(max-width:500px){dl{display:block}dd{margin-bottom:10px}}@page{size:auto;margin:24mm 15mm 22mm;@top-center{content:"Draft · Synthetic · Incomplete company inventory · Unreleased · No assurance";font:700 8pt system-ui}@bottom-center{content:"Draft · Synthetic · No assurance · Page " counter(page);font:700 8pt system-ui}}@media print{body{font-size:10pt;margin:0;padding:0;max-width:none}h1{font-size:20pt}h2{break-after:avoid}p,dd{orphans:3;widows:3}dl{display:block}dt{margin-top:7px}.identity{font-size:8pt}table{font-size:8pt}}</style></head><body>
<main><p>Neuvetra · Saved evidence snapshot</p><h1>Synthetic annual electricity and bill evidence</h1><div class="notice"><strong>Draft · Synthetic · Incomplete company inventory · Unreleased · No assurance</strong><p>One fictional CAMX facility, calendar 2023, location-based Scope 2. Manual entries and document attachment do not verify consumption, authenticate bills or grant filing approval.</p></div>
<h2>{{subtotalLabel}}</h2><p class="subtotal">{{display}} kg CO2e</p><p>Exact subtotal before display rounding: {{unrounded}} kg CO2e. Manual annual quantity: {{quantity}} kWh / {{mwh}} MWh.</p><p>Totals reuse the exact selected annual version. Bill quantities are never added, substituted, prorated or annualized. Exact monthly values are summed before half-even rounding to four decimal places; displayed monthly results may not sum to the displayed subtotal. Precision does not establish measurement certainty.</p><dl><dt>Fictional company</dt><dd>{{companyLabel}}</dd><dt>Fictional facility</dt><dd>{{facilityLabel}}</dd></dl>
<h2>Entered months and attached documents</h2><p>{{entered}} / 12 months entered; {{attached}} / 12 months with attached documents. {{single}} month(s) with one attached document (not verified).</p><dl><dt>Missing input months</dt><dd>{{missingInputs}}</dd><dt>Missing document months</dt><dd>{{missingDocuments}}</dd><dt>Overlapping document months</dt><dd>{{overlaps}}</dd><dt>Quantity difference months</dt><dd>{{differences}}</dd></dl><p>These are separate, overlapping diagnostics; their counts must not be added. An explanation or manager decision does not clear a quantity difference. Two January bills describe the same consumption and are an unresolved overlap, never independent loads. Twelve entered months do not establish a complete company inventory or complete evidence.</p>
<h2>Monthly manual entries</h2><p>Missing is not zero. An explicit zero remains a manual assertion and still needs documentation. The historical annual version retains its original manual/no-bill basis; this separate evidence version adds the links listed below.</p><table><thead><tr><th>Month</th><th>Manual kWh</th><th>Exact kg CO2e</th><th>Displayed kg CO2e</th><th>Documents</th></tr></thead><tbody><tr><th scope="row">2023-01</th><td>{{m0kwh}}</td><td>{{m0exact}}</td><td>{{m0display}}</td><td>{{januaryDocuments}}</td></tr><tr><th scope="row">2023-02</th><td>{{m1kwh}}</td><td>{{m1exact}}</td><td>{{m1display}}</td><td>Missing document</td></tr><tr><th scope="row">2023-03</th><td>{{m2kwh}}</td><td>{{m2exact}}</td><td>{{m2display}}</td><td>Missing document</td></tr><tr><th scope="row">2023-04</th><td>{{m3kwh}}</td><td>{{m3exact}}</td><td>{{m3display}}</td><td>Missing document</td></tr><tr><th scope="row">2023-05</th><td>{{m4kwh}}</td><td>{{m4exact}}</td><td>{{m4display}}</td><td>Missing document</td></tr><tr><th scope="row">2023-06</th><td>{{m5kwh}}</td><td>{{m5exact}}</td><td>{{m5display}}</td><td>Missing document</td></tr><tr><th scope="row">2023-07</th><td>{{m6kwh}}</td><td>{{m6exact}}</td><td>{{m6display}}</td><td>Missing document</td></tr><tr><th scope="row">2023-08</th><td>{{m7kwh}}</td><td>{{m7exact}}</td><td>{{m7display}}</td><td>Missing document</td></tr><tr><th scope="row">2023-09</th><td>{{m8kwh}}</td><td>{{m8exact}}</td><td>{{m8display}}</td><td>Missing document</td></tr><tr><th scope="row">2023-10</th><td>{{m9kwh}}</td><td>{{m9exact}}</td><td>{{m9display}}</td><td>Missing document</td></tr><tr><th scope="row">2023-11</th><td>{{m10kwh}}</td><td>{{m10exact}}</td><td>{{m10display}}</td><td>Missing document</td></tr><tr><th scope="row">2023-12</th><td>{{m11kwh}}</td><td>{{m11exact}}</td><td>{{m11display}}</td><td>Missing document</td></tr></tbody></table>
<h2>Retained January documents</h2><p>Both supported fictional fixtures cover January 1–31, 2023, page 1 only. Statement dates do not establish February consumption. Each link records manual confirmation.</p><h3>Document slot 1</h3><dl><dt>File</dt><dd>{{d0name}}</dd><dt>Printed quantity (kWh)</dt><dd>{{d0printed}}</dd><dt>Page</dt><dd>{{d0page}}</dd><dt>Service starts</dt><dd>{{d0start}}</dd><dt>Service ends</dt><dd>{{d0end}}</dd><dt>Difference explanation</dt><dd>{{d0reason}}</dd><dt>Confirmed by</dt><dd>{{d0by}}</dd><dt>Confirmed at (UTC)</dt><dd>{{d0at}}</dd><dt>Source ID</dt><dd>{{d0id}}</dd><dt>Source SHA-256</dt><dd>{{d0hash}}</dd><dt>Source byte length</dt><dd>{{d0bytes}}</dd><dt>Uploaded by</dt><dd>{{d0uploadBy}}</dd><dt>Uploaded at (UTC)</dt><dd>{{d0uploadAt}}</dd></dl><p>{{d0difference}}</p><h3>Document slot 2</h3><dl><dt>File</dt><dd>{{d1name}}</dd><dt>Printed quantity (kWh)</dt><dd>{{d1printed}}</dd><dt>Page</dt><dd>{{d1page}}</dd><dt>Service starts</dt><dd>{{d1start}}</dd><dt>Service ends</dt><dd>{{d1end}}</dd><dt>Difference explanation</dt><dd>{{d1reason}}</dd><dt>Confirmed by</dt><dd>{{d1by}}</dd><dt>Confirmed at (UTC)</dt><dd>{{d1at}}</dd><dt>Source ID</dt><dd>{{d1id}}</dd><dt>Source SHA-256</dt><dd>{{d1hash}}</dd><dt>Source byte length</dt><dd>{{d1bytes}}</dd><dt>Uploaded by</dt><dd>{{d1uploadBy}}</dd><dt>Uploaded at (UTC)</dt><dd>{{d1uploadAt}}</dd></dl><p>{{d1difference}}</p><h2>Captured evidence review</h2><p><strong>{{reviewSummary}}</strong></p><p>A different manager reviews this exact bounded draft; the decision does not authenticate documents, verify inputs, approve report presentation, release methods or provide assurance. No annual-worksheet or predecessor review is inherited.</p><dl><dt>Reviewer</dt><dd>{{reviewer}}</dd><dt>Reviewed at (UTC)</dt><dd>{{reviewAt}}</dd><dt>Review ID</dt><dd>{{reviewId}}</dd><dt>Decision fingerprint</dt><dd>{{reviewHash}}</dd></dl><p class="note">{{reviewNote}}</p><p>Acknowledgments: {{acknowledgments}}</p>
<h2>Pinned method and limitations</h2><p>Annual 2023 CAMX regional average factor, applied to each entered month; not a month-specific factor. Operational control; grid-delivered purchased electricity consumed by the reporting company. Market-based Scope 2, Scope 1, Scope 3 and other facilities are not assessed. Factor and method remain unreleased development candidates.</p><dl><dt>Method</dt><dd>{{methodid}}</dd><dt>Method version</dt><dd>{{methodversion}}</dd><dt>Candidate factor</dt><dd>{{methodfactorId}}</dd><dt>Factor version</dt><dd>{{methodfactorVersion}}</dd><dt>Rate (kg CO2e/MWh)</dt><dd>{{methodfactorValue}}</dd><dt>Workbook SHA-256</dt><dd>{{methodsourceSha256}}</dd><dt>Candidate SHA-256</dt><dd>{{methodfactorCandidateSha256}}</dd><dt>GWP policy SHA-256</dt><dd>{{methodgwpPolicySha256}}</dd><dt>Reviewed engine SHA-256</dt><dd>{{methodreviewedEngineSha256}}</dd></dl><p>EPA eGRID2023 revision 2, SRL23!AI6 (A6=2023, B6=CAMX, C6=WECC California). AR5, 100 years, without climate-carbon feedbacks; CO2 1, CH4 28, N2O 265. 1 MWh = 1,000 kWh. <a href="https://www.epa.gov/system/files/documents/2025-06/egrid2023_data_metric_rev2.xlsx" rel="noreferrer">EPA source workbook</a>.</p>
<h2>Version and report identity</h2><dl class="identity"><dt>Evidence version</dt><dd>{{evidenceVersion}}</dd><dt>Evidence ID</dt><dd>{{evidenceId}}</dd><dt>Evidence saved at</dt><dd>{{evidenceAt}}</dd><dt>Evidence author</dt><dd>{{evidenceBy}}</dd><dt>Previous evidence version</dt><dd>{{predecessor}}</dd><dt>Evidence correction reason</dt><dd>{{correctionReason}}</dd><dt>Evidence input SHA-256</dt><dd>{{inputHash}}</dd><dt>Evidence result SHA-256</dt><dd>{{resultHash}}</dd><dt>Annual version</dt><dd>{{annualVersion}}</dd><dt>Annual ID</dt><dd>{{annualId}}</dd><dt>Annual input SHA-256</dt><dd>{{annualInput}}</dd><dt>Annual result SHA-256</dt><dd>{{annualResult}}</dd><dt>Annual correction reason</dt><dd>{{annualCorrection}}</dd><dt>Company ID</dt><dd>{{companyId}}</dd><dt>Report ID</dt><dd>{{reportId}}</dd><dt>Captured at (UTC)</dt><dd>{{createdAt}}</dd><dt>Report creator</dt><dd>{{createdBy}}</dd><dt>Report profile</dt><dd>{{profile}}</dd><dt>Template version</dt><dd>{{templateVersion}}</dd><dt>Template SHA-256</dt><dd>{{templateSha256}}</dd><dt>Snapshot identity SHA-256</dt><dd>{{identitySha256}}</dd></dl><p>The report freezes this selected evidence version, its exact annual version, retained sources and captured review state. Later corrections or decisions do not change these bytes. Authenticated source downloads resolve exact retained PDFs; HTML does not embed PDF bytes. The download receipt binds all UTF-8 HTML bytes; browser print/PDF bytes may vary. This report does not claim to be the latest version.</p></main></body></html>
$template$::text $function$;
revoke all on function neuvetra.annual_evidence_report_template() from public,authenticated;
create function neuvetra.render_annual_evidence_report(report_id uuid,company uuid,creator uuid,captured text,source jsonb,identity_sha text) returns bytea
language plpgsql immutable set search_path=pg_catalog,neuvetra,pg_temp as $$
declare result text:=neuvetra.annual_evidence_report_template();values_map jsonb:='{}'::jsonb;item record;escaped text;r jsonb:=source->'review';
begin
 values_map:=values_map||jsonb_build_object('display',coalesce(source#>>'{annual,total,display}','Not recorded'));
 values_map:=values_map||jsonb_build_object('unrounded',coalesce(source#>>'{annual,total,unrounded}','Not recorded'));
 values_map:=values_map||jsonb_build_object('quantity',coalesce(source#>>'{annual,quantityKwh}','Not recorded'));
 values_map:=values_map||jsonb_build_object('mwh',coalesce(source#>>'{annual,quantityMwh}','Not recorded'));
 values_map:=values_map||jsonb_build_object('companyLabel',coalesce(source#>>'{annual,companyLabel}','Not recorded'));
 values_map:=values_map||jsonb_build_object('facilityLabel',coalesce(source#>>'{annual,facilityLabel}','Not recorded'));
 values_map:=values_map||jsonb_build_object('entered',coalesce(source#>>'{coverage,enteredMonths}','Not recorded'));
 values_map:=values_map||jsonb_build_object('attached',coalesce(source#>>'{coverage,linkedDocumentMonths}','Not recorded'));
 values_map:=values_map||jsonb_build_object('single',coalesce(source#>>'{coverage,unambiguousDocumentMonths}','Not recorded'));
 values_map:=values_map||jsonb_build_object('reviewer',coalesce(source#>>'{review,reviewerId}','Not recorded'));
 values_map:=values_map||jsonb_build_object('reviewAt',coalesce(source#>>'{review,reviewedAt}','Not recorded'));
 values_map:=values_map||jsonb_build_object('reviewId',coalesce(source#>>'{review,id}','Not recorded'));
 values_map:=values_map||jsonb_build_object('reviewHash',coalesce(source#>>'{review,decisionSha256}','Not recorded'));
 values_map:=values_map||jsonb_build_object('evidenceVersion',coalesce(source#>>'{version}','Not recorded'));
 values_map:=values_map||jsonb_build_object('evidenceId',coalesce(source#>>'{id}','Not recorded'));
 values_map:=values_map||jsonb_build_object('evidenceAt',coalesce(source#>>'{createdAt}','Not recorded'));
 values_map:=values_map||jsonb_build_object('evidenceBy',coalesce(source#>>'{createdBy}','Not recorded'));
 values_map:=values_map||jsonb_build_object('predecessor',coalesce(source#>>'{previousVersionId}','Not recorded'));
 values_map:=values_map||jsonb_build_object('correctionReason',coalesce(source#>>'{correctionReason}','Not recorded'));
 values_map:=values_map||jsonb_build_object('inputHash',coalesce(source#>>'{inputSha256}','Not recorded'));
 values_map:=values_map||jsonb_build_object('resultHash',coalesce(source#>>'{resultSha256}','Not recorded'));
 values_map:=values_map||jsonb_build_object('annualVersion',coalesce(source#>>'{annual,version}','Not recorded'));
 values_map:=values_map||jsonb_build_object('annualId',coalesce(source#>>'{annual,id}','Not recorded'));
 values_map:=values_map||jsonb_build_object('annualInput',coalesce(source#>>'{annual,inputSha256}','Not recorded'));
 values_map:=values_map||jsonb_build_object('annualResult',coalesce(source#>>'{annual,resultSha256}','Not recorded'));
 values_map:=values_map||jsonb_build_object('annualCorrection',coalesce(source#>>'{annual,correctionReason}','Not recorded'));
 values_map:=values_map||jsonb_build_object('reviewNote',coalesce(source#>>'{review,note}','No change-request note'));
 values_map:=values_map||jsonb_build_object('m0kwh',coalesce(source#>>'{annual,months,0,quantityKwh}','Not entered'));
 values_map:=values_map||jsonb_build_object('m0exact',coalesce(source#>>'{annual,months,0,total,unrounded}','Not entered'));
 values_map:=values_map||jsonb_build_object('m0display',coalesce(source#>>'{annual,months,0,total,display}','Not entered'));
 values_map:=values_map||jsonb_build_object('m1kwh',coalesce(source#>>'{annual,months,1,quantityKwh}','Not entered'));
 values_map:=values_map||jsonb_build_object('m1exact',coalesce(source#>>'{annual,months,1,total,unrounded}','Not entered'));
 values_map:=values_map||jsonb_build_object('m1display',coalesce(source#>>'{annual,months,1,total,display}','Not entered'));
 values_map:=values_map||jsonb_build_object('m2kwh',coalesce(source#>>'{annual,months,2,quantityKwh}','Not entered'));
 values_map:=values_map||jsonb_build_object('m2exact',coalesce(source#>>'{annual,months,2,total,unrounded}','Not entered'));
 values_map:=values_map||jsonb_build_object('m2display',coalesce(source#>>'{annual,months,2,total,display}','Not entered'));
 values_map:=values_map||jsonb_build_object('m3kwh',coalesce(source#>>'{annual,months,3,quantityKwh}','Not entered'));
 values_map:=values_map||jsonb_build_object('m3exact',coalesce(source#>>'{annual,months,3,total,unrounded}','Not entered'));
 values_map:=values_map||jsonb_build_object('m3display',coalesce(source#>>'{annual,months,3,total,display}','Not entered'));
 values_map:=values_map||jsonb_build_object('m4kwh',coalesce(source#>>'{annual,months,4,quantityKwh}','Not entered'));
 values_map:=values_map||jsonb_build_object('m4exact',coalesce(source#>>'{annual,months,4,total,unrounded}','Not entered'));
 values_map:=values_map||jsonb_build_object('m4display',coalesce(source#>>'{annual,months,4,total,display}','Not entered'));
 values_map:=values_map||jsonb_build_object('m5kwh',coalesce(source#>>'{annual,months,5,quantityKwh}','Not entered'));
 values_map:=values_map||jsonb_build_object('m5exact',coalesce(source#>>'{annual,months,5,total,unrounded}','Not entered'));
 values_map:=values_map||jsonb_build_object('m5display',coalesce(source#>>'{annual,months,5,total,display}','Not entered'));
 values_map:=values_map||jsonb_build_object('m6kwh',coalesce(source#>>'{annual,months,6,quantityKwh}','Not entered'));
 values_map:=values_map||jsonb_build_object('m6exact',coalesce(source#>>'{annual,months,6,total,unrounded}','Not entered'));
 values_map:=values_map||jsonb_build_object('m6display',coalesce(source#>>'{annual,months,6,total,display}','Not entered'));
 values_map:=values_map||jsonb_build_object('m7kwh',coalesce(source#>>'{annual,months,7,quantityKwh}','Not entered'));
 values_map:=values_map||jsonb_build_object('m7exact',coalesce(source#>>'{annual,months,7,total,unrounded}','Not entered'));
 values_map:=values_map||jsonb_build_object('m7display',coalesce(source#>>'{annual,months,7,total,display}','Not entered'));
 values_map:=values_map||jsonb_build_object('m8kwh',coalesce(source#>>'{annual,months,8,quantityKwh}','Not entered'));
 values_map:=values_map||jsonb_build_object('m8exact',coalesce(source#>>'{annual,months,8,total,unrounded}','Not entered'));
 values_map:=values_map||jsonb_build_object('m8display',coalesce(source#>>'{annual,months,8,total,display}','Not entered'));
 values_map:=values_map||jsonb_build_object('m9kwh',coalesce(source#>>'{annual,months,9,quantityKwh}','Not entered'));
 values_map:=values_map||jsonb_build_object('m9exact',coalesce(source#>>'{annual,months,9,total,unrounded}','Not entered'));
 values_map:=values_map||jsonb_build_object('m9display',coalesce(source#>>'{annual,months,9,total,display}','Not entered'));
 values_map:=values_map||jsonb_build_object('m10kwh',coalesce(source#>>'{annual,months,10,quantityKwh}','Not entered'));
 values_map:=values_map||jsonb_build_object('m10exact',coalesce(source#>>'{annual,months,10,total,unrounded}','Not entered'));
 values_map:=values_map||jsonb_build_object('m10display',coalesce(source#>>'{annual,months,10,total,display}','Not entered'));
 values_map:=values_map||jsonb_build_object('m11kwh',coalesce(source#>>'{annual,months,11,quantityKwh}','Not entered'));
 values_map:=values_map||jsonb_build_object('m11exact',coalesce(source#>>'{annual,months,11,total,unrounded}','Not entered'));
 values_map:=values_map||jsonb_build_object('m11display',coalesce(source#>>'{annual,months,11,total,display}','Not entered'));
 values_map:=values_map||jsonb_build_object('d0name',coalesce(source#>>'{links,0,source,originalName}','No document linked'));
 values_map:=values_map||jsonb_build_object('d0printed',coalesce(source#>>'{links,0,source,printedQuantityKwh}','Not linked'));
 values_map:=values_map||jsonb_build_object('d0page',coalesce(source#>>'{links,0,page}','Not linked'));
 values_map:=values_map||jsonb_build_object('d0start',coalesce(source#>>'{links,0,periodStart}','Not linked'));
 values_map:=values_map||jsonb_build_object('d0end',coalesce(source#>>'{links,0,periodEnd}','Not linked'));
 values_map:=values_map||jsonb_build_object('d0reason',coalesce(source#>>'{links,0,quantityDifferenceReason}','No discrepancy explanation recorded'));
 values_map:=values_map||jsonb_build_object('d0by',coalesce(source#>>'{links,0,confirmedBy}','Not linked'));
 values_map:=values_map||jsonb_build_object('d0at',coalesce(source#>>'{links,0,confirmedAt}','Not linked'));
 values_map:=values_map||jsonb_build_object('d0id',coalesce(source#>>'{links,0,source,id}','Not linked'));
 values_map:=values_map||jsonb_build_object('d0hash',coalesce(source#>>'{links,0,source,sha256}','Not linked'));
 values_map:=values_map||jsonb_build_object('d0bytes',coalesce(source#>>'{links,0,source,byteLength}','Not linked'));
 values_map:=values_map||jsonb_build_object('d0uploadBy',coalesce(source#>>'{links,0,source,uploadedBy}','Not linked'));
 values_map:=values_map||jsonb_build_object('d0uploadAt',coalesce(source#>>'{links,0,source,uploadedAt}','Not linked'));
 values_map:=values_map||jsonb_build_object('d1name',coalesce(source#>>'{links,1,source,originalName}','No document linked'));
 values_map:=values_map||jsonb_build_object('d1printed',coalesce(source#>>'{links,1,source,printedQuantityKwh}','Not linked'));
 values_map:=values_map||jsonb_build_object('d1page',coalesce(source#>>'{links,1,page}','Not linked'));
 values_map:=values_map||jsonb_build_object('d1start',coalesce(source#>>'{links,1,periodStart}','Not linked'));
 values_map:=values_map||jsonb_build_object('d1end',coalesce(source#>>'{links,1,periodEnd}','Not linked'));
 values_map:=values_map||jsonb_build_object('d1reason',coalesce(source#>>'{links,1,quantityDifferenceReason}','No discrepancy explanation recorded'));
 values_map:=values_map||jsonb_build_object('d1by',coalesce(source#>>'{links,1,confirmedBy}','Not linked'));
 values_map:=values_map||jsonb_build_object('d1at',coalesce(source#>>'{links,1,confirmedAt}','Not linked'));
 values_map:=values_map||jsonb_build_object('d1id',coalesce(source#>>'{links,1,source,id}','Not linked'));
 values_map:=values_map||jsonb_build_object('d1hash',coalesce(source#>>'{links,1,source,sha256}','Not linked'));
 values_map:=values_map||jsonb_build_object('d1bytes',coalesce(source#>>'{links,1,source,byteLength}','Not linked'));
 values_map:=values_map||jsonb_build_object('d1uploadBy',coalesce(source#>>'{links,1,source,uploadedBy}','Not linked'));
 values_map:=values_map||jsonb_build_object('d1uploadAt',coalesce(source#>>'{links,1,source,uploadedAt}','Not linked'));
 values_map:=values_map||jsonb_build_object('methodid',coalesce(source#>>'{annual,method,id}','Not recorded'));
 values_map:=values_map||jsonb_build_object('methodversion',coalesce(source#>>'{annual,method,version}','Not recorded'));
 values_map:=values_map||jsonb_build_object('methodfactorId',coalesce(source#>>'{annual,method,factorId}','Not recorded'));
 values_map:=values_map||jsonb_build_object('methodfactorVersion',coalesce(source#>>'{annual,method,factorVersion}','Not recorded'));
 values_map:=values_map||jsonb_build_object('methodfactorValue',coalesce(source#>>'{annual,method,factorValue}','Not recorded'));
 values_map:=values_map||jsonb_build_object('methodsourceSha256',coalesce(source#>>'{annual,method,sourceSha256}','Not recorded'));
 values_map:=values_map||jsonb_build_object('methodfactorCandidateSha256',coalesce(source#>>'{annual,method,factorCandidateSha256}','Not recorded'));
 values_map:=values_map||jsonb_build_object('methodgwpPolicySha256',coalesce(source#>>'{annual,method,gwpPolicySha256}','Not recorded'));
 values_map:=values_map||jsonb_build_object('methodreviewedEngineSha256',coalesce(source#>>'{annual,method,reviewedEngineSha256}','Not recorded'));
 values_map:=values_map||jsonb_build_object('subtotalLabel',case when (source#>>'{annual,coverage,electricityComplete}')::boolean then 'Full-year electricity subtotal — all 12 months entered' else 'Entered-month electricity subtotal' end);
 values_map:=values_map||jsonb_build_object('januaryDocuments',case when jsonb_array_length(source->'links')>1 then 'Overlapping documents (not summed)' when jsonb_array_length(source->'links')=1 then 'One attached document (not verified)' else 'Missing document' end);
 values_map:=values_map||jsonb_build_object('reviewSummary',case when r='null'::jsonb then 'Unreviewed at report capture' when r->>'decision'='accept_bounded_internal_draft' then 'Accepted for bounded internal use' else 'Changes requested' end);
 values_map:=values_map||jsonb_build_object('companyId',company::text);
 values_map:=values_map||jsonb_build_object('reportId',report_id::text);
 values_map:=values_map||jsonb_build_object('createdBy',creator::text);
 values_map:=values_map||jsonb_build_object('createdAt',captured);
 values_map:=values_map||jsonb_build_object('profile','neuvetra.synthetic.annual-electricity-evidence-report.v1');
 values_map:=values_map||jsonb_build_object('templateVersion','m68-annual-evidence-report-v1');
 values_map:=values_map||jsonb_build_object('templateSha256',encode(sha256(convert_to(neuvetra.annual_evidence_report_template(),'utf8')),'hex'));
 values_map:=values_map||jsonb_build_object('identitySha256',identity_sha);
 values_map:=values_map||jsonb_build_object('missingInputs',coalesce((select string_agg(value,', ' order by ord) from jsonb_array_elements_text(coalesce(source#>'{coverage,missingInputMonths}','[]'::jsonb)) with ordinality t(value,ord)),'None'));
 values_map:=values_map||jsonb_build_object('missingDocuments',coalesce((select string_agg(value,', ' order by ord) from jsonb_array_elements_text(coalesce(source#>'{coverage,missingDocumentMonths}','[]'::jsonb)) with ordinality t(value,ord)),'None'));
 values_map:=values_map||jsonb_build_object('overlaps',coalesce((select string_agg(value,', ' order by ord) from jsonb_array_elements_text(coalesce(source#>'{coverage,overlappingDocumentMonths}','[]'::jsonb)) with ordinality t(value,ord)),'None'));
 values_map:=values_map||jsonb_build_object('differences',coalesce((select string_agg(value,', ' order by ord) from jsonb_array_elements_text(coalesce(source#>'{coverage,quantityDifferenceMonths}','[]'::jsonb)) with ordinality t(value,ord)),'None'));
 values_map:=values_map||jsonb_build_object('acknowledgments',coalesce((select string_agg(value,', ' order by ord) from jsonb_array_elements_text(coalesce(source#>'{review,acknowledgedLimitations}','[]'::jsonb)) with ordinality t(value,ord)),'None'));
 values_map:=values_map||jsonb_build_object('d0difference',case when source#>'{links,0}' is null then 'No document linked.' when source#>>'{links,0,source,printedQuantityKwh}'=source#>>'{annual,months,0,quantityKwh}' then 'Printed and manual January quantities match; document and inputs remain unverified.' else 'Manual quantity differs from the fictional bill. Explanation recorded; difference remains.' end);
 values_map:=values_map||jsonb_build_object('d1difference',case when source#>'{links,1}' is null then 'No document linked.' when source#>>'{links,1,source,printedQuantityKwh}'=source#>>'{annual,months,0,quantityKwh}' then 'Printed and manual January quantities match; document and inputs remain unverified.' else 'Manual quantity differs from the fictional bill. Explanation recorded; difference remains.' end);
 for item in select key,value from jsonb_each_text(values_map) loop
  if item.value is null then raise exception 'invalid report source' using errcode='22023';end if;
  escaped:=replace(replace(replace(replace(replace(replace(replace(item.value,'&','&amp;'),'<','&lt;'),'>','&gt;'),'"','&quot;'),'''','&#39;'),'{','&#123;'),'}','&#125;');
  result:=replace(result,'{{'||item.key||'}}',escaped);
 end loop;
 if result ~ '\{\{[a-zA-Z0-9]+\}\}' then raise exception 'unresolved report template';end if;
 return convert_to(result,'utf8');
end $$;
revoke all on function neuvetra.render_annual_evidence_report(uuid,uuid,uuid,text,jsonb,text) from public,authenticated;
create function neuvetra.create_annual_evidence_report(target_company uuid,request jsonb) returns uuid
language plpgsql security definer set search_path=pg_catalog,neuvetra,pg_temp as $$
declare actor uuid:=neuvetra.current_user_id(); v record; r record; prior record; source jsonb; report_id uuid; fingerprint text;
 template_sha text:=encode(sha256(convert_to(neuvetra.annual_evidence_report_template(),'utf8')),'hex'); captured timestamptz; captured_text text; content bytea; content_sha text; meta jsonb;
begin
 if actor is null or not neuvetra.can_manage_company(target_company) then raise exception 'workspace not found' using errcode='42501';end if;
 perform id from neuvetra.companies where id=target_company for update;
 if not neuvetra.can_manage_company(target_company) then raise exception 'workspace not found' using errcode='42501';end if;
 if jsonb_typeof(request) is distinct from 'object' or (select array_agg(key order by key) from jsonb_object_keys(request) key) is distinct from array['expectedInputSha256','expectedResultSha256','expectedReviewId','expectedReviewSha256','idempotencyKey','sourceVersionId']::text[] then raise exception 'invalid report request' using errcode='22023';end if;
 if exists(select 1 from jsonb_each(request) where key not in('expectedReviewId','expectedReviewSha256') and jsonb_typeof(value)<>'string') or request->>'sourceVersionId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or request->>'idempotencyKey' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or request->>'expectedInputSha256' !~ '^[0-9a-f]{64}$' or request->>'expectedResultSha256' !~ '^[0-9a-f]{64}$' then raise exception 'invalid report request' using errcode='22023';end if;
 if not ((request->'expectedReviewId'='null'::jsonb and request->'expectedReviewSha256'='null'::jsonb) or (jsonb_typeof(request->'expectedReviewId')='string' and jsonb_typeof(request->'expectedReviewSha256')='string' and request->>'expectedReviewId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and request->>'expectedReviewSha256' ~ '^[0-9a-f]{64}$')) then raise exception 'invalid review binding' using errcode='22023';end if;
 select * into v from neuvetra.annual_electricity_evidence_versions where company_id=target_company and id=(request->>'sourceVersionId')::uuid;
 if not found or v.input_sha256 is distinct from request->>'expectedInputSha256' or v.result_sha256 is distinct from request->>'expectedResultSha256' then raise exception 'report source conflicts' using errcode='23505';end if;
 fingerprint:=neuvetra.m67_hash(jsonb_build_object('profile','neuvetra.synthetic.annual-electricity-evidence-report.v1','companyId',target_company,'sourceVersionId',v.id,'inputSha256',v.input_sha256,'resultSha256',v.result_sha256,'reviewId',request->'expectedReviewId','reviewSha256',request->'expectedReviewSha256','templateVersion','m68-annual-evidence-report-v1','templateSha256',template_sha));
 select * into prior from neuvetra.annual_evidence_report_requests where company_id=target_company and idempotency_key=(request->>'idempotencyKey')::uuid;
 if found then
  if prior.operation_fingerprint<>fingerprint then raise exception 'report request conflicts' using errcode='23505';end if;
  return prior.report_id;
 end if;
 select id into report_id from neuvetra.annual_evidence_reports where company_id=target_company and operation_fingerprint=fingerprint;
 if found then
  insert into neuvetra.annual_evidence_report_requests values(target_company,(request->>'idempotencyKey')::uuid,fingerprint,report_id,actor);
  return report_id;
 end if;
 select * into r from neuvetra.annual_electricity_evidence_reviews where company_id=target_company and version_id=v.id;
 if r.id is distinct from (request->>'expectedReviewId')::uuid or r.decision_sha256 is distinct from request->>'expectedReviewSha256' then raise exception 'report review snapshot changed' using errcode='23505';end if;
 source:=v.payload||jsonb_build_object('createdAt',to_char(v.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'review',case when r.id is null then 'null'::jsonb else r.payload||jsonb_build_object('reviewedAt',to_char(r.reviewed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) end);
 report_id:=gen_random_uuid();captured:=date_trunc('milliseconds',clock_timestamp());captured_text:=to_char(captured at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 content:=neuvetra.render_annual_evidence_report(report_id,target_company,actor,captured_text,source,fingerprint);
 content_sha:=encode(sha256(content),'hex');
 insert into neuvetra.annual_evidence_reports values(report_id,target_company,v.id,v.input_sha256,v.result_sha256,r.id,r.decision_sha256,'m68-annual-evidence-report-v1',template_sha,source,content,content_sha,octet_length(content),fingerprint,actor,captured);
 insert into neuvetra.annual_evidence_report_requests values(target_company,(request->>'idempotencyKey')::uuid,fingerprint,report_id,actor);
 meta:=jsonb_build_object('profile','neuvetra.synthetic.annual-electricity-evidence-report.v1','reportId',report_id,'sourceVersionId',v.id,'inputSha256',v.input_sha256,'resultSha256',v.result_sha256,'reviewId',r.id,'reviewSha256',r.decision_sha256,'templateVersion','m68-annual-evidence-report-v1','templateSha256',template_sha,'reportSha256',content_sha,'reportByteLength',octet_length(content),'identitySha256',fingerprint);
 insert into neuvetra.annual_evidence_report_audit values(gen_random_uuid(),target_company,report_id,actor,meta,captured);
 return report_id;
end $$;
revoke all on function neuvetra.create_annual_evidence_report(uuid,jsonb) from public,authenticated;
do $$ begin
 if exists(select 1 from pg_roles where rolname='neuvetra_runtime') then
  grant execute on function neuvetra.lock_annual_evidence_report_read(uuid),neuvetra.create_annual_evidence_report(uuid,jsonb) to neuvetra_runtime;
  revoke all on function neuvetra.lock_annual_evidence_report_read(uuid) from authenticated;
 end if;
end $$;

