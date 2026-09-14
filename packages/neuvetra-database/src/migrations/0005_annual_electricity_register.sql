create table neuvetra.annual_source_register_versions (
  id uuid primary key,
  company_id uuid not null references neuvetra.companies(id) on delete cascade,
  boundary_id uuid not null,
  previous_inventory_version_id uuid not null,
  version integer not null check (version in (1,2)),
  status text not null check (status in ('incomplete','resolved_with_exceptions')),
  payload_json text not null,
  fixture_sha256 text,
  snapshot_sha256 text not null check (snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  idempotency_key uuid not null,
  operation_fingerprint text not null check (operation_fingerprint ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (id, company_id),
  unique (company_id, boundary_id, version),
  unique (company_id, idempotency_key),
  foreign key (boundary_id, company_id) references neuvetra.reporting_boundaries(id, company_id),
  foreign key (previous_inventory_version_id, company_id) references neuvetra.inventory_versions(id, company_id),
  check ((version = 1 and status = 'incomplete' and fixture_sha256 is null) or
         (version = 2 and status = 'resolved_with_exceptions' and fixture_sha256 ~ '^[0-9a-f]{64}$'))
);

create table neuvetra.annual_inventory_versions (
  id uuid primary key,
  company_id uuid not null references neuvetra.companies(id) on delete cascade,
  boundary_id uuid not null,
  previous_inventory_version_id uuid not null,
  register_version_id uuid not null,
  version integer not null check (version = 2),
  payload_json text not null,
  snapshot_sha256 text not null check (snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  idempotency_key uuid not null,
  operation_fingerprint text not null check (operation_fingerprint ~ '^[0-9a-f]{64}$'),
  submitted_by uuid not null references auth.users(id),
  submitted_at timestamptz not null default now(),
  unique (id, company_id),
  unique (company_id, boundary_id, version),
  unique (company_id, idempotency_key),
  foreign key (boundary_id, company_id) references neuvetra.reporting_boundaries(id, company_id),
  foreign key (previous_inventory_version_id, company_id) references neuvetra.inventory_versions(id, company_id),
  foreign key (register_version_id, company_id) references neuvetra.annual_source_register_versions(id, company_id)
);

create table neuvetra.annual_inventory_review_decisions (
  id uuid primary key,
  company_id uuid not null references neuvetra.companies(id) on delete cascade,
  annual_inventory_version_id uuid not null,
  decision text not null check (decision in ('approve_bounded_annual_location_draft','changes_requested')),
  reason_code text not null check (reason_code in ('bounded_annual_location_register_reviewed','source_or_calculation_revision_required')),
  acknowledged_warning_codes text[] not null,
  idempotency_key uuid not null,
  operation_fingerprint text not null check (operation_fingerprint ~ '^[0-9a-f]{64}$'),
  decided_by uuid not null references auth.users(id),
  decided_at timestamptz not null default now(),
  unique (id, company_id),
  unique (company_id, annual_inventory_version_id),
  unique (company_id, idempotency_key),
  foreign key (annual_inventory_version_id, company_id) references neuvetra.annual_inventory_versions(id, company_id)
);

create table neuvetra.annual_inventory_audit_log (
  id uuid primary key, company_id uuid not null references neuvetra.companies(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id), event_type text not null,
  subject_id uuid not null, event_meta jsonb not null, created_at timestamptz not null default now(),
  unique (company_id, event_type, subject_id)
);

alter table neuvetra.annual_source_register_versions enable row level security;
alter table neuvetra.annual_source_register_versions force row level security;
alter table neuvetra.annual_inventory_versions enable row level security;
alter table neuvetra.annual_inventory_versions force row level security;
alter table neuvetra.annual_inventory_review_decisions enable row level security;
alter table neuvetra.annual_inventory_review_decisions force row level security;
alter table neuvetra.annual_inventory_audit_log enable row level security;
alter table neuvetra.annual_inventory_audit_log force row level security;
create policy annual_register_member_select on neuvetra.annual_source_register_versions for select to authenticated using (neuvetra.is_company_member(company_id));
create policy annual_inventory_member_select on neuvetra.annual_inventory_versions for select to authenticated using (neuvetra.is_company_member(company_id));
create policy annual_decision_member_select on neuvetra.annual_inventory_review_decisions for select to authenticated using (neuvetra.is_company_member(company_id));
create policy annual_audit_member_select on neuvetra.annual_inventory_audit_log for select to authenticated using (neuvetra.is_company_member(company_id));

create trigger annual_register_immutable before update or delete on neuvetra.annual_source_register_versions for each row execute function neuvetra.reject_inventory_history_mutation();
create trigger annual_inventory_immutable before update or delete on neuvetra.annual_inventory_versions for each row execute function neuvetra.reject_inventory_history_mutation();
create trigger annual_decision_immutable before update or delete on neuvetra.annual_inventory_review_decisions for each row execute function neuvetra.reject_inventory_history_mutation();
create trigger annual_audit_immutable before update or delete on neuvetra.annual_inventory_audit_log for each row execute function neuvetra.reject_inventory_history_mutation();

create function neuvetra.create_annual_source_register(
  target_company_id uuid, prior_inventory_id uuid, register_id uuid, audit_id uuid,
  request_payload_json text, request_snapshot_sha256 text, request_idempotency_key uuid, request_operation_fingerprint text
) returns uuid language plpgsql security definer set search_path = neuvetra, pg_temp as $$
declare actor_id uuid := neuvetra.current_user_id(); stored_id uuid; predecessor record; payload jsonb := request_payload_json::jsonb;
begin
  if actor_id is null or not neuvetra.can_manage_company(target_company_id) then raise exception 'workspace not found' using errcode='42501'; end if;
  select i.boundary_id, i.calculation_id, i.calculation_result_sha256, c.facility_id, d.outcome into predecessor from neuvetra.inventory_versions i
    join neuvetra.inventory_review_decisions d on d.company_id=i.company_id and d.inventory_version_id=i.id
    join neuvetra.inventory_calculation_results c on c.company_id=i.company_id and c.id=i.calculation_id
    where i.company_id=target_company_id and i.id=prior_inventory_id and i.version=1 and d.outcome='approved_bounded_draft' for update of i;
  if predecessor.boundary_id is null then raise exception 'approved predecessor required' using errcode='22023'; end if;
  if payload - 'snapshotSha256' is distinct from jsonb_build_object(
    'id',register_id,'companyId',target_company_id,'boundaryId',predecessor.boundary_id,'previousInventoryVersionId',prior_inventory_id,
    'version',1,'reportingYear',2023,'facilityId',predecessor.facility_id,'status','incomplete',
    'counts',jsonb_build_object('expected',12,'resolved',1,'reported',1,'estimated',0,'excluded',0,'missing',11,'calculationBearing',1),
    'periods',jsonb_build_array(
      jsonb_build_object('month','2023-01','state','reported','version',1,'quantityMwh','12.346000','emissionsKgCo2e','2407.9674055248','evidence',jsonb_build_object('source','M56 calculation derived from M55 bill version 2','sha256',predecessor.calculation_result_sha256,'locator',format('calculation %s; service 2023-01-01..2023-01-31',predecessor.calculation_id)),'reason',null,'method',null,'formula',null,'basisMonths',jsonb_build_array()),
      jsonb_build_object('month','2023-02','state','missing','version',1,'quantityMwh',null,'emissionsKgCo2e',null,'evidence',null,'reason','awaiting_source','method',null,'formula',null,'basisMonths',jsonb_build_array()),
      jsonb_build_object('month','2023-03','state','missing','version',1,'quantityMwh',null,'emissionsKgCo2e',null,'evidence',null,'reason','awaiting_source','method',null,'formula',null,'basisMonths',jsonb_build_array()),
      jsonb_build_object('month','2023-04','state','missing','version',1,'quantityMwh',null,'emissionsKgCo2e',null,'evidence',null,'reason','awaiting_source','method',null,'formula',null,'basisMonths',jsonb_build_array()),
      jsonb_build_object('month','2023-05','state','missing','version',1,'quantityMwh',null,'emissionsKgCo2e',null,'evidence',null,'reason','awaiting_source','method',null,'formula',null,'basisMonths',jsonb_build_array()),
      jsonb_build_object('month','2023-06','state','missing','version',1,'quantityMwh',null,'emissionsKgCo2e',null,'evidence',null,'reason','awaiting_source','method',null,'formula',null,'basisMonths',jsonb_build_array()),
      jsonb_build_object('month','2023-07','state','missing','version',1,'quantityMwh',null,'emissionsKgCo2e',null,'evidence',null,'reason','awaiting_source','method',null,'formula',null,'basisMonths',jsonb_build_array()),
      jsonb_build_object('month','2023-08','state','missing','version',1,'quantityMwh',null,'emissionsKgCo2e',null,'evidence',null,'reason','awaiting_source','method',null,'formula',null,'basisMonths',jsonb_build_array()),
      jsonb_build_object('month','2023-09','state','missing','version',1,'quantityMwh',null,'emissionsKgCo2e',null,'evidence',null,'reason','awaiting_source','method',null,'formula',null,'basisMonths',jsonb_build_array()),
      jsonb_build_object('month','2023-10','state','missing','version',1,'quantityMwh',null,'emissionsKgCo2e',null,'evidence',null,'reason','awaiting_source','method',null,'formula',null,'basisMonths',jsonb_build_array()),
      jsonb_build_object('month','2023-11','state','missing','version',1,'quantityMwh',null,'emissionsKgCo2e',null,'evidence',null,'reason','awaiting_source','method',null,'formula',null,'basisMonths',jsonb_build_array()),
      jsonb_build_object('month','2023-12','state','missing','version',1,'quantityMwh',null,'emissionsKgCo2e',null,'evidence',null,'reason','awaiting_source','method',null,'formula',null,'basisMonths',jsonb_build_array())
    ),'totals',null,'fixtureSha256',null
  ) then raise exception 'register contract mismatch' using errcode='22023'; end if;
  if jsonb_typeof(payload) is distinct from 'object' or (select count(*) from jsonb_object_keys(payload)) is distinct from 13::bigint or payload->>'id' is distinct from register_id::text or payload->>'companyId' is distinct from target_company_id::text or payload->>'boundaryId' is distinct from predecessor.boundary_id::text or payload->>'previousInventoryVersionId' is distinct from prior_inventory_id::text
    or payload->>'version' is distinct from '1' or payload->>'reportingYear' is distinct from '2023' or payload->>'status' is distinct from 'incomplete' or payload->'totals' is distinct from 'null'::jsonb or payload->'fixtureSha256' is distinct from 'null'::jsonb
    or payload#>>'{counts,expected}' is distinct from '12' or payload#>>'{counts,resolved}' is distinct from '1' or payload#>>'{counts,reported}' is distinct from '1' or payload#>>'{counts,missing}' is distinct from '11' or payload#>>'{counts,calculationBearing}' is distinct from '1'
    or jsonb_array_length(payload->'periods') is distinct from 12 or payload#>>'{periods,0,month}' is distinct from '2023-01' or payload#>>'{periods,0,state}' is distinct from 'reported' or payload#>>'{periods,0,quantityMwh}' is distinct from '12.346000'
    or payload#>>'{periods,0,emissionsKgCo2e}' is distinct from '2407.9674055248' or payload#>>'{periods,0,evidence,sha256}' is distinct from predecessor.calculation_result_sha256
    or payload#>>'{periods,1,state}' is distinct from 'missing' or payload#>>'{periods,2,state}' is distinct from 'missing' or payload#>>'{periods,3,state}' is distinct from 'missing' or payload#>>'{periods,4,state}' is distinct from 'missing' or payload#>>'{periods,5,state}' is distinct from 'missing' or payload#>>'{periods,6,state}' is distinct from 'missing' or payload#>>'{periods,7,state}' is distinct from 'missing' or payload#>>'{periods,8,state}' is distinct from 'missing' or payload#>>'{periods,9,state}' is distinct from 'missing' or payload#>>'{periods,10,state}' is distinct from 'missing' or payload#>>'{periods,11,state}' is distinct from 'missing' or payload->>'snapshotSha256' is distinct from request_snapshot_sha256
  then raise exception 'register contract mismatch' using errcode='22023'; end if;
  insert into neuvetra.annual_source_register_versions values
    (register_id,target_company_id,predecessor.boundary_id,prior_inventory_id,1,'incomplete',request_payload_json,null,request_snapshot_sha256,request_idempotency_key,request_operation_fingerprint,actor_id,now())
    on conflict (company_id,boundary_id,version) do nothing returning id into stored_id;
  if stored_id is null then select id into stored_id from neuvetra.annual_source_register_versions where company_id=target_company_id and boundary_id=predecessor.boundary_id and previous_inventory_version_id=prior_inventory_id and version=1; end if;
  if stored_id is null then raise exception 'register conflict' using errcode='23505'; end if;
  insert into neuvetra.annual_inventory_audit_log values(audit_id,target_company_id,actor_id,'annual_register.created',stored_id,jsonb_build_object('version',1,'snapshot_sha256',request_snapshot_sha256),now()) on conflict do nothing;
  return stored_id;
end $$;

create function neuvetra.complete_annual_source_register(
  target_company_id uuid, prior_register_id uuid, register_id uuid, audit_id uuid,
  request_payload_json text, request_fixture_sha256 text, request_snapshot_sha256 text,
  request_idempotency_key uuid, request_operation_fingerprint text
) returns uuid language plpgsql security definer set search_path = neuvetra, pg_temp as $$
declare actor_id uuid := neuvetra.current_user_id(); stored_id uuid; prior record; payload jsonb := request_payload_json::jsonb;
begin
  if actor_id is null or not neuvetra.can_manage_company(target_company_id) then raise exception 'workspace not found' using errcode='42501'; end if;
  select * into prior from neuvetra.annual_source_register_versions where company_id=target_company_id and id=prior_register_id and version=1 and status='incomplete' for update;
  if prior.id is null then raise exception 'register conflict' using errcode='22023'; end if;
  if payload - 'snapshotSha256' is distinct from jsonb_build_object(
    'id',register_id,'companyId',target_company_id,'boundaryId',prior.boundary_id,'previousInventoryVersionId',prior.previous_inventory_version_id,
    'version',2,'reportingYear',2023,'facilityId',(prior.payload_json::jsonb)->'facilityId','status','resolved_with_exceptions',
    'counts',jsonb_build_object('expected',12,'resolved',12,'reported',10,'estimated',1,'excluded',1,'missing',0,'calculationBearing',11),
    'periods',jsonb_build_array(
      (prior.payload_json::jsonb)#>'{periods,0}',
      jsonb_build_object('month','2023-02','state','reported','version',2,'quantityMwh','11.982000','emissionsKgCo2e','2336.9727404016','evidence',jsonb_build_object('source','M58 fixed fictional electricity register','sha256',request_fixture_sha256,'locator','rows[0]'),'reason',null,'method',null,'formula',null,'basisMonths',jsonb_build_array()),
      jsonb_build_object('month','2023-03','state','reported','version',2,'quantityMwh','12.417000','emissionsKgCo2e','2421.8152660296','evidence',jsonb_build_object('source','M58 fixed fictional electricity register','sha256',request_fixture_sha256,'locator','rows[1]'),'reason',null,'method',null,'formula',null,'basisMonths',jsonb_build_array()),
      jsonb_build_object('month','2023-04','state','reported','version',2,'quantityMwh','11.876000','emissionsKgCo2e','2316.2984697888','evidence',jsonb_build_object('source','M58 fixed fictional electricity register','sha256',request_fixture_sha256,'locator','rows[2]'),'reason',null,'method',null,'formula',null,'basisMonths',jsonb_build_array()),
      jsonb_build_object('month','2023-05','state','reported','version',2,'quantityMwh','12.104000','emissionsKgCo2e','2360.7676556352','evidence',jsonb_build_object('source','M58 fixed fictional electricity register','sha256',request_fixture_sha256,'locator','rows[3]'),'reason',null,'method',null,'formula',null,'basisMonths',jsonb_build_array()),
      jsonb_build_object('month','2023-06','state','reported','version',2,'quantityMwh','13.228000','emissionsKgCo2e','2579.9929402464','evidence',jsonb_build_object('source','M58 fixed fictional electricity register','sha256',request_fixture_sha256,'locator','rows[4]'),'reason',null,'method',null,'formula',null,'basisMonths',jsonb_build_array()),
      jsonb_build_object('month','2023-07','state','reported','version',2,'quantityMwh','14.037000','emissionsKgCo2e','2737.7805338856','evidence',jsonb_build_object('source','M58 fixed fictional electricity register','sha256',request_fixture_sha256,'locator','rows[5]'),'reason',null,'method',null,'formula',null,'basisMonths',jsonb_build_array()),
      jsonb_build_object('month','2023-08','state','reported','version',2,'quantityMwh','13.812000','emissionsKgCo2e','2693.8964689056','evidence',jsonb_build_object('source','M58 fixed fictional electricity register','sha256',request_fixture_sha256,'locator','rows[6]'),'reason',null,'method',null,'formula',null,'basisMonths',jsonb_build_array()),
      jsonb_build_object('month','2023-09','state','reported','version',2,'quantityMwh','12.765000','emissionsKgCo2e','2489.689286532','evidence',jsonb_build_object('source','M58 fixed fictional electricity register','sha256',request_fixture_sha256,'locator','rows[7]'),'reason',null,'method',null,'formula',null,'basisMonths',jsonb_build_array()),
      jsonb_build_object('month','2023-10','state','reported','version',2,'quantityMwh','12.221000','emissionsKgCo2e','2383.5873694248','evidence',jsonb_build_object('source','M58 fixed fictional electricity register','sha256',request_fixture_sha256,'locator','rows[8]'),'reason',null,'method',null,'formula',null,'basisMonths',jsonb_build_array()),
      jsonb_build_object('month','2023-11','state','estimated','version',2,'quantityMwh','12.493000','emissionsKgCo2e','2436.6383279784','evidence',null,'reason','synthetic_november_statement_unavailable','method','mean_of_prior_two_reported_months_v1','formula','(12.765000 + 12.221000) / 2','basisMonths',jsonb_build_array('2023-09','2023-10')),
      jsonb_build_object('month','2023-12','state','excluded','version',2,'quantityMwh',null,'emissionsKgCo2e',null,'evidence',jsonb_build_object('source','M58 fixed fictional electricity register','sha256',request_fixture_sha256,'locator','closureMemo'),'reason','outside_operational_control_after_lease_end','method',null,'formula',null,'basisMonths',jsonb_build_array())
    ),
    'totals',jsonb_build_object('reportedMwh','126.788000','reportedKgCo2e','24728.7681363744','reportedDisplayKgCo2e','24728.7681','estimatedMwh','12.493000','estimatedKgCo2e','2436.6383279784','estimatedDisplayKgCo2e','2436.6383','includedMwh','139.281000','includedKgCo2e','27165.4064643528','includedDisplayKgCo2e','27165.4065'),
    'fixtureSha256',request_fixture_sha256
  ) then raise exception 'register contract mismatch' using errcode='22023'; end if;
  if jsonb_typeof(payload) is distinct from 'object' or (select count(*) from jsonb_object_keys(payload)) is distinct from 13::bigint or request_fixture_sha256 is distinct from '44cf813b31bf92a13e15a5432e26cd931355df7ded4684248759a50876dbdc29' or payload->>'id' is distinct from register_id::text or payload->>'companyId' is distinct from target_company_id::text
    or payload->>'boundaryId' is distinct from prior.boundary_id::text or payload->>'previousInventoryVersionId' is distinct from prior.previous_inventory_version_id::text or payload->>'version' is distinct from '2' or payload->>'status' is distinct from 'resolved_with_exceptions'
    or payload->>'fixtureSha256' is distinct from request_fixture_sha256 or payload->>'snapshotSha256' is distinct from request_snapshot_sha256 or jsonb_array_length(payload->'periods') is distinct from 12
    or payload#>>'{counts,expected}' is distinct from '12' or payload#>>'{counts,resolved}' is distinct from '12' or payload#>>'{counts,reported}' is distinct from '10' or payload#>>'{counts,estimated}' is distinct from '1' or payload#>>'{counts,excluded}' is distinct from '1' or payload#>>'{counts,missing}' is distinct from '0' or payload#>>'{counts,calculationBearing}' is distinct from '11'
    or payload#>>'{totals,reportedMwh}' is distinct from '126.788000' or payload#>>'{totals,reportedKgCo2e}' is distinct from '24728.7681363744' or payload#>>'{totals,estimatedMwh}' is distinct from '12.493000' or payload#>>'{totals,estimatedKgCo2e}' is distinct from '2436.6383279784' or payload#>>'{totals,includedMwh}' is distinct from '139.281000' or payload#>>'{totals,includedKgCo2e}' is distinct from '27165.4064643528' or payload#>>'{totals,includedDisplayKgCo2e}' is distinct from '27165.4065'
    or payload#>>'{periods,0,state}' is distinct from 'reported' or payload#>>'{periods,1,state}' is distinct from 'reported' or payload#>>'{periods,2,state}' is distinct from 'reported' or payload#>>'{periods,3,state}' is distinct from 'reported' or payload#>>'{periods,4,state}' is distinct from 'reported' or payload#>>'{periods,5,state}' is distinct from 'reported' or payload#>>'{periods,6,state}' is distinct from 'reported' or payload#>>'{periods,7,state}' is distinct from 'reported' or payload#>>'{periods,8,state}' is distinct from 'reported' or payload#>>'{periods,9,state}' is distinct from 'reported'
    or payload#>>'{periods,0,quantityMwh}' is distinct from '12.346000' or payload#>>'{periods,1,quantityMwh}' is distinct from '11.982000' or payload#>>'{periods,2,quantityMwh}' is distinct from '12.417000' or payload#>>'{periods,3,quantityMwh}' is distinct from '11.876000' or payload#>>'{periods,4,quantityMwh}' is distinct from '12.104000' or payload#>>'{periods,5,quantityMwh}' is distinct from '13.228000' or payload#>>'{periods,6,quantityMwh}' is distinct from '14.037000' or payload#>>'{periods,7,quantityMwh}' is distinct from '13.812000' or payload#>>'{periods,8,quantityMwh}' is distinct from '12.765000' or payload#>>'{periods,9,quantityMwh}' is distinct from '12.221000'
    or payload#>>'{periods,1,evidence,sha256}' is distinct from request_fixture_sha256 or payload#>>'{periods,9,evidence,sha256}' is distinct from request_fixture_sha256
    or payload#>>'{periods,10,state}' is distinct from 'estimated' or payload#>>'{periods,10,quantityMwh}' is distinct from '12.493000' or payload#>>'{periods,10,method}' is distinct from 'mean_of_prior_two_reported_months_v1' or payload#>>'{periods,10,reason}' is distinct from 'synthetic_november_statement_unavailable'
    or payload#>>'{periods,11,state}' is distinct from 'excluded' or payload#>>'{periods,11,reason}' is distinct from 'outside_operational_control_after_lease_end' or payload#>'{periods,11,quantityMwh}' is distinct from 'null'::jsonb or payload#>'{periods,11,emissionsKgCo2e}' is distinct from 'null'::jsonb
  then raise exception 'register contract mismatch' using errcode='22023'; end if;
  insert into neuvetra.annual_source_register_versions values
    (register_id,target_company_id,prior.boundary_id,prior.previous_inventory_version_id,2,'resolved_with_exceptions',request_payload_json,request_fixture_sha256,request_snapshot_sha256,request_idempotency_key,request_operation_fingerprint,actor_id,now())
    on conflict (company_id,boundary_id,version) do nothing returning id into stored_id;
  if stored_id is null then select id into stored_id from neuvetra.annual_source_register_versions where company_id=target_company_id and boundary_id=prior.boundary_id and previous_inventory_version_id=prior.previous_inventory_version_id and version=2 and fixture_sha256=request_fixture_sha256; end if;
  if stored_id is null then raise exception 'register conflict' using errcode='23505'; end if;
  insert into neuvetra.annual_inventory_audit_log values(audit_id,target_company_id,actor_id,'annual_register.completed',stored_id,jsonb_build_object('version',2,'snapshot_sha256',request_snapshot_sha256),now()) on conflict do nothing;
  return stored_id;
end $$;

create function neuvetra.create_annual_inventory_v2(
  target_company_id uuid, target_register_id uuid, inventory_id uuid, audit_id uuid,
  request_payload_json text, request_snapshot_sha256 text, request_idempotency_key uuid, request_operation_fingerprint text
) returns uuid language plpgsql security definer set search_path = neuvetra, pg_temp as $$
declare actor_id uuid := neuvetra.current_user_id(); stored_id uuid; reg record; payload jsonb := request_payload_json::jsonb;
begin
  if actor_id is null or not neuvetra.can_manage_company(target_company_id) then raise exception 'workspace not found' using errcode='42501'; end if;
  select * into reg from neuvetra.annual_source_register_versions where company_id=target_company_id and id=target_register_id and version=2 and status='resolved_with_exceptions' for update;
  if reg.id is null then raise exception 'resolved register required' using errcode='22023'; end if;
  if payload - 'snapshotSha256' is distinct from jsonb_build_object(
    'id',inventory_id,'companyId',target_company_id,'boundaryId',reg.boundary_id,'previousInventoryVersionId',reg.previous_inventory_version_id,'registerId',reg.id,'registerSnapshotSha256',reg.snapshot_sha256,
    'version',2,'reportingYear',2023,'scope','scope_2_location_based','periodResolution','resolved_with_exceptions','overallInventoryCompleteness','incomplete','releaseEligible',false,
    'counts',(reg.payload_json::jsonb)->'counts','totals',(reg.payload_json::jsonb)->'totals',
    'warnings',jsonb_build_array('one_period_estimated','one_period_excluded','market_based_scope2_not_included','factor_and_method_not_released','scope_1_and_scope_3_not_assessed','synthetic_local_only_no_assurance')
  ) then raise exception 'inventory contract mismatch' using errcode='22023'; end if;
  if jsonb_typeof(payload) is distinct from 'object' or (select count(*) from jsonb_object_keys(payload)) is distinct from 16::bigint or payload->>'id' is distinct from inventory_id::text or payload->>'companyId' is distinct from target_company_id::text or payload->>'boundaryId' is distinct from reg.boundary_id::text or payload->>'previousInventoryVersionId' is distinct from reg.previous_inventory_version_id::text
    or payload->>'registerId' is distinct from reg.id::text or payload->>'registerSnapshotSha256' is distinct from reg.snapshot_sha256 or payload->>'version' is distinct from '2' or payload->>'reportingYear' is distinct from '2023' or payload->>'scope' is distinct from 'scope_2_location_based'
    or payload->>'periodResolution' is distinct from 'resolved_with_exceptions' or payload->>'overallInventoryCompleteness' is distinct from 'incomplete' or payload->>'releaseEligible' is distinct from 'false' or payload->>'snapshotSha256' is distinct from request_snapshot_sha256
    or payload#>>'{counts,resolved}' is distinct from '12' or payload#>>'{counts,reported}' is distinct from '10' or payload#>>'{counts,estimated}' is distinct from '1' or payload#>>'{counts,excluded}' is distinct from '1' or payload#>>'{counts,missing}' is distinct from '0' or payload#>>'{counts,calculationBearing}' is distinct from '11'
    or payload#>>'{totals,includedMwh}' is distinct from '139.281000' or payload#>>'{totals,includedKgCo2e}' is distinct from '27165.4064643528' or payload#>>'{totals,includedDisplayKgCo2e}' is distinct from '27165.4065'
    or payload->'warnings' is distinct from jsonb_build_array('one_period_estimated','one_period_excluded','market_based_scope2_not_included','factor_and_method_not_released','scope_1_and_scope_3_not_assessed','synthetic_local_only_no_assurance')
  then raise exception 'inventory contract mismatch' using errcode='22023'; end if;
  insert into neuvetra.annual_inventory_versions values
    (inventory_id,target_company_id,reg.boundary_id,reg.previous_inventory_version_id,reg.id,2,request_payload_json,request_snapshot_sha256,request_idempotency_key,request_operation_fingerprint,actor_id,now())
    on conflict (company_id,boundary_id,version) do nothing returning id into stored_id;
  if stored_id is null then select id into stored_id from neuvetra.annual_inventory_versions where company_id=target_company_id and boundary_id=reg.boundary_id and version=2 and register_version_id=reg.id; end if;
  if stored_id is null then raise exception 'inventory conflict' using errcode='23505'; end if;
  insert into neuvetra.annual_inventory_audit_log values(audit_id,target_company_id,actor_id,'annual_inventory.created',stored_id,jsonb_build_object('version',2,'snapshot_sha256',request_snapshot_sha256),now()) on conflict do nothing;
  return stored_id;
end $$;

create function neuvetra.review_annual_inventory_v2(
  target_company_id uuid, target_inventory_id uuid, review_id uuid, audit_id uuid,
  requested_decision text, requested_reason text, requested_warnings text[],
  request_idempotency_key uuid, request_operation_fingerprint text
) returns uuid language plpgsql security definer set search_path = neuvetra, pg_temp as $$
declare actor_id uuid := neuvetra.current_user_id(); stored_id uuid; inv record;
begin
  if actor_id is null or not neuvetra.can_manage_company(target_company_id) then raise exception 'workspace not found' using errcode='42501'; end if;
  select * into inv from neuvetra.annual_inventory_versions where company_id=target_company_id and id=target_inventory_id for update;
  if inv.id is null or inv.submitted_by=actor_id then raise exception 'review conflict' using errcode='22023'; end if;
  if (requested_decision='approve_bounded_annual_location_draft' and (requested_reason is distinct from 'bounded_annual_location_register_reviewed' or requested_warnings is distinct from array['one_period_estimated','one_period_excluded','market_based_scope2_not_included','factor_and_method_not_released','scope_1_and_scope_3_not_assessed','synthetic_local_only_no_assurance']::text[])) or
     (requested_decision='changes_requested' and (requested_reason is distinct from 'source_or_calculation_revision_required' or requested_warnings is distinct from array[]::text[])) then raise exception 'review contract mismatch' using errcode='22023'; end if;
  insert into neuvetra.annual_inventory_review_decisions values(review_id,target_company_id,target_inventory_id,requested_decision,requested_reason,requested_warnings,request_idempotency_key,request_operation_fingerprint,actor_id,now())
    on conflict (company_id,annual_inventory_version_id) do nothing returning id into stored_id;
  if stored_id is null then select id into stored_id from neuvetra.annual_inventory_review_decisions where company_id=target_company_id and annual_inventory_version_id=target_inventory_id and decision=requested_decision and operation_fingerprint=request_operation_fingerprint; end if;
  if stored_id is null then raise exception 'review conflict' using errcode='23505'; end if;
  insert into neuvetra.annual_inventory_audit_log values(audit_id,target_company_id,actor_id,'annual_inventory.reviewed',stored_id,jsonb_build_object('decision',requested_decision),now()) on conflict do nothing;
  return stored_id;
end $$;

revoke all on function neuvetra.create_annual_source_register(uuid,uuid,uuid,uuid,text,text,uuid,text) from public;
revoke all on function neuvetra.complete_annual_source_register(uuid,uuid,uuid,uuid,text,text,text,uuid,text) from public;
revoke all on function neuvetra.create_annual_inventory_v2(uuid,uuid,uuid,uuid,text,text,uuid,text) from public;
revoke all on function neuvetra.review_annual_inventory_v2(uuid,uuid,uuid,uuid,text,text,text[],uuid,text) from public;
grant select on neuvetra.annual_source_register_versions, neuvetra.annual_inventory_versions, neuvetra.annual_inventory_review_decisions, neuvetra.annual_inventory_audit_log to authenticated;
