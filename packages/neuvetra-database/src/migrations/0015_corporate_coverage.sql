-- M71: additive synthetic corporate coverage; historical migrations/rows untouched.
create table neuvetra.corporate_inventory_heads(company_id uuid primary key references neuvetra.companies(id),id uuid not null,version_id uuid,revision integer not null default 0,unique(id,company_id));
create table neuvetra.corporate_inventory_versions(id uuid primary key,company_id uuid not null,inventory_id uuid not null,version integer not null check(version>0),previous_version_id uuid,payload jsonb not null,content_sha256 text not null check(content_sha256~'^[0-9a-f]{64}$'),version_sha256 text not null check(version_sha256~'^[0-9a-f]{64}$'),created_by uuid not null references auth.users(id),created_at timestamptz not null,export_text text not null,unique(id,company_id),unique(company_id,version),foreign key(inventory_id,company_id) references neuvetra.corporate_inventory_heads(id,company_id),foreign key(previous_version_id,company_id) references neuvetra.corporate_inventory_versions(id,company_id));
alter table neuvetra.corporate_inventory_heads add foreign key(version_id,company_id) references neuvetra.corporate_inventory_versions(id,company_id);
create table neuvetra.corporate_inventory_reviews(id uuid primary key,company_id uuid not null,version_id uuid not null,payload jsonb not null,decision_sha256 text not null check(decision_sha256~'^[0-9a-f]{64}$'),reviewed_by uuid not null references auth.users(id),reviewed_at timestamptz not null,unique(id,company_id),unique(company_id,version_id),foreign key(version_id,company_id) references neuvetra.corporate_inventory_versions(id,company_id));
create table neuvetra.corporate_inventory_requests(company_id uuid not null references neuvetra.companies(id),idempotency_key uuid not null,fingerprint text not null check(fingerprint~'^[0-9a-f]{64}$'),kind text not null check(kind in('save','review')),record_id uuid not null,primary key(company_id,idempotency_key));
create table neuvetra.corporate_inventory_audit(id uuid primary key,company_id uuid not null references neuvetra.companies(id),record_id uuid not null,kind text not null check(kind in('save','review')),record_sha256 text not null check(record_sha256~'^[0-9a-f]{64}$'),actor_id uuid not null references auth.users(id),created_at timestamptz not null,unique(company_id,kind,record_id));
do $$ declare relation text;begin foreach relation in array array['corporate_inventory_heads','corporate_inventory_versions','corporate_inventory_reviews','corporate_inventory_requests','corporate_inventory_audit'] loop
 execute format('alter table neuvetra.%I enable row level security',relation);execute format('alter table neuvetra.%I force row level security',relation);
 execute format('revoke all on neuvetra.%I from public,authenticated,neuvetra_runtime',relation);
 execute format('create policy m71_runtime_read on neuvetra.%I for select to neuvetra_runtime using(neuvetra.is_company_member(company_id))',relation);execute format('grant select on neuvetra.%I to neuvetra_runtime',relation);
 if relation<>'corporate_inventory_heads' then execute format('create trigger m71_immutable before update or delete on neuvetra.%I for each row execute function neuvetra.reject_inventory_history_mutation()',relation);end if;
end loop;end $$;

-- Admission -> membership -> company/head. Revocation UPDATE waits for an admitted
-- operation, or completes first and causes the waiting operation to fail closed.
create function neuvetra.m71_lock(target_company uuid,manager boolean) returns boolean language plpgsql security definer set search_path=pg_catalog,neuvetra,pg_temp as $$
declare actor uuid:=auth.uid();a record;m record;begin
 select * into a from neuvetra.staging_access where user_id=actor for share;
 if not found or not a.active or a.company_id is distinct from target_company then return false;end if;
 select * into m from neuvetra.company_members where company_id=target_company and user_id=actor for share;
 if not found or (manager and m.role not in('owner','admin')) then return false;end if;
 return neuvetra.is_company_member(target_company) and (not manager or neuvetra.can_manage_company(target_company));end $$;

create function neuvetra.m71_keys(v jsonb,keys text) returns void language plpgsql immutable set search_path=pg_catalog,neuvetra,pg_temp as $$ begin
 if jsonb_typeof(v) is distinct from 'object' or (select array_agg(key order by key) from jsonb_object_keys(v) key) is distinct from (select array_agg(k order by k) from unnest(string_to_array(keys,',')) k) then raise exception 'invalid corporate object keys' using errcode='22023';end if;end $$;
create function neuvetra.m71_node(v jsonb,kind text) returns void language plpgsql immutable set search_path=pg_catalog,neuvetra,pg_temp as $$
declare spec text;pair record;child jsonb;childkind text;str text;arr jsonb;begin
 spec:=case kind
 when 'snapshot' then 'profile,companyLabel,period,consolidationApproach,policyVersion,entities,relationships,facilities,sources,boundaryDecisions,coverageItems,requirements'
 when 'period' then 'start,endExclusive'
 when 'entities' then 'id,legalName,countryCode,regionCode,start,endExclusive,evidenceRefs'
 when 'relationships' then 'id,parentEntityId,childEntityId,ownershipPercent,controlFacts,start,endExclusive,evidenceRefs'
 when 'facilities' then 'id,entityId,name,countryCode,regionCode,start,endExclusive,evidenceRefs'
 when 'sources' then 'id,entityId,facilityId,name,domain,start,endExclusive,evidenceRefs'
 when 'boundaryDecisions' then 'id,entityId,disposition,reason,start,endExclusive,evidenceRefs'
 when 'coverageItems' then 'id,domain,entityId,sourceId,disposition,activityDataState,evidenceState,methodReadiness,reason,evidenceRefs,estimateBasis,quantity,unit,start,endExclusive'
 when 'requirements' then 'id,character,sourceLocator,sourceEdition,lastCheckedOn,applicability,missingFacts,reason'
 when 'evidenceRefs' then 'artifactId,expectedSha256,locator,purpose'
 when 'estimateBasis' then 'methodVersionId,assumptions,inputEvidenceRefs,uncertainty' end;
 if spec is null then raise exception 'invalid corporate shape' using errcode='22023';end if;perform neuvetra.m71_keys(v,spec);
 for pair in select key,value from jsonb_each(v) loop
  if pair.key in('period','estimateBasis') then if pair.key='estimateBasis' and pair.value='null'::jsonb then continue;end if;perform neuvetra.m71_node(pair.value,pair.key);
  elsif pair.key in('entities','relationships','facilities','sources','boundaryDecisions','coverageItems','requirements','evidenceRefs','inputEvidenceRefs','missingFacts') then
   if jsonb_typeof(pair.value) is distinct from 'array' or jsonb_array_length(pair.value)>150 then raise exception 'invalid corporate array' using errcode='22023';end if;
   childkind:=case when pair.key='inputEvidenceRefs' then 'evidenceRefs' else pair.key end;
   if pair.key='missingFacts' then
    if jsonb_array_length(pair.value) not between 1 and 20 or exists(select 1 from jsonb_array_elements(pair.value) e where jsonb_typeof(e)<>'string' or length(e#>>'{}') not between 1 and 100 or e#>>'{}'<>btrim(e#>>'{}') or e#>>'{}'<>normalize(e#>>'{}',NFC) or e#>>'{}'~'[[:cntrl:]]') or (select count(distinct e) from jsonb_array_elements(pair.value)e)<>jsonb_array_length(pair.value) then raise exception 'invalid missing facts' using errcode='22023';end if;
    select jsonb_agg(e order by e#>>'{}' collate "C") into arr from jsonb_array_elements(pair.value)e;
   else
    for child in select value from jsonb_array_elements(pair.value) loop perform neuvetra.m71_node(child,childkind);end loop;
    if childkind='evidenceRefs' then
     if jsonb_array_length(pair.value)>8 or (select count(distinct e->>'purpose') from jsonb_array_elements(pair.value)e)<>jsonb_array_length(pair.value) then raise exception 'duplicate evidence purpose' using errcode='22023';end if;
     select coalesce(jsonb_agg(e order by e->>'purpose' collate "C"),'[]') into arr from jsonb_array_elements(pair.value)e;
    else select coalesce(jsonb_agg(e order by e->>'id' collate "C"),'[]') into arr from jsonb_array_elements(pair.value)e;end if;
   end if;
   if arr is distinct from pair.value then raise exception 'corporate arrays must be canonical' using errcode='22023';end if;
  else
   if pair.value='null'::jsonb and (pair.key in('regionCode','ownershipPercent','controlFacts','facilityId','reason','quantity','unit','sourceLocator','sourceEdition','lastCheckedOn') or kind='coverageItems' and pair.key in('entityId','sourceId')) then continue;end if;
   if jsonb_typeof(pair.value) is distinct from 'string' then raise exception 'invalid corporate scalar type' using errcode='22023';end if;
   str:=pair.value#>>'{}';
   if length(str) not between 1 and 500 or str<>btrim(str) or str<>normalize(str,NFC) or str~'[[:cntrl:]]' then raise exception 'invalid corporate text' using errcode='22023';end if;
   if pair.key in('companyLabel','legalName','name') and length(str)>160 or pair.key in('policyVersion','methodVersionId') and length(str)>100 or pair.key='unit' and length(str)>40 then raise exception 'corporate label too long' using errcode='22023';end if;
   if pair.key in('id','entityId','sourceId','facilityId','parentEntityId','childEntityId','artifactId') and str!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'invalid corporate ID' using errcode='22023';end if;
   if pair.key in('start','endExclusive','lastCheckedOn') and (str!~'^\d{4}-\d{2}-\d{2}$' or to_char(str::date,'YYYY-MM-DD')<>str) then raise exception 'invalid corporate date' using errcode='22023';end if;
   if pair.key='countryCode' and str!~'^[A-Z]{2}$' or pair.key='regionCode' and str!~'^[A-Z0-9-]{1,12}$' then raise exception 'invalid corporate geography' using errcode='22023';end if;
   if pair.key in('quantity','ownershipPercent') and (str!~'^(0|[1-9][0-9]{0,17})(\.[0-9]{0,5}[1-9])?$' or (pair.key='ownershipPercent' and str::numeric>100)) then raise exception 'invalid corporate decimal' using errcode='22023';end if;
   if pair.key='disposition' and str not in('unassessed','missing','included_activity','included_estimate','excluded','not_applicable') or pair.key='activityDataState' and str not in('not_assessed','missing','partial','entered','estimate_proposed','explicit_zero') or pair.key='evidenceState' and str not in('not_assessed','missing','partial','linked','conflicting') or pair.key='methodReadiness' and str not in('not_assessed','unsupported','candidate') or pair.key='applicability' and str not in('unknown','conflicting') or pair.key='consolidationApproach' and str not in('operational_control','financial_control','equity_share') or pair.key='character' and str not in('statute','regulation','standard','agency_guidance','proposal','enforcement_statement','court_order') then raise exception 'invalid corporate state' using errcode='22023';end if;
  end if;
 end loop;
 if v ? 'start' and ((v->>'start')>=(v->>'endExclusive') or (v->>'start')<'2025-01-01' or (v->>'endExclusive')>'2026-01-01') then raise exception 'invalid corporate interval' using errcode='22023';end if;
 if kind='evidenceRefs' and (v->>'artifactId'<>'71000000-0000-4000-8000-000000000900' or v->>'expectedSha256'<>'4fe7dc12d8f253f8d3cb1fd7fba2eade05f3d605ad7cb95376cca9d957afe5c7' or v->>'locator'<>'synthetic-register:entities-and-screening') then raise exception 'unsupported synthetic evidence' using errcode='22023';end if;
 if v->>'disposition' in('excluded','not_applicable') and (v->'reason'='null'::jsonb or jsonb_array_length(v->'evidenceRefs')=0) then raise exception 'explanation and evidence required' using errcode='22023';end if;
end $$;

create function neuvetra.m71_snapshot(s jsonb,prior jsonb) returns void language plpgsql immutable set search_path=pg_catalog,neuvetra,pg_temp as $$
declare key text;row jsonb;other jsonb;parent jsonb;domain text;cursor text;ids text[]:='{}';domains text[]:=array['stationary_combustion','mobile_combustion','process','fugitive','electricity','steam','heat','cooling','location_based','market_based'];begin
 perform neuvetra.m71_node(s,'snapshot');
 if octet_length(convert_to(neuvetra.m67_canonical(s),'utf8'))>50000 or s->>'profile'<>'synthetic-corporate-coverage-v1' or s->'period'<>'{"start":"2025-01-01","endExclusive":"2026-01-01"}'::jsonb or jsonb_array_length(s->'requirements')=0 then raise exception 'unsupported corporate profile' using errcode='22023';end if;
 if not exists(select 1 from jsonb_array_elements(s->'relationships')e where e->>'id'='71000000-0000-4000-8000-000000000010') then raise exception 'expected control relationship omitted' using errcode='22023';end if;
 for i in 1..15 loop domains:=array_append(domains,'scope3_'||i::text);end loop;
 foreach key in array array['entities','relationships','facilities','sources','boundaryDecisions','coverageItems','requirements'] loop
  for row in select value from jsonb_array_elements(s->key) loop
   if row->>'id'=any(ids) then raise exception 'duplicate corporate identity' using errcode='22023';end if;ids:=array_append(ids,row->>'id');
   if row ? 'domain' and not(row->>'domain'=any(domains)) then raise exception 'unknown screening domain' using errcode='22023';end if;
   if key in('facilities','sources','boundaryDecisions','coverageItems') and row->'entityId'<>'null'::jsonb then
    select e into parent from jsonb_array_elements(s->'entities')e where e->>'id'=row->>'entityId';
    if parent is null or row->>'start'<parent->>'start' or row->>'endExclusive'>parent->>'endExclusive' then raise exception 'invalid corporate entity binding' using errcode='22023';end if;
   end if;
  end loop;
  if prior is not null then for row in select value from jsonb_array_elements(prior->key) loop
   select e into other from jsonb_array_elements(s->key)e where e->>'id'=row->>'id';if other is null then raise exception 'corporate history cannot be omitted' using errcode='22023';end if;
   if (select jsonb_object_agg(k,v) from jsonb_each(row)t(k,v) where k in('entityId','sourceId','facilityId','parentEntityId','childEntityId','domain')) is distinct from (select jsonb_object_agg(k,v) from jsonb_each(other)t(k,v) where k in('entityId','sourceId','facilityId','parentEntityId','childEntityId','domain')) then raise exception 'corporate identity cannot be repurposed' using errcode='22023';end if;
  end loop;end if;
 end loop;
 foreach key in array array['entities','facilities','sources'] loop
  for i in 0..1 loop
   if not exists(select 1 from jsonb_array_elements(s->key)e where e->>'id'='71000000-0000-4000-8000-'||lpad((case key when 'entities' then 1 when 'facilities' then 20 else 30 end+i)::text,12,'0')) then raise exception 'expected corporate universe omitted' using errcode='22023';end if;
  end loop;
 end loop;
 for row in select value from jsonb_array_elements(s->'entities') loop
  cursor:=row->>'start';for other in select e from jsonb_array_elements(s->'boundaryDecisions')e where e->>'entityId'=row->>'id' order by e->>'start' loop
   if other->>'start'<>cursor then raise exception 'boundary interval gap or overlap' using errcode='22023';end if;cursor:=other->>'endExclusive';end loop;
  if cursor<>row->>'endExclusive' then raise exception 'missing boundary decision' using errcode='22023';end if;
 end loop;
 for row in select value from jsonb_array_elements(s->'relationships') loop
  foreach key in array array['parentEntityId','childEntityId'] loop select e into parent from jsonb_array_elements(s->'entities')e where e->>'id'=row->>key;
   if parent is null or row->>'start'<parent->>'start' or row->>'endExclusive'>parent->>'endExclusive' then raise exception 'invalid relationship binding' using errcode='22023';end if;end loop;
  if row->>'parentEntityId'=row->>'childEntityId' or exists(select 1 from jsonb_array_elements(s->'relationships')e where e->>'id'<>row->>'id' and e->>'childEntityId'=row->>'childEntityId' and e->>'start'<row->>'endExclusive' and row->>'start'<e->>'endExclusive') then raise exception 'overlapping relationship' using errcode='22023';end if;
 end loop;
 if exists(with recursive edges as(select e->>'parentEntityId' p,e->>'childEntityId' c,e->>'start' a,e->>'endExclusive' b from jsonb_array_elements(s->'relationships')e),walk as(select p,c,a,b,array[p,c] path,p=c cycle from edges union all select w.p,e.c,greatest(w.a,e.a),least(w.b,e.b),w.path||e.c,e.c=any(w.path) from walk w join edges e on e.p=w.c and e.a<w.b and w.a<e.b where not w.cycle)select 1 from walk where cycle) then raise exception 'effective relationship cycle' using errcode='22023';end if;
 for row in select value from jsonb_array_elements(s->'sources') loop
  if row->'facilityId'<>'null'::jsonb then select e into parent from jsonb_array_elements(s->'facilities')e where e->>'id'=row->>'facilityId';if parent is null or parent->>'entityId'<>row->>'entityId' or row->>'start'<parent->>'start' or row->>'endExclusive'>parent->>'endExclusive' then raise exception 'invalid source facility' using errcode='22023';end if;end if;
  if (select count(*) from jsonb_array_elements(s->'coverageItems')e where e->>'sourceId'=row->>'id' and e->>'start'=row->>'start' and e->>'endExclusive'=row->>'endExclusive')<>1 then raise exception 'source coverage missing' using errcode='22023';end if;
 end loop;
 for row in select value from jsonb_array_elements(s->'coverageItems') loop
  if row->'sourceId'<>'null'::jsonb then select e into parent from jsonb_array_elements(s->'sources')e where e->>'id'=row->>'sourceId';if parent is null or parent->>'entityId' is distinct from row->>'entityId' or parent->>'domain'<>row->>'domain' or row->>'start'<>parent->>'start' or row->>'endExclusive'<>parent->>'endExclusive' then raise exception 'invalid source screening' using errcode='22023';end if;
  elsif row->'entityId'<>'null'::jsonb then raise exception 'unsupported entity-only screening' using errcode='22023';
  elsif row->>'start'<>'2025-01-01' or row->>'endExclusive'<>'2026-01-01' then raise exception 'group screening must cover full period' using errcode='22023';end if;
  if (row->'quantity'='null'::jsonb)<>(row->'unit'='null'::jsonb) or (coalesce(row->>'quantity'='0',false))<>(row->>'activityDataState'='explicit_zero') or (row->'quantity'<>'null'::jsonb and row->>'activityDataState' not in('entered','partial','estimate_proposed','explicit_zero')) then raise exception 'invalid activity state' using errcode='22023';end if;
  if row->>'evidenceState'='linked' and jsonb_array_length(row->'evidenceRefs')=0 or row->>'activityDataState'='explicit_zero' and (row->'reason'='null'::jsonb or jsonb_array_length(row->'evidenceRefs')=0) then raise exception 'activity evidence missing' using errcode='22023';end if;
  if row->>'disposition'='included_estimate' and (row->'estimateBasis'='null'::jsonb or row->>'activityDataState'<>'estimate_proposed') or row->'estimateBasis'<>'null'::jsonb and jsonb_array_length(row#>'{estimateBasis,inputEvidenceRefs}')=0 then raise exception 'invalid estimate basis' using errcode='22023';end if;
 end loop;
 foreach domain in array domains loop if (select count(*) from jsonb_array_elements(s->'coverageItems')e where e->'entityId'='null'::jsonb and e->'sourceId'='null'::jsonb and e->>'domain'=domain and e->>'start'='2025-01-01' and e->>'endExclusive'='2026-01-01')<>1 then raise exception 'required group screening missing or duplicated' using errcode='22023';end if;end loop;
end $$;

-- Frozen coverage-only export findings. TypeScript independently derives these on read.
create function neuvetra.m71_findings(s jsonb) returns jsonb language plpgsql immutable set search_path=pg_catalog,neuvetra,pg_temp as $$
declare result jsonb:='[]';r jsonb;code text;begin
 result:=jsonb_build_array(jsonb_build_object('code','requirements_not_determined','recordId',null,'message','Corporate applicability and reporting requirements remain undetermined.'),jsonb_build_object('code','methods_not_released','recordId',null,'message','No corporate calculation method is released; emissions remain unknown.'));
 if s->>'consolidationApproach'<>'operational_control' then result:=result||jsonb_build_array(jsonb_build_object('code','unsupported_consolidation','recordId',null,'message','This consolidation approach requires a later reviewed method.'));end if;
 for r in select e from jsonb_array_elements((s->'entities')||(s->'facilities'))e loop
  if r->>'countryCode'<>'US' or r->>'regionCode' is distinct from 'CA' then result:=result||jsonb_build_array(jsonb_build_object('code','unsupported_geography','recordId',r->'id','message','Discovered operations remain registered; this milestone supports only California operations.'));end if;
  if r->>'start'<>'2025-01-01' or r->>'endExclusive'<>'2026-01-01' then result:=result||jsonb_build_array(jsonb_build_object('code','unsupported_temporal_allocation','recordId',r->'id','message','Partial-year control/operations need reviewed interval allocation.'));end if;
 end loop;
 for r in select e from jsonb_array_elements(s->'relationships')e loop
  if r->>'start'<>'2025-01-01' or r->>'endExclusive'<>'2026-01-01' or r->>'ownershipPercent' is distinct from '100' then result:=result||jsonb_build_array(jsonb_build_object('code','unsupported_boundary_relationship','recordId',r->'id','message','Partial-year or non-wholly-owned relationships need reviewed allocation.'));end if;
  if r->'controlFacts'='null'::jsonb or jsonb_array_length(r->'evidenceRefs')=0 then result:=result||jsonb_build_array(jsonb_build_object('code','control_evidence_missing','recordId',r->'id','message','Control facts and supporting evidence are incomplete.'));end if;
 end loop;
 for r in select e from jsonb_array_elements(s->'boundaryDecisions')e loop
  if r->>'disposition' in('missing','unassessed') then result:=result||jsonb_build_array(jsonb_build_object('code','boundary_unreconciled','recordId',r->'id','message','Expected entity remains unreconciled.'));end if;
  if r->>'disposition' in('excluded','not_applicable') then result:=result||jsonb_build_array(jsonb_build_object('code','boundary_assertion_unverified','recordId',r->'id','message','Boundary exclusion/non-applicability remains visible and requires qualified review.'));end if;
 end loop;
 for r in select e from jsonb_array_elements(s->'coverageItems')e loop
  if r->'quantity'='null'::jsonb then result:=result||jsonb_build_array(jsonb_build_object('code','activity_unknown','recordId',r->'id','message','No activity quantity is recorded; unknown is not zero.'));end if;
  if r->>'evidenceState'<>'linked' then code:=case when r->>'evidenceState'='conflicting' then 'evidence_conflicting' else 'evidence_incomplete' end;result:=result||jsonb_build_array(jsonb_build_object('code',code,'recordId',r->'id','message','Supporting evidence is missing, incomplete or conflicting.'));end if;
  if jsonb_array_length(r->'evidenceRefs')>0 then result:=result||jsonb_build_array(jsonb_build_object('code','synthetic_evidence_not_sufficient','recordId',r->'id','message','Pinned fictional evidence is not proof of activity or reporting sufficiency.'));end if;
  if r->>'methodReadiness'<>'candidate' then result:=result||jsonb_build_array(jsonb_build_object('code','method_unsupported','recordId',r->'id','message','This screening has no released calculation method.'));end if;
  if r->>'disposition' in('excluded','not_applicable') then result:=result||jsonb_build_array(jsonb_build_object('code','screening_assertion_unverified','recordId',r->'id','message','The assertion remains an open coverage finding.'));end if;
  if r->'estimateBasis'<>'null'::jsonb then result:=result||jsonb_build_array(jsonb_build_object('code','estimate_unverified','recordId',r->'id','message','Proposed estimate needs a reviewed method and supporting activity.'));end if;
 end loop;
 for r in select e from jsonb_array_elements(s->'requirements')e loop code:=case when r->>'applicability'='conflicting' then 'requirement_conflicting' else 'requirement_unknown' end;result:=result||jsonb_build_array(jsonb_build_object('code',code,'recordId',r->'id','message','Missing facts/source review prevent a legal determination.'));end loop;
 return (select jsonb_agg(e order by coalesce(e->>'recordId','') collate "C",e->>'code' collate "C") from jsonb_array_elements(result)e);
end $$;
revoke all on function neuvetra.m71_findings(jsonb) from public,authenticated,neuvetra_runtime;

create function neuvetra.save_corporate_inventory(target_company uuid,target_inventory uuid,request jsonb) returns uuid language plpgsql security definer set search_path=pg_catalog,neuvetra,pg_temp as $$
declare actor uuid:=auth.uid();head record;prior record;old record;body jsonb;s jsonb;fingerprint text;digest text;content_hash text;new_id uuid:=gen_random_uuid();captured timestamptz:=date_trunc('milliseconds',clock_timestamp());contributors jsonb;frozen_export text;begin
 if not neuvetra.m71_lock(target_company,true) then raise exception 'forbidden' using errcode='42501';end if;
 perform id from neuvetra.companies where id=target_company for update;
 perform neuvetra.m71_keys(request,'snapshot,expectedVersionId,expectedVersionSha256,correctionReason,idempotencyKey');
 if request->>'idempotencyKey' is null or request->>'idempotencyKey'!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'invalid request key' using errcode='22023';end if;
 s:=request->'snapshot';perform neuvetra.m71_snapshot(s,null);
 fingerprint:=neuvetra.m67_hash(jsonb_build_object('operation','save','actor',actor,'companyId',target_company,'inventoryId',target_inventory,'request',request-'idempotencyKey'));
 select * into old from neuvetra.corporate_inventory_requests where company_id=target_company and idempotency_key=(request->>'idempotencyKey')::uuid;
 if found then if old.fingerprint<>fingerprint or old.kind<>'save' then raise exception 'request conflict' using errcode='23505';end if;return old.record_id;end if;
 select * into head from neuvetra.corporate_inventory_heads where company_id=target_company for update;
 select * into prior from neuvetra.corporate_inventory_versions where company_id=target_company and id=head.version_id;
 if target_inventory is null then
  if head.id is not null then raise exception 'inventory exists' using errcode='23505';end if;
  if request->'expectedVersionId'<>'null'::jsonb or request->'expectedVersionSha256'<>'null'::jsonb or request->'correctionReason'<>'null'::jsonb then raise exception 'invalid initial binding' using errcode='22023';end if;
  insert into neuvetra.corporate_inventory_heads(company_id,id) values(target_company,gen_random_uuid()) returning * into head;
 else
  if head.id is null or head.id<>target_inventory then raise exception 'inventory conflict' using errcode='23505';end if;
  select * into prior from neuvetra.corporate_inventory_versions where company_id=target_company and id=head.version_id;
  if prior.id::text is distinct from request->>'expectedVersionId' or prior.version_sha256 is distinct from request->>'expectedVersionSha256' then raise exception 'stale corporate head' using errcode='23505';end if;
  if jsonb_typeof(request->'correctionReason')<>'string' or length(request->>'correctionReason') not between 1 and 500 or request->>'correctionReason'<>btrim(request->>'correctionReason') or request->>'correctionReason'<>normalize(request->>'correctionReason',NFC) or request->>'correctionReason'~'[[:cntrl:]]' then raise exception 'correction reason required' using errcode='22023';end if;
  perform neuvetra.m71_snapshot(s,prior.payload->'snapshot');if s=prior.payload->'snapshot' and request->'correctionReason'=prior.payload->'correctionReason' then raise exception 'corporate correction is no-op' using errcode='22023';end if;
 end if;
 if head.revision>=40 then raise exception 'synthetic history limit reached' using errcode='54000';end if;
 captured:=date_trunc('milliseconds',clock_timestamp());
 content_hash:=neuvetra.m67_hash(s);
 select jsonb_agg(e order by e collate "C") into contributors from (select distinct e from (select jsonb_array_elements_text(coalesce(prior.payload->'contributorIds','[]')) e union all select actor::text)e)e;
 body:=jsonb_build_object('profile','synthetic-corporate-coverage-v1','id',new_id,'inventoryId',head.id,'companyId',target_company,'version',head.revision+1,'previousVersionId',prior.id,'previousVersionSha256',prior.version_sha256,'createdBy',actor,'createdAt',to_char(captured at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'contributorIds',contributors,'correctionReason',request->'correctionReason','contentSha256',content_hash);
 digest:=neuvetra.m67_hash(body);body:=(body-'profile')||jsonb_build_object('snapshot',s,'versionSha256',digest);
 frozen_export:=neuvetra.m67_canonical(body||jsonb_build_object('findings',neuvetra.m71_findings(s),'synthetic',true,'corporateCompleteness','incomplete','releaseEligible',false,'assurance','none','emissionsTotals',null,'review',null));
 -- Reserve 200 KB of the 4 MB reader budget for forty review records and envelope.
 if octet_length(convert_to(frozen_export,'utf8'))+coalesce((select sum(octet_length(convert_to(export_text,'utf8'))) from neuvetra.corporate_inventory_versions where company_id=target_company),0)>3800000 then raise exception 'synthetic history byte capacity reached' using errcode='54001';end if;
 insert into neuvetra.corporate_inventory_versions values(new_id,target_company,head.id,head.revision+1,prior.id,body,content_hash,digest,actor,captured,frozen_export);
 insert into neuvetra.corporate_inventory_requests values(target_company,(request->>'idempotencyKey')::uuid,fingerprint,'save',new_id);
 insert into neuvetra.corporate_inventory_audit values(gen_random_uuid(),target_company,new_id,'save',digest,actor,captured);
 update neuvetra.corporate_inventory_heads set version_id=new_id,revision=revision+1 where company_id=target_company;return new_id;
end $$;
create function neuvetra.review_corporate_inventory(target_company uuid,target_inventory uuid,request jsonb) returns uuid language plpgsql security definer set search_path=pg_catalog,neuvetra,pg_temp as $$
declare actor uuid:=auth.uid();v record;old record;body jsonb;fingerprint text;digest text;new_id uuid:=gen_random_uuid();captured timestamptz:=date_trunc('milliseconds',clock_timestamp());begin
 if not neuvetra.m71_lock(target_company,true) then raise exception 'forbidden' using errcode='42501';end if;perform id from neuvetra.companies where id=target_company for update;
 perform neuvetra.m71_keys(request,'versionId,expectedVersionSha256,decision,note,acknowledgedLimitations,idempotencyKey');
 if exists(select 1 from jsonb_each(request) where key<>'acknowledgedLimitations' and jsonb_typeof(value)<>'string') or request->>'versionId'!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or request->>'idempotencyKey'!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or request->>'expectedVersionSha256'!~'^[0-9a-f]{64}$' or request->>'note'<>normalize(request->>'note',NFC) or request->>'note'~'[[:cntrl:]]' then raise exception 'invalid review types' using errcode='22023';end if;
 if jsonb_typeof(request->'note')<>'string' or length(request->>'note') not between 1 and 500 or request->>'note'<>btrim(request->>'note') or request->>'decision' not in('accepted_bounded_internal','changes_requested') or request->'acknowledgedLimitations'<>'["synthetic_only","corporate_inventory_incomplete","methods_not_released","requirements_not_determined","no_emissions_calculated","no_external_assurance"]'::jsonb then raise exception 'invalid review' using errcode='22023';end if;
 fingerprint:=neuvetra.m67_hash(jsonb_build_object('operation','review','actor',actor,'companyId',target_company,'inventoryId',target_inventory,'request',request-'idempotencyKey'));
 select * into old from neuvetra.corporate_inventory_requests where company_id=target_company and idempotency_key=(request->>'idempotencyKey')::uuid;
 if found then if old.fingerprint<>fingerprint or old.kind<>'review' then raise exception 'request conflict' using errcode='23505';end if;return old.record_id;end if;
 select * into v from neuvetra.corporate_inventory_versions where company_id=target_company and inventory_id=target_inventory and id=(request->>'versionId')::uuid;
 if not found or v.version_sha256 is distinct from request->>'expectedVersionSha256' or v.payload->'contributorIds' ? actor::text or not exists(select 1 from neuvetra.corporate_inventory_heads where company_id=target_company and id=target_inventory and version_id=v.id) then raise exception 'review conflicts or contributor cannot review' using errcode='23505';end if;
 captured:=date_trunc('milliseconds',clock_timestamp());
 body:=jsonb_build_object('id',new_id,'versionId',v.id,'versionSha256',v.version_sha256,'decision',request->'decision','note',request->'note','acknowledgedLimitations',request->'acknowledgedLimitations','reviewerId',actor,'reviewedAt',to_char(captured at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
 digest:=neuvetra.m67_hash(body||jsonb_build_object('profile','synthetic-corporate-coverage-v1','companyId',target_company));body:=body||jsonb_build_object('decisionSha256',digest);
 insert into neuvetra.corporate_inventory_reviews values(new_id,target_company,v.id,body,digest,actor,captured);
 insert into neuvetra.corporate_inventory_requests values(target_company,(request->>'idempotencyKey')::uuid,fingerprint,'review',new_id);
 insert into neuvetra.corporate_inventory_audit values(gen_random_uuid(),target_company,new_id,'review',digest,actor,captured);return new_id;
end $$;
revoke all on function neuvetra.m71_keys(jsonb,text),neuvetra.m71_node(jsonb,text),neuvetra.m71_snapshot(jsonb,jsonb),neuvetra.m71_lock(uuid,boolean),neuvetra.save_corporate_inventory(uuid,uuid,jsonb),neuvetra.review_corporate_inventory(uuid,uuid,jsonb) from public,authenticated,neuvetra_runtime;
grant execute on function neuvetra.m71_lock(uuid,boolean),neuvetra.save_corporate_inventory(uuid,uuid,jsonb),neuvetra.review_corporate_inventory(uuid,uuid,jsonb) to neuvetra_runtime;
