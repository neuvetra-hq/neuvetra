-- Candidate 0027 only: additive synthetic Scope 1+2 collection schema. Do not register or apply to hosted staging yet.
-- Existing records are untouched. Scope 3 grid losses retain lineage only to a collected electricity record.

create table neuvetra.collection_evidence_objects (
  id uuid primary key,
  company_id uuid not null references neuvetra.companies(id),
  storage_bucket text not null default 'neuvetra-private-company-evidence' check(storage_bucket='neuvetra-private-company-evidence'),
  storage_key text not null check(length(storage_key) between 40 and 500),
  original_name text not null check(length(btrim(original_name)) between 1 and 255),
  media_type text not null check(media_type in('application/pdf','image/jpeg','image/png','text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')),
  byte_length integer not null check(byte_length between 1 and 10485760),
  sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default clock_timestamp(),
  unique(id,company_id), unique(company_id,sha256), unique(company_id,storage_key),
  check(storage_key like company_id::text||'/original/%' and storage_key not like '%..%' and position(chr(92) in storage_key)=0)
);
create table neuvetra.collection_evidence_quarantine_events (
  id uuid primary key,
  company_id uuid not null,
  evidence_id uuid not null,
  status text not null check(status in('pending','clean','rejected','error')),
  scanner_reference text not null check(length(scanner_reference) between 1 and 500),
  details text not null check(length(details)<=2000),
  created_at timestamptz not null default clock_timestamp(),
  foreign key(evidence_id,company_id) references neuvetra.collection_evidence_objects(id,company_id)
);
create table neuvetra.collection_evidence_upload_intents (
  id uuid primary key,
  company_id uuid not null references neuvetra.companies(id),
  proposed_evidence_id uuid not null,
  object_key text not null,
  original_name text not null,
  media_type text not null,
  byte_length integer not null,
  sha256 text not null,
  request_sha256 text not null check(request_sha256 ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default clock_timestamp(),
  unique(id,company_id),
  check(object_key like company_id::text||'/original/%' and position(chr(92) in object_key)=0),
  check(length(btrim(original_name)) between 1 and 255),
  check(media_type in('application/pdf','image/jpeg','image/png','text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')),
  check(byte_length between 1 and 10485760),
  check(sha256 ~ '^[0-9a-f]{64}$')
);
create index collection_evidence_upload_intents_object_idx on neuvetra.collection_evidence_upload_intents(company_id,object_key);
create table neuvetra.collection_evidence_uploads (
  id uuid primary key,
  company_id uuid not null references neuvetra.companies(id),
  evidence_id uuid not null,
  uploaded_object_key text not null,
  status text not null check(status in('attached','duplicate_reused')),
  request_sha256 text not null check(request_sha256 ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default clock_timestamp(),
  unique(id,company_id),
  foreign key(id,company_id) references neuvetra.collection_evidence_upload_intents(id,company_id),
  foreign key(evidence_id,company_id) references neuvetra.collection_evidence_objects(id,company_id)
);
create table neuvetra.collection_evidence_orphan_recovery (
  id uuid primary key,
  company_id uuid not null,
  upload_id uuid not null,
  object_key text not null,
  reason text not null check(reason in('duplicate_object','registration_failed','attachment_abandoned')),
  status text not null check(status in('pending','recovered','abandoned')),
  recovery_note text,
  created_at timestamptz not null default clock_timestamp(),
  recovered_at timestamptz,
  unique(company_id,object_key),
  foreign key(upload_id,company_id) references neuvetra.collection_evidence_upload_intents(id,company_id),
  check((status='pending' and recovered_at is null) or (status<>'pending' and recovered_at is not null))
);

create table neuvetra.collection_activity_records (
  id uuid primary key,
  company_id uuid not null references neuvetra.companies(id),
  scope smallint not null check(scope in(1,2)),
  kind text not null check(kind in('natural_gas','distillate_no2','vehicle','fugitive','electricity')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default clock_timestamp(),
  unique(id,company_id), unique(id,company_id,kind),
  check((scope=1 and kind in('natural_gas','distillate_no2','vehicle','fugitive')) or (scope=2 and kind='electricity'))
);
create table neuvetra.collection_activity_versions (
  id uuid primary key,
  record_id uuid not null,
  company_id uuid not null,
  revision integer not null check(revision between 1 and 1000),
  previous_version_id uuid,
  correction_reason text,
  original_quantity text not null check(length(original_quantity)<=100),
  original_unit text not null check(length(original_unit)<=80),
  normalized_quantity numeric(15,3),
  normalized_unit text,
  quality text not null check(quality in('actual','estimated','unknown')),
  estimate_basis text,
  period_start date not null,
  period_end_exclusive date not null,
  reference text not null check(length(reference)<=1000),
  notes text not null check(length(notes)<=4000),
  inside_boundary boolean,
  maintains_refrigerant_stock boolean,
  retrofit_in_period boolean,
  electricity_zip text,
  utility_eia_id text,
  payload jsonb not null check(jsonb_typeof(payload)='object'),
  payload_sha256 text not null check(payload_sha256 ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default clock_timestamp(),
  unique(id,company_id), unique(record_id,revision),
  foreign key(record_id,company_id) references neuvetra.collection_activity_records(id,company_id),
  foreign key(previous_version_id,company_id) references neuvetra.collection_activity_versions(id,company_id),
  check((revision=1 and previous_version_id is null and correction_reason is null) or (revision>1 and previous_version_id is not null and length(btrim(correction_reason)) between 3 and 2000)),
  check((normalized_quantity is null)=(normalized_unit is null)),
  check((quality='estimated' and length(btrim(estimate_basis)) between 1 and 2000) or (quality<>'estimated' and estimate_basis is null)),
  check(period_start>=date '2025-01-01' and period_end_exclusive<=date '2026-01-01' and period_start<period_end_exclusive),
  check((payload->>'kind'='fugitive') or (inside_boundary is null and maintains_refrigerant_stock is null and retrofit_in_period is null)),
  check((payload->>'kind'='electricity' and electricity_zip ~ '^[0-9]{5}$') or (payload->>'kind'<>'electricity' and electricity_zip is null and utility_eia_id is null))
);
create table neuvetra.collection_activity_heads (
  record_id uuid not null,
  company_id uuid not null,
  version_id uuid not null,
  revision integer not null check(revision between 1 and 1000),
  primary key(record_id,company_id),
  foreign key(record_id,company_id) references neuvetra.collection_activity_records(id,company_id),
  foreign key(version_id,company_id) references neuvetra.collection_activity_versions(id,company_id)
);
create table neuvetra.collection_activity_requests (
  company_id uuid not null,
  idempotency_key uuid not null,
  actor_id uuid not null references auth.users(id),
  request_sha256 text not null check(request_sha256 ~ '^[0-9a-f]{64}$'),
  record_id uuid not null,
  version_id uuid not null,
  primary key(company_id,idempotency_key),
  foreign key(record_id,company_id) references neuvetra.collection_activity_records(id,company_id),
  foreign key(version_id,company_id) references neuvetra.collection_activity_versions(id,company_id)
);
create table neuvetra.collection_activity_evidence_links (
  company_id uuid not null,
  version_id uuid not null,
  evidence_id uuid not null,
  primary key(version_id,evidence_id),
  foreign key(version_id,company_id) references neuvetra.collection_activity_versions(id,company_id),
  foreign key(evidence_id,company_id) references neuvetra.collection_evidence_objects(id,company_id)
);
create table neuvetra.collection_electricity_instruments (
  company_id uuid not null,
  version_id uuid not null,
  ordinal integer not null check(ordinal between 1 and 100),
  instrument_type text not null check(instrument_type in('energy_attribute_certificate','power_purchase_agreement','green_tariff','supplier_specific_rate')),
  mwh numeric(15,3) check(mwh>=0),
  quality_criteria_met boolean not null,
  vintage_year integer not null check(vintage_year between 2024 and 2026),
  evidence_id uuid,
  generation_technology text not null check(generation_technology in('wind','solar_photovoltaic','hydro','nuclear','geothermal','natural_gas','coal','oil','biomass','biogas','landfill_gas','mixed','unknown')),
  rate_co2_lb_per_mwh numeric(15,3),
  rate_ch4_lb_per_mwh numeric(15,3),
  rate_n2o_lb_per_mwh numeric(15,3),
  primary key(version_id,ordinal),
  foreign key(version_id,company_id) references neuvetra.collection_activity_versions(id,company_id),
  foreign key(evidence_id,company_id) references neuvetra.collection_evidence_objects(id,company_id)
);
create table neuvetra.collection_grid_loss_lineage (
  id uuid primary key,
  company_id uuid not null references neuvetra.companies(id),
  electricity_record_id uuid not null,
  electricity_kind text not null default 'electricity' check(electricity_kind='electricity'),
  reference text not null check(length(reference)<=1000),
  notes text not null check(length(notes)<=4000),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default clock_timestamp(),
  unique(id,company_id), unique(company_id,electricity_record_id),
  foreign key(electricity_record_id,company_id,electricity_kind) references neuvetra.collection_activity_records(id,company_id,kind)
);

do $$ declare t text; begin
  foreach t in array array['collection_evidence_objects','collection_evidence_quarantine_events','collection_evidence_upload_intents','collection_evidence_uploads','collection_evidence_orphan_recovery','collection_activity_records','collection_activity_versions','collection_activity_heads','collection_activity_requests','collection_activity_evidence_links','collection_electricity_instruments','collection_grid_loss_lineage'] loop
    execute format('alter table neuvetra.%I enable row level security',t);
    execute format('alter table neuvetra.%I force row level security',t);
    execute format('revoke all on neuvetra.%I from public,authenticated,neuvetra_runtime',t);
    execute format('grant select on neuvetra.%I to neuvetra_runtime',t);
    execute format('create policy collection_member_read on neuvetra.%I for select to neuvetra_runtime using(neuvetra.is_company_member(company_id))',t);
  end loop;
  foreach t in array array['collection_evidence_objects','collection_evidence_quarantine_events','collection_evidence_upload_intents','collection_evidence_uploads','collection_activity_records','collection_activity_versions','collection_activity_requests','collection_activity_evidence_links','collection_electricity_instruments','collection_grid_loss_lineage'] loop
    execute format('create trigger collection_history_immutable before update or delete on neuvetra.%I for each row execute function neuvetra.reject_inventory_history_mutation()',t);
  end loop;
end $$;

-- Private Supabase Storage boundary. Uploads require a durable intent; reads require a clean quarantine event.
create function neuvetra.collection_storage_company_id(object_name text) returns uuid language plpgsql immutable set search_path=pg_catalog,neuvetra,pg_temp as $$ begin
  if object_name is null or object_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/original/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return null; end if;
  return split_part(object_name,'/',1)::uuid;
end $$;
revoke all on function neuvetra.collection_storage_company_id(text) from public,authenticated,neuvetra_runtime;

create function neuvetra.collection_storage_can_upload(bucket text,object_name text) returns boolean language plpgsql stable security definer set search_path=pg_catalog,neuvetra,pg_temp as $$
declare actor uuid:=auth.uid(); target_company uuid:=neuvetra.collection_storage_company_id(object_name); begin
  return bucket='neuvetra-private-company-evidence' and actor is not null and target_company is not null and neuvetra.has_staging_access() and neuvetra.can_manage_company(target_company)
    and exists(select 1 from neuvetra.collection_evidence_upload_intents i where i.company_id=target_company and i.object_key=object_name and i.created_by=actor);
end $$;
revoke all on function neuvetra.collection_storage_can_upload(text,text) from public,authenticated,neuvetra_runtime;
grant execute on function neuvetra.collection_storage_can_upload(text,text) to authenticated;

create function neuvetra.collection_storage_can_read(bucket text,object_name text) returns boolean language plpgsql stable security definer set search_path=pg_catalog,neuvetra,pg_temp as $$
declare target_company uuid:=neuvetra.collection_storage_company_id(object_name); begin
  return bucket='neuvetra-private-company-evidence' and target_company is not null and neuvetra.has_staging_access() and neuvetra.is_company_member(target_company)
    and exists(select 1 from neuvetra.collection_evidence_objects o where o.company_id=target_company and o.storage_key=object_name
      and (select q.status from neuvetra.collection_evidence_quarantine_events q where q.company_id=o.company_id and q.evidence_id=o.id order by q.created_at desc,q.id desc limit 1)='clean');
end $$;
revoke all on function neuvetra.collection_storage_can_read(text,text) from public,authenticated,neuvetra_runtime;
grant execute on function neuvetra.collection_storage_can_read(text,text) to authenticated;

do $$ begin
  if to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null then raise exception 'Supabase Storage baseline required' using errcode='55000'; end if;
  insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('neuvetra-private-company-evidence','neuvetra-private-company-evidence',false,10485760,array['application/pdf','image/jpeg','image/png','text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']::text[]) on conflict(id) do nothing;
  if not exists(select 1 from storage.buckets where id='neuvetra-private-company-evidence' and name='neuvetra-private-company-evidence' and public=false and file_size_limit=10485760 and allowed_mime_types=array['application/pdf','image/jpeg','image/png','text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']::text[]) then raise exception 'Collection Storage bucket configuration conflict' using errcode='55000'; end if;
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='storage' and c.relname='objects' and c.relrowsecurity) then raise exception 'Supabase Storage object RLS required' using errcode='55000'; end if;
end $$;
-- Restrictive guards keep these checks effective even if another permissive Storage policy is broader.
create policy neuvetra_collection_upload_allow on storage.objects as permissive for insert to authenticated with check(neuvetra.collection_storage_can_upload(bucket_id,name));
create policy neuvetra_collection_upload_guard on storage.objects as restrictive for insert to authenticated with check(bucket_id<>'neuvetra-private-company-evidence' or neuvetra.collection_storage_can_upload(bucket_id,name));
create policy neuvetra_collection_clean_read_allow on storage.objects as permissive for select to authenticated using(neuvetra.collection_storage_can_read(bucket_id,name));
create policy neuvetra_collection_clean_read_guard on storage.objects as restrictive for select to authenticated using(bucket_id<>'neuvetra-private-company-evidence' or neuvetra.collection_storage_can_read(bucket_id,name));
create policy neuvetra_collection_no_direct_update on storage.objects as restrictive for update to authenticated using(bucket_id<>'neuvetra-private-company-evidence') with check(bucket_id<>'neuvetra-private-company-evidence');
create policy neuvetra_collection_no_direct_delete on storage.objects as restrictive for delete to authenticated using(bucket_id<>'neuvetra-private-company-evidence');

create function neuvetra.collection_assert_decimal(value text) returns void language plpgsql immutable set search_path=pg_catalog,neuvetra,pg_temp as $$ begin
  if value !~ '^(0|[1-9][0-9]{0,11})(\.[0-9]{1,3})?$' then raise exception 'invalid collection decimal' using errcode='22023'; end if;
end $$;
revoke all on function neuvetra.collection_assert_decimal(text) from public,authenticated,neuvetra_runtime;
create function neuvetra.collection_assert_numeric_input(value jsonb) returns void language plpgsql immutable set search_path=pg_catalog,neuvetra,pg_temp as $$ begin
  if jsonb_typeof(value) is distinct from 'string' or length(value#>>'{}')>100 or value#>>'{}' ~ '[[:cntrl:]]' then raise exception 'invalid collection source text' using errcode='22023'; end if;
end $$;
revoke all on function neuvetra.collection_assert_numeric_input(jsonb) from public,authenticated,neuvetra_runtime;

create function neuvetra.collection_assert_activity(a jsonb) returns void language plpgsql set search_path=pg_catalog,neuvetra,pg_temp as $$
declare q jsonb; p jsonb; x jsonb; k text; start_date date; end_date date; begin
  perform neuvetra.m71_keys(a,'kind,quantity,quality,estimateBasis,period,reference,notes,evidenceIds,payload');
  if a->>'kind' not in('natural_gas','distillate_no2','vehicle','fugitive','electricity') or jsonb_typeof(a->'reference') is distinct from 'string' or length(a->>'reference')>1000 or jsonb_typeof(a->'notes') is distinct from 'string' or length(a->>'notes')>4000 then raise exception 'invalid collection activity' using errcode='22023'; end if;
  q:=a->'quantity'; perform neuvetra.m71_keys(q,'originalValue,originalUnit,normalizedValue,normalizedUnit');
  if jsonb_typeof(q->'originalValue') is distinct from 'string' or length(q->>'originalValue')>100 or jsonb_typeof(q->'originalUnit') is distinct from 'string' or length(q->>'originalUnit')>80 or jsonb_typeof(q->'normalizedValue') not in('string','null') or jsonb_typeof(q->'normalizedUnit') not in('string','null') or (q->'normalizedValue'='null'::jsonb)<>(q->'normalizedUnit'='null'::jsonb) then raise exception 'invalid collection quantity' using errcode='22023'; end if;
  if q->>'originalValue' in('','unknown') and q->'normalizedValue'<>'null'::jsonb then raise exception 'unknown quantity cannot be normalized' using errcode='22023'; end if;
  if q->'normalizedValue'<>'null'::jsonb then perform neuvetra.collection_assert_decimal(q->>'normalizedValue'); if length(q->>'normalizedUnit') not between 1 and 80 then raise exception 'invalid normalized unit' using errcode='22023'; end if; end if;
  if q->'normalizedValue'<>'null'::jsonb and ((a->>'kind'='natural_gas' and q->>'normalizedUnit' not in('therm','MMBtu','scf','ccf','mcf')) or (a->>'kind' in('distillate_no2','vehicle') and q->>'normalizedUnit'<>'US_gallon') or (a->>'kind'='fugitive' and q->>'normalizedUnit' not in('kg','lb')) or (a->>'kind'='electricity' and q->>'normalizedUnit' not in('kWh','MWh'))) then raise exception 'unsupported unit cannot be normalized' using errcode='22023'; end if;
  if a->>'quality' not in('actual','estimated','unknown') or jsonb_typeof(a->'estimateBasis') not in('string','null') or (a->>'quality'='estimated' and coalesce(length(btrim(a->>'estimateBasis')),0)=0) or (a->>'quality'<>'estimated' and a->'estimateBasis'<>'null'::jsonb) then raise exception 'invalid collection quality' using errcode='22023'; end if;
  perform neuvetra.m71_keys(a->'period','start,endExclusive');
  foreach k in array array['start','endExclusive'] loop if coalesce(a#>>array['period',k],'')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'invalid collection date' using errcode='22023'; end if; end loop;
  start_date:=(a#>>'{period,start}')::date; end_date:=(a#>>'{period,endExclusive}')::date;
  if start_date<date '2025-01-01' or end_date>date '2026-01-01' or start_date>=end_date then raise exception 'collection period outside 2025' using errcode='22023'; end if;
  if jsonb_typeof(a->'evidenceIds') is distinct from 'array' or jsonb_array_length(a->'evidenceIds')>20 or exists(select 1 from jsonb_array_elements(a->'evidenceIds') e where jsonb_typeof(e)<>'string' or e#>>'{}' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') or (select count(*) from jsonb_array_elements_text(a->'evidenceIds'))<>(select count(distinct e) from jsonb_array_elements_text(a->'evidenceIds') e) then raise exception 'invalid collection evidence list' using errcode='22023'; end if;
  p:=a->'payload';
  if a->>'kind'='natural_gas' then
    perform neuvetra.m71_keys(p,'heatContent');
    if jsonb_typeof(p->'heatContent') not in('object','null') then raise exception 'invalid heat content' using errcode='22023'; end if;
    if p->'heatContent'<>'null'::jsonb then perform neuvetra.m71_keys(p->'heatContent','value,unit'); perform neuvetra.collection_assert_numeric_input(p#>'{heatContent,value}'); if p#>>'{heatContent,unit}' not in('MMBtu per scf','MMBtu per ccf','MMBtu per mcf','therm per ccf') then raise exception 'invalid heat content unit' using errcode='22023'; end if; end if;
  elsif a->>'kind'='distillate_no2' then
    perform neuvetra.m71_keys(p,'consumption,statedHhvMmbtuPerGallon'); if jsonb_typeof(p->'statedHhvMmbtuPerGallon') not in('string','null') then raise exception 'invalid stated HHV' using errcode='22023'; end if; if p->'statedHhvMmbtuPerGallon'<>'null'::jsonb then perform neuvetra.collection_assert_decimal(p->>'statedHhvMmbtuPerGallon'); end if;
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
  else
    perform neuvetra.m71_keys(p,'meterOrAccountNumber,utilityName,site,zip,subregion,utilityEiaId,instruments');
    if coalesce(p->>'zip','')!~'^[0-9]{5}$' or jsonb_typeof(p->'utilityEiaId') not in('string','null') or jsonb_typeof(p->'instruments') is distinct from 'array' or jsonb_array_length(p->'instruments')>100 then raise exception 'invalid electricity activity' using errcode='22023'; end if;
    for x in select value from jsonb_array_elements(p->'instruments') loop
      perform neuvetra.m71_keys(x,'type,mwh,qualityCriteriaMet,vintageYear,evidenceReference,generationTechnology,rateLbPerMwh'); perform neuvetra.collection_assert_numeric_input(x->'mwh');
      if x->>'type' not in('energy_attribute_certificate','power_purchase_agreement','green_tariff','supplier_specific_rate') or jsonb_typeof(x->'qualityCriteriaMet') is distinct from 'boolean' or coalesce(x->>'vintageYear','')!~'^[0-9]{4}$' or (x->>'vintageYear')::integer not between 2024 and 2026 or jsonb_typeof(x->'evidenceReference') not in('string','null') or (x->'evidenceReference'<>'null'::jsonb and coalesce(x->>'evidenceReference','')!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') or x->>'generationTechnology' not in('wind','solar_photovoltaic','hydro','nuclear','geothermal','natural_gas','coal','oil','biomass','biogas','landfill_gas','mixed','unknown') or jsonb_typeof(x->'rateLbPerMwh') not in('object','null') then raise exception 'invalid electricity instrument' using errcode='22023'; end if;
      if x->'rateLbPerMwh'<>'null'::jsonb then perform neuvetra.m71_keys(x->'rateLbPerMwh','co2,ch4,n2o'); perform neuvetra.collection_assert_numeric_input(x#>'{rateLbPerMwh,co2}'); if x#>'{rateLbPerMwh,ch4}'<>'null'::jsonb then perform neuvetra.collection_assert_numeric_input(x#>'{rateLbPerMwh,ch4}'); end if; if x#>'{rateLbPerMwh,n2o}'<>'null'::jsonb then perform neuvetra.collection_assert_numeric_input(x#>'{rateLbPerMwh,n2o}'); end if; end if;
      if x->'evidenceReference'<>'null'::jsonb and not (a->'evidenceIds' ? (x->>'evidenceReference')) then raise exception 'instrument evidence must be linked' using errcode='22023'; end if;
    end loop;
  end if;
end $$;
revoke all on function neuvetra.collection_assert_activity(jsonb) from public,authenticated,neuvetra_runtime;

create function neuvetra.save_collection_activity(target_company uuid,target_record uuid,request jsonb)
returns table(record_id uuid,version_id uuid,replayed boolean) language plpgsql security definer set search_path=pg_catalog,neuvetra,pg_temp as $$
#variable_conflict use_column
declare actor uuid:=auth.uid(); a jsonb; old neuvetra.collection_activity_requests%rowtype; head neuvetra.collection_activity_heads%rowtype; rec neuvetra.collection_activity_records%rowtype; fingerprint text; new_version uuid:=gen_random_uuid(); next_revision integer; evidence text; instrument jsonb; n bigint; begin
  if actor is null or not neuvetra.has_staging_access() or not neuvetra.can_manage_company(target_company) then raise exception 'collection activity unavailable' using errcode='42501'; end if;
  perform neuvetra.m71_keys(request,'idempotencyKey,expectedRevision,expectedVersionId,correctionReason,activity');
  if coalesce(request->>'idempotencyKey','')!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or coalesce(request->>'expectedRevision','')!~'^[0-9]{1,4}$' or jsonb_typeof(request->'expectedVersionId') not in('string','null') or jsonb_typeof(request->'correctionReason') not in('string','null') or octet_length(request::text)>150000 then raise exception 'invalid collection request' using errcode='22023'; end if;
  a:=request->'activity'; perform neuvetra.collection_assert_activity(a);
  fingerprint:=neuvetra.m67_hash(jsonb_build_object('operation','save_collection_activity','companyId',target_company,'recordId',target_record,'actorId',actor,'request',request-'idempotencyKey'));
  -- Serialize before looking up the receipt: a concurrent exact replay may have
  -- been waiting on this company lock and must observe the committed request.
  perform id from neuvetra.companies where id=target_company for update;
  select * into old from neuvetra.collection_activity_requests where company_id=target_company and idempotency_key=(request->>'idempotencyKey')::uuid;
  if found then if old.actor_id<>actor or old.request_sha256<>fingerprint or old.record_id<>target_record then raise exception 'collection idempotency conflict' using errcode='23505'; end if; record_id:=old.record_id; version_id:=old.version_id; replayed:=true; return next; return; end if;
  select * into rec from neuvetra.collection_activity_records where id=target_record and company_id=target_company;
  if not found then
    if request->>'expectedRevision'<>'0' or request->'expectedVersionId'<>'null'::jsonb or request->'correctionReason'<>'null'::jsonb then raise exception 'invalid first collection version' using errcode='22023'; end if;
    insert into neuvetra.collection_activity_records(id,company_id,scope,kind,created_by) values(target_record,target_company,case when a->>'kind'='electricity' then 2 else 1 end,a->>'kind',actor);
  elsif rec.kind<>a->>'kind' then raise exception 'collection record kind cannot change' using errcode='22023'; end if;
  select * into head from neuvetra.collection_activity_heads where record_id=target_record and company_id=target_company for update;
  if (request->>'expectedRevision')::integer<>coalesce(head.revision,0) or request->'expectedVersionId' is distinct from coalesce(to_jsonb(head.version_id::text),'null'::jsonb) then raise exception 'collection changed; reload before saving' using errcode='23505'; end if;
  next_revision:=coalesce(head.revision,0)+1;
  if (next_revision=1 and request->'correctionReason'<>'null'::jsonb) or (next_revision>1 and coalesce(length(btrim(request->>'correctionReason')),0)<3) then raise exception 'collection correction reason required' using errcode='22023'; end if;
  for evidence in select value from jsonb_array_elements_text(a->'evidenceIds') loop if not exists(select 1 from neuvetra.collection_evidence_objects where company_id=target_company and id=evidence::uuid) then raise exception 'collection evidence unavailable' using errcode='23503'; end if; end loop;
  insert into neuvetra.collection_activity_versions(id,record_id,company_id,revision,previous_version_id,correction_reason,original_quantity,original_unit,normalized_quantity,normalized_unit,quality,estimate_basis,period_start,period_end_exclusive,reference,notes,inside_boundary,maintains_refrigerant_stock,retrofit_in_period,electricity_zip,utility_eia_id,payload,payload_sha256,created_by)
  values(new_version,target_record,target_company,next_revision,head.version_id,request->>'correctionReason',a#>>'{quantity,originalValue}',a#>>'{quantity,originalUnit}',(a#>>'{quantity,normalizedValue}')::numeric,a#>>'{quantity,normalizedUnit}',a->>'quality',a->>'estimateBasis',(a#>>'{period,start}')::date,(a#>>'{period,endExclusive}')::date,a->>'reference',a->>'notes',(a#>>'{payload,insideBoundary}')::boolean,(a#>>'{payload,maintainsRefrigerantStock}')::boolean,(a#>>'{payload,retrofitInPeriod}')::boolean,a#>>'{payload,zip}',a#>>'{payload,utilityEiaId}',a,neuvetra.m67_hash(a),actor);
  insert into neuvetra.collection_activity_evidence_links(company_id,version_id,evidence_id) select target_company,new_version,value::uuid from jsonb_array_elements_text(a->'evidenceIds');
  if a->>'kind'='electricity' then
    for instrument,n in select value,ordinality from jsonb_array_elements(a#>'{payload,instruments}') with ordinality loop
      insert into neuvetra.collection_electricity_instruments(company_id,version_id,ordinal,instrument_type,mwh,quality_criteria_met,vintage_year,evidence_id,generation_technology,rate_co2_lb_per_mwh,rate_ch4_lb_per_mwh,rate_n2o_lb_per_mwh)
      values(target_company,new_version,n,instrument->>'type',case when instrument->>'mwh' ~ '^(0|[1-9][0-9]{0,11})(\.[0-9]{1,3})?$' then (instrument->>'mwh')::numeric end,(instrument->>'qualityCriteriaMet')::boolean,(instrument->>'vintageYear')::integer,(instrument->>'evidenceReference')::uuid,instrument->>'generationTechnology',case when instrument#>>'{rateLbPerMwh,co2}' ~ '^(0|[1-9][0-9]{0,11})(\.[0-9]{1,3})?$' then (instrument#>>'{rateLbPerMwh,co2}')::numeric end,case when instrument#>>'{rateLbPerMwh,ch4}' ~ '^(0|[1-9][0-9]{0,11})(\.[0-9]{1,3})?$' then (instrument#>>'{rateLbPerMwh,ch4}')::numeric end,case when instrument#>>'{rateLbPerMwh,n2o}' ~ '^(0|[1-9][0-9]{0,11})(\.[0-9]{1,3})?$' then (instrument#>>'{rateLbPerMwh,n2o}')::numeric end);
    end loop;
  end if;
  insert into neuvetra.collection_activity_heads values(target_record,target_company,new_version,next_revision) on conflict(record_id,company_id) do update set version_id=excluded.version_id,revision=excluded.revision;
  insert into neuvetra.collection_activity_requests values(target_company,(request->>'idempotencyKey')::uuid,actor,fingerprint,target_record,new_version);
  record_id:=target_record; version_id:=new_version; replayed:=false; return next;
end $$;
revoke all on function neuvetra.save_collection_activity(uuid,uuid,jsonb) from public,authenticated,neuvetra_runtime;
grant execute on function neuvetra.save_collection_activity(uuid,uuid,jsonb) to neuvetra_runtime;

create function neuvetra.create_collection_grid_loss_lineage(target_company uuid,lineage_id uuid,electricity_record uuid,reference_text text,notes_text text) returns uuid language plpgsql security definer set search_path=pg_catalog,neuvetra,pg_temp as $$
declare actor uuid:=auth.uid(); begin
  if actor is null or not neuvetra.has_staging_access() or not neuvetra.can_manage_company(target_company) then raise exception 'grid-loss lineage unavailable' using errcode='42501'; end if;
  if length(reference_text)>1000 or length(notes_text)>4000 then raise exception 'invalid grid-loss lineage' using errcode='22023'; end if;
  insert into neuvetra.collection_grid_loss_lineage(id,company_id,electricity_record_id,reference,notes,created_by) values(lineage_id,target_company,electricity_record,reference_text,notes_text,actor);
  return lineage_id;
end $$;
revoke all on function neuvetra.create_collection_grid_loss_lineage(uuid,uuid,uuid,text,text) from public,authenticated,neuvetra_runtime;
grant execute on function neuvetra.create_collection_grid_loss_lineage(uuid,uuid,uuid,text,text) to neuvetra_runtime;

create function neuvetra.reserve_collection_evidence_upload(target_company uuid,requested_upload_id uuid,proposed_evidence_id uuid,object_key text,original_name text,media_type text,byte_length integer,content_sha256 text) returns uuid language plpgsql security definer set search_path=pg_catalog,neuvetra,pg_temp as $$
declare actor uuid:=auth.uid(); prior neuvetra.collection_evidence_upload_intents%rowtype; fingerprint text; begin
  if actor is null or not neuvetra.has_staging_access() or not neuvetra.can_manage_company(target_company) then raise exception 'collection evidence unavailable' using errcode='42501'; end if;
  if object_key not like target_company::text||'/original/%' or neuvetra.collection_storage_company_id(object_key) is distinct from target_company or length(btrim(original_name)) not between 1 and 255 or media_type not in('application/pdf','image/jpeg','image/png','text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') or byte_length not between 1 and 10485760 or content_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'invalid collection evidence metadata' using errcode='22023'; end if;
  fingerprint:=neuvetra.m67_hash(jsonb_build_object('companyId',target_company,'evidenceId',proposed_evidence_id,'objectKey',object_key,'originalName',original_name,'mediaType',media_type,'byteLength',byte_length,'sha256',content_sha256));
  -- Serialize before looking up the receipt so simultaneous reservations with
  -- the same upload id converge on the first committed intent.
  perform id from neuvetra.companies where id=target_company for update;
  select * into prior from neuvetra.collection_evidence_upload_intents where id=requested_upload_id and company_id=target_company;
  if found then if prior.created_by<>actor or prior.request_sha256<>fingerprint then raise exception 'evidence upload intent conflict' using errcode='23505'; end if; return prior.id; end if;
  insert into neuvetra.collection_evidence_upload_intents(id,company_id,proposed_evidence_id,object_key,original_name,media_type,byte_length,sha256,request_sha256,created_by) values(requested_upload_id,target_company,proposed_evidence_id,object_key,original_name,media_type,byte_length,content_sha256,fingerprint,actor);
  return requested_upload_id;
end $$;
revoke all on function neuvetra.reserve_collection_evidence_upload(uuid,uuid,uuid,text,text,text,integer,text) from public,authenticated,neuvetra_runtime;
grant execute on function neuvetra.reserve_collection_evidence_upload(uuid,uuid,uuid,text,text,text,integer,text) to neuvetra_runtime;

create function neuvetra.register_collection_evidence(target_company uuid,requested_upload_id uuid,proposed_evidence_id uuid,object_key text,original_name text,media_type text,byte_length integer,content_sha256 text)
returns table(upload_id uuid,evidence_id uuid,reused boolean,quarantine_status text,orphan_recovery_required boolean) language plpgsql security definer set search_path=pg_catalog,neuvetra,pg_temp as $$
#variable_conflict use_column
declare actor uuid:=auth.uid(); existing neuvetra.collection_evidence_objects%rowtype; intent neuvetra.collection_evidence_upload_intents%rowtype; prior neuvetra.collection_evidence_uploads%rowtype; fingerprint text; current_status text; orphaned boolean:=false; begin
  if actor is null or not neuvetra.has_staging_access() or not neuvetra.can_manage_company(target_company) then raise exception 'collection evidence unavailable' using errcode='42501'; end if;
  if object_key not like target_company::text||'/original/%' or object_key like '%..%' or position(chr(92) in object_key)>0 or length(object_key)>500 or length(btrim(original_name)) not between 1 and 255 or media_type not in('application/pdf','image/jpeg','image/png','text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') or byte_length not between 1 and 10485760 or content_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'invalid collection evidence metadata' using errcode='22023'; end if;
  fingerprint:=neuvetra.m67_hash(jsonb_build_object('companyId',target_company,'evidenceId',proposed_evidence_id,'objectKey',object_key,'originalName',original_name,'mediaType',media_type,'byteLength',byte_length,'sha256',content_sha256));
  -- Use the same company-first lock order as reservation. A concurrent exact
  -- registration then observes and replays the first committed receipt.
  perform id from neuvetra.companies where id=target_company for update;
  select * into prior from neuvetra.collection_evidence_uploads where id=requested_upload_id and company_id=target_company;
  if found then
    if prior.created_by<>actor or prior.request_sha256<>fingerprint then raise exception 'evidence upload idempotency conflict' using errcode='23505'; end if;
    select q.status into current_status from neuvetra.collection_evidence_quarantine_events q where q.company_id=target_company and q.evidence_id=prior.evidence_id order by q.created_at desc,q.id desc limit 1;
    upload_id:=prior.id; evidence_id:=prior.evidence_id; reused:=prior.status='duplicate_reused'; quarantine_status:=current_status; orphan_recovery_required:=exists(select 1 from neuvetra.collection_evidence_orphan_recovery o where o.company_id=target_company and o.upload_id=prior.id and o.status='pending'); return next; return;
  end if;
  select * into intent from neuvetra.collection_evidence_upload_intents where id=requested_upload_id and company_id=target_company for update;
  if not found or intent.created_by<>actor or intent.request_sha256<>fingerprint then raise exception 'matching evidence upload intent required' using errcode='23503'; end if;
  select * into existing from neuvetra.collection_evidence_objects where company_id=target_company and sha256=content_sha256;
  if found then
    insert into neuvetra.collection_evidence_uploads values(requested_upload_id,target_company,existing.id,object_key,'duplicate_reused',fingerprint,actor,clock_timestamp());
    if object_key<>existing.storage_key then insert into neuvetra.collection_evidence_orphan_recovery values(gen_random_uuid(),target_company,requested_upload_id,object_key,'duplicate_object','pending',null,clock_timestamp(),null); orphaned:=true; end if;
    select q.status into current_status from neuvetra.collection_evidence_quarantine_events q where q.company_id=target_company and q.evidence_id=existing.id order by q.created_at desc,q.id desc limit 1;
    evidence_id:=existing.id; reused:=true;
  else
    insert into neuvetra.collection_evidence_objects(id,company_id,storage_key,original_name,media_type,byte_length,sha256,uploaded_by) values(proposed_evidence_id,target_company,object_key,original_name,media_type,byte_length,content_sha256,actor);
    insert into neuvetra.collection_evidence_quarantine_events values(gen_random_uuid(),target_company,proposed_evidence_id,'pending','upload-registration','Awaiting malware and content scan.',clock_timestamp());
    insert into neuvetra.collection_evidence_uploads values(requested_upload_id,target_company,proposed_evidence_id,object_key,'attached',fingerprint,actor,clock_timestamp());
    evidence_id:=proposed_evidence_id; reused:=false; current_status:='pending';
  end if;
  upload_id:=requested_upload_id; quarantine_status:=current_status; orphan_recovery_required:=orphaned; return next;
end $$;
revoke all on function neuvetra.register_collection_evidence(uuid,uuid,uuid,text,text,text,integer,text) from public,authenticated,neuvetra_runtime;
grant execute on function neuvetra.register_collection_evidence(uuid,uuid,uuid,text,text,text,integer,text) to neuvetra_runtime;

create function neuvetra.mark_collection_evidence_registration_failed(target_company uuid,requested_upload_id uuid) returns uuid language plpgsql security definer set search_path=pg_catalog,neuvetra,pg_temp as $$
declare actor uuid:=auth.uid(); intent neuvetra.collection_evidence_upload_intents%rowtype; recovery_id uuid; begin
  if actor is null or not neuvetra.has_staging_access() or not neuvetra.can_manage_company(target_company) then raise exception 'collection evidence unavailable' using errcode='42501'; end if;
  select * into intent from neuvetra.collection_evidence_upload_intents where id=requested_upload_id and company_id=target_company;
  if not found or intent.created_by<>actor or exists(select 1 from neuvetra.collection_evidence_uploads where id=requested_upload_id and company_id=target_company) then raise exception 'pending evidence upload intent required' using errcode='23503'; end if;
  insert into neuvetra.collection_evidence_orphan_recovery(id,company_id,upload_id,object_key,reason,status) values(gen_random_uuid(),target_company,requested_upload_id,intent.object_key,'registration_failed','pending') on conflict(company_id,object_key) do nothing;
  select id into recovery_id from neuvetra.collection_evidence_orphan_recovery where company_id=target_company and object_key=intent.object_key;
  return recovery_id;
end $$;
revoke all on function neuvetra.mark_collection_evidence_registration_failed(uuid,uuid) from public,authenticated,neuvetra_runtime;
grant execute on function neuvetra.mark_collection_evidence_registration_failed(uuid,uuid) to neuvetra_runtime;

-- Trusted operator-only recovery receipt. Application roles cannot delete or mark Storage objects recovered.
create function neuvetra.resolve_collection_evidence_orphan(target_company uuid,target_recovery uuid,outcome text,note text) returns void language plpgsql security definer set search_path=pg_catalog,neuvetra,pg_temp as $$
declare recovery neuvetra.collection_evidence_orphan_recovery%rowtype; begin
  if outcome not in('recovered','abandoned') or length(btrim(note)) not between 3 and 2000 then raise exception 'invalid orphan recovery receipt' using errcode='22023'; end if;
  select * into recovery from neuvetra.collection_evidence_orphan_recovery where company_id=target_company and id=target_recovery and status='pending' for update;
  if not found then raise exception 'pending orphan recovery not found' using errcode='P0002'; end if;
  if outcome='recovered' and exists(select 1 from storage.objects where bucket_id='neuvetra-private-company-evidence' and name=recovery.object_key) then raise exception 'orphan storage object must be removed before recovery is recorded' using errcode='23514'; end if;
  update neuvetra.collection_evidence_orphan_recovery set status=outcome,recovery_note=note,recovered_at=clock_timestamp() where company_id=target_company and id=target_recovery;
end $$;
revoke all on function neuvetra.resolve_collection_evidence_orphan(uuid,uuid,text,text) from public,authenticated,neuvetra_runtime;

-- Operator/scanner boundary. Deliberately not granted to application roles.
create function neuvetra.record_collection_evidence_quarantine(target_company uuid,target_evidence uuid,status text,scanner_reference text,details text) returns uuid language plpgsql set search_path=pg_catalog,neuvetra,pg_temp as $$
declare event_id uuid:=gen_random_uuid(); begin
  if status not in('clean','rejected','error') or length(scanner_reference) not between 1 and 500 or length(details)>2000 then raise exception 'invalid quarantine event' using errcode='22023'; end if;
  insert into neuvetra.collection_evidence_quarantine_events values(event_id,target_company,target_evidence,status,scanner_reference,details,clock_timestamp()); return event_id;
end $$;
revoke all on function neuvetra.record_collection_evidence_quarantine(uuid,uuid,text,text,text) from public,authenticated,neuvetra_runtime;
