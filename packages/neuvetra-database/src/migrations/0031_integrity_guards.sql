-- 0031: integrity guards (BF-09, 12 November 2026). Enforces in SQL what the routes of BF-03 (PR #41) and BF-05 (PR #43)
-- enforce before calling the database, accepts the Scope 1 and 2 "confirmed distinct" flag for a later order, and refuses
-- TRUNCATE on the setup (0023) and collection (0027) history tables, as 0030 does for its own tables.
--
-- Only CREATE OR REPLACE and additive statements. No table is created, altered, rewritten or scanned, and no row is
-- inserted, updated or deleted: every existing row is preserved byte for byte. The statements take only brief catalog
-- locks (CREATE TRIGGER takes SHARE ROW EXCLUSIVE on each guarded table for the instant it runs); the lock timeout below
-- makes a blocked apply fail and roll back instead of queueing behind long transactions. The whole file can run again on a
-- schema-31 database without error or change (every statement replaces itself), although the runner applies it once.
--   1. collection_assert_activity: 0030's body; the five Scope 1 and 2 payload key lists accept an optional boolean
--      duplicateConfirmedDistinct (storage and validation only; nothing reads it yet).
--   2. save_collection_activity: 0030's body; a save that makes a Scope 1 or 2 record active (new, or withdrawn then made
--      active again) past 400 active Scope 1 and 2 records is refused with 54N31 (route: 422 record_limit_reached).
--   3. approve_scope3_report: 0030's body; approving a revision that a higher revision of the same company and reporting
--      year replaces is refused with 55N31 (route: 409 version_superseded).
--   4. BEFORE TRUNCATE guards on the 0023 setup tables and the 0027 collection tables.
-- Section 0 first refuses to run over functions that are not 0030's (or 0031's own). CREATE OR REPLACE keeps each function's
-- owner and privileges; sections 2 and 3 end by proving it, as 0029 and 0030 did.
set local lock_timeout='5s';

-- 0. Drift guard, as 0030's. 0031 replaces three functions with 0030's bodies plus marked changes, so it may only run over
-- exactly 0030's functions (or its own, when it runs again): the same identity arguments, return type and stored source (md5
-- of pg_proc.prosrc, which PostgreSQL keeps verbatim). A function changed by hand stops the apply here, with nothing changed.
do $drift$
declare f record; begin
  for f in select * from (values
    ('neuvetra.collection_assert_activity(jsonb)','a jsonb','void',array['0457ca21aed5a59262777131d91e470b','58164f62f8431d8bbd1013037b20eea3']),
    ('neuvetra.save_collection_activity(uuid,uuid,jsonb)','target_company uuid, target_record uuid, request jsonb','record',array['3ca3b0a7329de85173b9c2c7142a2a80','20af0cfd2e915c23e8670b8c0b14b95e']),
    ('neuvetra.approve_scope3_report(uuid,jsonb)','target_company uuid, request jsonb','record',array['17ff92295a6f163252eed24042c4394d','5381e69b395abef537e02f93127aa726'])) v(signature,arguments,result,source_md5) loop
    if to_regprocedure(f.signature) is null or not exists(select 1 from pg_proc p where p.oid=to_regprocedure(f.signature)
      and pg_get_function_identity_arguments(p.oid)=f.arguments and p.prorettype::regtype::text=f.result and md5(p.prosrc)=any(f.source_md5)) then
      raise exception '0031: % differs from 0030; re-derive 0031 from the applied 0030',f.signature using errcode='55000';
    end if;
  end loop;
end $drift$;

-- 1. The activity check: 0030's body; changed only where marked 0031.
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
    perform neuvetra.m71_keys(p-'duplicateConfirmedDistinct','meterOrAccountNumber,utilityName,site,zip,subregion,utilityEiaId,instruments');
    if coalesce(p->>'zip','')!~'^[0-9]{5}$' or jsonb_typeof(p->'utilityEiaId') not in('string','null') or jsonb_typeof(p->'instruments') is distinct from 'array' or jsonb_array_length(p->'instruments')>100 then raise exception 'invalid electricity activity' using errcode='22023'; end if;
    for x in select value from jsonb_array_elements(p->'instruments') loop
      perform neuvetra.m71_keys(x,'type,mwh,qualityCriteriaMet,vintageYear,evidenceReference,generationTechnology,rateLbPerMwh'); perform neuvetra.collection_assert_numeric_input(x->'mwh');
      if x->>'type' not in('energy_attribute_certificate','power_purchase_agreement','green_tariff','supplier_specific_rate') or jsonb_typeof(x->'qualityCriteriaMet') is distinct from 'boolean' or coalesce(x->>'vintageYear','')!~'^[0-9]{4}$' or (x->>'vintageYear')::integer not between 1000 and 9999 or jsonb_typeof(x->'evidenceReference') not in('string','null') or (x->'evidenceReference'<>'null'::jsonb and coalesce(x->>'evidenceReference','')!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') or x->>'generationTechnology' not in('wind','solar_photovoltaic','hydro','nuclear','geothermal','natural_gas','coal','oil','biomass','biogas','landfill_gas','mixed','unknown') or jsonb_typeof(x->'rateLbPerMwh') not in('object','null') then raise exception 'invalid electricity instrument' using errcode='22023'; end if;
      if x->'rateLbPerMwh'<>'null'::jsonb then perform neuvetra.m71_keys(x->'rateLbPerMwh','co2,ch4,n2o'); perform neuvetra.collection_assert_numeric_input(x#>'{rateLbPerMwh,co2}'); if x#>'{rateLbPerMwh,ch4}'<>'null'::jsonb then perform neuvetra.collection_assert_numeric_input(x#>'{rateLbPerMwh,ch4}'); end if; if x#>'{rateLbPerMwh,n2o}'<>'null'::jsonb then perform neuvetra.collection_assert_numeric_input(x#>'{rateLbPerMwh,n2o}'); end if; end if;
      if x->'evidenceReference'<>'null'::jsonb and not (a->'evidenceIds' ? (x->>'evidenceReference')) then raise exception 'instrument evidence must be linked' using errcode='22023'; end if;
    end loop;
  end if;
end $$;

-- 2. The save function: 0030's body; changed only where marked 0031 (the Scope 1 and 2 cap before the receipt is returned).
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

-- Prove the collection functions' privileges are 0030's: the runtime may call only the save function, and neither function
-- is open to public or authenticated.
do $grants$
begin
  if not has_function_privilege('neuvetra_runtime','neuvetra.save_collection_activity(uuid,uuid,jsonb)','execute')
    or has_function_privilege('authenticated','neuvetra.save_collection_activity(uuid,uuid,jsonb)','execute')
    or has_function_privilege('neuvetra_runtime','neuvetra.collection_assert_activity(jsonb)','execute')
    or has_function_privilege('authenticated','neuvetra.collection_assert_activity(jsonb)','execute')
    or exists(select 1 from pg_proc p, aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
      where p.oid in('neuvetra.save_collection_activity(uuid,uuid,jsonb)'::regprocedure,'neuvetra.collection_assert_activity(jsonb)'::regprocedure) and acl.grantee=0 and acl.privilege_type='EXECUTE')
  then raise exception '0031 changed the collection function privileges' using errcode='42501'; end if;
end $grants$;

-- 3. The approval function: 0030's body; changed only where marked 0031 (the superseded check and the two columns it reads).
create or replace function neuvetra.approve_scope3_report(target_company uuid,request jsonb)
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
  select x.id,x.report_sha256,x.open_issues,x.created_by,x.reporting_year,x.revision into v from neuvetra.scope3_report_versions x where x.id=(request->>'versionId')::uuid and x.company_id=target_company;
  if not found then raise exception 'Scope 3 report version unavailable' using errcode='23503'; end if;
  -- 0031 (BF-09, BL-03): approval signs off the current figures, so a revision that a later revision of the same company and
  -- reporting year replaces is refused with 55N31, under the company row lock prepare_scope3_report also takes: a prepare and
  -- an approval are serialised, so neither can slip between the other's check and write. Checked before the hash, as the route
  -- does (BF-05). An approval recorded before the newer revision existed is untouched, and repeating it is still a replay.
  if exists(select 1 from neuvetra.scope3_report_versions x where x.company_id=target_company and x.reporting_year=v.reporting_year and x.revision>v.revision)
    and not exists(select 1 from neuvetra.scope3_report_approvals x where x.version_id=v.id and x.company_id=target_company) then
    raise exception 'Scope 3 report version superseded' using errcode='55N31'; end if;
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

-- Prove the approval function's privileges are 0030's: the runtime may call it; public, anon and authenticated may not.
do $grants$
declare r text; begin
  if not has_function_privilege('neuvetra_runtime','neuvetra.approve_scope3_report(uuid,jsonb)','execute')
    or exists(select 1 from pg_proc p, aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
      where p.oid='neuvetra.approve_scope3_report(uuid,jsonb)'::regprocedure and acl.grantee=0 and acl.privilege_type='EXECUTE')
  then raise exception '0031 changed the approval function privileges' using errcode='42501'; end if;
  foreach r in array array['authenticated','anon'] loop
    if exists(select 1 from pg_roles where rolname=r) and has_function_privilege(r,'neuvetra.approve_scope3_report(uuid,jsonb)','execute') then raise exception '0031 approval function is open to %',r using errcode='42501'; end if;
  end loop;
end $grants$;

-- 4. No TRUNCATE of setup or collection history, even by the operator (rows there are already never updated or deleted, by
-- the 0023 and 0027 row triggers; TRUNCATE fires no row trigger). Every table of both migrations is guarded: the heads and
-- the orphan-recovery rows change through their functions, but no workflow ever empties them, and emptying the heads would
-- lose which version of each record is current. A TRUNCATE ... CASCADE reaching any of them is refused too.
create or replace function neuvetra.reject_history_truncate() returns trigger language plpgsql set search_path=pg_catalog,neuvetra,pg_temp as $$ begin
  raise exception 'setup and collection history cannot be truncated' using errcode='55000';
end $$;
revoke all on function neuvetra.reject_history_truncate() from public,authenticated,neuvetra_runtime;
do $$ declare t text; begin
  foreach t in array array['company_setup_versions','company_setup_heads','company_setup_requests','company_setup_entities','company_setup_relationships','company_setup_locations','company_setup_screening','company_setup_changes'] loop
    execute format('create or replace trigger setup_history_no_truncate before truncate on neuvetra.%I for each statement execute function neuvetra.reject_history_truncate()',t);
  end loop;
  foreach t in array array['collection_evidence_objects','collection_evidence_quarantine_events','collection_evidence_upload_intents','collection_evidence_uploads','collection_evidence_orphan_recovery','collection_activity_records','collection_activity_versions','collection_activity_heads','collection_activity_requests','collection_activity_evidence_links','collection_electricity_instruments','collection_grid_loss_lineage'] loop
    execute format('create or replace trigger collection_history_no_truncate before truncate on neuvetra.%I for each statement execute function neuvetra.reject_history_truncate()',t);
  end loop;
end $$;

-- Prove the guards: each of the 20 tables has its enabled BEFORE TRUNCATE statement trigger on the new function, and no
-- application role (nor public) may call the function.
do $guards$
declare r text; begin
  if (select count(*) from pg_trigger g join pg_class c on c.oid=g.tgrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='neuvetra' and g.tgfoid='neuvetra.reject_history_truncate()'::regprocedure and g.tgtype=34 and g.tgenabled='O'
        and ((g.tgname='setup_history_no_truncate' and c.relname like 'company\_setup\_%') or (g.tgname='collection_history_no_truncate' and c.relname like 'collection\_%')))<>20
  then raise exception '0031 truncate guards incomplete' using errcode='42501'; end if;
  foreach r in array array['neuvetra_runtime','authenticated','anon'] loop
    if exists(select 1 from pg_roles where rolname=r) and has_function_privilege(r,'neuvetra.reject_history_truncate()','execute') then raise exception '0031 truncate guard is callable by %',r using errcode='42501'; end if;
  end loop;
  if exists(select 1 from pg_proc p, aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl where p.oid='neuvetra.reject_history_truncate()'::regprocedure and acl.grantee=0 and acl.privilege_type='EXECUTE')
  then raise exception '0031 truncate guard is open to public' using errcode='42501'; end if;
end $guards$;
