create table neuvetra.inventory_evidence_packs (
  id uuid primary key,
  company_id uuid not null references neuvetra.companies(id) on delete cascade,
  annual_inventory_version_id uuid not null,
  inventory_snapshot_sha256 text not null check (inventory_snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  profile text not null check (profile = 'neuvetra.synthetic.inventory-evidence-pack.v1'),
  manifest_sha256 text not null check (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  lineage_root_sha256 text not null check (lineage_root_sha256 ~ '^[0-9a-f]{64}$'),
  archive_bytes bytea not null,
  archive_sha256 text not null check (archive_sha256 ~ '^[0-9a-f]{64}$'),
  archive_byte_length integer not null check (archive_byte_length between 1 and 262144),
  entry_count integer not null check (entry_count = 17),
  idempotency_key uuid not null,
  operation_fingerprint text not null check (operation_fingerprint ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (id, company_id),
  unique (company_id, annual_inventory_version_id, profile),
  unique (company_id, idempotency_key),
  foreign key (annual_inventory_version_id, company_id) references neuvetra.annual_inventory_versions(id, company_id)
);

create table neuvetra.inventory_evidence_pack_audit_log (
  id uuid primary key,
  company_id uuid not null references neuvetra.companies(id) on delete cascade,
  pack_id uuid not null,
  actor_user_id uuid not null references auth.users(id),
  event_type text not null check (event_type = 'inventory_evidence_pack.created'),
  event_meta jsonb not null,
  created_at timestamptz not null default now(),
  unique (company_id, pack_id),
  foreign key (pack_id, company_id) references neuvetra.inventory_evidence_packs(id, company_id)
);

alter table neuvetra.inventory_evidence_packs enable row level security;
alter table neuvetra.inventory_evidence_packs force row level security;
alter table neuvetra.inventory_evidence_pack_audit_log enable row level security;
alter table neuvetra.inventory_evidence_pack_audit_log force row level security;
create policy evidence_pack_member_select on neuvetra.inventory_evidence_packs for select to authenticated using (neuvetra.is_company_member(company_id));
create policy evidence_pack_audit_member_select on neuvetra.inventory_evidence_pack_audit_log for select to authenticated using (neuvetra.is_company_member(company_id));
create trigger evidence_pack_immutable before update or delete on neuvetra.inventory_evidence_packs for each row execute function neuvetra.reject_inventory_history_mutation();
create trigger evidence_pack_audit_immutable before update or delete on neuvetra.inventory_evidence_pack_audit_log for each row execute function neuvetra.reject_inventory_history_mutation();

create function neuvetra.create_inventory_evidence_pack(
  target_company_id uuid, target_inventory_id uuid, requested_pack_id uuid, requested_audit_id uuid,
  expected_inventory_snapshot_sha256 text, request_manifest_sha256 text, request_lineage_root_sha256 text,
  request_archive_bytes bytea, request_archive_sha256 text, request_archive_byte_length integer,
  request_idempotency_key uuid, request_operation_fingerprint text
) returns uuid language plpgsql security definer set search_path = neuvetra, pg_temp as $$
declare actor_id uuid := neuvetra.current_user_id(); stored_id uuid; anchored record;
begin
  if actor_id is null or not neuvetra.can_manage_company(target_company_id) then raise exception 'workspace not found' using errcode='42501'; end if;
  select i.id, i.snapshot_sha256, i.submitted_by, d.decision, d.reason_code, d.decided_by into anchored
    from neuvetra.annual_inventory_versions i join neuvetra.annual_inventory_review_decisions d
      on d.company_id=i.company_id and d.annual_inventory_version_id=i.id
    where i.company_id=target_company_id and i.id=target_inventory_id and i.version=2 for update of i;
  if anchored.id is null or anchored.snapshot_sha256 is distinct from expected_inventory_snapshot_sha256
    or anchored.decision is distinct from 'approve_bounded_annual_location_draft'
    or anchored.reason_code is distinct from 'bounded_annual_location_register_reviewed'
    or anchored.submitted_by=anchored.decided_by
  then raise exception 'approved annual inventory required' using errcode='22023'; end if;
  if octet_length(request_archive_bytes) is distinct from request_archive_byte_length
    or encode(sha256(request_archive_bytes),'hex') is distinct from request_archive_sha256
    or request_archive_byte_length not between 1 and 262144
    or request_manifest_sha256 !~ '^[0-9a-f]{64}$'
    or request_lineage_root_sha256 !~ '^[0-9a-f]{64}$'
    or request_archive_sha256 !~ '^[0-9a-f]{64}$'
  then raise exception 'evidence pack contract mismatch' using errcode='22023'; end if;
  select id into stored_id from neuvetra.inventory_evidence_packs where company_id=target_company_id and idempotency_key=request_idempotency_key;
  if stored_id is not null then
    if not exists(select 1 from neuvetra.inventory_evidence_packs where id=stored_id and operation_fingerprint=request_operation_fingerprint) then raise exception 'evidence pack request conflicts' using errcode='23505'; end if;
    return stored_id;
  end if;
  insert into neuvetra.inventory_evidence_packs values(
    requested_pack_id,target_company_id,target_inventory_id,expected_inventory_snapshot_sha256,'neuvetra.synthetic.inventory-evidence-pack.v1',
    request_manifest_sha256,request_lineage_root_sha256,request_archive_bytes,request_archive_sha256,request_archive_byte_length,17,
    request_idempotency_key,request_operation_fingerprint,actor_id,now()
  ) on conflict (company_id,annual_inventory_version_id,profile) do nothing returning id into stored_id;
  if stored_id is null then
    select id into stored_id from neuvetra.inventory_evidence_packs where company_id=target_company_id and annual_inventory_version_id=target_inventory_id and profile='neuvetra.synthetic.inventory-evidence-pack.v1'
      and archive_sha256=request_archive_sha256 and operation_fingerprint=request_operation_fingerprint;
  end if;
  if stored_id is null then raise exception 'evidence pack request conflicts' using errcode='23505'; end if;
  insert into neuvetra.inventory_evidence_pack_audit_log values(
    requested_audit_id,target_company_id,stored_id,actor_id,'inventory_evidence_pack.created',
    jsonb_build_object('manifest_sha256',request_manifest_sha256,'lineage_root_sha256',request_lineage_root_sha256,'archive_sha256',request_archive_sha256,'archive_byte_length',request_archive_byte_length,'entry_count',17),now()
  ) on conflict (company_id,pack_id) do nothing;
  return stored_id;
end $$;

revoke all on table neuvetra.inventory_evidence_packs, neuvetra.inventory_evidence_pack_audit_log from public;
revoke all on function neuvetra.create_inventory_evidence_pack(uuid,uuid,uuid,uuid,text,text,text,bytea,text,integer,uuid,text) from public;
revoke all on function neuvetra.create_inventory_evidence_pack(uuid,uuid,uuid,uuid,text,text,text,bytea,text,integer,uuid,text) from authenticated;
grant select on neuvetra.inventory_evidence_packs, neuvetra.inventory_evidence_pack_audit_log to authenticated;
