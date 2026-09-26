-- General, versioned corporate setup. Synthetic staging only; no calculation/release path.
-- Existing setup, inventory and evidence rows remain unchanged.
-- Widen geography metadata only; prior US/CA values and all row histories are retained.
alter table neuvetra.companies drop constraint companies_country_code_check, drop constraint companies_state_code_check;
alter table neuvetra.companies add constraint companies_country_code_check check(country_code ~ '^[A-Z]{2}$'), add constraint companies_state_code_check check(length(btrim(state_code)) between 1 and 100);
alter table neuvetra.facilities drop constraint facilities_country_code_check, drop constraint facilities_state_code_check;
alter table neuvetra.facilities add constraint facilities_country_code_check check(country_code ~ '^[A-Z]{2}$'), add constraint facilities_state_code_check check(length(btrim(state_code)) between 1 and 100);

-- Inert privileged operator boundary. Auth identities must already exist; never callable by HTTP roles.
create function neuvetra.provision_company_setup_workspace(target_company uuid,owner_id uuid,company_name text,country text,region text,synthetic_confirmed boolean)
returns void language plpgsql set search_path=pg_catalog,neuvetra,pg_temp as $$
begin
  if synthetic_confirmed is distinct from true or company_name !~ '^Synthetic ' then raise exception 'explicit synthetic company required' using errcode='22023'; end if;
  if exists(select 1 from neuvetra.staging_access where user_id=owner_id) or exists(select 1 from neuvetra.company_members where user_id=owner_id) then raise exception 'subject already assigned' using errcode='23505'; end if;
  insert into neuvetra.companies(id,name,country_code,state_code,created_by) values(target_company,company_name,country,region,owner_id);
  insert into neuvetra.company_members(company_id,user_id,role) values(target_company,owner_id,'owner');
  insert into neuvetra.staging_access(user_id,company_id,active) values(owner_id,target_company,true);
end $$;
revoke all on function neuvetra.provision_company_setup_workspace(uuid,uuid,text,text,text,boolean) from public,authenticated,neuvetra_runtime;
create table neuvetra.company_setup_versions (
  id uuid primary key,
  company_id uuid not null references neuvetra.companies(id),
  revision integer not null check(revision > 0),
  previous_version_id uuid,
  correction_reason text,
  payload jsonb not null check(jsonb_typeof(payload)='object'),
  payload_sha256 text not null check(payload_sha256 ~ '^[0-9a-f]{64}$'),
  period_start date,
  period_end_exclusive date,
  boundary_approach text not null check(boundary_approach in('unknown','operational_control','financial_control','equity_share')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default clock_timestamp(),
  unique(id,company_id), unique(company_id,revision),
  foreign key(previous_version_id,company_id) references neuvetra.company_setup_versions(id,company_id),
  check(period_start is null or period_end_exclusive is null or period_start < period_end_exclusive),
  check((revision=1 and previous_version_id is null and correction_reason is null) or
        (revision>1 and previous_version_id is not null and length(btrim(correction_reason)) between 3 and 2000))
);
create table neuvetra.company_setup_heads (
  company_id uuid primary key references neuvetra.companies(id),
  version_id uuid not null, revision integer not null check(revision>0),
  foreign key(version_id,company_id) references neuvetra.company_setup_versions(id,company_id)
);
create table neuvetra.company_setup_requests (
  company_id uuid not null references neuvetra.companies(id),
  idempotency_key uuid not null, actor_id uuid not null references auth.users(id),
  request_sha256 text not null, version_id uuid not null,
  primary key(company_id,idempotency_key),
  foreign key(version_id,company_id) references neuvetra.company_setup_versions(id,company_id)
);
create table neuvetra.company_setup_entities (
  company_id uuid not null, version_id uuid not null, id uuid not null,
  name text not null check(length(btrim(name)) between 1 and 200),
  ownership_percent numeric check(ownership_percent between 0 and 100),
  control text not null check(control in('unknown','operational_control','financial_control','none')),
  inclusion text not null check(inclusion in('unknown','included','excluded')),
  reason text not null check(length(reason)<=2000),
  primary key(version_id,company_id,id),
  foreign key(version_id,company_id) references neuvetra.company_setup_versions(id,company_id),
  check(inclusion<>'excluded' or length(btrim(reason))>=3)
);
create table neuvetra.company_setup_relationships (
  company_id uuid not null, version_id uuid not null, id uuid not null,
  parent_entity_id uuid not null, child_entity_id uuid not null,
  relationship_type text not null check(relationship_type in('ownership','joint_venture','other','unknown')),
  notes text not null check(length(notes)<=2000),
  primary key(version_id,company_id,id),
  foreign key(version_id,company_id) references neuvetra.company_setup_versions(id,company_id),
  foreign key(version_id,company_id,parent_entity_id) references neuvetra.company_setup_entities(version_id,company_id,id),
  foreign key(version_id,company_id,child_entity_id) references neuvetra.company_setup_entities(version_id,company_id,id),
  check(parent_entity_id<>child_entity_id)
);
create table neuvetra.company_setup_locations (
  company_id uuid not null, version_id uuid not null, id uuid not null,
  entity_id uuid, facility_id uuid,
  name text not null check(length(btrim(name)) between 1 and 200),
  country_code text check(country_code ~ '^[A-Z]{2}$'),
  region_code text check(length(btrim(region_code)) between 1 and 100),
  locality text not null, purpose text not null,
  occupancy text not null check(occupancy in('unknown','owned','leased','shared','other')),
  control text not null check(control in('unknown','reporting_company','related_entity','landlord','shared','other')),
  inclusion text not null check(inclusion in('unknown','included','excluded')),
  reason text not null, period_start date, period_end_exclusive date,
  other_entity text not null, operator_details text not null,
  start_mode text not null check(start_mode in('unknown','period_start','specific')),
  end_mode text not null check(end_mode in('unknown','period_end','specific')), opened date,
  primary key(version_id,company_id,id),
  foreign key(version_id,company_id) references neuvetra.company_setup_versions(id,company_id),
  foreign key(version_id,company_id,entity_id) references neuvetra.company_setup_entities(version_id,company_id,id),
  foreign key(facility_id,company_id) references neuvetra.facilities(id,company_id),
  check(inclusion<>'excluded' or length(btrim(reason))>=3),
  check(period_start is null or period_end_exclusive is null or period_start<period_end_exclusive)
);
create table neuvetra.company_setup_screening (
  company_id uuid not null, version_id uuid not null, id text not null check(length(id) between 1 and 100),
  scope integer not null check(scope in(1,2,3)), category text not null check(length(btrim(category)) between 1 and 120),
  state text not null check(state in('unknown','yes','no','not_applicable')),
  reason text not null check(length(reason)<=2000), details text not null, location_id uuid,
  primary key(version_id,company_id,id), unique(version_id,company_id,scope,category),
  foreign key(version_id,company_id) references neuvetra.company_setup_versions(id,company_id),
  foreign key(version_id,company_id,location_id) references neuvetra.company_setup_locations(version_id,company_id,id),
  check(state not in('no','not_applicable') or length(btrim(reason))>=3)
);
create table neuvetra.company_setup_changes (
  company_id uuid not null, version_id uuid not null, id text not null check(length(id) between 1 and 100),
  category text not null check(length(btrim(category)) between 1 and 120),
  state text not null check(state in('unknown','yes','no')), effective_date date, details text not null,
  primary key(version_id,company_id,id),
  foreign key(version_id,company_id) references neuvetra.company_setup_versions(id,company_id)
);

do $$ declare t text; begin
  foreach t in array array['company_setup_versions','company_setup_heads','company_setup_requests','company_setup_entities','company_setup_relationships','company_setup_locations','company_setup_screening','company_setup_changes'] loop
    execute format('alter table neuvetra.%I enable row level security',t);
    execute format('alter table neuvetra.%I force row level security',t);
    execute format('revoke all on neuvetra.%I from public,authenticated,neuvetra_runtime',t);
    execute format('grant select on neuvetra.%I to neuvetra_runtime',t);
    execute format('create policy setup_member_read on neuvetra.%I for select to neuvetra_runtime using(neuvetra.is_company_member(company_id))',t);
    if t<>'company_setup_heads' then
      execute format('create trigger setup_history_immutable before update or delete on neuvetra.%I for each row execute function neuvetra.reject_inventory_history_mutation()',t);
    end if;
  end loop;
end $$;

-- Exact object keys and string types: JSON numbers/booleans must never become draft text.
create function neuvetra.company_setup_object(v jsonb,keys text,strings text,nullable text default '') returns void
language plpgsql set search_path=pg_catalog,neuvetra,pg_temp as $$
declare k text; begin
  perform neuvetra.m71_keys(v,keys);
  foreach k in array string_to_array(strings,',') loop
    if jsonb_typeof(v->k) is distinct from 'string' or length(v->>k)>2000 then raise exception 'invalid setup text' using errcode='22023'; end if;
  end loop;
  foreach k in array string_to_array(nullable,',') loop
    if jsonb_typeof(v->k) not in('string','null') or length(v->>k)>2000 then raise exception 'invalid setup nullable text' using errcode='22023'; end if;
  end loop;
end $$;
revoke all on function neuvetra.company_setup_object(jsonb,text,text,text) from public,authenticated,neuvetra_runtime;

create function neuvetra.save_company_setup(target_company uuid,request jsonb)
returns table(record_id uuid,replayed boolean) language plpgsql security definer
set search_path=pg_catalog,neuvetra,pg_temp as $$
#variable_conflict use_column
declare actor uuid:=auth.uid(); s jsonb; x jsonb; k text; old neuvetra.company_setup_requests%rowtype;
  head neuvetra.company_setup_heads%rowtype; fingerprint text; new_id uuid:=gen_random_uuid();
  next_revision integer; start_date date; end_date date; begin
  -- Hold both authorization rows until commit. Concurrent revocation cannot race an accepted write.
  perform 1 from neuvetra.staging_access where user_id=actor and company_id=target_company and active for share;
  if not found then raise exception 'company setup unavailable' using errcode='42501'; end if;
  perform 1 from neuvetra.company_members where user_id=actor and company_id=target_company and role in('owner','admin') for share;
  if not found then raise exception 'company setup unavailable' using errcode='42501'; end if;
  perform neuvetra.company_setup_object(request,'idempotencyKey,expectedRevision,expectedVersionId,correctionReason,setup','idempotencyKey','expectedVersionId,correctionReason');
  if jsonb_typeof(request->'expectedRevision') is distinct from 'number' or coalesce(request->>'expectedRevision','')!~'^[0-9]{1,8}$' or
    request->>'idempotencyKey' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or octet_length(request::text)>250000 then
    raise exception 'invalid setup request' using errcode='22023'; end if;
  s:=request->'setup';
  perform neuvetra.company_setup_object(s,'company,reportingPeriod,boundary,entities,relationships,locations,screening,changes,changeNotes,review','changeNotes');
  foreach k in array array['entities','relationships','locations','screening','changes'] loop
    if jsonb_typeof(s->k) is distinct from 'array' or jsonb_array_length(s->k)>500 then raise exception 'invalid setup collection' using errcode='22023'; end if;
  end loop;
  perform neuvetra.company_setup_object(s->'company','legalName,tradingName,countryCode,regionCode,industry,naics,preparerRole,additionalBusinessActivities,otherIndustry','legalName,tradingName,industry,naics,preparerRole,additionalBusinessActivities,otherIndustry','countryCode,regionCode');
  if length(btrim(s#>>'{company,legalName}')) not between 1 and 200 or (s#>>'{company,countryCode}') !~ '^[A-Z]{2}$' or (s#>>'{company,naics}') !~ '^([0-9]{6})?$' then raise exception 'invalid company facts' using errcode='22023'; end if;
  perform neuvetra.company_setup_object(s->'reportingPeriod','start,endExclusive,firstInventory,priorInventoryReference','firstInventory,priorInventoryReference','start,endExclusive');
  perform neuvetra.company_setup_object(s->'boundary','approach,notes,hasParent,parentName,includedOperations','approach,notes,hasParent,parentName,includedOperations');
  if s#>>'{reportingPeriod,firstInventory}' not in('unknown','yes','no') or s#>>'{boundary,hasParent}' not in('unknown','yes','no') then raise exception 'invalid setup state' using errcode='22023'; end if;
  perform neuvetra.company_setup_object(s->'review','acknowledged,notes','notes');
  if jsonb_typeof(s#>'{review,acknowledged}') is distinct from 'boolean' then raise exception 'invalid review acknowledgment' using errcode='22023'; end if;
  -- Strict ISO date text excludes PostgreSQL's permissive alternate formats and infinity.
  foreach k in array array['start','endExclusive'] loop
    if (s->'reportingPeriod'->>k) is not null and (s->'reportingPeriod'->>k)!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'invalid reporting date' using errcode='22023'; end if;
  end loop;
  start_date:=(s#>>'{reportingPeriod,start}')::date; end_date:=(s#>>'{reportingPeriod,endExclusive}')::date;
  -- Serialize one company's history, including the first write where no head exists.
  perform 1 from neuvetra.companies where id=target_company for update;
  fingerprint:=neuvetra.m67_hash(jsonb_build_object('companyId',target_company,'actorId',actor,'request',request));
  select * into old from neuvetra.company_setup_requests where company_id=target_company and idempotency_key=(request->>'idempotencyKey')::uuid;
  if found then
    if old.actor_id<>actor or old.request_sha256<>fingerprint then raise exception 'setup idempotency conflict' using errcode='23505'; end if;
    record_id:=old.version_id; replayed:=true; return next; return;
  end if;
  select * into head from neuvetra.company_setup_heads where company_id=target_company;
  if (request->>'expectedRevision')::integer<>coalesce(head.revision,0) or (request->>'expectedVersionId')::uuid is distinct from head.version_id then raise exception 'setup changed; reload before saving' using errcode='23505'; end if;
  next_revision:=coalesce(head.revision,0)+1;
  if (next_revision=1 and request->'correctionReason'<>'null'::jsonb) or (next_revision>1 and coalesce(length(btrim(request->>'correctionReason')),0)<3) then raise exception 'correction reason required' using errcode='22023'; end if;
  if next_revision>1000 then raise exception 'setup history capacity reached' using errcode='54000'; end if;
  insert into neuvetra.company_setup_versions(id,company_id,revision,previous_version_id,correction_reason,payload,payload_sha256,period_start,period_end_exclusive,boundary_approach,created_by)
    values(new_id,target_company,next_revision,head.version_id,request->>'correctionReason',s,neuvetra.m67_hash(s),start_date,end_date,s#>>'{boundary,approach}',actor);
  for x in select value from jsonb_array_elements(s->'entities') loop
    perform neuvetra.company_setup_object(x,'id,name,ownershipPercent,control,inclusion,reason','id,name,control,inclusion,reason','ownershipPercent');
    if x->>'ownershipPercent' is not null and x->>'ownershipPercent' !~ '^(0|[1-9][0-9]{0,2})(\.[0-9]{1,8})?$' then raise exception 'invalid ownership percent' using errcode='22023'; end if;
    insert into neuvetra.company_setup_entities values(target_company,new_id,(x->>'id')::uuid,x->>'name',(x->>'ownershipPercent')::numeric,x->>'control',x->>'inclusion',x->>'reason');
  end loop;
  for x in select value from jsonb_array_elements(s->'relationships') loop
    perform neuvetra.company_setup_object(x,'id,parentEntityId,childEntityId,type,notes','id,parentEntityId,childEntityId,type,notes');
    insert into neuvetra.company_setup_relationships values(target_company,new_id,(x->>'id')::uuid,(x->>'parentEntityId')::uuid,(x->>'childEntityId')::uuid,x->>'type',x->>'notes');
  end loop;
  for x in select value from jsonb_array_elements(s->'locations') loop
    perform neuvetra.company_setup_object(x,'id,entityId,facilityId,name,countryCode,regionCode,locality,purpose,occupancy,control,inclusion,reason,start,endExclusive,otherEntity,operatorDetails,startMode,endMode,opened','id,name,locality,purpose,occupancy,control,inclusion,reason,otherEntity,operatorDetails,startMode,endMode','entityId,facilityId,countryCode,regionCode,start,endExclusive,opened');
    foreach k in array array['start','endExclusive','opened'] loop
      if x->>k is not null and x->>k!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'invalid location date' using errcode='22023'; end if;
    end loop;
    if (x->>'start')::date<start_date or (x->>'endExclusive')::date>end_date then raise exception 'location coverage outside reporting period' using errcode='22023'; end if;
    insert into neuvetra.company_setup_locations values(target_company,new_id,(x->>'id')::uuid,(x->>'entityId')::uuid,(x->>'facilityId')::uuid,x->>'name',x->>'countryCode',x->>'regionCode',x->>'locality',x->>'purpose',x->>'occupancy',x->>'control',x->>'inclusion',x->>'reason',(x->>'start')::date,(x->>'endExclusive')::date,x->>'otherEntity',x->>'operatorDetails',x->>'startMode',x->>'endMode',(x->>'opened')::date);
  end loop;
  for x in select value from jsonb_array_elements(s->'screening') loop
    perform neuvetra.company_setup_object(x,'id,scope,category,state,reason,details,locationId','id,category,state,reason,details','locationId');
    if jsonb_typeof(x->'scope') is distinct from 'number' or x->>'scope' not in('1','2','3') then raise exception 'invalid scope' using errcode='22023'; end if;
    insert into neuvetra.company_setup_screening values(target_company,new_id,x->>'id',(x->>'scope')::integer,x->>'category',x->>'state',x->>'reason',x->>'details',(x->>'locationId')::uuid);
  end loop;
  for x in select value from jsonb_array_elements(s->'changes') loop
    perform neuvetra.company_setup_object(x,'id,category,state,effectiveDate,details','id,category,state,details','effectiveDate');
    if x->>'effectiveDate' is not null and x->>'effectiveDate'!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'invalid change date' using errcode='22023'; end if;
    insert into neuvetra.company_setup_changes values(target_company,new_id,x->>'id',x->>'category',x->>'state',(x->>'effectiveDate')::date,x->>'details');
  end loop;
  insert into neuvetra.company_setup_heads values(target_company,new_id,next_revision) on conflict(company_id) do update set version_id=excluded.version_id,revision=excluded.revision;
  insert into neuvetra.company_setup_requests values(target_company,(request->>'idempotencyKey')::uuid,actor,fingerprint,new_id);
  record_id:=new_id; replayed:=false; return next;
end $$;
revoke all on function neuvetra.save_company_setup(uuid,jsonb) from public,authenticated,neuvetra_runtime;
grant execute on function neuvetra.save_company_setup(uuid,jsonb) to neuvetra_runtime;
