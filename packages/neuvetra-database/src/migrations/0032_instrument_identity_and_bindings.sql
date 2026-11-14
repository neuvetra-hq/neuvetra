-- 0032: instrument identity and the integrity bindings of round 2 (BF-18, 13 November 2026). One migration, applied once by the
-- owner: the total contents frozen by the CEO (fix orders round 2, part B, section 4, items 1 to 7).
--
-- Additive and CREATE OR REPLACE only; 0001-0031 are untouched. What it changes, in order:
--   1. collection_electricity_instruments (BF-11 schema, BI-06): three nullable identity columns (instrument_id, registry,
--      face_mwh), and mwh and the three rate columns become unconstrained numeric (from numeric(15,3)).
--   2. Backfill (BI-06): every existing instrument row is set to its own version's payload, matched by (version_id, ordinal),
--      with the row trigger that refuses updates disabled for that one statement (inside this transaction, under the table
--      lock, so no other session ever sees it disabled) and enabled again. Then the projection is proved equal to the payload
--      for every row of every electricity version, in both directions.
--   3. collection_assert_activity: 0031's body; an instrument may carry instrumentId, registry and faceMwh (BF-11), and an
--      asset_energy or building_average payload may carry scope2OverlapConfirmedDistinct (BF-17, CEO decision on B-9).
--   4. save_collection_activity: 0031's body; the instrument insert writes the identity columns and casts every plain decimal
--      (BI-06), and a receipt mismatch raises 23N32 instead of 23505 (BI-11, for BF-28).
--   5. scope3_report_approvals (BI-05): csv_sha256, backfilled from each approval's own version (same trigger rule as in 2),
--      then NOT NULL; scope3_report_versions gains unique(id,company_id,report_sha256,csv_sha256); the approval's foreign key
--      now covers both hashes (the old three-column key is dropped after the new one is in place).
--   6. approve_scope3_report: 0031's body; writes csv_sha256 and accepts an optional csvSha256 in the request (BF-23).
--   7. scope3_active_line_count: 0030's body; counts the lines of stored Scope 3 records only (BI-03 option C, BF-21).
--   8. Housekeeping: each replaced function keeps its owner and privileges (proved below, as 0031 does); no function or
--      table is created, so there is nothing new to grant and no new TRUNCATE guard; the touched tables keep forced RLS,
--      runtime SELECT only, their row and TRUNCATE triggers enabled.
--
-- No stored result, report version, approval, request receipt or payload changes: the only rows written are instrument rows
-- (to equal their own payload) and approval rows (one new column, copied from their own version). The whole file can run
-- again on a schema-32 database without error or change, although the runner applies it once. The lock timeout makes a
-- blocked apply fail and roll back instead of queueing behind other transactions.
set local lock_timeout='5s';

-- 0. Drift guard, as 0031's. 0032 replaces three functions with 0031's bodies and one with 0030's, plus marked changes, so it
-- may only run over exactly those functions (or its own, when it runs again): the same identity arguments, return type and
-- stored source (md5 of pg_proc.prosrc). A function changed by hand stops the apply here, with nothing changed. The backfills
-- read and write tables with forced row-level security, so the applying role must bypass it (the staging owner role does:
-- the security-definer functions it owns write those tables); otherwise a backfill would see no rows and prove nothing.
do $drift$
declare f record; begin
  for f in select * from (values
    ('neuvetra.collection_assert_activity(jsonb)','a jsonb','void',array['58164f62f8431d8bbd1013037b20eea3','127febca8d7bb1fbbd3d52eda5756338']),
    ('neuvetra.save_collection_activity(uuid,uuid,jsonb)','target_company uuid, target_record uuid, request jsonb','record',array['20af0cfd2e915c23e8670b8c0b14b95e','beec39de7d66151a94843d538950ac67']),
    ('neuvetra.approve_scope3_report(uuid,jsonb)','target_company uuid, request jsonb','record',array['5381e69b395abef537e02f93127aa726','34943c0f7aa12fbefcbc78b3a9caef87']),
    ('neuvetra.scope3_active_line_count(uuid)','target_company uuid','integer',array['9279221fe0b977ac72aa5f7b17afd096','1c6c5c0f10ab170ba50e904e56d288d2'])) v(signature,arguments,result,source_md5) loop
    if to_regprocedure(f.signature) is null or not exists(select 1 from pg_proc p where p.oid=to_regprocedure(f.signature)
      and pg_get_function_identity_arguments(p.oid)=f.arguments and p.prorettype::regtype::text=f.result and md5(p.prosrc)=any(f.source_md5)) then
      raise exception '0032: % differs from 0031; re-derive 0032 from the applied 0031',f.signature using errcode='55000';
    end if;
  end loop;
  if not exists(select 1 from pg_roles where rolname=current_user and (rolsuper or rolbypassrls)) then
    raise exception '0032: the applying role must bypass row-level security to backfill' using errcode='55000';
  end if;
end $drift$;

-- 1. Instrument identity columns (BF-11) and the unconstrained numeric projection (BI-06). The type change is binary
-- compatible (no table rewrite) and is skipped when the column is already unconstrained (a second run).
alter table neuvetra.collection_electricity_instruments add column if not exists instrument_id text, add column if not exists registry text, add column if not exists face_mwh numeric;
do $columns$
declare c text; begin
  foreach c in array array['mwh','rate_co2_lb_per_mwh','rate_ch4_lb_per_mwh','rate_n2o_lb_per_mwh'] loop
    if (select atttypmod from pg_attribute where attrelid='neuvetra.collection_electricity_instruments'::regclass and attname=c and not attisdropped)<>-1 then
      execute format('alter table neuvetra.collection_electricity_instruments alter column %I type numeric',c);
    end if;
  end loop;
  -- The same limits the save function checks, kept by the table itself (every existing row has null identity).
  if not exists(select 1 from pg_constraint where conrelid='neuvetra.collection_electricity_instruments'::regclass and conname='collection_electricity_instruments_identity_check') then
    alter table neuvetra.collection_electricity_instruments add constraint collection_electricity_instruments_identity_check
      check((instrument_id is null or length(instrument_id) between 1 and 120) and (registry is null or length(registry) between 1 and 80) and (face_mwh is null or face_mwh>0));
  end if;
end $columns$;

-- 2. Backfill the projection from each version's own payload (BI-06). Only rows that differ are written, so a second run
-- writes nothing. The identity keys cannot be in any payload saved before 0032, so those columns stay null here.
alter table neuvetra.collection_electricity_instruments disable trigger collection_history_immutable;
update neuvetra.collection_electricity_instruments i set
  mwh=case when p.x->>'mwh' ~ '^(0|[1-9][0-9]*)(\.[0-9]+)?$' then (p.x->>'mwh')::numeric end,
  rate_co2_lb_per_mwh=case when p.x#>>'{rateLbPerMwh,co2}' ~ '^(0|[1-9][0-9]*)(\.[0-9]+)?$' then (p.x#>>'{rateLbPerMwh,co2}')::numeric end,
  rate_ch4_lb_per_mwh=case when p.x#>>'{rateLbPerMwh,ch4}' ~ '^(0|[1-9][0-9]*)(\.[0-9]+)?$' then (p.x#>>'{rateLbPerMwh,ch4}')::numeric end,
  rate_n2o_lb_per_mwh=case when p.x#>>'{rateLbPerMwh,n2o}' ~ '^(0|[1-9][0-9]*)(\.[0-9]+)?$' then (p.x#>>'{rateLbPerMwh,n2o}')::numeric end,
  instrument_id=p.x->>'instrumentId',registry=p.x->>'registry',
  face_mwh=case when p.x->>'faceMwh' ~ '^(0|[1-9][0-9]*)(\.[0-9]+)?$' then (p.x->>'faceMwh')::numeric end
from (select v.company_id,v.id version_id,e.n::integer ordinal,e.x
    from neuvetra.collection_activity_versions v cross join lateral jsonb_array_elements(v.payload#>'{payload,instruments}') with ordinality e(x,n)
    where v.payload->>'kind'='electricity') p
where i.company_id=p.company_id and i.version_id=p.version_id and i.ordinal=p.ordinal
  and (i.mwh::text is distinct from (case when p.x->>'mwh' ~ '^(0|[1-9][0-9]*)(\.[0-9]+)?$' then p.x->>'mwh' end)
    or i.rate_co2_lb_per_mwh::text is distinct from (case when p.x#>>'{rateLbPerMwh,co2}' ~ '^(0|[1-9][0-9]*)(\.[0-9]+)?$' then p.x#>>'{rateLbPerMwh,co2}' end)
    or i.rate_ch4_lb_per_mwh::text is distinct from (case when p.x#>>'{rateLbPerMwh,ch4}' ~ '^(0|[1-9][0-9]*)(\.[0-9]+)?$' then p.x#>>'{rateLbPerMwh,ch4}' end)
    or i.rate_n2o_lb_per_mwh::text is distinct from (case when p.x#>>'{rateLbPerMwh,n2o}' ~ '^(0|[1-9][0-9]*)(\.[0-9]+)?$' then p.x#>>'{rateLbPerMwh,n2o}' end)
    or i.instrument_id is distinct from p.x->>'instrumentId' or i.registry is distinct from p.x->>'registry'
    or i.face_mwh::text is distinct from (case when p.x->>'faceMwh' ~ '^(0|[1-9][0-9]*)(\.[0-9]+)?$' then p.x->>'faceMwh' end));
alter table neuvetra.collection_electricity_instruments enable trigger collection_history_immutable;

-- Prove it: every instrument of every electricity version has exactly one row and every row has its instrument; every column
-- equals its payload value (numbers compared as text, so 12.500 is not 12.5); and the row trigger is enabled again.
do $projection$
begin
  if exists(select 1 from (select v.company_id,v.id version_id,e.n::integer ordinal,e.x
    from neuvetra.collection_activity_versions v cross join lateral jsonb_array_elements(v.payload#>'{payload,instruments}') with ordinality e(x,n)
    where v.payload->>'kind'='electricity') p
      full join neuvetra.collection_electricity_instruments i on i.company_id=p.company_id and i.version_id=p.version_id and i.ordinal=p.ordinal
    where p.version_id is null or i.version_id is null
      or i.instrument_type is distinct from p.x->>'type' or i.quality_criteria_met is distinct from (p.x->>'qualityCriteriaMet')::boolean
      or i.vintage_year is distinct from (p.x->>'vintageYear')::integer or i.evidence_id is distinct from (p.x->>'evidenceReference')::uuid
      or i.generation_technology is distinct from p.x->>'generationTechnology'
      or i.mwh::text is distinct from (case when p.x->>'mwh' ~ '^(0|[1-9][0-9]*)(\.[0-9]+)?$' then p.x->>'mwh' end)
      or i.rate_co2_lb_per_mwh::text is distinct from (case when p.x#>>'{rateLbPerMwh,co2}' ~ '^(0|[1-9][0-9]*)(\.[0-9]+)?$' then p.x#>>'{rateLbPerMwh,co2}' end)
      or i.rate_ch4_lb_per_mwh::text is distinct from (case when p.x#>>'{rateLbPerMwh,ch4}' ~ '^(0|[1-9][0-9]*)(\.[0-9]+)?$' then p.x#>>'{rateLbPerMwh,ch4}' end)
      or i.rate_n2o_lb_per_mwh::text is distinct from (case when p.x#>>'{rateLbPerMwh,n2o}' ~ '^(0|[1-9][0-9]*)(\.[0-9]+)?$' then p.x#>>'{rateLbPerMwh,n2o}' end)
      or i.instrument_id is distinct from p.x->>'instrumentId' or i.registry is distinct from p.x->>'registry'
      or i.face_mwh::text is distinct from (case when p.x->>'faceMwh' ~ '^(0|[1-9][0-9]*)(\.[0-9]+)?$' then p.x->>'faceMwh' end))
  then raise exception '0032: an instrument row differs from its payload' using errcode='55000'; end if;
  if not exists(select 1 from pg_trigger where tgrelid='neuvetra.collection_electricity_instruments'::regclass and tgname='collection_history_immutable' and tgenabled='O') then
    raise exception '0032: the instrument row trigger is not enabled' using errcode='55000'; end if;
end $projection$;

-- 3. The activity check: 0031's body; changed only where marked 0032.
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
  -- 0031 (BF-09): a Scope 1 or 2 payload may carry an optional boolean duplicateConfirmedDistinct (the user confirmed that a
  -- possible duplicate is a different record). Absent, true or false; never null or any other type. The five Scope 1 and 2
  -- key lists below are 0030's, read without it. Scope 3 kinds are unchanged (purchase_spend already requires it).
  if a->>'kind' in('natural_gas','distillate_no2','vehicle','fugitive','electricity') and jsonb_typeof(p)='object' and p ? 'duplicateConfirmedDistinct' and jsonb_typeof(p->'duplicateConfirmedDistinct') is distinct from 'boolean' then raise exception 'invalid duplicate confirmation' using errcode='22023'; end if;
  if (a->>'kind'='vehicle' and a->>'sourceId' is distinct from p->>'vehicleGroupId') or (a->>'kind'='electricity' and a->>'sourceId' is distinct from p->>'meterOrAccountNumber') then raise exception 'source identifier must match payload' using errcode='22023'; end if;
  if a->>'kind'='fugitive' and (q->>'originalUnit' is distinct from p->>'unit' or (q->>'normalizedUnit' is not null and q->>'normalizedUnit' is distinct from p->>'unit')) then raise exception 'refrigerant quantity unit must match terms unit' using errcode='22023'; end if;
  if a->>'kind'='natural_gas' then
    perform neuvetra.m71_keys(p-'duplicateConfirmedDistinct','heatContent');
    if jsonb_typeof(p->'heatContent') not in('object','null') then raise exception 'invalid heat content' using errcode='22023'; end if;
    if p->'heatContent'<>'null'::jsonb then perform neuvetra.m71_keys(p->'heatContent','value,unit'); perform neuvetra.collection_assert_numeric_input(p#>'{heatContent,value}'); if p#>>'{heatContent,unit}' not in('MMBtu per scf','MMBtu per ccf','MMBtu per mcf','therm per ccf') then raise exception 'invalid heat content unit' using errcode='22023'; end if; end if;
  elsif a->>'kind'='distillate_no2' then
    perform neuvetra.m71_keys(p-'duplicateConfirmedDistinct','consumption,statedHhvMmbtuPerGallon');
    -- Supplier-stated HHV alone permits six fractional digits; quantities stay at three.
    if jsonb_typeof(p->'statedHhvMmbtuPerGallon') not in('string','null') or (p->'statedHhvMmbtuPerGallon'<>'null'::jsonb and p->>'statedHhvMmbtuPerGallon' !~ '^(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?$') then raise exception 'invalid stated HHV' using errcode='22023'; end if;
    if p#>>'{consumption,basis}'='measured' then perform neuvetra.m71_keys(p->'consumption','basis,gallons'); perform neuvetra.collection_assert_numeric_input(p#>'{consumption,gallons}');
    elsif p#>>'{consumption,basis}'='purchases_only' then perform neuvetra.m71_keys(p->'consumption','basis,purchasedGallons'); perform neuvetra.collection_assert_numeric_input(p#>'{consumption,purchasedGallons}');
    elsif p#>>'{consumption,basis}'='purchases_with_tank_levels' then perform neuvetra.m71_keys(p->'consumption','basis,purchasedGallons,openingGallons,closingGallons'); perform neuvetra.collection_assert_numeric_input(p#>'{consumption,purchasedGallons}'); perform neuvetra.collection_assert_numeric_input(p#>'{consumption,openingGallons}'); perform neuvetra.collection_assert_numeric_input(p#>'{consumption,closingGallons}');
    else raise exception 'invalid distillate basis' using errcode='22023'; end if;
  elsif a->>'kind'='vehicle' then
    perform neuvetra.m71_keys(p-'duplicateConfirmedDistinct','vehicleGroupId,fuel,vehicleType,modelYear,gallons,vehicleCount,miles,fuelEconomy'); perform neuvetra.collection_assert_numeric_input(p->'gallons');
    if jsonb_typeof(p->'vehicleGroupId') is distinct from 'string' or length(btrim(p->>'vehicleGroupId')) not between 1 and 120 or jsonb_typeof(p->'fuel') is distinct from 'string' or length(btrim(p->>'fuel'))=0 or jsonb_typeof(p->'vehicleType') is distinct from 'string' or length(btrim(p->>'vehicleType'))=0 or coalesce(p->>'modelYear','')!~'^[0-9]{4}$' or (p->>'modelYear')::integer not between 1900 and 2026 or jsonb_typeof(p->'vehicleCount') not in('number','null') or jsonb_typeof(p->'miles') not in('object','null') or jsonb_typeof(p->'fuelEconomy') not in('object','null') then raise exception 'invalid vehicle activity' using errcode='22023'; end if;
    if p->'miles'<>'null'::jsonb then perform neuvetra.m71_keys(p->'miles','value,basis'); perform neuvetra.collection_assert_numeric_input(p#>'{miles,value}'); end if;
    if p->'fuelEconomy'<>'null'::jsonb then perform neuvetra.m71_keys(p->'fuelEconomy','mpg,source'); perform neuvetra.collection_assert_numeric_input(p#>'{fuelEconomy,mpg}'); end if;
  elsif a->>'kind'='fugitive' then
    perform neuvetra.m71_keys(p-'duplicateConfirmedDistinct','gas,unit,terms,insideBoundary,maintainsRefrigerantStock,retrofitInPeriod,contractorRecordsComplete,eventChronologyComplete'); perform neuvetra.m71_keys(p->'terms','PN,CN,PS,CD,RD');
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
    -- 0032 (BF-17, B-9): the optional boolean scope2OverlapConfirmedDistinct (the user confirmed that this asset's energy is a
    -- different meter from any Scope 2 electricity record at the same site). Absent, true or false; never null.
    perform neuvetra.m71_keys(p-'dataQuality'-'scope2OverlapConfirmedDistinct','category,carrier,assetLabel,counterpartyName,leaseType,noOperationalControlBasis,zip,subregion,utilityEiaId,refrigerantGas,allocation');
    perform neuvetra.scope3_assert_data_quality(p);
    if p ? 'scope2OverlapConfirmedDistinct' then perform neuvetra.scope3_assert_bool(p->'scope2OverlapConfirmedDistinct',false,'Scope 2 overlap confirmation'); end if;
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
    -- 0032 (BF-17, B-9): the same optional scope2OverlapConfirmedDistinct as asset_energy.
    perform neuvetra.m71_keys(p-'dataQuality'-'scope2OverlapConfirmedDistinct','category,cbecsActivity,usesNaturalGas,gridBasis,zip,subregion,utilityEiaId,coveredDays,leaseType,noOperationalControlBasis');
    perform neuvetra.scope3_assert_data_quality(p);
    if p ? 'scope2OverlapConfirmedDistinct' then perform neuvetra.scope3_assert_bool(p->'scope2OverlapConfirmedDistinct',false,'Scope 2 overlap confirmation'); end if;
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
    perform neuvetra.m71_keys(p-'duplicateConfirmedDistinct','meterOrAccountNumber,utilityName,site,zip,subregion,utilityEiaId,instruments');
    if coalesce(p->>'zip','')!~'^[0-9]{5}$' or jsonb_typeof(p->'utilityEiaId') not in('string','null') or jsonb_typeof(p->'instruments') is distinct from 'array' or jsonb_array_length(p->'instruments')>100 then raise exception 'invalid electricity activity' using errcode='22023'; end if;
    for x in select value from jsonb_array_elements(p->'instruments') loop
      -- 0032 (BF-11, B-1/B-4): an instrument may carry its certificate or contract identity: instrumentId (1-120 characters,
      -- not blank, no control character), registry (1-80 such characters, or null) and faceMwh (a QUANTITY decimal above 0,
      -- through collection_assert_numeric_input first). Each optional; the seven keys of 0027 are read without them.
      perform neuvetra.m71_keys(x-'instrumentId'-'registry'-'faceMwh','type,mwh,qualityCriteriaMet,vintageYear,evidenceReference,generationTechnology,rateLbPerMwh'); perform neuvetra.collection_assert_numeric_input(x->'mwh');
      if (x ? 'instrumentId' and (jsonb_typeof(x->'instrumentId') is distinct from 'string' or length(x->>'instrumentId') not between 1 and 120 or btrim(x->>'instrumentId')='' or x->>'instrumentId' ~ '[\u0001-\u001f\u007f-\u009f]'))
        or (x ? 'registry' and x->'registry'<>'null'::jsonb and (jsonb_typeof(x->'registry') is distinct from 'string' or length(x->>'registry') not between 1 and 80 or btrim(x->>'registry')='' or x->>'registry' ~ '[\u0001-\u001f\u007f-\u009f]')) then raise exception 'invalid electricity instrument identity' using errcode='22023'; end if;
      if x ? 'faceMwh' then perform neuvetra.collection_assert_numeric_input(x->'faceMwh'); if (case when x->>'faceMwh' ~ '^(0|[1-9][0-9]{0,11})(\.[0-9]{1,3})?$' then (x->>'faceMwh')::numeric<=0 else true end) then raise exception 'invalid electricity instrument face value' using errcode='22023'; end if; end if;
      if x->>'type' not in('energy_attribute_certificate','power_purchase_agreement','green_tariff','supplier_specific_rate') or jsonb_typeof(x->'qualityCriteriaMet') is distinct from 'boolean' or coalesce(x->>'vintageYear','')!~'^[0-9]{4}$' or (x->>'vintageYear')::integer not between 1000 and 9999 or jsonb_typeof(x->'evidenceReference') not in('string','null') or (x->'evidenceReference'<>'null'::jsonb and coalesce(x->>'evidenceReference','')!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') or x->>'generationTechnology' not in('wind','solar_photovoltaic','hydro','nuclear','geothermal','natural_gas','coal','oil','biomass','biogas','landfill_gas','mixed','unknown') or jsonb_typeof(x->'rateLbPerMwh') not in('object','null') then raise exception 'invalid electricity instrument' using errcode='22023'; end if;
      if x->'rateLbPerMwh'<>'null'::jsonb then perform neuvetra.m71_keys(x->'rateLbPerMwh','co2,ch4,n2o'); perform neuvetra.collection_assert_numeric_input(x#>'{rateLbPerMwh,co2}'); if x#>'{rateLbPerMwh,ch4}'<>'null'::jsonb then perform neuvetra.collection_assert_numeric_input(x#>'{rateLbPerMwh,ch4}'); end if; if x#>'{rateLbPerMwh,n2o}'<>'null'::jsonb then perform neuvetra.collection_assert_numeric_input(x#>'{rateLbPerMwh,n2o}'); end if; end if;
      if x->'evidenceReference'<>'null'::jsonb and not (a->'evidenceIds' ? (x->>'evidenceReference')) then raise exception 'instrument evidence must be linked' using errcode='22023'; end if;
    end loop;
  end if;
end $$;

-- 4. The save function: 0031's body; changed only where marked 0032 (the receipt SQLSTATE and the instrument insert).
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
  -- 0032 (BF-28, BI-11): a receipt for this key that names another actor, request or record is its own SQLSTATE, 23N32, so the
  -- route can tell it from a revision conflict (23505 below).
  if found then if old.actor_id<>actor or old.request_sha256<>fingerprint or old.record_id<>target_record then raise exception 'collection idempotency conflict' using errcode='23N32'; end if; record_id:=old.record_id; version_id:=old.version_id; replayed:=true; return next; return; end if;
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
      -- 0032 (BI-06, BF-24): each numeric column is its payload value exactly, whenever that value is a plain decimal
      -- (unconstrained numeric; no 3-decimal limit), and null only when the payload value is null, blank or not a plain
      -- decimal (the engine holds those). 0032 (BF-11): the identity columns are the payload's, as given.
      insert into neuvetra.collection_electricity_instruments(company_id,version_id,ordinal,instrument_type,mwh,quality_criteria_met,vintage_year,evidence_id,generation_technology,rate_co2_lb_per_mwh,rate_ch4_lb_per_mwh,rate_n2o_lb_per_mwh,instrument_id,registry,face_mwh)
      values(target_company,new_version,n,instrument->>'type',case when instrument->>'mwh' ~ '^(0|[1-9][0-9]*)(\.[0-9]+)?$' then (instrument->>'mwh')::numeric end,(instrument->>'qualityCriteriaMet')::boolean,(instrument->>'vintageYear')::integer,(instrument->>'evidenceReference')::uuid,instrument->>'generationTechnology',case when instrument#>>'{rateLbPerMwh,co2}' ~ '^(0|[1-9][0-9]*)(\.[0-9]+)?$' then (instrument#>>'{rateLbPerMwh,co2}')::numeric end,case when instrument#>>'{rateLbPerMwh,ch4}' ~ '^(0|[1-9][0-9]*)(\.[0-9]+)?$' then (instrument#>>'{rateLbPerMwh,ch4}')::numeric end,case when instrument#>>'{rateLbPerMwh,n2o}' ~ '^(0|[1-9][0-9]*)(\.[0-9]+)?$' then (instrument#>>'{rateLbPerMwh,n2o}')::numeric end,instrument->>'instrumentId',instrument->>'registry',case when instrument->>'faceMwh' ~ '^(0|[1-9][0-9]*)(\.[0-9]+)?$' then (instrument->>'faceMwh')::numeric end);
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
  -- 0031 (BF-09, BL-02): a save that makes a Scope 1 or 2 record active (a new active record, or a withdrawn one made active
  -- again) must leave at most MAX_ACTIVE_SCOPE12_RECORDS (400) active Scope 1 and 2 records in the company, else 54N31 and
  -- nothing is saved. The count is read here, after this save's rows are written and under the company row lock taken above
  -- (every save takes it), so simultaneous saves are serialised and cannot overshoot. A correction that keeps a record active
  -- and a withdrawal are never refused, nor is an exact replay (it returned above). Scope 3 kinds never count.
  if a->>'state'='active' and a->>'kind' in('natural_gas','distillate_no2','vehicle','fugitive','electricity') and (next_revision=1 or exists(select 1 from neuvetra.collection_activity_versions pv where pv.company_id=target_company and pv.id=head.version_id and pv.state='withdrawn'))
    and (select count(*) from neuvetra.collection_activity_records r
      -- Each record's head and head version by their unique keys, as scope3_active_line_count reads them (EN-1's pattern).
      cross join lateral (select h.version_id from neuvetra.collection_activity_heads h where h.record_id=r.id and h.company_id=r.company_id limit 1) h
      cross join lateral (select v.state from neuvetra.collection_activity_versions v where v.id=h.version_id and v.company_id=r.company_id limit 1) v
      where r.company_id=target_company and r.scope in(1,2) and v.state='active')>400 then raise exception 'Scope 1 and 2 active record limit reached' using errcode='54N31'; end if;
  record_id:=target_record; version_id:=new_version; replayed:=false; return next;
end $$;

-- Prove the collection functions' privileges are 0031's: the runtime may call only the save function, and neither function
-- is open to public, anon or authenticated.
do $grants$
declare r text; begin
  if not has_function_privilege('neuvetra_runtime','neuvetra.save_collection_activity(uuid,uuid,jsonb)','execute')
    or has_function_privilege('neuvetra_runtime','neuvetra.collection_assert_activity(jsonb)','execute')
    or exists(select 1 from pg_proc p, aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
      where p.oid in('neuvetra.save_collection_activity(uuid,uuid,jsonb)'::regprocedure,'neuvetra.collection_assert_activity(jsonb)'::regprocedure) and acl.grantee=0 and acl.privilege_type='EXECUTE')
  then raise exception '0032 changed the collection function privileges' using errcode='42501'; end if;
  foreach r in array array['authenticated','anon'] loop
    if exists(select 1 from pg_roles where rolname=r) and (has_function_privilege(r,'neuvetra.save_collection_activity(uuid,uuid,jsonb)','execute') or has_function_privilege(r,'neuvetra.collection_assert_activity(jsonb)','execute'))
    then raise exception '0032 collection function is open to %',r using errcode='42501'; end if;
  end loop;
end $grants$;

-- 5. The approval binds the CSV as well (BI-05). Each existing approval takes its own version's CSV hash: the version row's
-- CHECK already guarantees that hash is the SHA-256 of its stored CSV text, and version rows can never change.
alter table neuvetra.scope3_report_approvals add column if not exists csv_sha256 text;
alter table neuvetra.scope3_report_approvals disable trigger scope3_history_immutable;
update neuvetra.scope3_report_approvals a set csv_sha256=v.csv_sha256 from neuvetra.scope3_report_versions v
  where v.id=a.version_id and v.company_id=a.company_id and v.report_sha256=a.report_sha256 and a.csv_sha256 is null;
alter table neuvetra.scope3_report_approvals enable trigger scope3_history_immutable;
alter table neuvetra.scope3_report_approvals alter column csv_sha256 set not null;
do $approvals$
declare old_key name; begin
  if not exists(select 1 from pg_constraint where conrelid='neuvetra.scope3_report_versions'::regclass and conname='scope3_report_versions_hashes_key') then
    alter table neuvetra.scope3_report_versions add constraint scope3_report_versions_hashes_key unique(id,company_id,report_sha256,csv_sha256);
  end if;
  if not exists(select 1 from pg_constraint where conrelid='neuvetra.scope3_report_approvals'::regclass and conname='scope3_report_approvals_version_hashes_fkey') then
    alter table neuvetra.scope3_report_approvals add constraint scope3_report_approvals_version_hashes_fkey foreign key(version_id,company_id,report_sha256,csv_sha256)
      references neuvetra.scope3_report_versions(id,company_id,report_sha256,csv_sha256);
  end if;
  -- 0030's three-column key (version, company, report hash) is replaced by the four-column one above; found by its columns.
  for old_key in select c.conname from pg_constraint c where c.conrelid='neuvetra.scope3_report_approvals'::regclass and c.contype='f' and c.confrelid='neuvetra.scope3_report_versions'::regclass
    and c.conkey=array[(select attnum from pg_attribute where attrelid=c.conrelid and attname='version_id'),(select attnum from pg_attribute where attrelid=c.conrelid and attname='company_id'),(select attnum from pg_attribute where attrelid=c.conrelid and attname='report_sha256')]::smallint[] loop
    execute format('alter table neuvetra.scope3_report_approvals drop constraint %I',old_key);
  end loop;
  -- Prove it: every approval equals its version's two hashes; one foreign key to the versions, over both hashes; the row
  -- trigger enabled again.
  if exists(select 1 from neuvetra.scope3_report_approvals a left join neuvetra.scope3_report_versions v on v.id=a.version_id and v.company_id=a.company_id
      where v.id is null or a.report_sha256 is distinct from v.report_sha256 or a.csv_sha256 is distinct from v.csv_sha256)
    or (select count(*) from pg_constraint c where c.conrelid='neuvetra.scope3_report_approvals'::regclass and c.contype='f' and c.confrelid='neuvetra.scope3_report_versions'::regclass)<>1
    or not exists(select 1 from pg_constraint c where c.conrelid='neuvetra.scope3_report_approvals'::regclass and c.conname='scope3_report_approvals_version_hashes_fkey' and c.convalidated)
    or not exists(select 1 from pg_trigger where tgrelid='neuvetra.scope3_report_approvals'::regclass and tgname='scope3_history_immutable' and tgenabled='O')
  then raise exception '0032: the approval CSV binding is incomplete' using errcode='55000'; end if;
end $approvals$;

-- 6. The approval function: 0031's body; changed only where marked 0032.
create or replace function neuvetra.approve_scope3_report(target_company uuid,request jsonb)
returns table(version_id uuid,approved_by uuid,approved_at timestamptz,self_approved boolean,replayed boolean) language plpgsql security definer set search_path=pg_catalog,neuvetra,pg_temp as $$
#variable_conflict use_column
declare actor uuid; v record; prior neuvetra.scope3_report_approvals%rowtype; stamp timestamptz:=clock_timestamp(); begin
  actor:=neuvetra.scope3_manager_lock(target_company,'Scope 3 report approval');
  -- 0032 (BF-23, BI-05): the request may also name the CSV hash the approver saw (csvSha256, optional so a request without it
  -- is still accepted); the approval stores the version's CSV hash either way.
  perform neuvetra.m71_keys(request-'csvSha256','versionId,reportSha256,acknowledgeOpenIssues,confirmSelfApproval');
  if request ? 'csvSha256' then perform neuvetra.scope3_assert_match(request->'csvSha256','^[0-9a-f]{64}$',false,'CSV SHA-256'); end if;
  if jsonb_typeof(request->'acknowledgeOpenIssues') is distinct from 'boolean' or jsonb_typeof(request->'confirmSelfApproval') is distinct from 'boolean' then raise exception 'invalid Scope 3 report approval' using errcode='22023'; end if;
  perform neuvetra.scope3_assert_match(request->'versionId','^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',false,'report version');
  perform neuvetra.scope3_assert_match(request->'reportSha256','^[0-9a-f]{64}$',false,'report SHA-256');
  perform id from neuvetra.companies where id=target_company for update;
  -- Round 3 (EN-2): the columns the approval needs, never the two texts (a whole-row read detoasts them).
  select x.id,x.report_sha256,x.csv_sha256,x.open_issues,x.created_by,x.reporting_year,x.revision into v from neuvetra.scope3_report_versions x where x.id=(request->>'versionId')::uuid and x.company_id=target_company;
  if not found then raise exception 'Scope 3 report version unavailable' using errcode='23503'; end if;
  -- 0031 (BF-09, BL-03): approval signs off the current figures, so a revision that a later revision of the same company and
  -- reporting year replaces is refused with 55N31, under the company row lock prepare_scope3_report also takes: a prepare and
  -- an approval are serialised, so neither can slip between the other's check and write. Checked before the hash, as the route
  -- does (BF-05). An approval recorded before the newer revision existed is untouched, and repeating it is still a replay.
  if exists(select 1 from neuvetra.scope3_report_versions x where x.company_id=target_company and x.reporting_year=v.reporting_year and x.revision>v.revision)
    and not exists(select 1 from neuvetra.scope3_report_approvals x where x.version_id=v.id and x.company_id=target_company) then
    raise exception 'Scope 3 report version superseded' using errcode='55N31'; end if;
  if v.report_sha256<>request->>'reportSha256' then raise exception 'Scope 3 report changed' using errcode='23505'; end if;
  -- 0032 (BF-23): a CSV hash other than the stored one is the same refusal as a report hash other than the stored one.
  if request ? 'csvSha256' and v.csv_sha256<>request->>'csvSha256' then raise exception 'Scope 3 report changed' using errcode='23505'; end if;
  select * into prior from neuvetra.scope3_report_approvals x where x.version_id=v.id and x.company_id=target_company;
  if found then version_id:=prior.version_id; approved_by:=prior.approved_by; approved_at:=prior.approved_at; self_approved:=prior.self_approved; replayed:=true; return next; return; end if;
  if (request->>'acknowledgeOpenIssues')::boolean and jsonb_array_length(v.open_issues)=0 then raise exception 'Scope 3 report has no open issues to acknowledge' using errcode='22023'; end if;
  if (request->>'confirmSelfApproval')::boolean and v.created_by<>actor then raise exception 'Scope 3 report approval is not a self-approval' using errcode='22023'; end if;
  if jsonb_array_length(v.open_issues)>0 and not (request->>'acknowledgeOpenIssues')::boolean then raise exception 'Scope 3 report has open issues; acknowledge them to approve' using errcode='23514'; end if;
  if v.created_by=actor and not (request->>'confirmSelfApproval')::boolean then raise exception 'Scope 3 report self-approval must be confirmed' using errcode='23514'; end if;
  -- 0032 (BI-05): the approval binds the CSV as well (its foreign key now covers both hashes of the version).
  insert into neuvetra.scope3_report_approvals(version_id,company_id,report_sha256,csv_sha256,approved_by,approved_at,self_approved,acknowledged_open_issues,self_approval_confirmed)
  values(v.id,target_company,v.report_sha256,v.csv_sha256,actor,stamp,v.created_by=actor,case when jsonb_array_length(v.open_issues)>0 then v.open_issues end,v.created_by=actor);
  version_id:=v.id; approved_by:=actor; approved_at:=stamp; self_approved:=v.created_by=actor; replayed:=false; return next;
end $$;

-- Prove the approval function's privileges are 0031's: the runtime may call it; public, anon and authenticated may not.
do $grants$
declare r text; begin
  if not has_function_privilege('neuvetra_runtime','neuvetra.approve_scope3_report(uuid,jsonb)','execute')
    or exists(select 1 from pg_proc p, aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
      where p.oid='neuvetra.approve_scope3_report(uuid,jsonb)'::regprocedure and acl.grantee=0 and acl.privilege_type='EXECUTE')
  then raise exception '0032 changed the approval function privileges' using errcode='42501'; end if;
  foreach r in array array['authenticated','anon'] loop
    if exists(select 1 from pg_roles where rolname=r) and has_function_privilege(r,'neuvetra.approve_scope3_report(uuid,jsonb)','execute') then raise exception '0032 approval function is open to %',r using errcode='42501'; end if;
  end loop;
end $grants$;

-- 7. The Scope 3 line count behind 54N30: 0030's body; changed only where marked 0032.
create or replace function neuvetra.scope3_active_line_count(target_company uuid) returns integer language sql stable security definer set search_path=pg_catalog,neuvetra,pg_temp as $$
  -- 0032 (BF-21 option C, CEO decision 13 Nov 2026): only the lines of stored Scope 3 records count (each record, plus the 3D
  -- upstream line of an energy-resold record when category 3 is included). The category 3 lines derived from Scope 1 and 2
  -- records no longer count: they are bounded by the 400 active Scope 1 and 2 records (at most 3 each), so a Scope 1 or 2
  -- save can never push the Scope 3 budget over.
  select coalesce(sum(case when r.scope=3 then 1+case when r.kind='energy_resold' and c.yes then 1 else 0 end
    else 0 end),0)::integer
  -- Each record's head and head version by their unique keys (LATERAL ... LIMIT 1), never a join the planner can turn into a
  -- per-row scan of the company's versions on statistics that do not know a new company (EN-1's pattern).
  from neuvetra.collection_activity_records r
    cross join lateral (select h.version_id from neuvetra.collection_activity_heads h where h.record_id=r.id and h.company_id=r.company_id limit 1) h
    cross join lateral (select v.state from neuvetra.collection_activity_versions v where v.id=h.version_id and v.company_id=r.company_id limit 1) v,
    (select exists(select 1 from neuvetra.company_setup_heads sh join neuvetra.company_setup_screening s on s.company_id=sh.company_id and s.version_id=sh.version_id
      where sh.company_id=target_company and s.scope=3 and s.category='fuel_and_energy_related_activities' and s.state='yes') yes) c
  where r.company_id=target_company and v.state<>'withdrawn'
$$;

-- Prove the count's privileges are 0030's: no application role may call it, and it is not open to public.
do $grants$
declare r text; begin
  foreach r in array array['neuvetra_runtime','authenticated','anon'] loop
    if exists(select 1 from pg_roles where rolname=r) and has_function_privilege(r,'neuvetra.scope3_active_line_count(uuid)','execute') then raise exception '0032 line count is callable by %',r using errcode='42501'; end if;
  end loop;
  if exists(select 1 from pg_proc p, aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl where p.oid='neuvetra.scope3_active_line_count(uuid)'::regprocedure and acl.grantee=0 and acl.privilege_type='EXECUTE')
  then raise exception '0032 line count is open to public' using errcode='42501'; end if;
end $grants$;

-- 8. Housekeeping: the three tables 0032 altered keep forced row-level security, runtime SELECT and nothing else, nothing for
-- public, anon or authenticated (no column grant either), and their row and TRUNCATE triggers enabled.
do $tables$
declare t text; r text; begin
  foreach t in array array['collection_electricity_instruments','scope3_report_approvals','scope3_report_versions'] loop
    if not exists(select 1 from pg_class c where c.oid=('neuvetra.'||t)::regclass and c.relrowsecurity and c.relforcerowsecurity)
      or not has_table_privilege('neuvetra_runtime','neuvetra.'||t,'SELECT') or has_table_privilege('neuvetra_runtime','neuvetra.'||t,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      or exists(select 1 from pg_class c, aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) acl where c.oid=('neuvetra.'||t)::regclass and acl.grantee=0)
      or exists(select 1 from pg_attribute a, aclexplode(a.attacl) acl where a.attrelid=('neuvetra.'||t)::regclass and a.attnum>0 and a.attacl is not null
        and (acl.grantee=0 or acl.grantee in(select oid from pg_roles where rolname in('neuvetra_runtime','authenticated','anon'))))
      or exists(select 1 from pg_trigger g where g.tgrelid=('neuvetra.'||t)::regclass and not g.tgisinternal and g.tgenabled<>'O')
      or (select count(*) from pg_trigger g where g.tgrelid=('neuvetra.'||t)::regclass and not g.tgisinternal and g.tgtype in(27,34))<>2
    then raise exception '0032 changed the privileges or triggers of %',t using errcode='42501'; end if;
    foreach r in array array['authenticated','anon'] loop
      if exists(select 1 from pg_roles where rolname=r) and has_table_privilege(r,'neuvetra.'||t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then raise exception '0032 table % is open to %',t,r using errcode='42501'; end if;
    end loop;
  end loop;
end $tables$;
