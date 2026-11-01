-- 0029: Scope 3 collection (Scope 3 package 2; Claude, 26 October 2026). Board decisions of 26 October 2026: D1 (extend the
-- 0027 collection tables), D2 (screening stays in company setup, 0023), D3 and D4 (application only), D5 (the 0028 gates).
--
-- Additive only. No existing row is rewritten, moved or deleted, and every existing record, version, head, request and
-- hash stays byte-identical. This migration:
--   1. widens the record table's scope and kind checks to the four Scope 3 kinds (transport, waste, business_travel,
--      employee_commuting), each paired with scope 3;
--   2. replaces collection_assert_activity (same signature) so it also accepts those kinds, with exactly the payload keys
--      and types of validateScope3Payload (scope3-collection-contract.ts) and the per-kind normalized units of
--      SCOPE3_COLLECTION_UNITS. Tokens (vehicle, material, treatment, mode) are any text up to 80 characters, so the
--      adapter can hold an unknown value rather than the database refusing it; nothing else about Scope 1 or 2 changes;
--   3. replaces save_collection_activity (same signature and grants) so a Scope 3 record is stored with scope 3.
-- Unchanged: the versions table (its 2025 period check applies to Scope 3; its fugitive and electricity column checks hold
-- because Scope 3 leaves those columns null), collection_derive_quantity, 0028's electricity trigger (electricity only),
-- the grid-loss lineage table, and company setup screening (0023 already stores Scope 3 rows).
-- Never rerun 001, 004, 0027 or 0028. No reverse migration is planned.

-- 1. The record table's checks. 0027 declared them inline, so PostgreSQL chose their names; they are found by the
-- columns they constrain (scope alone, kind alone, and the scope/kind pairing) and there must be exactly three.
do $checks$
declare c record; dropped integer:=0;
begin
  for c in
    select con.conname, array(select att.attname::text from unnest(con.conkey) k join pg_attribute att on att.attrelid=con.conrelid and att.attnum=k order by 1) cols
    from pg_constraint con where con.conrelid='neuvetra.collection_activity_records'::regclass and con.contype='c'
  loop
    if c.cols in (array['scope'], array['kind'], array['kind','scope']) then
      execute format('alter table neuvetra.collection_activity_records drop constraint %I', c.conname);
      dropped:=dropped+1;
    end if;
  end loop;
  if dropped<>3 then raise exception '0029 expected the three 0027 scope and kind checks on collection_activity_records, found %', dropped using errcode='55000'; end if;
end $checks$;
alter table neuvetra.collection_activity_records
  add constraint collection_activity_records_scope_check check(scope in(1,2,3)),
  add constraint collection_activity_records_kind_check check(kind in('natural_gas','distillate_no2','vehicle','fugitive','electricity','transport','waste','business_travel','employee_commuting')),
  add constraint collection_activity_records_scope_kind_check check((scope=1 and kind in('natural_gas','distillate_no2','vehicle','fugitive')) or (scope=2 and kind='electricity') or (scope=3 and kind in('transport','waste','business_travel','employee_commuting')));

-- 2. The activity check, with the Scope 3 kinds. The Scope 1 and 2 branches are 0027's, unchanged.
create or replace function neuvetra.collection_assert_activity(a jsonb) returns void language plpgsql set search_path=pg_catalog,neuvetra,pg_temp as $$
declare q jsonb; p jsonb; x jsonb; k text; start_date date; end_date date; begin
  perform neuvetra.m71_keys(a,'kind,locationId,setupVersionId,sourceId,state,withdrawalReason,quantity,quality,estimateBasis,period,reference,notes,evidenceIds,payload');
  if coalesce(a->>'locationId','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or coalesce(a->>'setupVersionId','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or jsonb_typeof(a->'sourceId') is distinct from 'string' or length(btrim(a->>'sourceId')) not between 1 and 120 then raise exception 'location and source identifiers required' using errcode='22023'; end if;
  if a->>'state' not in('active','withdrawn') or jsonb_typeof(a->'withdrawalReason') not in('string','null') or (a->>'state'='active' and a->'withdrawalReason'<>'null'::jsonb) or (a->>'state'='withdrawn' and coalesce(length(btrim(a->>'withdrawalReason')),0) not between 3 and 2000) then raise exception 'invalid withdrawal state or reason' using errcode='22023'; end if;
  if a->>'kind' not in('natural_gas','distillate_no2','vehicle','fugitive','electricity','transport','waste','business_travel','employee_commuting') or jsonb_typeof(a->'reference') is distinct from 'string' or length(a->>'reference')>1000 or jsonb_typeof(a->'notes') is distinct from 'string' or length(a->>'notes')>4000 then raise exception 'invalid collection activity' using errcode='22023'; end if;
  q:=a->'quantity'; perform neuvetra.m71_keys(q,'originalValue,originalUnit,normalizedValue,normalizedUnit');
  if jsonb_typeof(q->'originalValue') is distinct from 'string' or length(q->>'originalValue')>100 or jsonb_typeof(q->'originalUnit') is distinct from 'string' or length(q->>'originalUnit')>80 or jsonb_typeof(q->'normalizedValue') not in('string','null') or jsonb_typeof(q->'normalizedUnit') not in('string','null') or (q->'normalizedValue'='null'::jsonb)<>(q->'normalizedUnit'='null'::jsonb) then raise exception 'invalid collection quantity' using errcode='22023'; end if;
  if q->>'originalValue' in('','unknown') and q->'normalizedValue'<>'null'::jsonb then raise exception 'unknown quantity cannot be normalized' using errcode='22023'; end if;
  if q->'normalizedValue'<>'null'::jsonb then perform neuvetra.collection_assert_decimal(q->>'normalizedValue'); if length(q->>'normalizedUnit') not between 1 and 80 then raise exception 'invalid normalized unit' using errcode='22023'; end if; end if;
  if q->'normalizedValue'<>'null'::jsonb and ((a->>'kind'='natural_gas' and q->>'normalizedUnit' not in('therm','MMBtu','scf','ccf','mcf')) or (a->>'kind' in('distillate_no2','vehicle') and q->>'normalizedUnit'<>'US_gallon') or (a->>'kind'='fugitive' and q->>'normalizedUnit' not in('kg','lb')) or (a->>'kind'='electricity' and q->>'normalizedUnit' not in('kWh','MWh'))
    or (a->>'kind'='transport' and q->>'normalizedUnit' not in('vehicle-mile','vehicle-km','short ton-mile','tonne-km')) or (a->>'kind'='waste' and q->>'normalizedUnit' not in('short_ton','lb','kg','metric_ton'))
    or (a->>'kind'='business_travel' and q->>'normalizedUnit' not in('mile','km','passenger-mile','passenger-km','vehicle-mile','vehicle-km')) or (a->>'kind'='employee_commuting' and q->>'normalizedUnit' not in('passenger-mile','passenger-km','vehicle-mile','vehicle-km'))) then raise exception 'unsupported unit cannot be normalized' using errcode='22023'; end if;
  if a->>'quality' not in('actual','estimated','unknown') or jsonb_typeof(a->'estimateBasis') not in('string','null') or (a->>'quality'='estimated' and coalesce(length(btrim(a->>'estimateBasis')),0)=0) or (a->>'quality'<>'estimated' and a->'estimateBasis'<>'null'::jsonb) then raise exception 'invalid collection quality' using errcode='22023'; end if;
  perform neuvetra.m71_keys(a->'period','start,endExclusive');
  foreach k in array array['start','endExclusive'] loop if coalesce(a#>>array['period',k],'')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'invalid collection date' using errcode='22023'; end if; end loop;
  start_date:=(a#>>'{period,start}')::date; end_date:=(a#>>'{period,endExclusive}')::date;
  if start_date<date '2025-01-01' or end_date>date '2026-01-01' or start_date>=end_date then raise exception 'collection period outside 2025' using errcode='22023'; end if;
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
    perform neuvetra.m71_keys(p,'category,vehicle,loadBasis,thirdPartyFacilities');
    if jsonb_typeof(p->'category') is distinct from 'number' or p->>'category' not in('4','9') or jsonb_typeof(p->'vehicle') is distinct from 'string' or length(p->>'vehicle')>80
      or (p->'loadBasis'<>'null'::jsonb and coalesce(p->>'loadBasis','') not in('dedicated_vehicle','shared_vehicle')) or coalesce(p->>'thirdPartyFacilities','') not in('none','present_not_included','unknown') or jsonb_typeof(p->'thirdPartyFacilities') is distinct from 'string' then raise exception 'invalid transport activity' using errcode='22023'; end if;
  elsif a->>'kind'='waste' then
    perform neuvetra.m71_keys(p,'category,material,treatment');
    if jsonb_typeof(p->'category') is distinct from 'number' or p->>'category' not in('5','12') or jsonb_typeof(p->'material') is distinct from 'string' or length(p->>'material')>80 or jsonb_typeof(p->'treatment') is distinct from 'string' or length(p->>'treatment')>80 then raise exception 'invalid waste activity' using errcode='22023'; end if;
  elsif a->>'kind'='business_travel' then
    perform neuvetra.m71_keys(p,'mode,passengerSegments,haulBasis');
    if jsonb_typeof(p->'mode') is distinct from 'string' or length(p->>'mode')>80
      or (p->'passengerSegments'<>'null'::jsonb and (jsonb_typeof(p->'passengerSegments') is distinct from 'number' or coalesce(p->>'passengerSegments','') !~ '^[1-9][0-9]{0,7}$' or (p->>'passengerSegments')::bigint>10000000))
      or (p->'haulBasis'<>'null'::jsonb and (jsonb_typeof(p->'haulBasis') is distinct from 'string' or length(p->>'haulBasis')>200)) then raise exception 'invalid business travel activity' using errcode='22023'; end if;
  elsif a->>'kind'='employee_commuting' then
    perform neuvetra.m71_keys(p,'mode');
    if jsonb_typeof(p->'mode') is distinct from 'string' or length(p->>'mode')>80 then raise exception 'invalid commuting activity' using errcode='22023'; end if;
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

-- 3. The save function: 0027's body, with scope 3 for the Scope 3 kinds (the one changed expression is marked).
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
    -- 0029: scope 3 for the Scope 3 kinds.
    insert into neuvetra.collection_activity_records(id,company_id,scope,kind,created_by) values(target_record,target_company,case when a->>'kind'='electricity' then 2 when a->>'kind' in('transport','waste','business_travel','employee_commuting') then 3 else 1 end,a->>'kind',actor);
  elsif rec.kind<>a->>'kind' then raise exception 'collection record kind cannot change' using errcode='22023'; end if;
  select * into head from neuvetra.collection_activity_heads where record_id=target_record and company_id=target_company for update;
  if (request->>'expectedRevision')::integer<>coalesce(head.revision,0) or request->'expectedVersionId' is distinct from coalesce(to_jsonb(head.version_id::text),'null'::jsonb) then raise exception 'collection changed; reload before saving' using errcode='23505'; end if;
  next_revision:=coalesce(head.revision,0)+1;
  if next_revision=1 and a->>'state'='withdrawn' then raise exception 'save record before withdrawing it' using errcode='22023'; end if;
  if (next_revision=1 and request->'correctionReason'<>'null'::jsonb) or (next_revision>1 and coalesce(length(btrim(request->>'correctionReason')),0)<3) then raise exception 'collection correction reason required' using errcode='22023'; end if;
  for evidence in select value from jsonb_array_elements_text(a->'evidenceIds') loop if not exists(select 1 from neuvetra.collection_evidence_objects where company_id=target_company and id=evidence::uuid) then raise exception 'collection evidence unavailable' using errcode='23503'; end if; if exists(select 1 from neuvetra.collection_evidence_quarantine_events where company_id=target_company and evidence_id=evidence::uuid and status='rejected') then raise exception 'rejected evidence cannot be linked' using errcode='22023'; end if; end loop;
  insert into neuvetra.collection_activity_versions(id,record_id,company_id,revision,previous_version_id,correction_reason,setup_version_id,location_id,source_id,state,withdrawal_reason,original_quantity,original_unit,normalized_quantity,normalized_unit,quality,estimate_basis,period_start,period_end_exclusive,reference,notes,inside_boundary,maintains_refrigerant_stock,retrofit_in_period,electricity_zip,utility_eia_id,payload,payload_sha256,created_by)
  values(new_version,target_record,target_company,next_revision,head.version_id,request->>'correctionReason',(a->>'setupVersionId')::uuid,(a->>'locationId')::uuid,a->>'sourceId',a->>'state',a->>'withdrawalReason',a#>>'{quantity,originalValue}',a#>>'{quantity,originalUnit}',(a#>>'{quantity,normalizedValue}')::numeric,a#>>'{quantity,normalizedUnit}',a->>'quality',a->>'estimateBasis',(a#>>'{period,start}')::date,(a#>>'{period,endExclusive}')::date,a->>'reference',a->>'notes',(a#>>'{payload,insideBoundary}')::boolean,(a#>>'{payload,maintainsRefrigerantStock}')::boolean,(a#>>'{payload,retrofitInPeriod}')::boolean,a#>>'{payload,zip}',a#>>'{payload,utilityEiaId}',a,neuvetra.m67_hash(a),actor);
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

-- CREATE OR REPLACE keeps each function's owner and privileges. Prove it: the runtime may call only the save function,
-- and neither function is open to public or authenticated.
do $grants$
begin
  if not has_function_privilege('neuvetra_runtime','neuvetra.save_collection_activity(uuid,uuid,jsonb)','execute')
    or has_function_privilege('authenticated','neuvetra.save_collection_activity(uuid,uuid,jsonb)','execute')
    or has_function_privilege('neuvetra_runtime','neuvetra.collection_assert_activity(jsonb)','execute')
    or has_function_privilege('authenticated','neuvetra.collection_assert_activity(jsonb)','execute')
    or exists(select 1 from pg_proc p, aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
      where p.oid in('neuvetra.save_collection_activity(uuid,uuid,jsonb)'::regprocedure,'neuvetra.collection_assert_activity(jsonb)'::regprocedure) and acl.grantee=0 and acl.privilege_type='EXECUTE')
  then raise exception '0029 changed the collection function privileges' using errcode='42501'; end if;
end $grants$;
