create table neuvetra.inventory_draft_report_review_decisions (
 id uuid primary key,
 company_id uuid not null,
 report_id uuid not null,
 profile text not null check(profile='neuvetra.synthetic.inventory-draft-report-review.v1'),
 decision text not null check(decision in ('accept_bounded_internal_draft','changes_requested')),
 outcome text not null check(outcome in ('accepted_bounded_internal_draft','changes_requested')),
 reason_code text not null check(reason_code in ('exact_report_reviewed_for_bounded_internal_use','report_revision_required')),
 acknowledged_limitations text[] not null,
 change_route_code text check(change_route_code in ('source_evidence_revision_required','calculation_revision_required','inventory_boundary_or_period_revision_required','report_presentation_revision_required')),
 change_note text,
 report_sha256 text not null check(report_sha256~'^[0-9a-f]{64}$'),
 inventory_snapshot_sha256 text not null check(inventory_snapshot_sha256~'^[0-9a-f]{64}$'),
 source_archive_sha256 text not null check(source_archive_sha256~'^[0-9a-f]{64}$'),
 source_manifest_sha256 text not null check(source_manifest_sha256~'^[0-9a-f]{64}$'),
 source_lineage_root_sha256 text not null check(source_lineage_root_sha256~'^[0-9a-f]{64}$'),
 report_created_by uuid not null references auth.users(id),
 decision_snapshot_sha256 text not null check(decision_snapshot_sha256~'^[0-9a-f]{64}$'),
 release_eligible boolean not null default false check(release_eligible=false),
 idempotency_key uuid not null,
 operation_fingerprint text not null check(operation_fingerprint~'^[0-9a-f]{64}$'),
 decided_by uuid not null references auth.users(id),
 decided_at timestamptz not null default now(),
 unique(id,company_id), unique(company_id,report_id), unique(company_id,idempotency_key),
 foreign key(report_id,company_id) references neuvetra.inventory_draft_reports(id,company_id),
 check(
   (decision='accept_bounded_internal_draft' and outcome='accepted_bounded_internal_draft' and reason_code='exact_report_reviewed_for_bounded_internal_use'
    and acknowledged_limitations=array['overall_inventory_incomplete','one_period_estimated','one_period_excluded','market_based_scope2_not_included','factor_and_method_not_released','scope_1_and_scope_3_not_assessed','synthetic_local_only_no_assurance']::text[]
    and change_route_code is null and change_note is null)
   or
   (decision='changes_requested' and outcome='changes_requested' and reason_code='report_revision_required'
    and acknowledged_limitations='{}'::text[] and change_route_code is not null and change_note is not null
    and change_note=btrim(change_note) and char_length(change_note) between 1 and 500 and change_note !~ '[[:cntrl:]]')
 )
);

create table neuvetra.inventory_draft_report_review_audit_log (
 id uuid primary key,
 company_id uuid not null references neuvetra.companies(id) on delete cascade,
 decision_id uuid not null,
 report_id uuid not null,
 actor_user_id uuid not null references auth.users(id),
 event_type text not null check(event_type='inventory_draft_report.reviewed'),
 event_meta jsonb not null,
 created_at timestamptz not null default now(),
 unique(company_id,decision_id), unique(company_id,report_id),
 foreign key(decision_id,company_id) references neuvetra.inventory_draft_report_review_decisions(id,company_id),
 foreign key(report_id,company_id) references neuvetra.inventory_draft_reports(id,company_id)
);

alter table neuvetra.inventory_draft_report_review_decisions enable row level security;
alter table neuvetra.inventory_draft_report_review_decisions force row level security;
alter table neuvetra.inventory_draft_report_review_audit_log enable row level security;
alter table neuvetra.inventory_draft_report_review_audit_log force row level security;
create policy inventory_report_review_member_select on neuvetra.inventory_draft_report_review_decisions for select to authenticated using(neuvetra.is_company_member(company_id));
create policy inventory_report_review_audit_member_select on neuvetra.inventory_draft_report_review_audit_log for select to authenticated using(neuvetra.is_company_member(company_id));
create trigger inventory_report_review_immutable before update or delete on neuvetra.inventory_draft_report_review_decisions for each row execute function neuvetra.reject_inventory_history_mutation();
create trigger inventory_report_review_audit_immutable before update or delete on neuvetra.inventory_draft_report_review_audit_log for each row execute function neuvetra.reject_inventory_history_mutation();

create function neuvetra.review_inventory_draft_report(
 target_company_id uuid,target_inventory_id uuid,target_report_id uuid,requested_decision_id uuid,requested_audit_id uuid,
 request_decision text,request_reason_code text,request_acknowledged_limitations text[],request_change_route_code text,request_change_note text,
 expected_report_sha256 text,expected_inventory_snapshot_sha256 text,expected_archive_sha256 text,expected_manifest_sha256 text,expected_lineage_sha256 text,expected_report_created_by uuid,request_decision_snapshot_sha256 text,
 request_idempotency_key uuid,request_operation_fingerprint text
) returns uuid language plpgsql security definer set search_path=neuvetra,pg_temp as $$
declare actor_id uuid:=neuvetra.current_user_id();stored_id uuid;anchored record;request_outcome text;computed_snapshot_sha256 text;
begin
 if actor_id is null or not neuvetra.can_manage_company(target_company_id) then raise exception 'workspace not found' using errcode='42501';end if;
 select id,created_by,report_sha256,inventory_snapshot_sha256,source_archive_sha256,source_manifest_sha256,source_lineage_root_sha256 into anchored
 from neuvetra.inventory_draft_reports where company_id=target_company_id and annual_inventory_version_id=target_inventory_id and id=target_report_id for update;
 if not found then raise exception 'draft report review conflicts' using errcode='23505';end if;
 if anchored.created_by=actor_id then raise exception 'second manager required' using errcode='23505';end if;
 if anchored.created_by is distinct from expected_report_created_by then raise exception 'draft report review conflicts' using errcode='23505';end if;
 if anchored.report_sha256 is distinct from expected_report_sha256 or anchored.inventory_snapshot_sha256 is distinct from expected_inventory_snapshot_sha256 or anchored.source_archive_sha256 is distinct from expected_archive_sha256 or anchored.source_manifest_sha256 is distinct from expected_manifest_sha256 or anchored.source_lineage_root_sha256 is distinct from expected_lineage_sha256 then raise exception 'draft report review conflicts' using errcode='23505';end if;
 if request_decision='accept_bounded_internal_draft' then
   request_outcome:='accepted_bounded_internal_draft';
   if request_reason_code is distinct from 'exact_report_reviewed_for_bounded_internal_use' or request_acknowledged_limitations is distinct from array['overall_inventory_incomplete','one_period_estimated','one_period_excluded','market_based_scope2_not_included','factor_and_method_not_released','scope_1_and_scope_3_not_assessed','synthetic_local_only_no_assurance']::text[] or request_change_route_code is not null or request_change_note is not null then raise exception 'invalid draft report review' using errcode='22023';end if;
 elsif request_decision='changes_requested' then
   request_outcome:='changes_requested';
   if request_reason_code is distinct from 'report_revision_required' or request_acknowledged_limitations is distinct from '{}'::text[] or request_change_route_code not in ('source_evidence_revision_required','calculation_revision_required','inventory_boundary_or_period_revision_required','report_presentation_revision_required') or request_change_note is null or request_change_note is distinct from btrim(request_change_note) or char_length(request_change_note) not between 1 and 500 or request_change_note ~ '[[:cntrl:]]' then raise exception 'invalid draft report review' using errcode='22023';end if;
 else raise exception 'invalid draft report review' using errcode='22023';end if;
 computed_snapshot_sha256:=encode(sha256(convert_to(concat_ws(E'\n',
   'version=1','companyId='||target_company_id::text,'reportId='||target_report_id::text,'profile=neuvetra.synthetic.inventory-draft-report-review.v1','decision='||request_decision,'outcome='||request_outcome,'reasonCode='||request_reason_code,
   'acknowledgedLimitations='||array_to_string(request_acknowledged_limitations,','),'changeRouteCode='||coalesce(request_change_route_code,'<null>'),'changeNote='||coalesce(request_change_note,'<null>'),
   'reportSha256='||expected_report_sha256,'reportCreatedBy='||expected_report_created_by::text,'inventorySnapshotSha256='||expected_inventory_snapshot_sha256,'sourceArchiveSha256='||expected_archive_sha256,'sourceManifestSha256='||expected_manifest_sha256,'sourceLineageRootSha256='||expected_lineage_sha256,'releaseEligible=false','reviewerIdentity='||actor_id::text
 ),'utf8')),'hex');
 if computed_snapshot_sha256 is distinct from request_decision_snapshot_sha256 then raise exception 'draft report review snapshot mismatch' using errcode='22023';end if;
 select id into stored_id from neuvetra.inventory_draft_report_review_decisions where company_id=target_company_id and idempotency_key=request_idempotency_key;
 if stored_id is not null then if not exists(select 1 from neuvetra.inventory_draft_report_review_decisions where id=stored_id and operation_fingerprint=request_operation_fingerprint) then raise exception 'draft report review conflicts' using errcode='23505';end if;return stored_id;end if;
 insert into neuvetra.inventory_draft_report_review_decisions values(requested_decision_id,target_company_id,target_report_id,'neuvetra.synthetic.inventory-draft-report-review.v1',request_decision,request_outcome,request_reason_code,request_acknowledged_limitations,request_change_route_code,request_change_note,expected_report_sha256,expected_inventory_snapshot_sha256,expected_archive_sha256,expected_manifest_sha256,expected_lineage_sha256,expected_report_created_by,request_decision_snapshot_sha256,false,request_idempotency_key,request_operation_fingerprint,actor_id,now())
 on conflict(company_id,report_id) do nothing returning id into stored_id;
 if stored_id is null then select id into stored_id from neuvetra.inventory_draft_report_review_decisions where company_id=target_company_id and report_id=target_report_id and operation_fingerprint=request_operation_fingerprint;end if;
 if stored_id is null then raise exception 'draft report review conflicts' using errcode='23505';end if;
 insert into neuvetra.inventory_draft_report_review_audit_log values(requested_audit_id,target_company_id,stored_id,target_report_id,actor_id,'inventory_draft_report.reviewed',jsonb_build_object('decision',request_decision,'report_sha256',expected_report_sha256,'report_created_by',expected_report_created_by,'decision_snapshot_sha256',request_decision_snapshot_sha256,'change_route_code',request_change_route_code),now()) on conflict(company_id,report_id) do nothing;
 return stored_id;
end$$;

revoke all on table neuvetra.inventory_draft_report_review_decisions,neuvetra.inventory_draft_report_review_audit_log from public;
revoke all on function neuvetra.review_inventory_draft_report(uuid,uuid,uuid,uuid,uuid,text,text,text[],text,text,text,text,text,text,text,uuid,text,uuid,text) from public,authenticated;
grant select on neuvetra.inventory_draft_report_review_decisions,neuvetra.inventory_draft_report_review_audit_log to authenticated;
