-- M66 retains only reviewed fictional PDFs. Original migrations and records remain untouched.
create table neuvetra.electricity_sources (
 id uuid primary key,company_id uuid not null references neuvetra.companies(id),fixture_id text not null,original_name text not null,
 media_type text not null check(media_type='application/pdf'),byte_length integer not null check(byte_length between 1 and 262144),sha256 text not null,
 printed_quantity_kwh text not null,original_bytes bytea not null,uploaded_by uuid not null references auth.users(id),uploaded_at timestamptz not null,
 identity_sha256 text not null,unique(id,company_id),unique(company_id,sha256),
 check(sha256~'^[0-9a-f]{64}$' and identity_sha256~'^[0-9a-f]{64}$' and octet_length(original_bytes)=byte_length and encode(sha256(original_bytes),'hex')=sha256)
);
create table neuvetra.electricity_source_requests (
 company_id uuid not null,idempotency_key uuid not null,operation_fingerprint text not null,source_id uuid not null,primary key(company_id,idempotency_key),
 foreign key(source_id,company_id) references neuvetra.electricity_sources(id,company_id)
);
create table neuvetra.electricity_source_audit (
 id uuid primary key,company_id uuid not null,source_id uuid not null,actor_id uuid not null references auth.users(id),identity_sha256 text not null,created_at timestamptz not null,
 unique(company_id,source_id),foreign key(source_id,company_id) references neuvetra.electricity_sources(id,company_id)
);
do $$ declare relation text; begin
 foreach relation in array array['electricity_sources','electricity_source_requests','electricity_source_audit'] loop
  execute format('alter table neuvetra.%I enable row level security',relation);
  execute format('alter table neuvetra.%I force row level security',relation);
  execute format('create policy m66_source_member_read on neuvetra.%I for select to authenticated using(neuvetra.is_company_member(company_id))',relation);
  execute format('grant select on neuvetra.%I to authenticated',relation);
  execute format('revoke all on neuvetra.%I from public',relation);
  execute format('create trigger m66_source_immutable before update or delete on neuvetra.%I for each row execute function neuvetra.reject_inventory_history_mutation()',relation);
  if exists(select 1 from pg_roles where rolname='neuvetra_runtime') then
   execute format('create policy m66_source_runtime_read on neuvetra.%I for select to neuvetra_runtime using(neuvetra.is_company_member(company_id))',relation);
   execute format('grant select on neuvetra.%I to neuvetra_runtime',relation);
   execute format('revoke all on neuvetra.%I from authenticated',relation);
  end if;
 end loop;
end $$;
create function neuvetra.electricity_source_fixtures() returns jsonb language sql immutable as $$ select '[{"fixtureId":"m55-fictional-bill-a","originalName":"neuvetra-m55-synthetic-electricity-bill.pdf","byteLength":4605,"sha256":"0a97cd0976c03af0776214fc19bdc3d4f0c00e9c835f3e116574a6f375c8e135","printedQuantityKwh":"12345.000"},{"fixtureId":"m66-fictional-bill-b","originalName":"neuvetra-m66-synthetic-electricity-bill-b.pdf","byteLength":2480,"sha256":"83e000a95f9e2f95473dc2cba18be0fc36810b24b9288f59b5aceb3a5ec0430f","printedQuantityKwh":"12345.000"}]'::jsonb $$;
revoke all on function neuvetra.electricity_source_fixtures() from public,authenticated;
create function neuvetra.electricity_source_metadata(source_id uuid,target_company uuid) returns jsonb
language sql stable set search_path=pg_catalog,neuvetra,pg_temp as $$
 select jsonb_build_object('id',id,'companyId',company_id,'fixtureId',fixture_id,'originalName',original_name,'mediaType',media_type,'byteLength',byte_length,'sha256',sha256,'printedQuantityKwh',printed_quantity_kwh,'uploadedBy',uploaded_by,'uploadedAt',to_char(uploaded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) from neuvetra.electricity_sources where id=source_id and company_id=target_company
$$;
revoke all on function neuvetra.electricity_source_metadata(uuid,uuid) from public,authenticated;
create function neuvetra.upload_electricity_source(target_company uuid,source_name text,source_type text,source_hex text,request_key uuid) returns uuid
language plpgsql security definer set search_path=pg_catalog,neuvetra,pg_temp as $$
declare actor uuid:=neuvetra.current_user_id();content bytea;source_sha text;fixture jsonb;prior record;new_id uuid;fingerprint text;captured timestamptz;captured_text text;identity_sha text;
begin
 if actor is null or not neuvetra.can_manage_company(target_company) then raise exception 'workspace not found' using errcode='42501';end if;
 perform id from neuvetra.companies where id=target_company for update;
 if not neuvetra.can_manage_company(target_company) then raise exception 'workspace not found' using errcode='42501';end if;
 if request_key is null or source_name is null or source_type is distinct from 'application/pdf' or source_hex is null or char_length(source_hex) not between 2 and 524288 or source_hex !~ '^[0-9a-f]+$' or mod(char_length(source_hex),2)<>0 then raise exception 'unsupported fictional source' using errcode='22023';end if;
 content:=decode(source_hex,'hex');source_sha:=encode(sha256(content),'hex');
 select value into fixture from jsonb_array_elements(neuvetra.electricity_source_fixtures()) where value->>'sha256'=source_sha and value->>'originalName'=source_name and (value->>'byteLength')::integer=octet_length(content);
 if not found then raise exception 'unsupported fictional source' using errcode='22023';end if;
 fingerprint:=encode(sha256(convert_to(concat_ws(E'\n',actor::text,source_name,source_type,source_sha),'utf8')),'hex');
 select * into prior from neuvetra.electricity_source_requests where company_id=target_company and idempotency_key=request_key;
 if found then
  if prior.operation_fingerprint<>fingerprint then raise exception 'source request conflicts' using errcode='23505';end if;
  return prior.source_id;
 end if;
 select id into new_id from neuvetra.electricity_sources where company_id=target_company and sha256=source_sha;
 if found then
  insert into neuvetra.electricity_source_requests values(target_company,request_key,fingerprint,new_id);return new_id;
 end if;
 new_id:=gen_random_uuid();captured:=date_trunc('milliseconds',clock_timestamp());captured_text:=to_char(captured at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 identity_sha:=encode(sha256(convert_to(concat_ws(E'\n','neuvetra.synthetic.electricity-source.v1',new_id::text,target_company::text,fixture->>'fixtureId',source_name,source_type,octet_length(content)::text,source_sha,fixture->>'printedQuantityKwh',actor::text,captured_text),'utf8')),'hex');
 insert into neuvetra.electricity_sources values(new_id,target_company,fixture->>'fixtureId',source_name,source_type,octet_length(content),source_sha,fixture->>'printedQuantityKwh',content,actor,captured,identity_sha);
 insert into neuvetra.electricity_source_requests values(target_company,request_key,fingerprint,new_id);
 insert into neuvetra.electricity_source_audit values(gen_random_uuid(),target_company,new_id,actor,identity_sha,captured);
 return new_id;
end $$;
revoke all on function neuvetra.upload_electricity_source(uuid,text,text,text,uuid) from public,authenticated;
do $$ begin if exists(select 1 from pg_roles where rolname='neuvetra_runtime') then grant execute on function neuvetra.upload_electricity_source(uuid,text,text,text,uuid) to neuvetra_runtime;end if;end $$;

-- Additive M64 history. Never changes M54-M63 domain records or migration bytes.
create table neuvetra.source_worksheet_versions (
 id uuid primary key, company_id uuid not null references neuvetra.companies(id), version integer not null check(version>0),
 previous_version_id uuid, payload jsonb not null, input_sha256 text not null, result_sha256 text not null,
 operation_fingerprint text not null, created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 unique(id,company_id), unique(company_id,version), unique(company_id,operation_fingerprint),
 foreign key(previous_version_id,company_id) references neuvetra.source_worksheet_versions(id,company_id),
 check(input_sha256~'^[0-9a-f]{64}$' and result_sha256~'^[0-9a-f]{64}$' and operation_fingerprint~'^[0-9a-f]{64}$')
);
create table neuvetra.source_worksheet_reviews (
 id uuid primary key, company_id uuid not null, version_id uuid not null, payload jsonb not null,
 decision_sha256 text not null check(decision_sha256~'^[0-9a-f]{64}$'), operation_fingerprint text not null,
 reviewed_by uuid not null references auth.users(id), reviewed_at timestamptz not null default now(),
 unique(id,company_id), unique(company_id,version_id), unique(company_id,operation_fingerprint),
 foreign key(version_id,company_id) references neuvetra.source_worksheet_versions(id,company_id)
);
create table neuvetra.source_worksheet_requests (
 company_id uuid not null references neuvetra.companies(id), idempotency_key uuid not null, operation_fingerprint text not null,
 kind text not null check(kind in('save','review')), record_id uuid not null, primary key(company_id,idempotency_key)
);
create table neuvetra.source_worksheet_audit (
 id uuid primary key, company_id uuid not null references neuvetra.companies(id), record_id uuid not null,
 kind text not null check(kind in('save','review')), record_sha256 text not null, actor_id uuid not null references auth.users(id),
 created_at timestamptz not null default now(), unique(company_id,kind,record_id)
);
do $$ declare relation text; begin
 foreach relation in array array['source_worksheet_versions','source_worksheet_reviews','source_worksheet_requests','source_worksheet_audit'] loop
  execute format('alter table neuvetra.%I enable row level security',relation);
  execute format('alter table neuvetra.%I force row level security',relation);
  execute format('create policy m66_member_read on neuvetra.%I for select to authenticated using(neuvetra.is_company_member(company_id))',relation);
  execute format('grant select on neuvetra.%I to authenticated',relation);
  execute format('revoke all on neuvetra.%I from public',relation);
  execute format('create trigger m66_immutable before update or delete on neuvetra.%I for each row execute function neuvetra.reject_inventory_history_mutation()',relation);
  if exists(select 1 from pg_roles where rolname='neuvetra_runtime') then
   execute format('create policy m66_runtime_read on neuvetra.%I for select to neuvetra_runtime using(neuvetra.is_company_member(company_id))',relation);
   execute format('grant select on neuvetra.%I to neuvetra_runtime',relation);
   execute format('revoke all on neuvetra.%I from authenticated',relation);
  end if;
 end loop;
end $$;

create function neuvetra.review_source_worksheet(target_company uuid, request jsonb) returns uuid
language plpgsql security definer set search_path=pg_catalog,neuvetra,pg_temp as $$
declare actor uuid:=neuvetra.current_user_id(); v record; prior record; review_id uuid:=gen_random_uuid(); fingerprint text; digest text; body jsonb; acknowledgments jsonb; note text; decision_captured_at timestamptz;
begin
 if actor is null or not neuvetra.can_manage_company(target_company) then raise exception 'workspace not found' using errcode='42501'; end if;
 perform id from neuvetra.companies where id=target_company for update;
 if not neuvetra.can_manage_company(target_company) then raise exception 'workspace not found' using errcode='42501';end if;
 decision_captured_at:=date_trunc('milliseconds',clock_timestamp());
 if jsonb_typeof(request) is distinct from 'object' or (select array_agg(key order by key) from jsonb_object_keys(request) key) is distinct from array['acknowledgedLimitations','decision','expectedResultSha256','idempotencyKey','note','versionId']::text[] then raise exception 'invalid worksheet review' using errcode='22023'; end if;
 if exists(select 1 from jsonb_each(request) where key not in('note','acknowledgedLimitations') and jsonb_typeof(value)<>'string') or (request->>'idempotencyKey') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'invalid worksheet review' using errcode='22023'; end if;
 acknowledgments := '["synthetic_manual_confirmation","document_attachment_not_verification","overall_inventory_incomplete","january_2023_camx_only","market_based_scope2_not_included","factor_and_method_not_released","scope_1_and_scope_3_not_assessed","no_assurance"]'::jsonb;
 if request->>'decision'='accept_bounded_internal_draft' then
  if request->'note' is distinct from 'null'::jsonb or request->'acknowledgedLimitations' is distinct from acknowledgments then raise exception 'invalid worksheet review' using errcode='22023'; end if;
 elsif request->>'decision'='changes_requested' then
  note:=request->>'note';
  if jsonb_typeof(request->'note') is distinct from 'string' or (note !~ '^[ -~]+$' or char_length(note) not between 1 and 500) or note<>btrim(note) or request->'acknowledgedLimitations' is distinct from '[]'::jsonb then raise exception 'invalid worksheet review' using errcode='22023'; end if;
 else raise exception 'invalid worksheet review' using errcode='22023'; end if;
 select * into v from neuvetra.source_worksheet_versions where company_id=target_company and id=(request->>'versionId')::uuid;
 if not found or v.result_sha256 is distinct from request->>'expectedResultSha256' or v.created_by=actor then raise exception 'worksheet review conflicts' using errcode='23505'; end if;
 fingerprint:=encode(sha256(convert_to(actor::text||E'\n'||(request-'idempotencyKey')::text,'utf8')),'hex');
 select * into prior from neuvetra.source_worksheet_requests where company_id=target_company and idempotency_key=(request->>'idempotencyKey')::uuid;
 if found then
  if prior.kind<>'review' or prior.operation_fingerprint<>fingerprint then raise exception 'worksheet request conflicts' using errcode='23505';end if;
  return prior.record_id;
 end if;
 select id into review_id from neuvetra.source_worksheet_reviews where company_id=target_company and operation_fingerprint=fingerprint;
 if found then
  insert into neuvetra.source_worksheet_requests values(target_company,(request->>'idempotencyKey')::uuid,fingerprint,'review',review_id);
  return review_id;
 end if;
 if exists(select 1 from neuvetra.source_worksheet_versions where company_id=target_company and version>v.version) or exists(select 1 from neuvetra.source_worksheet_reviews where company_id=target_company and version_id=v.id) then raise exception 'worksheet review conflicts' using errcode='23505';end if;
 review_id:=gen_random_uuid();
 digest:=encode(sha256(convert_to(concat_ws(E'\n','neuvetra.synthetic.source-electricity-worksheet.v1',target_company::text,review_id::text,v.id::text,v.result_sha256,request->>'decision',coalesce(note,'<null>'),(select coalesce(string_agg(value,',' order by ord),'') from jsonb_array_elements_text(request->'acknowledgedLimitations') with ordinality as a(value,ord)),actor::text),'utf8')),'hex');
 body:=jsonb_build_object('id',review_id,'versionId',v.id,'resultSha256',v.result_sha256,'decision',request->>'decision','note',note,'acknowledgedLimitations',request->'acknowledgedLimitations','reviewerId',actor,'decisionSha256',digest);
 insert into neuvetra.source_worksheet_reviews values(review_id,target_company,v.id,body,digest,fingerprint,actor,decision_captured_at);
 insert into neuvetra.source_worksheet_requests values(target_company,(request->>'idempotencyKey')::uuid,fingerprint,'review',review_id);
 insert into neuvetra.source_worksheet_audit values(gen_random_uuid(),target_company,review_id,'review',digest,actor,decision_captured_at);
 return review_id;
end $$;

revoke all on function neuvetra.review_source_worksheet(uuid,jsonb) from public,authenticated;
create function neuvetra.save_source_worksheet(target_company uuid, request jsonb, correction boolean) returns uuid
language plpgsql security definer set search_path=pg_catalog,neuvetra,pg_temp as $$
declare actor uuid:=neuvetra.current_user_id(); predecessor record; prior record; new_id uuid; seq integer; fingerprint text; input_hash text; result_hash text;
 raw_quantity text; kwh text; mwh text; exact_total text; display_total text; scaled numeric; q numeric; rem numeric; reason text; body jsonb; method jsonb; evidence jsonb; source record; captured timestamptz; captured_text text; difference_reason text;
begin
 if actor is null or not neuvetra.can_manage_company(target_company) then raise exception 'workspace not found' using errcode='42501';end if;
 perform id from neuvetra.companies where id=target_company for update;
 if not neuvetra.can_manage_company(target_company) then raise exception 'workspace not found' using errcode='42501';end if;
 captured:=date_trunc('milliseconds',clock_timestamp());captured_text:=to_char(captured at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 if jsonb_typeof(request) is distinct from 'object' or (select array_agg(key order by key) from jsonb_object_keys(request) key) is distinct from (case when correction then array['companyLabel','correctionReason','expectedResultSha256','expectedSourceSha256','expectedVersionId','facilityLabel','geography','idempotencyKey','manualConfirmation','period','quantityDifferenceReason','quantityKwh','sourceId','sourcePage','unit'] else array['companyLabel','expectedSourceSha256','facilityLabel','geography','idempotencyKey','manualConfirmation','period','quantityDifferenceReason','quantityKwh','sourceId','sourcePage','unit'] end) then raise exception 'invalid worksheet input' using errcode='22023';end if;
 if exists(select 1 from jsonb_each(request) where key not in('sourcePage','manualConfirmation','quantityDifferenceReason') and jsonb_typeof(value)<>'string') or request->>'period'<>'2023-01' or request->>'geography'<>'CAMX' or request->>'unit'<>'kWh' or request->>'idempotencyKey' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'invalid worksheet input' using errcode='22023';end if;
 if request->>'companyLabel' !~ '^[ -~]{1,100}$' or request->>'companyLabel'<>btrim(request->>'companyLabel') or request->>'facilityLabel' !~ '^[ -~]{1,100}$' or request->>'facilityLabel'<>btrim(request->>'facilityLabel') then raise exception 'invalid worksheet label' using errcode='22023';end if;
 if request->'sourcePage' is distinct from '1'::jsonb or request->'manualConfirmation' is distinct from 'true'::jsonb or request->>'sourceId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or request->>'expectedSourceSha256' !~ '^[0-9a-f]{64}$' then raise exception 'invalid source confirmation' using errcode='22023';end if;
 select * into source from neuvetra.electricity_sources where company_id=target_company and id=(request->>'sourceId')::uuid;
 if not found or source.sha256 is distinct from request->>'expectedSourceSha256' then raise exception 'source conflicts' using errcode='23505';end if;
 if encode(sha256(source.original_bytes),'hex')<>source.sha256 or octet_length(source.original_bytes)<>source.byte_length then raise exception 'source integrity failed';end if;
 raw_quantity:=request->>'quantityKwh';
 if char_length(raw_quantity)>11 or raw_quantity !~ '^(0|[1-9][0-9]{0,6})(\.[0-9]{1,3})?$' or raw_quantity ~ '[^0-9.]' then raise exception 'invalid worksheet quantity' using errcode='22023';end if;
 if raw_quantity::numeric>1000000 then raise exception 'invalid worksheet quantity' using errcode='22023';end if;
 kwh:=(raw_quantity::numeric)::numeric(10,3)::text;
 difference_reason:=request->>'quantityDifferenceReason';
 if kwh=source.printed_quantity_kwh then
  if request->'quantityDifferenceReason' is distinct from 'null'::jsonb then raise exception 'invalid quantity difference reason' using errcode='22023';end if;
 else
  if jsonb_typeof(request->'quantityDifferenceReason') is distinct from 'string' or difference_reason !~ '^[ -~]+$' or char_length(difference_reason) not between 1 and 500 or difference_reason<>btrim(difference_reason) then raise exception 'quantity difference reason required' using errcode='22023';end if;
 end if;
 evidence:=jsonb_build_object('source',neuvetra.electricity_source_metadata(source.id,target_company),'page',1,'confirmedBy',actor,'confirmedAt',captured_text,'quantityDifferenceReason',difference_reason);
 mwh:=(raw_quantity::numeric*0.001)::numeric(10,6)::text;
 scaled:=raw_quantity::numeric*1000*1950402888;
 exact_total:=rtrim(rtrim((scaled*0.0000000000001)::numeric(20,13)::text,'0'),'.');
 q:=div(scaled,1000000000); rem:=mod(scaled,1000000000);
 if rem>500000000 or (rem=500000000 and mod(q,2)=1) then q:=q+1;end if;
 display_total:=(q*0.0001)::numeric(12,4)::text;
 if correction then
  reason:=request->>'correctionReason';
  if (reason !~ '^[ -~]+$' or char_length(reason) not between 1 and 500) or reason<>btrim(reason) then raise exception 'invalid correction reason' using errcode='22023';end if;
 else reason:=null;end if;
 fingerprint:=encode(sha256(convert_to(actor::text||E'\n'||correction::text||E'\n'||((request-'idempotencyKey')||jsonb_build_object('quantityKwh',kwh))::text,'utf8')),'hex');
 select * into prior from neuvetra.source_worksheet_requests where company_id=target_company and idempotency_key=(request->>'idempotencyKey')::uuid;
 if found then
  if prior.kind<>'save' or prior.operation_fingerprint<>fingerprint then raise exception 'worksheet request conflicts' using errcode='23505';end if;
  return prior.record_id;
 end if;
 select id into new_id from neuvetra.source_worksheet_versions where company_id=target_company and operation_fingerprint=fingerprint;
 if found then
  insert into neuvetra.source_worksheet_requests values(target_company,(request->>'idempotencyKey')::uuid,fingerprint,'save',new_id);
  return new_id;
 end if;
 select * into predecessor from neuvetra.source_worksheet_versions where company_id=target_company order by version desc limit 1;
 if correction then
  if not found or predecessor.id is distinct from (request->>'expectedVersionId')::uuid or predecessor.result_sha256 is distinct from request->>'expectedResultSha256' or (predecessor.payload->>'quantityKwh'=kwh and predecessor.payload->>'companyLabel'=request->>'companyLabel' and predecessor.payload->>'facilityLabel'=request->>'facilityLabel' and predecessor.payload#>>'{evidence,source,id}'=source.id::text and predecessor.payload#>'{evidence,quantityDifferenceReason}'=request->'quantityDifferenceReason') then raise exception 'worksheet correction conflicts' using errcode='23505';end if;
  seq:=predecessor.version+1;
 else
  if found then raise exception 'worksheet already exists' using errcode='23505';end if;
  seq:=1;
 end if;
 new_id:=gen_random_uuid();
 input_hash:=encode(sha256(convert_to(concat_ws(E'\n','neuvetra.synthetic.source-electricity-worksheet.v1',target_company::text,new_id::text,seq::text,coalesce(predecessor.id::text,'<null>'),actor::text,request->>'companyLabel',request->>'facilityLabel',kwh,'2023-01','CAMX','kWh',coalesce(reason,'<null>'),source.id::text,target_company::text,source.fixture_id,source.original_name,source.media_type,source.byte_length::text,source.sha256,source.printed_quantity_kwh,source.uploaded_by::text,to_char(source.uploaded_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'1',actor::text,captured_text,coalesce(difference_reason,'<null>')),'utf8')),'hex');
 method:='{"id":"scope2-location-based-egrid-subregion","version":"2023-r2-camx-v1","factorId":"epa-egrid2023-r2-camx-total-output","factorVersion":"eGRID2023-revision-2","factorValue":"195.0402888","factorUnit":"kg CO2e/MWh","sourceSha256":"3dfbbcf2f949d58d5b2dbee3aab8150bd04a0c8ebb730ba1cd37a013bd4450ab","sheet":"SRL23","cell":"AI6","classification":"development_candidate","policy":"m64-accounting-policy-v1","accountingProfile":"manual-synthetic-2023-01-camx-kwh-v1","factorCandidateSha256":"8770ae6238df8525e5250850fab248c934be33f459ed19cc1fa24bd0718cb356","gwpPolicySha256":"fd9fd8973012da1a232dad7fc00db3013194751a92b34ab21dfd4f7b2c5148c5","reviewedEngineSha256":"4ad28f3877d13f238bbbf7e8bfb1fc6241922b9def73712ec1b02fd80b51b82c"}'::jsonb;
 result_hash:=encode(sha256(convert_to(concat_ws(E'\n',input_hash,mwh,exact_total,display_total,'kg CO2e','half_even_4dp',method->>'id',method->>'version',method->>'factorId',method->>'factorVersion',method->>'factorValue',method->>'factorUnit',method->>'sourceSha256',method->>'sheet',method->>'cell',method->>'classification',method->>'policy',method->>'accountingProfile',method->>'factorCandidateSha256',method->>'gwpPolicySha256',method->>'reviewedEngineSha256','synthetic=true','complete=false','releaseEligible=false','assurance=none','synthetic_manual_confirmation','document_attachment_not_verification','overall_inventory_incomplete','january_2023_camx_only','market_based_scope2_not_included','factor_and_method_not_released','scope_1_and_scope_3_not_assessed','no_assurance'),'utf8')),'hex');
 body:=jsonb_build_object('id',new_id,'version',seq,'previousVersionId',predecessor.id,'companyLabel',request->>'companyLabel','facilityLabel',request->>'facilityLabel','quantityKwh',kwh,'quantityMwh',mwh,'period','2023-01','geography','CAMX','unit','kWh','correctionReason',reason,'inputSha256',input_hash,'resultSha256',result_hash,'createdBy',actor,'evidence',evidence,'method',method,'total',jsonb_build_object('unrounded',exact_total,'display',display_total,'unit','kg CO2e','rounding','half_even_4dp'));
 insert into neuvetra.source_worksheet_versions values(new_id,target_company,seq,predecessor.id,body,input_hash,result_hash,fingerprint,actor,captured);
 insert into neuvetra.source_worksheet_requests values(target_company,(request->>'idempotencyKey')::uuid,fingerprint,'save',new_id);
 insert into neuvetra.source_worksheet_audit values(gen_random_uuid(),target_company,new_id,'save',result_hash,actor,captured);
 return new_id;
end $$;
revoke all on function neuvetra.save_source_worksheet(uuid,jsonb,boolean) from public,authenticated;
do $$ begin
 if exists(select 1 from pg_roles where rolname='neuvetra_runtime') then
  grant execute on function neuvetra.save_source_worksheet(uuid,jsonb,boolean),neuvetra.review_source_worksheet(uuid,jsonb) to neuvetra_runtime;
 end if;
end $$;




-- M65 adds immutable worksheet reports; existing M63/M64 rows and contracts are untouched.
create table neuvetra.source_worksheet_reports (
 id uuid primary key, company_id uuid not null references neuvetra.companies(id), source_version_id uuid not null,
 source_input_sha256 text not null, source_result_sha256 text not null, review_id uuid, review_sha256 text,
 template_version text not null, template_sha256 text not null, source_snapshot jsonb not null,
 report_bytes bytea not null, report_sha256 text not null, report_byte_length integer not null check(report_byte_length between 1 and 98304),
 operation_fingerprint text not null, created_by uuid not null references auth.users(id), created_at timestamptz not null,
 unique(id,company_id),unique(company_id,operation_fingerprint),
 foreign key(source_version_id,company_id) references neuvetra.source_worksheet_versions(id,company_id),
 foreign key(review_id,company_id) references neuvetra.source_worksheet_reviews(id,company_id),
 check((review_id is null)=(review_sha256 is null)),
 check(source_input_sha256~'^[0-9a-f]{64}$' and source_result_sha256~'^[0-9a-f]{64}$' and template_sha256~'^[0-9a-f]{64}$' and report_sha256~'^[0-9a-f]{64}$' and operation_fingerprint~'^[0-9a-f]{64}$'),
 check(octet_length(report_bytes)=report_byte_length and encode(sha256(report_bytes),'hex')=report_sha256)
);
create table neuvetra.source_worksheet_report_requests (
 company_id uuid not null, idempotency_key uuid not null, operation_fingerprint text not null, report_id uuid not null,
 requested_by uuid not null references auth.users(id), primary key(company_id,idempotency_key),
 foreign key(report_id,company_id) references neuvetra.source_worksheet_reports(id,company_id)
);
create table neuvetra.source_worksheet_report_audit (
 id uuid primary key, company_id uuid not null, report_id uuid not null, actor_id uuid not null references auth.users(id),
 event_meta jsonb not null, created_at timestamptz not null, unique(company_id,report_id),
 foreign key(report_id,company_id) references neuvetra.source_worksheet_reports(id,company_id)
);
do $$ declare relation text; begin
 foreach relation in array array['source_worksheet_reports','source_worksheet_report_requests','source_worksheet_report_audit'] loop
  execute format('alter table neuvetra.%I enable row level security',relation);
  execute format('alter table neuvetra.%I force row level security',relation);
  execute format('create policy m66_report_member_read on neuvetra.%I for select to authenticated using(neuvetra.is_company_member(company_id))',relation);
  execute format('grant select on neuvetra.%I to authenticated',relation);
  execute format('revoke all on neuvetra.%I from public',relation);
  execute format('create trigger m66_report_immutable before update or delete on neuvetra.%I for each row execute function neuvetra.reject_inventory_history_mutation()',relation);
  if exists(select 1 from pg_roles where rolname='neuvetra_runtime') then
   execute format('create policy m66_report_runtime_read on neuvetra.%I for select to neuvetra_runtime using(neuvetra.is_company_member(company_id))',relation);
   execute format('grant select on neuvetra.%I to neuvetra_runtime',relation);
   execute format('revoke all on neuvetra.%I from authenticated',relation);
  end if;
 end loop;
end $$;
-- The same company row is locked exclusively by M64 corrections/reviews.
create function neuvetra.lock_source_worksheet_report_read(target_company uuid) returns boolean
language plpgsql security definer set search_path=pg_catalog,neuvetra,pg_temp as $$
begin
 if not neuvetra.is_company_member(target_company) then return false;end if;
 perform id from neuvetra.companies where id=target_company for share;
 return found and neuvetra.is_company_member(target_company);
end $$;
revoke all on function neuvetra.lock_source_worksheet_report_read(uuid) from public,authenticated;
grant execute on function neuvetra.lock_source_worksheet_report_read(uuid) to authenticated;

create function neuvetra.source_worksheet_report_template() returns text language sql immutable set search_path=pg_catalog as $function$ select $template$<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Source-linked synthetic electricity worksheet report — {{companyLabel}}</title>
<style>body{font:16px/1.55 system-ui,sans-serif;color:#182820;max-width:850px;margin:32px auto;padding:0 22px}h1{font-size:1.85rem;line-height:1.2}h2{font-size:1.2rem;margin-top:1.8rem}p,li,dd{overflow-wrap:anywhere}dl{display:grid;grid-template-columns:minmax(110px,1fr) minmax(0,3fr);gap:6px 18px}dt{font-weight:650}dd{margin:0;min-width:0}.notice{border:2px solid #927130;background:#fff8e8;padding:14px}.subtotal{font-size:2rem;font-weight:750;margin-bottom:0}.mono{font:12px/1.55 ui-monospace,monospace;overflow-wrap:anywhere;white-space:pre-wrap}.review-note{white-space:pre-wrap;border-left:3px solid #a1aea5;padding-left:12px}.print-status{display:none}.muted{color:#405248}a{color:#16553b}@media(max-width:500px){body{padding:0 14px}dl{display:block}dd{margin:2px 0 12px}}@page{size:auto;margin:24mm 15mm 22mm;@top-center{content:"Draft · Synthetic · Incomplete · Unreleased · No assurance";font:700 8pt/1.2 system-ui,sans-serif;color:#182820;vertical-align:middle}@bottom-center{content:"Draft · Synthetic · Incomplete · Unreleased · No assurance · Page " counter(page);font:700 8pt/1.2 system-ui,sans-serif;color:#182820;vertical-align:middle}}@media print{body{font-size:10pt;margin:0;max-width:none;padding:0}h1{font-size:21pt}h2{break-after:avoid}p,li,dd{orphans:3;widows:3}.notice{background:white}.subtotal{font-size:24pt}.mono{font-size:8pt}dl{display:block}dt{margin-top:7px}dd{margin-left:0}a{color:inherit;text-decoration:none}}</style></head><body>
<header class="print-status print-header">Draft · Synthetic · Incomplete · Unreleased · No assurance</header><footer class="print-status print-footer">Draft · Synthetic · Incomplete · Unreleased · No assurance · January 2023 CAMX worksheet only</footer>
<main><p>Neuvetra · Saved worksheet snapshot</p><h1>Source-linked synthetic electricity worksheet report</h1><div class="notice"><strong>Draft · Synthetic · Incomplete · Unreleased · No assurance</strong><br>Fictional manual data for private testing. Retained fictional bill; no verification, filing approval or professional assurance.</div>
<h2>January location-based subtotal</h2><p class="subtotal">{{display}} kg CO2e</p><p>Exact subtotal before display rounding: <strong>{{unrounded}} kg CO2e</strong></p><dl><dt>Fictional company</dt><dd>{{companyLabel}}</dd><dt>Fictional facility</dt><dd>{{facilityLabel}}</dd><dt>Period</dt><dd>January 1–31, 2023</dd><dt>Declared geography</dt><dd>United States · California · CAMX</dd><dt>Boundary</dt><dd>Operational control · Location-based Scope 2</dd><dt>Activity</dt><dd>Grid-delivered purchased electricity consumed by the reporting company</dd><dt>Manual quantity</dt><dd>{{quantityKwh}} kWh</dd><dt>Converted quantity</dt><dd>{{quantityMwh}} MWh · 1 MWh = 1,000 kWh</dd><dt>Evidence</dt><dd>Manual confirmation from a retained fictional bill</dd></dl>
<p>Display rounded once to four decimal places, half to even; no intermediate rounding. Decimal precision does not establish measurement certainty.</p>
<h2>Retained fictional bill and manual confirmation</h2><p>Retained fictional bill - not real customer evidence. Attachment and manual confirmation do not verify the document, its applicability or the entered quantity. No automated extraction or assurance is provided.</p><dl><dt>Source ID</dt><dd class="mono">{{evidenceId}}</dd><dt>Fictional fixture</dt><dd>{{fixtureId}}</dd><dt>File name</dt><dd>{{evidenceName}}</dd><dt>Media type / bytes</dt><dd>application/pdf / {{evidenceBytes}}</dd><dt>Source fingerprint</dt><dd class="mono">{{evidenceSha256}}</dd><dt>Printed bill quantity</dt><dd>{{printedQuantityKwh}} kWh</dd><dt>Manual worksheet quantity</dt><dd>{{quantityKwh}} kWh</dd><dt>Source locator</dt><dd>Page {{sourcePage}} - Electricity usage / Metered electricity</dd><dt>Uploaded by / at (UTC)</dt><dd>{{uploadedBy}} / {{uploadedAt}}</dd><dt>Manually confirmed by / at (UTC)</dt><dd>{{confirmedBy}} / {{confirmedAt}}</dd></dl><p class="review-note">{{quantityDifference}}</p><p>The source fingerprint identifies the exact retained PDF. Retrieve the source through the authorized application; this report contains no public source URL.</p>
<h2>Worksheet review captured for this report</h2><p><strong>{{reviewSummary}}</strong></p><p>This is a snapshot of a worksheet decision, not approval of this report presentation or assurance. The manager’s worksheet decision covers this recorded manual confirmation; it does not authenticate the fictional bill or approve the report presentation.</p><dl><dt>Reviewed source</dt><dd>Worksheet version {{sourceVersion}} · {{sourceVersionId}}</dd><dt>Result fingerprint</dt><dd class="mono">{{resultSha256}}</dd><dt>Manager reference</dt><dd class="mono">{{reviewerId}}</dd><dt>Decision time (UTC)</dt><dd>{{reviewedAt}}</dd><dt>Decision ID</dt><dd class="mono">{{reviewId}}</dd><dt>Decision fingerprint</dt><dd class="mono">{{reviewSha256}}</dd><dt>Acknowledgments</dt><dd>{{reviewAcknowledgments}}</dd></dl><p class="review-note">{{reviewNote}}</p><p class="muted">Review state was captured at {{createdAt}}. Later worksheet decisions and corrections do not change this report.</p>
<h2>Source and correction history</h2><dl><dt>Worksheet version</dt><dd>{{sourceVersion}} · {{sourceVersionId}}</dd><dt>Saved (UTC)</dt><dd>{{sourceCreatedAt}}</dd><dt>Source creator</dt><dd class="mono">{{sourceCreatedBy}}</dd><dt>Predecessor</dt><dd class="mono">{{previousVersionId}}</dd><dt>Correction reason</dt><dd>{{correctionReason}}</dd><dt>Tenant binding</dt><dd class="mono">{{companyId}}</dd><dt>Input fingerprint</dt><dd class="mono">{{inputSha256}}</dd><dt>Result fingerprint</dt><dd class="mono">{{resultSha256}}</dd></dl>
<h2>Pinned method and source</h2><p>An annual 2023 regional average factor is applied to January consumption. This is not a January-specific factor or a complete annual inventory.</p><dl><dt>Method</dt><dd>{{methodId}} · {{methodVersion}}</dd><dt>Candidate factor</dt><dd>{{factorId}} · {{factorVersion}}</dd><dt>Rate</dt><dd>{{factorValue}} kg CO2e/MWh</dd><dt>Workbook locator</dt><dd>EPA eGRID2023 metric workbook, revision 2 · SRL23!AI6 · annual total-output CO2e rate; A6=2023, B6=CAMX, C6=WECC California</dd><dt>Workbook fingerprint</dt><dd class="mono">{{sourceSha256}}</dd><dt>Candidate fingerprint</dt><dd class="mono">{{factorCandidateSha256}}</dd><dt>GWP policy</dt><dd>AR5 · 100 years · without climate-carbon feedbacks; CO2 1, CH4 28, N2O 265</dd><dt>GWP fingerprint</dt><dd class="mono">{{gwpPolicySha256}}</dd><dt>Reviewed engine fingerprint</dt><dd class="mono">{{reviewedEngineSha256}}</dd></dl><p><a href="https://www.epa.gov/system/files/documents/2025-06/egrid2023_data_metric_rev2.xlsx" rel="noreferrer">EPA source workbook</a> · <a href="https://www.epa.gov/system/files/documents/2025-01/egrid2023_technical_guide.pdf" rel="noreferrer">EPA technical guide, page 12, section 3.1.1.2 / Table 3-1</a></p><p>The existing reviewed candidate decimal normalization is retained. No factor or method is released by this report.</p>
<h2>Incomplete coverage and limitations</h2><ul><li>All input is fictional manual data linked to a retained fictional bill, not real or independently verified evidence.</li><li>The overall inventory is incomplete. February–December and other facilities/sources are not assessed; missing coverage is not zero consumption.</li><li>This worksheet covers January 2023 CAMX only.</li><li>Market-based Scope 2 is not included.</li><li>The factor and method are unreleased development candidates.</li><li>Scope 1 and Scope 3 are not assessed.</li><li>No assurance, verification, certification or filing approval is provided. Release eligibility remains false.</li></ul>
<h2>Report identity</h2><dl><dt>Report ID</dt><dd class="mono">{{reportId}}</dd><dt>Captured (UTC)</dt><dd>{{createdAt}}</dd><dt>Report creator</dt><dd class="mono">{{createdBy}}</dd><dt>Report profile</dt><dd>{{profile}}</dd><dt>Template version</dt><dd>{{templateVersion}}</dd><dt>Template fingerprint</dt><dd class="mono">{{templateSha256}}</dd><dt>Snapshot identity fingerprint</dt><dd class="mono">{{identitySha256}}</dd></dl><p class="muted">The snapshot identity fingerprint binds the company, worksheet input/result, captured review and template. The authenticated application receipt records the SHA-256 of all UTF-8 HTML bytes; this document does not embed its own byte hash. Browser print/PDF layout and bytes may vary and are not covered by the HTML hash. This report identifies its saved source version and does not claim that it remains the latest worksheet.</p>
</main></body></html>
$template$::text $function$;
revoke all on function neuvetra.source_worksheet_report_template() from public,authenticated;

create function neuvetra.render_source_worksheet_report(report_id uuid,company uuid,creator uuid,captured text,source jsonb,identity_sha text) returns bytea
language plpgsql immutable set search_path=pg_catalog,neuvetra,pg_temp as $$
declare result text:=neuvetra.source_worksheet_report_template(); values_map jsonb; item record; escaped text; r jsonb:=source->'review'; m jsonb:=source->'method';
begin
 values_map:=jsonb_build_object(
 'evidenceId',source#>>'{evidence,source,id}','fixtureId',source#>>'{evidence,source,fixtureId}','evidenceName',source#>>'{evidence,source,originalName}','evidenceBytes',source#>>'{evidence,source,byteLength}','evidenceSha256',source#>>'{evidence,source,sha256}','printedQuantityKwh',source#>>'{evidence,source,printedQuantityKwh}','sourcePage',source#>>'{evidence,page}','uploadedBy',source#>>'{evidence,source,uploadedBy}','uploadedAt',source#>>'{evidence,source,uploadedAt}','confirmedBy',source#>>'{evidence,confirmedBy}','confirmedAt',source#>>'{evidence,confirmedAt}',
 'quantityDifference',case when source#>>'{evidence,quantityDifferenceReason}' is null then 'The manual worksheet quantity matches the printed fictional bill quantity; this is not independent verification.' else 'Manual worksheet quantity differs from the bill: '||(source#>>'{evidence,quantityDifferenceReason}') end)||jsonb_build_object(
 'companyLabel',source->>'companyLabel','facilityLabel',source->>'facilityLabel','display',source#>>'{total,display}','unrounded',source#>>'{total,unrounded}','quantityKwh',source->>'quantityKwh','quantityMwh',source->>'quantityMwh',
 'reviewSummary',case when r='null'::jsonb then 'No worksheet review was recorded when this report was created.' when r->>'decision'='accept_bounded_internal_draft' then 'The worksheet version was accepted for bounded internal use.' else 'A manager requested changes to this worksheet version.' end,
 'sourceVersion',source->>'version','sourceVersionId',source->>'id','resultSha256',source->>'resultSha256','reviewerId',coalesce(r->>'reviewerId','Not recorded at capture'),'reviewedAt',coalesce(r->>'reviewedAt','Not recorded at capture'),'reviewId',coalesce(r->>'id','None at capture'),'reviewSha256',coalesce(r->>'decisionSha256','None at capture'),
 'reviewAcknowledgments',coalesce((select string_agg(value,', ' order by ord) from jsonb_array_elements_text(case when r='null'::jsonb then '[]'::jsonb else r->'acknowledgedLimitations' end) with ordinality a(value,ord)),'No acceptance acknowledgments'),
 'reviewNote',coalesce(r->>'note','No change-request note at capture'),'createdAt',captured,'sourceCreatedAt',source->>'createdAt','sourceCreatedBy',source->>'createdBy','previousVersionId',coalesce(source->>'previousVersionId','None — initial saved version'),'correctionReason',coalesce(source->>'correctionReason','Initial saved version — no correction'),'companyId',company::text,'inputSha256',source->>'inputSha256',
 'methodId',m->>'id','methodVersion',m->>'version','factorId',m->>'factorId','factorVersion',m->>'factorVersion','factorValue',m->>'factorValue','sourceSha256',m->>'sourceSha256','factorCandidateSha256',m->>'factorCandidateSha256','gwpPolicySha256',m->>'gwpPolicySha256','reviewedEngineSha256',m->>'reviewedEngineSha256',
 'reportId',report_id::text,'createdBy',creator::text,'profile','neuvetra.synthetic.source-electricity-report.v1','templateVersion','m66-source-january-camx-report-v1','templateSha256',encode(sha256(convert_to(neuvetra.source_worksheet_report_template(),'utf8')),'hex'),'identitySha256',identity_sha);
 for item in select key,value from jsonb_each_text(values_map) loop
  if item.value is null then raise exception 'report source is invalid' using errcode='22023';end if;
  escaped:=replace(replace(replace(replace(replace(replace(replace(item.value,'&','&amp;'),'<','&lt;'),'>','&gt;'),'"','&quot;'),'''','&#39;'),'{','&#123;'),'}','&#125;');
  result:=replace(result,'{{'||item.key||'}}',escaped);
 end loop;
 if result ~ '\{\{[a-zA-Z0-9]+\}\}' then raise exception 'unresolved report template';end if;
 return convert_to(result,'utf8');
end $$;
revoke all on function neuvetra.render_source_worksheet_report(uuid,uuid,uuid,text,jsonb,text) from public,authenticated;

create function neuvetra.create_source_worksheet_report(target_company uuid,request jsonb) returns uuid
language plpgsql security definer set search_path=pg_catalog,neuvetra,pg_temp as $$
declare actor uuid:=neuvetra.current_user_id(); v record; r record; prior record; source jsonb; report_id uuid; fingerprint text;
 template_sha text:=encode(sha256(convert_to(neuvetra.source_worksheet_report_template(),'utf8')),'hex'); captured timestamptz; captured_text text; content bytea; content_sha text; meta jsonb;
begin
 if actor is null or not neuvetra.can_manage_company(target_company) then raise exception 'workspace not found' using errcode='42501';end if;
 perform id from neuvetra.companies where id=target_company for update;
 if not neuvetra.can_manage_company(target_company) then raise exception 'workspace not found' using errcode='42501';end if;
 if jsonb_typeof(request) is distinct from 'object' or (select array_agg(key order by key) from jsonb_object_keys(request) key) is distinct from array['expectedInputSha256','expectedResultSha256','expectedReviewId','expectedReviewSha256','idempotencyKey','sourceVersionId']::text[] then raise exception 'invalid report request' using errcode='22023';end if;
 if exists(select 1 from jsonb_each(request) where key not in('expectedReviewId','expectedReviewSha256') and jsonb_typeof(value)<>'string') or request->>'sourceVersionId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or request->>'idempotencyKey' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or request->>'expectedInputSha256' !~ '^[0-9a-f]{64}$' or request->>'expectedResultSha256' !~ '^[0-9a-f]{64}$' then raise exception 'invalid report request' using errcode='22023';end if;
 if not ((request->'expectedReviewId'='null'::jsonb and request->'expectedReviewSha256'='null'::jsonb) or (jsonb_typeof(request->'expectedReviewId')='string' and jsonb_typeof(request->'expectedReviewSha256')='string' and request->>'expectedReviewId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and request->>'expectedReviewSha256' ~ '^[0-9a-f]{64}$')) then raise exception 'invalid review binding' using errcode='22023';end if;
 select * into v from neuvetra.source_worksheet_versions where company_id=target_company and id=(request->>'sourceVersionId')::uuid;
 if not found or v.input_sha256 is distinct from request->>'expectedInputSha256' or v.result_sha256 is distinct from request->>'expectedResultSha256' then raise exception 'report source conflicts' using errcode='23505';end if;
 fingerprint:=encode(sha256(convert_to(concat_ws(E'\n','neuvetra.synthetic.source-electricity-report.v1',target_company::text,v.id::text,v.input_sha256,v.result_sha256,coalesce(request->>'expectedReviewId','<none>'),coalesce(request->>'expectedReviewSha256','<none>'),'m66-source-january-camx-report-v1',template_sha),'utf8')),'hex');
 select * into prior from neuvetra.source_worksheet_report_requests where company_id=target_company and idempotency_key=(request->>'idempotencyKey')::uuid;
 if found then
  if prior.operation_fingerprint<>fingerprint then raise exception 'report request conflicts' using errcode='23505';end if;
  return prior.report_id;
 end if;
 select id into report_id from neuvetra.source_worksheet_reports where company_id=target_company and operation_fingerprint=fingerprint;
 if found then
  insert into neuvetra.source_worksheet_report_requests values(target_company,(request->>'idempotencyKey')::uuid,fingerprint,report_id,actor);
  return report_id;
 end if;
 select * into r from neuvetra.source_worksheet_reviews where company_id=target_company and version_id=v.id;
 if r.id is distinct from (request->>'expectedReviewId')::uuid or r.decision_sha256 is distinct from request->>'expectedReviewSha256' then raise exception 'report review snapshot changed' using errcode='23505';end if;
 source:=v.payload||jsonb_build_object('createdAt',to_char(v.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'review',case when r.id is null then 'null'::jsonb else r.payload||jsonb_build_object('reviewedAt',to_char(r.reviewed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) end);
 report_id:=gen_random_uuid();captured:=date_trunc('milliseconds',clock_timestamp());captured_text:=to_char(captured at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 content:=neuvetra.render_source_worksheet_report(report_id,target_company,actor,captured_text,source,fingerprint);
 content_sha:=encode(sha256(content),'hex');
 insert into neuvetra.source_worksheet_reports values(report_id,target_company,v.id,v.input_sha256,v.result_sha256,r.id,r.decision_sha256,'m66-source-january-camx-report-v1',template_sha,source,content,content_sha,octet_length(content),fingerprint,actor,captured);
 insert into neuvetra.source_worksheet_report_requests values(target_company,(request->>'idempotencyKey')::uuid,fingerprint,report_id,actor);
 meta:=jsonb_build_object('profile','neuvetra.synthetic.source-electricity-report.v1','reportId',report_id,'sourceVersionId',v.id,'inputSha256',v.input_sha256,'resultSha256',v.result_sha256,'reviewId',r.id,'reviewSha256',r.decision_sha256,'templateVersion','m66-source-january-camx-report-v1','templateSha256',template_sha,'reportSha256',content_sha,'reportByteLength',octet_length(content),'identitySha256',fingerprint);
 insert into neuvetra.source_worksheet_report_audit values(gen_random_uuid(),target_company,report_id,actor,meta,captured);
 return report_id;
end $$;
revoke all on function neuvetra.create_source_worksheet_report(uuid,jsonb) from public,authenticated;
do $$ begin
 if exists(select 1 from pg_roles where rolname='neuvetra_runtime') then
  grant execute on function neuvetra.lock_source_worksheet_report_read(uuid),neuvetra.create_source_worksheet_report(uuid,jsonb) to neuvetra_runtime;
  revoke all on function neuvetra.lock_source_worksheet_report_read(uuid) from authenticated;
 end if;
end $$;


