-- Additive M64 history. Never changes M54-M63 domain records or migration bytes.
create table neuvetra.electricity_worksheet_versions (
 id uuid primary key, company_id uuid not null references neuvetra.companies(id), version integer not null check(version>0),
 previous_version_id uuid, payload jsonb not null, input_sha256 text not null, result_sha256 text not null,
 operation_fingerprint text not null, created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 unique(id,company_id), unique(company_id,version), unique(company_id,operation_fingerprint),
 foreign key(previous_version_id,company_id) references neuvetra.electricity_worksheet_versions(id,company_id),
 check(input_sha256~'^[0-9a-f]{64}$' and result_sha256~'^[0-9a-f]{64}$' and operation_fingerprint~'^[0-9a-f]{64}$')
);
create table neuvetra.electricity_worksheet_reviews (
 id uuid primary key, company_id uuid not null, version_id uuid not null, payload jsonb not null,
 decision_sha256 text not null check(decision_sha256~'^[0-9a-f]{64}$'), operation_fingerprint text not null,
 reviewed_by uuid not null references auth.users(id), reviewed_at timestamptz not null default now(),
 unique(id,company_id), unique(company_id,version_id), unique(company_id,operation_fingerprint),
 foreign key(version_id,company_id) references neuvetra.electricity_worksheet_versions(id,company_id)
);
create table neuvetra.electricity_worksheet_requests (
 company_id uuid not null references neuvetra.companies(id), idempotency_key uuid not null, operation_fingerprint text not null,
 kind text not null check(kind in('save','review')), record_id uuid not null, primary key(company_id,idempotency_key)
);
create table neuvetra.electricity_worksheet_audit (
 id uuid primary key, company_id uuid not null references neuvetra.companies(id), record_id uuid not null,
 kind text not null check(kind in('save','review')), record_sha256 text not null, actor_id uuid not null references auth.users(id),
 created_at timestamptz not null default now(), unique(company_id,kind,record_id)
);
do $$ declare relation text; begin
 foreach relation in array array['electricity_worksheet_versions','electricity_worksheet_reviews','electricity_worksheet_requests','electricity_worksheet_audit'] loop
  execute format('alter table neuvetra.%I enable row level security',relation);
  execute format('alter table neuvetra.%I force row level security',relation);
  execute format('create policy m64_member_read on neuvetra.%I for select to authenticated using(neuvetra.is_company_member(company_id))',relation);
  execute format('grant select on neuvetra.%I to authenticated',relation);
  execute format('revoke all on neuvetra.%I from public',relation);
  execute format('create trigger m64_immutable before update or delete on neuvetra.%I for each row execute function neuvetra.reject_inventory_history_mutation()',relation);
  if exists(select 1 from pg_roles where rolname='neuvetra_runtime') then
   execute format('create policy m64_runtime_read on neuvetra.%I for select to neuvetra_runtime using(neuvetra.is_company_member(company_id))',relation);
   execute format('grant select on neuvetra.%I to neuvetra_runtime',relation);
   execute format('revoke all on neuvetra.%I from authenticated',relation);
  end if;
 end loop;
end $$;

create function neuvetra.review_electricity_worksheet(target_company uuid, request jsonb) returns uuid
language plpgsql security definer set search_path=pg_catalog,neuvetra,pg_temp as $$
declare actor uuid:=neuvetra.current_user_id(); v record; prior record; review_id uuid:=gen_random_uuid(); fingerprint text; digest text; body jsonb; acknowledgments jsonb; note text;
begin
 if actor is null or not neuvetra.can_manage_company(target_company) then raise exception 'workspace not found' using errcode='42501'; end if;
 perform id from neuvetra.companies where id=target_company for update;
 if jsonb_typeof(request) is distinct from 'object' or (select array_agg(key order by key) from jsonb_object_keys(request) key) is distinct from array['acknowledgedLimitations','decision','expectedResultSha256','idempotencyKey','note','versionId']::text[] then raise exception 'invalid worksheet review' using errcode='22023'; end if;
 if exists(select 1 from jsonb_each(request) where key not in('note','acknowledgedLimitations') and jsonb_typeof(value)<>'string') or (request->>'idempotencyKey') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'invalid worksheet review' using errcode='22023'; end if;
 acknowledgments := '["synthetic_manual_input","overall_inventory_incomplete","january_2023_camx_only","market_based_scope2_not_included","factor_and_method_not_released","scope_1_and_scope_3_not_assessed","no_assurance"]'::jsonb;
 if request->>'decision'='accept_bounded_internal_draft' then
  if request->'note' is distinct from 'null'::jsonb or request->'acknowledgedLimitations' is distinct from acknowledgments then raise exception 'invalid worksheet review' using errcode='22023'; end if;
 elsif request->>'decision'='changes_requested' then
  note:=request->>'note';
  if jsonb_typeof(request->'note') is distinct from 'string' or (note !~ '^[ -~]+$' or char_length(note) not between 1 and 500) or note<>btrim(note) or request->'acknowledgedLimitations' is distinct from '[]'::jsonb then raise exception 'invalid worksheet review' using errcode='22023'; end if;
 else raise exception 'invalid worksheet review' using errcode='22023'; end if;
 select * into v from neuvetra.electricity_worksheet_versions where company_id=target_company and id=(request->>'versionId')::uuid;
 if not found or v.result_sha256 is distinct from request->>'expectedResultSha256' or v.created_by=actor then raise exception 'worksheet review conflicts' using errcode='23505'; end if;
 fingerprint:=encode(sha256(convert_to(actor::text||E'\n'||(request-'idempotencyKey')::text,'utf8')),'hex');
 select * into prior from neuvetra.electricity_worksheet_requests where company_id=target_company and idempotency_key=(request->>'idempotencyKey')::uuid;
 if found then
  if prior.kind<>'review' or prior.operation_fingerprint<>fingerprint then raise exception 'worksheet request conflicts' using errcode='23505';end if;
  return prior.record_id;
 end if;
 select id into review_id from neuvetra.electricity_worksheet_reviews where company_id=target_company and operation_fingerprint=fingerprint;
 if found then
  insert into neuvetra.electricity_worksheet_requests values(target_company,(request->>'idempotencyKey')::uuid,fingerprint,'review',review_id);
  return review_id;
 end if;
 if exists(select 1 from neuvetra.electricity_worksheet_versions where company_id=target_company and version>v.version) or exists(select 1 from neuvetra.electricity_worksheet_reviews where company_id=target_company and version_id=v.id) then raise exception 'worksheet review conflicts' using errcode='23505';end if;
 review_id:=gen_random_uuid();
 digest:=encode(sha256(convert_to(concat_ws(E'\n','neuvetra.synthetic.manual-electricity-worksheet.v1',target_company::text,review_id::text,v.id::text,v.result_sha256,request->>'decision',coalesce(note,'<null>'),(select coalesce(string_agg(value,',' order by ord),'') from jsonb_array_elements_text(request->'acknowledgedLimitations') with ordinality as a(value,ord)),actor::text),'utf8')),'hex');
 body:=jsonb_build_object('id',review_id,'versionId',v.id,'resultSha256',v.result_sha256,'decision',request->>'decision','note',note,'acknowledgedLimitations',request->'acknowledgedLimitations','reviewerId',actor,'decisionSha256',digest);
 insert into neuvetra.electricity_worksheet_reviews values(review_id,target_company,v.id,body,digest,fingerprint,actor,now());
 insert into neuvetra.electricity_worksheet_requests values(target_company,(request->>'idempotencyKey')::uuid,fingerprint,'review',review_id);
 insert into neuvetra.electricity_worksheet_audit values(gen_random_uuid(),target_company,review_id,'review',digest,actor,now());
 return review_id;
end $$;
revoke all on function neuvetra.review_electricity_worksheet(uuid,jsonb) from public,authenticated;

create function neuvetra.save_electricity_worksheet(target_company uuid, request jsonb, correction boolean) returns uuid
language plpgsql security definer set search_path=pg_catalog,neuvetra,pg_temp as $$
declare actor uuid:=neuvetra.current_user_id(); predecessor record; prior record; new_id uuid; seq integer; fingerprint text; input_hash text; result_hash text;
 raw_quantity text; kwh text; mwh text; exact_total text; display_total text; scaled numeric; q numeric; rem numeric; reason text; body jsonb; method jsonb;
begin
 if actor is null or not neuvetra.can_manage_company(target_company) then raise exception 'workspace not found' using errcode='42501';end if;
 perform id from neuvetra.companies where id=target_company for update;
 if jsonb_typeof(request) is distinct from 'object' or (select array_agg(key order by key) from jsonb_object_keys(request) key) is distinct from (case when correction then array['companyLabel','correctionReason','expectedResultSha256','expectedVersionId','facilityLabel','geography','idempotencyKey','period','quantityKwh','unit'] else array['companyLabel','facilityLabel','geography','idempotencyKey','period','quantityKwh','unit'] end) then raise exception 'invalid worksheet input' using errcode='22023';end if;
 if exists(select 1 from jsonb_each(request) where jsonb_typeof(value)<>'string') or request->>'period'<>'2023-01' or request->>'geography'<>'CAMX' or request->>'unit'<>'kWh' or request->>'idempotencyKey' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'invalid worksheet input' using errcode='22023';end if;
 if request->>'companyLabel' !~ '^[ -~]{1,100}$' or request->>'companyLabel'<>btrim(request->>'companyLabel') or request->>'facilityLabel' !~ '^[ -~]{1,100}$' or request->>'facilityLabel'<>btrim(request->>'facilityLabel') then raise exception 'invalid worksheet label' using errcode='22023';end if;
 raw_quantity:=request->>'quantityKwh';
 if char_length(raw_quantity)>11 or raw_quantity !~ '^(0|[1-9][0-9]{0,6})(\.[0-9]{1,3})?$' or raw_quantity ~ '[^0-9.]' then raise exception 'invalid worksheet quantity' using errcode='22023';end if;
 if raw_quantity::numeric>1000000 then raise exception 'invalid worksheet quantity' using errcode='22023';end if;
 kwh:=(raw_quantity::numeric)::numeric(10,3)::text;
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
 select * into prior from neuvetra.electricity_worksheet_requests where company_id=target_company and idempotency_key=(request->>'idempotencyKey')::uuid;
 if found then
  if prior.kind<>'save' or prior.operation_fingerprint<>fingerprint then raise exception 'worksheet request conflicts' using errcode='23505';end if;
  return prior.record_id;
 end if;
 select id into new_id from neuvetra.electricity_worksheet_versions where company_id=target_company and operation_fingerprint=fingerprint;
 if found then
  insert into neuvetra.electricity_worksheet_requests values(target_company,(request->>'idempotencyKey')::uuid,fingerprint,'save',new_id);
  return new_id;
 end if;
 select * into predecessor from neuvetra.electricity_worksheet_versions where company_id=target_company order by version desc limit 1;
 if correction then
  if not found or predecessor.id is distinct from (request->>'expectedVersionId')::uuid or predecessor.result_sha256 is distinct from request->>'expectedResultSha256' or predecessor.payload->>'quantityKwh'=kwh then raise exception 'worksheet correction conflicts' using errcode='23505';end if;
  seq:=predecessor.version+1;
 else
  if found then raise exception 'worksheet already exists' using errcode='23505';end if;
  seq:=1;
 end if;
 new_id:=gen_random_uuid();
 input_hash:=encode(sha256(convert_to(concat_ws(E'\n','neuvetra.synthetic.manual-electricity-worksheet.v1',target_company::text,new_id::text,seq::text,coalesce(predecessor.id::text,'<null>'),actor::text,request->>'companyLabel',request->>'facilityLabel',kwh,'2023-01','CAMX','kWh',coalesce(reason,'<null>')),'utf8')),'hex');
 method:='{"id":"scope2-location-based-egrid-subregion","version":"2023-r2-camx-v1","factorId":"epa-egrid2023-r2-camx-total-output","factorVersion":"eGRID2023-revision-2","factorValue":"195.0402888","factorUnit":"kg CO2e/MWh","sourceSha256":"3dfbbcf2f949d58d5b2dbee3aab8150bd04a0c8ebb730ba1cd37a013bd4450ab","sheet":"SRL23","cell":"AI6","classification":"development_candidate","policy":"m64-accounting-policy-v1","accountingProfile":"manual-synthetic-2023-01-camx-kwh-v1","factorCandidateSha256":"8770ae6238df8525e5250850fab248c934be33f459ed19cc1fa24bd0718cb356","gwpPolicySha256":"fd9fd8973012da1a232dad7fc00db3013194751a92b34ab21dfd4f7b2c5148c5","reviewedEngineSha256":"4ad28f3877d13f238bbbf7e8bfb1fc6241922b9def73712ec1b02fd80b51b82c"}'::jsonb;
 result_hash:=encode(sha256(convert_to(concat_ws(E'\n',input_hash,mwh,exact_total,display_total,'kg CO2e','half_even_4dp',method->>'id',method->>'version',method->>'factorId',method->>'factorVersion',method->>'factorValue',method->>'factorUnit',method->>'sourceSha256',method->>'sheet',method->>'cell',method->>'classification',method->>'policy',method->>'accountingProfile',method->>'factorCandidateSha256',method->>'gwpPolicySha256',method->>'reviewedEngineSha256','synthetic=true','complete=false','releaseEligible=false','assurance=none','synthetic_manual_input','overall_inventory_incomplete','january_2023_camx_only','market_based_scope2_not_included','factor_and_method_not_released','scope_1_and_scope_3_not_assessed','no_assurance'),'utf8')),'hex');
 body:=jsonb_build_object('id',new_id,'version',seq,'previousVersionId',predecessor.id,'companyLabel',request->>'companyLabel','facilityLabel',request->>'facilityLabel','quantityKwh',kwh,'quantityMwh',mwh,'period','2023-01','geography','CAMX','unit','kWh','correctionReason',reason,'inputSha256',input_hash,'resultSha256',result_hash,'createdBy',actor,'method',method,'total',jsonb_build_object('unrounded',exact_total,'display',display_total,'unit','kg CO2e','rounding','half_even_4dp'));
 insert into neuvetra.electricity_worksheet_versions values(new_id,target_company,seq,predecessor.id,body,input_hash,result_hash,fingerprint,actor,now());
 insert into neuvetra.electricity_worksheet_requests values(target_company,(request->>'idempotencyKey')::uuid,fingerprint,'save',new_id);
 insert into neuvetra.electricity_worksheet_audit values(gen_random_uuid(),target_company,new_id,'save',result_hash,actor,now());
 return new_id;
end $$;
revoke all on function neuvetra.save_electricity_worksheet(uuid,jsonb,boolean) from public,authenticated;
do $$ begin
 if exists(select 1 from pg_roles where rolname='neuvetra_runtime') then
  grant execute on function neuvetra.save_electricity_worksheet(uuid,jsonb,boolean),neuvetra.review_electricity_worksheet(uuid,jsonb) to neuvetra_runtime;
 end if;
end $$;



