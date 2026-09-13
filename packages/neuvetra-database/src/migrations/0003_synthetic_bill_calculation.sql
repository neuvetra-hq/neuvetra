create table neuvetra.inventory_calculation_results (
  id uuid primary key,
  company_id uuid not null references neuvetra.companies(id) on delete cascade,
  activity_version_id uuid not null,
  bill_version_id uuid not null,
  evidence_id uuid not null,
  facility_id uuid not null,
  boundary_id uuid not null,
  method_id text not null check (method_id = 'scope2-location-based-egrid-subregion'),
  method_version text not null check (method_version = '2023-r2-camx-v1'),
  adapter_implementation_sha256 text not null check (adapter_implementation_sha256 = 'ae03b9146060187c63b6f3b8a253fbd61cd4f97a9aa97905481904eca45b061e'),
  reviewed_engine_sha256 text not null check (reviewed_engine_sha256 = '4ad28f3877d13f238bbbf7e8bfb1fc6241922b9def73712ec1b02fd80b51b82c'),
  authority_record_sha256 text not null check (authority_record_sha256 = '9c63b2cb12fa2708f35d394e537ca5803e27f91c4647f33376abf75a6fb72b91'),
  factor_id text not null check (factor_id = 'epa-egrid2023-r2-camx-total-output'),
  factor_version text not null check (factor_version = 'eGRID2023-revision-2'),
  factor_candidate_sha256 text not null check (factor_candidate_sha256 = '8770ae6238df8525e5250850fab248c934be33f459ed19cc1fa24bd0718cb356'),
  source_sha256 text not null check (source_sha256 = '3dfbbcf2f949d58d5b2dbee3aab8150bd04a0c8ebb730ba1cd37a013bd4450ab'),
  gwp_policy_id text not null check (gwp_policy_id = 'epa-egrid2023-ar5-100-year'),
  gwp_policy_version text not null check (gwp_policy_version = 'egrid2023-technical-guide-v1'),
  gwp_policy_sha256 text not null check (gwp_policy_sha256 = 'fd9fd8973012da1a232dad7fc00db3013194751a92b34ab21dfd4f7b2c5148c5'),
  input_snapshot_sha256 text not null check (input_snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  result_payload_sha256 text not null check (result_payload_sha256 ~ '^[0-9a-f]{64}$'),
  source_quantity_kwh numeric(18,3) not null check (source_quantity_kwh = 12346.000),
  normalized_quantity_mwh numeric(18,6) not null check (normalized_quantity_mwh = 12.346000),
  unrounded_kg_co2e numeric(30,13) not null check (unrounded_kg_co2e = 2407.9674055248),
  display_kg_co2e numeric(30,4) not null check (display_kg_co2e = 2407.9674),
  status text not null check (status = 'draft'),
  classification text not null check (classification = 'development_candidate'),
  release_eligible boolean not null check (release_eligible = false),
  result_payload_json text not null,
  result_payload jsonb not null,
  idempotency_key uuid not null,
  operation_fingerprint text not null check (operation_fingerprint ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (id, company_id),
  unique (company_id, idempotency_key),
  unique (company_id, activity_version_id, method_version),
  foreign key (activity_version_id, company_id) references neuvetra.inventory_activity_versions(id, company_id),
  foreign key (bill_version_id, company_id) references neuvetra.bill_versions(id, company_id),
  foreign key (evidence_id, company_id) references neuvetra.bill_evidence(id, company_id),
  foreign key (facility_id, company_id) references neuvetra.facilities(id, company_id),
  foreign key (boundary_id, company_id) references neuvetra.reporting_boundaries(id, company_id),
  check (result_payload_json::jsonb = result_payload)
);

create table neuvetra.calculation_audit_log (
  id uuid primary key,
  company_id uuid not null references neuvetra.companies(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id),
  calculation_id uuid not null,
  event_type text not null check (event_type = 'calculation.created'),
  event_meta jsonb not null,
  created_at timestamptz not null default now(),
  unique (company_id, calculation_id),
  foreign key (calculation_id, company_id) references neuvetra.inventory_calculation_results(id, company_id)
);

alter table neuvetra.inventory_calculation_results enable row level security;
alter table neuvetra.inventory_calculation_results force row level security;
create policy inventory_calculation_results_member_select on neuvetra.inventory_calculation_results
  for select to authenticated using (neuvetra.is_company_member(company_id));
alter table neuvetra.calculation_audit_log enable row level security;
alter table neuvetra.calculation_audit_log force row level security;
create policy calculation_audit_log_member_select on neuvetra.calculation_audit_log
  for select to authenticated using (neuvetra.is_company_member(company_id));

create function neuvetra.create_synthetic_bill_calculation(
  target_company_id uuid, target_evidence_id uuid, target_activity_id uuid,
  calculation_id uuid, audit_id uuid, request_idempotency_key uuid, request_operation_fingerprint text,
  canonical_result_json text
) returns uuid
language plpgsql security definer
set search_path = neuvetra, pg_temp
as $$
declare
  actor_id uuid := neuvetra.current_user_id();
  payload jsonb;
  stored_id uuid;
  linked record;
begin
  if actor_id is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if not neuvetra.can_manage_company(target_company_id) then raise exception 'workspace not found' using errcode = '42501'; end if;
  if request_operation_fingerprint !~ '^[0-9a-f]{64}$' then raise exception 'calculation contract mismatch' using errcode = '22023'; end if;
  begin payload := canonical_result_json::jsonb;
  exception when others then raise exception 'calculation contract mismatch' using errcode = '22023'; end;

  select a.bill_version_id, v.evidence_id, a.facility_id, a.boundary_id, j.id extraction_id, v.previous_version_id
    into linked
  from neuvetra.inventory_activity_versions a
  join neuvetra.bill_versions v on v.id = a.bill_version_id and v.company_id = a.company_id
  join neuvetra.bill_versions prior on prior.id = v.previous_version_id and prior.company_id = v.company_id
  join neuvetra.bill_evidence e on e.id = v.evidence_id and e.company_id = v.company_id
  join neuvetra.extraction_jobs j on j.evidence_id = e.id and j.company_id = e.company_id
  join neuvetra.facilities f on f.id = a.facility_id and f.company_id = a.company_id
  join neuvetra.reporting_boundaries b on b.id = a.boundary_id and b.company_id = a.company_id
  join neuvetra.boundary_facilities bf on bf.company_id = a.company_id and bf.boundary_id = a.boundary_id and bf.facility_id = a.facility_id
  where a.company_id = target_company_id and a.id = target_activity_id
    and v.evidence_id = target_evidence_id and v.version = 2 and prior.version = 1
    and v.electricity_kwh = 12346.000 and v.correction_reason = 'Synthetic review exercise'
    and a.bill_version_id = v.id and a.quantity_mwh = 12.346000 and a.unit = 'MWh' and a.status = 'draft'
    and a.facility_id = v.facility_id and f.name = 'Synthetic California office' and f.egrid_subregion = 'CAMX'
    and b.reporting_year = 2023 and b.approach = 'operational_control' and b.status = 'draft' and b.version = 1
    and e.sha256 = '0a97cd0976c03af0776214fc19bdc3d4f0c00e9c835f3e116574a6f375c8e135'
    and j.parser_version = 'm55-fixed-pdf-v1' and j.status = 'completed'
  for update of a, v, b;
  if linked.bill_version_id is null then raise exception 'calculation source not found' using errcode = '42501'; end if;

  if payload->>'contract_version' <> 'm56-linked-bill-calculation-result-v1'
    or payload->>'status' <> 'calculated'
    or payload#>>'{activity,quantity}' <> '12.346000'
    or payload#>>'{activity,unit}' <> 'MWh'
    or payload#>>'{activity,geography,egrid_subregion}' <> 'CAMX'
    or payload#>>'{activity,activity_period,start}' <> '2023-01-01'
    or payload#>>'{activity,activity_period,end}' <> '2023-01-31'
    or payload#>>'{conversion,id}' <> 'exact-kwh-to-mwh-v1'
    or payload#>>'{conversion,source}' <> '12346.000 kWh'
    or payload#>>'{conversion,result}' <> '12.346000 MWh'
    or payload#>>'{method,id}' <> 'scope2-location-based-egrid-subregion'
    or payload#>>'{method,version}' <> '2023-r2-camx-v1'
    or payload#>>'{factor,candidate_sha256}' <> '8770ae6238df8525e5250850fab248c934be33f459ed19cc1fa24bd0718cb356'
    or payload#>>'{factor,source,workbook_sha256}' <> '3dfbbcf2f949d58d5b2dbee3aab8150bd04a0c8ebb730ba1cd37a013bd4450ab'
    or payload#>>'{factor,total_output_co2e,value}' <> '195.0402888'
    or payload#>>'{factor,total_output_co2e,cell}' <> 'AI6'
    or payload#>>'{gwp_policy,policy_sha256}' <> 'fd9fd8973012da1a232dad7fc00db3013194751a92b34ab21dfd4f7b2c5148c5'
    or payload->>'input_snapshot_sha256' !~ '^[0-9a-f]{64}$'
    or payload#>>'{total,unrounded}' <> '2407.9674055248'
    or payload#>>'{total,display}' <> '2407.9674'
    or payload#>>'{reconciliation,component_sum}' <> '2407.8330020304'
    or payload#>>'{reconciliation,component_rounding_delta}' <> '0.1344034944'
    or payload#>>'{classification,factor}' <> 'development_candidate'
    or payload#>>'{classification,runtime}' <> 'not_released'
    or (payload#>>'{classification,release_eligible}')::boolean <> false
    or payload->>'result_payload_sha256' !~ '^[0-9a-f]{64}$'
    or payload#>>'{method,adapter_implementation_sha256}' <> 'ae03b9146060187c63b6f3b8a253fbd61cd4f97a9aa97905481904eca45b061e'
    or payload#>>'{method,reviewed_engine_sha256}' <> '4ad28f3877d13f238bbbf7e8bfb1fc6241922b9def73712ec1b02fd80b51b82c'
    or payload#>>'{method,authority_record_sha256}' <> '9c63b2cb12fa2708f35d394e537ca5803e27f91c4647f33376abf75a6fb72b91'
    or payload#>>'{input_snapshot,company_id}' <> target_company_id::text
    or payload#>>'{input_snapshot,evidence_id}' <> target_evidence_id::text
    or payload#>>'{input_snapshot,activity_version_id}' <> target_activity_id::text
    or payload#>>'{input_snapshot,bill_version_id}' <> linked.bill_version_id::text
    or payload#>>'{input_snapshot,facility_id}' <> linked.facility_id::text
    or payload#>>'{input_snapshot,boundary_id}' <> linked.boundary_id::text
    or payload#>>'{input_snapshot,extraction_id}' <> linked.extraction_id::text
    or payload#>>'{input_snapshot,previous_bill_version_id}' <> linked.previous_version_id::text
    or payload#>>'{input_snapshot,parser_version}' <> 'm55-fixed-pdf-v1'
    or payload#>>'{input_snapshot,activity_version}' <> '1'
    or payload#>>'{input_snapshot,correction_reason}' <> 'Synthetic review exercise'
    or payload#>>'{input_snapshot,service_period,start}' <> '2023-01-01'
    or payload#>>'{input_snapshot,service_period,end}' <> '2023-01-31'
    or payload#>>'{gas_results,co2,mass}' <> '2399.4607843584'
    or payload#>>'{gas_results,ch4,mass}' <> '0.14000364'
    or payload#>>'{gas_results,ch4,co2e}' <> '3.92010192'
    or payload#>>'{gas_results,n2o,mass}' <> '0.0168004368'
    or payload#>>'{gas_results,n2o,co2e}' <> '4.452115752'
    or payload#>>'{trace,0,step}' <> 'reviewed_bill_conversion'
    or payload#>>'{trace,1,result}' <> '2407.9674055248'
    or payload#>>'{trace,2,result}' <> '2407.8330020304'
    or payload#>>'{trace,3,result}' <> '0.1344034944'
  then raise exception 'calculation contract mismatch' using errcode = '22023'; end if;

  insert into neuvetra.inventory_calculation_results (
    id, company_id, activity_version_id, bill_version_id, evidence_id, facility_id, boundary_id,
    method_id, method_version, adapter_implementation_sha256, reviewed_engine_sha256, authority_record_sha256, factor_id, factor_version,
    factor_candidate_sha256, source_sha256, gwp_policy_id, gwp_policy_version, gwp_policy_sha256,
    input_snapshot_sha256, result_payload_sha256, source_quantity_kwh, normalized_quantity_mwh,
    unrounded_kg_co2e, display_kg_co2e, status, classification, release_eligible,
    result_payload_json, result_payload, idempotency_key, operation_fingerprint, created_by
  ) values (
    calculation_id, target_company_id, target_activity_id, linked.bill_version_id, linked.evidence_id,
    linked.facility_id, linked.boundary_id, payload#>>'{method,id}', payload#>>'{method,version}',
    payload#>>'{method,adapter_implementation_sha256}', payload#>>'{method,reviewed_engine_sha256}', payload#>>'{method,authority_record_sha256}', payload#>>'{factor,id}', payload#>>'{factor,version}',
    payload#>>'{factor,candidate_sha256}', payload#>>'{factor,source,workbook_sha256}',
    payload#>>'{gwp_policy,id}', payload#>>'{gwp_policy,version}', payload#>>'{gwp_policy,policy_sha256}',
    payload->>'input_snapshot_sha256', payload->>'result_payload_sha256', 12346.000, 12.346000,
    2407.9674055248, 2407.9674, 'draft', 'development_candidate', false,
    canonical_result_json, payload, request_idempotency_key, request_operation_fingerprint, actor_id
  ) on conflict (company_id, activity_version_id, method_version) do nothing returning id into stored_id;

  if stored_id is null then
    select id into stored_id from neuvetra.inventory_calculation_results
      where company_id = target_company_id and activity_version_id = target_activity_id and method_version = '2023-r2-camx-v1'
        and result_payload = payload and result_payload_json = canonical_result_json
        and operation_fingerprint = request_operation_fingerprint;
    if stored_id is null then raise exception 'calculation conflict' using errcode = '23505'; end if;
    return stored_id;
  end if;

  insert into neuvetra.calculation_audit_log values (
    audit_id, target_company_id, actor_id, stored_id, 'calculation.created',
    jsonb_build_object('activity_version_id', target_activity_id, 'method_version', '2023-r2-camx-v1', 'result_payload_sha256', payload->>'result_payload_sha256'), now()
  );
  return stored_id;
end
$$;

revoke all on function neuvetra.create_synthetic_bill_calculation(uuid, uuid, uuid, uuid, uuid, uuid, text, text) from public;
grant select on neuvetra.inventory_calculation_results, neuvetra.calculation_audit_log to authenticated;
