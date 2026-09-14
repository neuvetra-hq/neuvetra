create table neuvetra.inventory_versions (
  id uuid primary key,
  company_id uuid not null references neuvetra.companies(id) on delete cascade,
  boundary_id uuid not null,
  calculation_id uuid not null,
  version integer not null check (version = 1),
  reporting_year integer not null check (reporting_year = 2023),
  scope text not null check (scope = 'scope_2_location_based'),
  status text not null check (status = 'in_review'),
  expected_facilities integer not null check (expected_facilities = 1),
  covered_facilities integer not null check (covered_facilities = 1),
  expected_periods integer not null check (expected_periods = 12),
  covered_periods integer not null check (covered_periods = 1),
  covered_months text[] not null check (covered_months = array['2023-01']::text[]),
  missing_months text[] not null check (missing_months = array['2023-02','2023-03','2023-04','2023-05','2023-06','2023-07','2023-08','2023-09','2023-10','2023-11','2023-12']::text[]),
  complete boolean not null check (complete = false),
  factor_release_eligible boolean not null check (factor_release_eligible = false),
  warning_codes text[] not null check (warning_codes = array['annual_coverage_incomplete_1_of_12_months','market_based_scope2_not_included','factor_and_method_not_released','synthetic_local_only_no_assurance']::text[]),
  calculation_result_sha256 text not null check (calculation_result_sha256 ~ '^[0-9a-f]{64}$'),
  snapshot_sha256 text not null check (snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  idempotency_key uuid not null,
  operation_fingerprint text not null check (operation_fingerprint ~ '^[0-9a-f]{64}$'),
  submitted_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (id, company_id),
  unique (company_id, boundary_id, version),
  unique (company_id, idempotency_key),
  foreign key (boundary_id, company_id) references neuvetra.reporting_boundaries(id, company_id),
  foreign key (calculation_id, company_id) references neuvetra.inventory_calculation_results(id, company_id)
);

create table neuvetra.inventory_review_decisions (
  id uuid primary key,
  company_id uuid not null references neuvetra.companies(id) on delete cascade,
  inventory_version_id uuid not null,
  decision text not null check (decision in ('approve_bounded_draft','changes_requested')),
  outcome text not null check (outcome in ('approved_bounded_draft','changes_requested')),
  inventory_status_after text not null check (inventory_status_after in ('approved_bounded_draft','changes_requested')),
  acknowledged_warning_codes text[] not null,
  reason_code text not null check (reason_code in ('bounded_synthetic_scope_reviewed','source_or_calculation_revision_required')),
  idempotency_key uuid not null,
  operation_fingerprint text not null check (operation_fingerprint ~ '^[0-9a-f]{64}$'),
  decided_by uuid not null references auth.users(id),
  decided_at timestamptz not null default now(),
  unique (id, company_id),
  unique (company_id, idempotency_key),
  unique (company_id, inventory_version_id),
  foreign key (inventory_version_id, company_id) references neuvetra.inventory_versions(id, company_id)
);

create table neuvetra.inventory_review_audit_log (
  id uuid primary key,
  company_id uuid not null references neuvetra.companies(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id),
  event_type text not null check (event_type in ('inventory.version.created','inventory.review.recorded')),
  subject_id uuid not null,
  event_meta jsonb not null,
  created_at timestamptz not null default now(),
  unique (company_id, event_type, subject_id)
);

alter table neuvetra.inventory_versions enable row level security;
alter table neuvetra.inventory_versions force row level security;
alter table neuvetra.inventory_review_decisions enable row level security;
alter table neuvetra.inventory_review_decisions force row level security;
alter table neuvetra.inventory_review_audit_log enable row level security;
alter table neuvetra.inventory_review_audit_log force row level security;
create policy inventory_versions_member_select on neuvetra.inventory_versions for select to authenticated using (neuvetra.is_company_member(company_id));
create policy inventory_review_decisions_member_select on neuvetra.inventory_review_decisions for select to authenticated using (neuvetra.is_company_member(company_id));
create policy inventory_review_audit_member_select on neuvetra.inventory_review_audit_log for select to authenticated using (neuvetra.is_company_member(company_id));

create function neuvetra.reject_inventory_history_mutation() returns trigger
language plpgsql as $$ begin raise exception 'inventory history is immutable' using errcode = '42501'; end $$;
create trigger inventory_versions_immutable before update or delete on neuvetra.inventory_versions for each row execute function neuvetra.reject_inventory_history_mutation();
create trigger inventory_review_decisions_immutable before update or delete on neuvetra.inventory_review_decisions for each row execute function neuvetra.reject_inventory_history_mutation();
create trigger inventory_review_audit_immutable before update or delete on neuvetra.inventory_review_audit_log for each row execute function neuvetra.reject_inventory_history_mutation();

create function neuvetra.create_synthetic_scope2_inventory(
  target_company_id uuid, target_calculation_id uuid, inventory_id uuid, audit_id uuid,
  request_idempotency_key uuid, request_operation_fingerprint text, request_snapshot_sha256 text
) returns uuid
language plpgsql security definer
set search_path = neuvetra, pg_temp
as $$
declare actor_id uuid := neuvetra.current_user_id(); stored_id uuid; linked record;
begin
  if actor_id is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if not neuvetra.can_manage_company(target_company_id) then raise exception 'workspace not found' using errcode = '42501'; end if;
  if request_operation_fingerprint !~ '^[0-9a-f]{64}$' or request_snapshot_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'inventory contract mismatch' using errcode = '22023'; end if;
  select c.boundary_id, c.result_payload_sha256 into linked
    from neuvetra.inventory_calculation_results c
    join neuvetra.reporting_boundaries b on b.id = c.boundary_id and b.company_id = c.company_id
    where c.company_id = target_company_id and c.id = target_calculation_id
      and c.status = 'draft' and c.release_eligible = false and c.classification = 'development_candidate'
      and c.source_quantity_kwh = 12346.000 and c.normalized_quantity_mwh = 12.346000
      and c.unrounded_kg_co2e = 2407.9674055248 and c.display_kg_co2e = 2407.9674
      and b.reporting_year = 2023 and b.status = 'draft' and b.version = 1
    for update of c, b;
  if linked.boundary_id is null then raise exception 'calculation not found' using errcode = '42501'; end if;

  insert into neuvetra.inventory_versions (
    id, company_id, boundary_id, calculation_id, version, reporting_year, scope, status,
    expected_facilities, covered_facilities, expected_periods, covered_periods, covered_months, missing_months,
    complete, factor_release_eligible, warning_codes, calculation_result_sha256, snapshot_sha256,
    idempotency_key, operation_fingerprint, submitted_by
  ) values (
    inventory_id, target_company_id, linked.boundary_id, target_calculation_id, 1, 2023, 'scope_2_location_based', 'in_review',
    1, 1, 12, 1, array['2023-01'], array['2023-02','2023-03','2023-04','2023-05','2023-06','2023-07','2023-08','2023-09','2023-10','2023-11','2023-12'],
    false, false, array['annual_coverage_incomplete_1_of_12_months','market_based_scope2_not_included','factor_and_method_not_released','synthetic_local_only_no_assurance'], linked.result_payload_sha256, request_snapshot_sha256,
    request_idempotency_key, request_operation_fingerprint, actor_id
  ) on conflict (company_id, boundary_id, version) do nothing returning id into stored_id;
  if stored_id is null then
    select id into stored_id from neuvetra.inventory_versions where company_id = target_company_id and boundary_id = linked.boundary_id and version = 1
      and calculation_id = target_calculation_id and calculation_result_sha256 = linked.result_payload_sha256 and snapshot_sha256 = request_snapshot_sha256
      and operation_fingerprint = request_operation_fingerprint;
    if stored_id is null then raise exception 'inventory conflict' using errcode = '23505'; end if;
    return stored_id;
  end if;
  insert into neuvetra.inventory_review_audit_log values (
    audit_id, target_company_id, actor_id, 'inventory.version.created', stored_id,
    jsonb_build_object('version', 1, 'complete', false, 'factor_release_eligible', false, 'snapshot_sha256', request_snapshot_sha256), now()
  );
  return stored_id;
end $$;

create function neuvetra.record_synthetic_inventory_review(
  target_company_id uuid, target_inventory_id uuid, review_id uuid, audit_id uuid, requested_decision text,
  requested_reason_code text, requested_acknowledgments text[], request_idempotency_key uuid, request_operation_fingerprint text
) returns uuid
language plpgsql security definer
set search_path = neuvetra, pg_temp
as $$
declare actor_id uuid := neuvetra.current_user_id(); stored_id uuid; inventory record;
begin
  if actor_id is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if not neuvetra.can_manage_company(target_company_id) then raise exception 'workspace not found' using errcode = '42501'; end if;
  if requested_decision not in ('approve_bounded_draft','changes_requested') or request_operation_fingerprint !~ '^[0-9a-f]{64}$' then raise exception 'review contract mismatch' using errcode = '22023'; end if;
  if (requested_decision = 'approve_bounded_draft' and (requested_reason_code <> 'bounded_synthetic_scope_reviewed' or requested_acknowledgments <> array['annual_coverage_incomplete_1_of_12_months','market_based_scope2_not_included','factor_and_method_not_released','synthetic_local_only_no_assurance']::text[]))
    or (requested_decision = 'changes_requested' and (requested_reason_code <> 'source_or_calculation_revision_required' or requested_acknowledgments <> array[]::text[]))
  then raise exception 'review contract mismatch' using errcode = '22023'; end if;
  select id, status, complete, factor_release_eligible, submitted_by into inventory from neuvetra.inventory_versions
    where company_id = target_company_id and id = target_inventory_id for update;
  if inventory.id is null then raise exception 'inventory not found' using errcode = '42501'; end if;
  if inventory.status <> 'in_review' or inventory.complete or inventory.factor_release_eligible or inventory.submitted_by = actor_id then raise exception 'review contract mismatch' using errcode = '22023'; end if;
  insert into neuvetra.inventory_review_decisions (
    id, company_id, inventory_version_id, decision, outcome, inventory_status_after, acknowledged_warning_codes, reason_code,
    idempotency_key, operation_fingerprint, decided_by
  ) values (
    review_id, target_company_id, target_inventory_id, requested_decision,
    case when requested_decision = 'approve_bounded_draft' then 'approved_bounded_draft' else 'changes_requested' end,
    case when requested_decision = 'approve_bounded_draft' then 'approved_bounded_draft' else 'changes_requested' end,
    requested_acknowledgments, requested_reason_code, request_idempotency_key, request_operation_fingerprint, actor_id
  ) on conflict (company_id, inventory_version_id) do nothing returning id into stored_id;
  if stored_id is null then
    select id into stored_id from neuvetra.inventory_review_decisions where company_id = target_company_id and inventory_version_id = target_inventory_id
      and decision = requested_decision and reason_code = requested_reason_code and acknowledged_warning_codes = requested_acknowledgments and operation_fingerprint = request_operation_fingerprint;
    if stored_id is null then raise exception 'review conflict' using errcode = '23505'; end if;
    return stored_id;
  end if;
  insert into neuvetra.inventory_review_audit_log values (
    audit_id, target_company_id, actor_id, 'inventory.review.recorded', stored_id,
    jsonb_build_object('inventory_version_id', target_inventory_id, 'decision', requested_decision,
      'outcome', case when requested_decision = 'approve_bounded_draft' then 'approved_bounded_draft' else 'changes_requested' end), now()
  );
  return stored_id;
end $$;

revoke all on function neuvetra.create_synthetic_scope2_inventory(uuid, uuid, uuid, uuid, uuid, text, text) from public;
revoke all on function neuvetra.record_synthetic_inventory_review(uuid, uuid, uuid, uuid, text, text, text[], uuid, text) from public;
grant select on neuvetra.inventory_versions, neuvetra.inventory_review_decisions, neuvetra.inventory_review_audit_log to authenticated;
revoke insert, update, delete on neuvetra.reporting_boundaries, neuvetra.boundary_facilities from authenticated;
