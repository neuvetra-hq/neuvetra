-- M65 adds immutable worksheet reports; existing M63/M64 rows and contracts are untouched.
create table neuvetra.worksheet_reports (
 id uuid primary key, company_id uuid not null references neuvetra.companies(id), source_version_id uuid not null,
 source_input_sha256 text not null, source_result_sha256 text not null, review_id uuid, review_sha256 text,
 template_version text not null, template_sha256 text not null, source_snapshot jsonb not null,
 report_bytes bytea not null, report_sha256 text not null, report_byte_length integer not null check(report_byte_length between 1 and 65536),
 operation_fingerprint text not null, created_by uuid not null references auth.users(id), created_at timestamptz not null,
 unique(id,company_id),unique(company_id,operation_fingerprint),
 foreign key(source_version_id,company_id) references neuvetra.electricity_worksheet_versions(id,company_id),
 foreign key(review_id,company_id) references neuvetra.electricity_worksheet_reviews(id,company_id),
 check((review_id is null)=(review_sha256 is null)),
 check(source_input_sha256~'^[0-9a-f]{64}$' and source_result_sha256~'^[0-9a-f]{64}$' and template_sha256~'^[0-9a-f]{64}$' and report_sha256~'^[0-9a-f]{64}$' and operation_fingerprint~'^[0-9a-f]{64}$'),
 check(octet_length(report_bytes)=report_byte_length and encode(sha256(report_bytes),'hex')=report_sha256)
);
create table neuvetra.worksheet_report_requests (
 company_id uuid not null, idempotency_key uuid not null, operation_fingerprint text not null, report_id uuid not null,
 requested_by uuid not null references auth.users(id), primary key(company_id,idempotency_key),
 foreign key(report_id,company_id) references neuvetra.worksheet_reports(id,company_id)
);
create table neuvetra.worksheet_report_audit (
 id uuid primary key, company_id uuid not null, report_id uuid not null, actor_id uuid not null references auth.users(id),
 event_meta jsonb not null, created_at timestamptz not null, unique(company_id,report_id),
 foreign key(report_id,company_id) references neuvetra.worksheet_reports(id,company_id)
);
do $$ declare relation text; begin
 foreach relation in array array['worksheet_reports','worksheet_report_requests','worksheet_report_audit'] loop
  execute format('alter table neuvetra.%I enable row level security',relation);
  execute format('alter table neuvetra.%I force row level security',relation);
  execute format('create policy m65_member_read on neuvetra.%I for select to authenticated using(neuvetra.is_company_member(company_id))',relation);
  execute format('grant select on neuvetra.%I to authenticated',relation);
  execute format('revoke all on neuvetra.%I from public',relation);
  execute format('create trigger m65_immutable before update or delete on neuvetra.%I for each row execute function neuvetra.reject_inventory_history_mutation()',relation);
  if exists(select 1 from pg_roles where rolname='neuvetra_runtime') then
   execute format('create policy m65_runtime_read on neuvetra.%I for select to neuvetra_runtime using(neuvetra.is_company_member(company_id))',relation);
   execute format('grant select on neuvetra.%I to neuvetra_runtime',relation);
   execute format('revoke all on neuvetra.%I from authenticated',relation);
  end if;
 end loop;
end $$;
-- The same company row is locked exclusively by M64 corrections/reviews.
create function neuvetra.lock_worksheet_report_read(target_company uuid) returns boolean
language plpgsql security definer set search_path=pg_catalog,neuvetra,pg_temp as $$
begin
 if not neuvetra.is_company_member(target_company) then return false;end if;
 perform id from neuvetra.companies where id=target_company for share;
 return found;
end $$;
revoke all on function neuvetra.lock_worksheet_report_read(uuid) from public,authenticated;
grant execute on function neuvetra.lock_worksheet_report_read(uuid) to authenticated;

create function neuvetra.worksheet_report_template() returns text language sql immutable set search_path=pg_catalog as $function$ select $template$<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Synthetic electricity worksheet report — {{companyLabel}}</title>
<style>body{font:16px/1.55 system-ui,sans-serif;color:#182820;max-width:850px;margin:32px auto;padding:0 22px}h1{font-size:1.85rem;line-height:1.2}h2{font-size:1.2rem;margin-top:1.8rem}p,li,dd{overflow-wrap:anywhere}dl{display:grid;grid-template-columns:minmax(110px,1fr) minmax(0,3fr);gap:6px 18px}dt{font-weight:650}dd{margin:0;min-width:0}.notice{border:2px solid #927130;background:#fff8e8;padding:14px}.subtotal{font-size:2rem;font-weight:750;margin-bottom:0}.mono{font:12px/1.55 ui-monospace,monospace;overflow-wrap:anywhere;white-space:pre-wrap}.review-note{white-space:pre-wrap;border-left:3px solid #a1aea5;padding-left:12px}.print-status{display:none}.muted{color:#405248}a{color:#16553b}@media(max-width:500px){body{padding:0 14px}dl{display:block}dd{margin:2px 0 12px}}@page{size:auto;margin:24mm 15mm 22mm;@top-center{content:"Draft · Synthetic · Incomplete · Unreleased · No assurance";font:700 8pt/1.2 system-ui,sans-serif;color:#182820;vertical-align:middle}@bottom-center{content:"Draft · Synthetic · Incomplete · Unreleased · No assurance · Page " counter(page);font:700 8pt/1.2 system-ui,sans-serif;color:#182820;vertical-align:middle}}@media print{body{font-size:10pt;margin:0;max-width:none;padding:0}h1{font-size:21pt}h2{break-after:avoid}p,li,dd{orphans:3;widows:3}.notice{background:white}.subtotal{font-size:24pt}.mono{font-size:8pt}dl{display:block}dt{margin-top:7px}dd{margin-left:0}a{color:inherit;text-decoration:none}}</style></head><body>
<header class="print-status print-header">Draft · Synthetic · Incomplete · Unreleased · No assurance</header><footer class="print-status print-footer">Draft · Synthetic · Incomplete · Unreleased · No assurance · January 2023 CAMX worksheet only</footer>
<main><p>Neuvetra · Saved worksheet snapshot</p><h1>Synthetic electricity worksheet report</h1><div class="notice"><strong>Draft · Synthetic · Incomplete · Unreleased · No assurance</strong><br>Fictional manual data for private testing. No bill evidence, filing approval or professional assurance.</div>
<h2>January location-based subtotal</h2><p class="subtotal">{{display}} kg CO2e</p><p>Exact subtotal before display rounding: <strong>{{unrounded}} kg CO2e</strong></p><dl><dt>Fictional company</dt><dd>{{companyLabel}}</dd><dt>Fictional facility</dt><dd>{{facilityLabel}}</dd><dt>Period</dt><dd>January 1–31, 2023</dd><dt>Declared geography</dt><dd>United States · California · CAMX</dd><dt>Boundary</dt><dd>Operational control · Location-based Scope 2</dd><dt>Activity</dt><dd>Grid-delivered purchased electricity consumed by the reporting company</dd><dt>Manual quantity</dt><dd>{{quantityKwh}} kWh</dd><dt>Converted quantity</dt><dd>{{quantityMwh}} MWh · 1 MWh = 1,000 kWh</dd><dt>Evidence</dt><dd>Synthetic manual entry — no bill evidence</dd></dl>
<p>Display rounded once to four decimal places, half to even; no intermediate rounding. Decimal precision does not establish measurement certainty.</p>
<h2>Worksheet review captured for this report</h2><p><strong>{{reviewSummary}}</strong></p><p>This is a snapshot of a worksheet decision, not approval of this report presentation or assurance.</p><dl><dt>Reviewed source</dt><dd>Worksheet version {{sourceVersion}} · {{sourceVersionId}}</dd><dt>Result fingerprint</dt><dd class="mono">{{resultSha256}}</dd><dt>Manager reference</dt><dd class="mono">{{reviewerId}}</dd><dt>Decision time (UTC)</dt><dd>{{reviewedAt}}</dd><dt>Decision ID</dt><dd class="mono">{{reviewId}}</dd><dt>Decision fingerprint</dt><dd class="mono">{{reviewSha256}}</dd><dt>Acknowledgments</dt><dd>{{reviewAcknowledgments}}</dd></dl><p class="review-note">{{reviewNote}}</p><p class="muted">Review state was captured at {{createdAt}}. Later worksheet decisions and corrections do not change this report.</p>
<h2>Source and correction history</h2><dl><dt>Worksheet version</dt><dd>{{sourceVersion}} · {{sourceVersionId}}</dd><dt>Saved (UTC)</dt><dd>{{sourceCreatedAt}}</dd><dt>Source creator</dt><dd class="mono">{{sourceCreatedBy}}</dd><dt>Predecessor</dt><dd class="mono">{{previousVersionId}}</dd><dt>Correction reason</dt><dd>{{correctionReason}}</dd><dt>Tenant binding</dt><dd class="mono">{{companyId}}</dd><dt>Input fingerprint</dt><dd class="mono">{{inputSha256}}</dd><dt>Result fingerprint</dt><dd class="mono">{{resultSha256}}</dd></dl>
<h2>Pinned method and source</h2><p>An annual 2023 regional average factor is applied to January consumption. This is not a January-specific factor or a complete annual inventory.</p><dl><dt>Method</dt><dd>{{methodId}} · {{methodVersion}}</dd><dt>Candidate factor</dt><dd>{{factorId}} · {{factorVersion}}</dd><dt>Rate</dt><dd>{{factorValue}} kg CO2e/MWh</dd><dt>Workbook locator</dt><dd>EPA eGRID2023 metric workbook, revision 2 · SRL23!AI6 · annual total-output CO2e rate; A6=2023, B6=CAMX, C6=WECC California</dd><dt>Workbook fingerprint</dt><dd class="mono">{{sourceSha256}}</dd><dt>Candidate fingerprint</dt><dd class="mono">{{factorCandidateSha256}}</dd><dt>GWP policy</dt><dd>AR5 · 100 years · without climate-carbon feedbacks; CO2 1, CH4 28, N2O 265</dd><dt>GWP fingerprint</dt><dd class="mono">{{gwpPolicySha256}}</dd><dt>Reviewed engine fingerprint</dt><dd class="mono">{{reviewedEngineSha256}}</dd></dl><p><a href="https://www.epa.gov/system/files/documents/2025-06/egrid2023_data_metric_rev2.xlsx" rel="noreferrer">EPA source workbook</a> · <a href="https://www.epa.gov/system/files/documents/2025-01/egrid2023_technical_guide.pdf" rel="noreferrer">EPA technical guide, page 12, section 3.1.1.2 / Table 3-1</a></p><p>The existing reviewed candidate decimal normalization is retained. No factor or method is released by this report.</p>
<h2>Incomplete coverage and limitations</h2><ul><li>All input is fictional manual data without bill evidence.</li><li>The overall inventory is incomplete. February–December and other facilities/sources are not assessed; missing coverage is not zero consumption.</li><li>This worksheet covers January 2023 CAMX only.</li><li>Market-based Scope 2 is not included.</li><li>The factor and method are unreleased development candidates.</li><li>Scope 1 and Scope 3 are not assessed.</li><li>No assurance, verification, certification or filing approval is provided. Release eligibility remains false.</li></ul>
<h2>Report identity</h2><dl><dt>Report ID</dt><dd class="mono">{{reportId}}</dd><dt>Captured (UTC)</dt><dd>{{createdAt}}</dd><dt>Report creator</dt><dd class="mono">{{createdBy}}</dd><dt>Report profile</dt><dd>{{profile}}</dd><dt>Template version</dt><dd>{{templateVersion}}</dd><dt>Template fingerprint</dt><dd class="mono">{{templateSha256}}</dd><dt>Snapshot identity fingerprint</dt><dd class="mono">{{identitySha256}}</dd></dl><p class="muted">The snapshot identity fingerprint binds the company, worksheet input/result, captured review and template. The authenticated application receipt records the SHA-256 of all UTF-8 HTML bytes; this document does not embed its own byte hash. Browser print/PDF layout and bytes may vary and are not covered by the HTML hash. This report identifies its saved source version and does not claim that it remains the latest worksheet.</p>
</main></body></html>
$template$::text $function$;
revoke all on function neuvetra.worksheet_report_template() from public,authenticated;

create function neuvetra.render_worksheet_report(report_id uuid,company uuid,creator uuid,captured text,source jsonb,identity_sha text) returns bytea
language plpgsql immutable set search_path=pg_catalog,neuvetra,pg_temp as $$
declare result text:=neuvetra.worksheet_report_template(); values_map jsonb; item record; escaped text; r jsonb:=source->'review'; m jsonb:=source->'method';
begin
 values_map:=jsonb_build_object(
 'companyLabel',source->>'companyLabel','facilityLabel',source->>'facilityLabel','display',source#>>'{total,display}','unrounded',source#>>'{total,unrounded}','quantityKwh',source->>'quantityKwh','quantityMwh',source->>'quantityMwh',
 'reviewSummary',case when r='null'::jsonb then 'No worksheet review was recorded when this report was created.' when r->>'decision'='accept_bounded_internal_draft' then 'The worksheet version was accepted for bounded internal use.' else 'A manager requested changes to this worksheet version.' end,
 'sourceVersion',source->>'version','sourceVersionId',source->>'id','resultSha256',source->>'resultSha256','reviewerId',coalesce(r->>'reviewerId','Not recorded at capture'),'reviewedAt',coalesce(r->>'reviewedAt','Not recorded at capture'),'reviewId',coalesce(r->>'id','None at capture'),'reviewSha256',coalesce(r->>'decisionSha256','None at capture'),
 'reviewAcknowledgments',coalesce((select string_agg(value,', ' order by ord) from jsonb_array_elements_text(case when r='null'::jsonb then '[]'::jsonb else r->'acknowledgedLimitations' end) with ordinality a(value,ord)),'No acceptance acknowledgments'),
 'reviewNote',coalesce(r->>'note','No change-request note at capture'),'createdAt',captured,'sourceCreatedAt',source->>'createdAt','sourceCreatedBy',source->>'createdBy','previousVersionId',coalesce(source->>'previousVersionId','None — initial saved version'),'correctionReason',coalesce(source->>'correctionReason','Initial saved version — no correction'),'companyId',company::text,'inputSha256',source->>'inputSha256',
 'methodId',m->>'id','methodVersion',m->>'version','factorId',m->>'factorId','factorVersion',m->>'factorVersion','factorValue',m->>'factorValue','sourceSha256',m->>'sourceSha256','factorCandidateSha256',m->>'factorCandidateSha256','gwpPolicySha256',m->>'gwpPolicySha256','reviewedEngineSha256',m->>'reviewedEngineSha256',
 'reportId',report_id::text,'createdBy',creator::text,'profile','neuvetra.synthetic.worksheet-report.v1','templateVersion','m65-january-camx-report-v1','templateSha256',encode(sha256(convert_to(neuvetra.worksheet_report_template(),'utf8')),'hex'),'identitySha256',identity_sha);
 for item in select key,value from jsonb_each_text(values_map) loop
  if item.value is null then raise exception 'report source is invalid' using errcode='22023';end if;
  escaped:=replace(replace(replace(replace(replace(replace(replace(item.value,'&','&amp;'),'<','&lt;'),'>','&gt;'),'"','&quot;'),'''','&#39;'),'{','&#123;'),'}','&#125;');
  result:=replace(result,'{{'||item.key||'}}',escaped);
 end loop;
 if result ~ '\{\{[a-zA-Z0-9]+\}\}' then raise exception 'unresolved report template';end if;
 return convert_to(result,'utf8');
end $$;
revoke all on function neuvetra.render_worksheet_report(uuid,uuid,uuid,text,jsonb,text) from public,authenticated;

create function neuvetra.create_worksheet_report(target_company uuid,request jsonb) returns uuid
language plpgsql security definer set search_path=pg_catalog,neuvetra,pg_temp as $$
declare actor uuid:=neuvetra.current_user_id(); v record; r record; prior record; source jsonb; report_id uuid; fingerprint text;
 template_sha text:=encode(sha256(convert_to(neuvetra.worksheet_report_template(),'utf8')),'hex'); captured timestamptz; captured_text text; content bytea; content_sha text; meta jsonb;
begin
 if actor is null or not neuvetra.can_manage_company(target_company) then raise exception 'workspace not found' using errcode='42501';end if;
 perform id from neuvetra.companies where id=target_company for update;
 if jsonb_typeof(request) is distinct from 'object' or (select array_agg(key order by key) from jsonb_object_keys(request) key) is distinct from array['expectedInputSha256','expectedResultSha256','expectedReviewId','expectedReviewSha256','idempotencyKey','sourceVersionId']::text[] then raise exception 'invalid report request' using errcode='22023';end if;
 if exists(select 1 from jsonb_each(request) where key not in('expectedReviewId','expectedReviewSha256') and jsonb_typeof(value)<>'string') or request->>'sourceVersionId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or request->>'idempotencyKey' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or request->>'expectedInputSha256' !~ '^[0-9a-f]{64}$' or request->>'expectedResultSha256' !~ '^[0-9a-f]{64}$' then raise exception 'invalid report request' using errcode='22023';end if;
 if not ((request->'expectedReviewId'='null'::jsonb and request->'expectedReviewSha256'='null'::jsonb) or (jsonb_typeof(request->'expectedReviewId')='string' and jsonb_typeof(request->'expectedReviewSha256')='string' and request->>'expectedReviewId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and request->>'expectedReviewSha256' ~ '^[0-9a-f]{64}$')) then raise exception 'invalid review binding' using errcode='22023';end if;
 select * into v from neuvetra.electricity_worksheet_versions where company_id=target_company and id=(request->>'sourceVersionId')::uuid;
 if not found or v.input_sha256 is distinct from request->>'expectedInputSha256' or v.result_sha256 is distinct from request->>'expectedResultSha256' then raise exception 'report source conflicts' using errcode='23505';end if;
 fingerprint:=encode(sha256(convert_to(concat_ws(E'\n','neuvetra.synthetic.worksheet-report.v1',target_company::text,v.id::text,v.input_sha256,v.result_sha256,coalesce(request->>'expectedReviewId','<none>'),coalesce(request->>'expectedReviewSha256','<none>'),'m65-january-camx-report-v1',template_sha),'utf8')),'hex');
 select * into prior from neuvetra.worksheet_report_requests where company_id=target_company and idempotency_key=(request->>'idempotencyKey')::uuid;
 if found then
  if prior.operation_fingerprint<>fingerprint then raise exception 'report request conflicts' using errcode='23505';end if;
  return prior.report_id;
 end if;
 select id into report_id from neuvetra.worksheet_reports where company_id=target_company and operation_fingerprint=fingerprint;
 if found then
  insert into neuvetra.worksheet_report_requests values(target_company,(request->>'idempotencyKey')::uuid,fingerprint,report_id,actor);
  return report_id;
 end if;
 select * into r from neuvetra.electricity_worksheet_reviews where company_id=target_company and version_id=v.id;
 if r.id is distinct from (request->>'expectedReviewId')::uuid or r.decision_sha256 is distinct from request->>'expectedReviewSha256' then raise exception 'report review snapshot changed' using errcode='23505';end if;
 source:=v.payload||jsonb_build_object('createdAt',to_char(v.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'review',case when r.id is null then 'null'::jsonb else r.payload||jsonb_build_object('reviewedAt',to_char(r.reviewed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) end);
 report_id:=gen_random_uuid();captured:=date_trunc('milliseconds',clock_timestamp());captured_text:=to_char(captured at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 content:=neuvetra.render_worksheet_report(report_id,target_company,actor,captured_text,source,fingerprint);
 content_sha:=encode(sha256(content),'hex');
 insert into neuvetra.worksheet_reports values(report_id,target_company,v.id,v.input_sha256,v.result_sha256,r.id,r.decision_sha256,'m65-january-camx-report-v1',template_sha,source,content,content_sha,octet_length(content),fingerprint,actor,captured);
 insert into neuvetra.worksheet_report_requests values(target_company,(request->>'idempotencyKey')::uuid,fingerprint,report_id,actor);
 meta:=jsonb_build_object('profile','neuvetra.synthetic.worksheet-report.v1','reportId',report_id,'sourceVersionId',v.id,'inputSha256',v.input_sha256,'resultSha256',v.result_sha256,'reviewId',r.id,'reviewSha256',r.decision_sha256,'templateVersion','m65-january-camx-report-v1','templateSha256',template_sha,'reportSha256',content_sha,'reportByteLength',octet_length(content),'identitySha256',fingerprint);
 insert into neuvetra.worksheet_report_audit values(gen_random_uuid(),target_company,report_id,actor,meta,captured);
 return report_id;
end $$;
revoke all on function neuvetra.create_worksheet_report(uuid,jsonb) from public,authenticated;
do $$ begin
 if exists(select 1 from pg_roles where rolname='neuvetra_runtime') then
  grant execute on function neuvetra.lock_worksheet_report_read(uuid),neuvetra.create_worksheet_report(uuid,jsonb) to neuvetra_runtime;
  revoke all on function neuvetra.lock_worksheet_report_read(uuid) from authenticated;
 end if;
end $$;


-- New review/audit timestamps reflect post-lock capture, not transaction start.
-- Original migration0010 and every existing review row remain unchanged.
create or replace function neuvetra.review_electricity_worksheet(target_company uuid, request jsonb) returns uuid
language plpgsql security definer set search_path=pg_catalog,neuvetra,pg_temp as $$
declare actor uuid:=neuvetra.current_user_id(); v record; prior record; review_id uuid:=gen_random_uuid(); fingerprint text; digest text; body jsonb; acknowledgments jsonb; note text; decision_captured_at timestamptz;
begin
 if actor is null or not neuvetra.can_manage_company(target_company) then raise exception 'workspace not found' using errcode='42501'; end if;
 perform id from neuvetra.companies where id=target_company for update;
 decision_captured_at:=date_trunc('milliseconds',clock_timestamp());
 if jsonb_typeof(request) is distinct from 'object' or (select array_agg(key order by key) from jsonb_object_keys(request) key) is distinct from array['acknowledgedLimitations','decision','expectedResultSha256','idempotencyKey','note','versionId']::text[] then raise exception 'invalid worksheet review' using errcode='22023'; end if;
 if exists(select 1 from jsonb_each(request) where key not in('note','acknowledgedLimitations') and jsonb_typeof(value)<>'string') or (request->>'idempotencyKey') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'invalid worksheet review' using errcode='22023'; end if;
 acknowledgments := '["synthetic_manual_input","overall_inventory_incomplete","january_2023_camx_only","market_based_scope2_not_included","factor_and_method_not_released","scope_1_and_scope_3_not_assessed","no_assurance"]'::jsonb;
 if request->>'decision'='accept_bounded_internal_draft' then
  if request->'note' is distinct from 'null'::jsonb or request->'acknowledgedLimitations' is distinct from acknowledgments then raise exception 'invalid worksheet review' using errcode='22023'; end if;
 elsif request->>'decision'='changes_requested' then
  note:=request->>'note';
  if jsonb_typeof(request->'note') is distinct from 'string' or (note !~ '^[ -~]+$' or char_length(note) not between 1 and 500) or note<>btrim(note) or request->'acknowledgedLimitations' is distinct from '[]'::jsonb then raise exception 'invalid worksheet review' using errcode='22023'; end if;
 else raise exception 'invalid worksheet review' using errcode='22023'; end if;
 select * into v from neuvetra.electricity_worksheet_versions where company_id=target_company and id=(request->>'versionId')::uuid;
 if not found or v.result_sha256 is distinct from request->>'expectedResultSha256' or v.created_by=actor then raise exception 'worksheet review conflicts' using errcode='23505'; end if;
 fingerprint:=encode(sha256(convert_to(actor::text||E'\n'||(request-'idempotencyKey')::text,'utf8')),'hex');
 select * into prior from neuvetra.electricity_worksheet_requests where company_id=target_company and idempotency_key=(request->>'idempotencyKey')::uuid;
 if found then
  if prior.kind<>'review' or prior.operation_fingerprint<>fingerprint then raise exception 'worksheet request conflicts' using errcode='23505';end if;
  return prior.record_id;
 end if;
 select id into review_id from neuvetra.electricity_worksheet_reviews where company_id=target_company and operation_fingerprint=fingerprint;
 if found then
  insert into neuvetra.electricity_worksheet_requests values(target_company,(request->>'idempotencyKey')::uuid,fingerprint,'review',review_id);
  return review_id;
 end if;
 if exists(select 1 from neuvetra.electricity_worksheet_versions where company_id=target_company and version>v.version) or exists(select 1 from neuvetra.electricity_worksheet_reviews where company_id=target_company and version_id=v.id) then raise exception 'worksheet review conflicts' using errcode='23505';end if;
 review_id:=gen_random_uuid();
 digest:=encode(sha256(convert_to(concat_ws(E'\n','neuvetra.synthetic.manual-electricity-worksheet.v1',target_company::text,review_id::text,v.id::text,v.result_sha256,request->>'decision',coalesce(note,'<null>'),(select coalesce(string_agg(value,',' order by ord),'') from jsonb_array_elements_text(request->'acknowledgedLimitations') with ordinality as a(value,ord)),actor::text),'utf8')),'hex');
 body:=jsonb_build_object('id',review_id,'versionId',v.id,'resultSha256',v.result_sha256,'decision',request->>'decision','note',note,'acknowledgedLimitations',request->'acknowledgedLimitations','reviewerId',actor,'decisionSha256',digest);
 insert into neuvetra.electricity_worksheet_reviews values(review_id,target_company,v.id,body,digest,fingerprint,actor,decision_captured_at);
 insert into neuvetra.electricity_worksheet_requests values(target_company,(request->>'idempotencyKey')::uuid,fingerprint,'review',review_id);
 insert into neuvetra.electricity_worksheet_audit values(gen_random_uuid(),target_company,review_id,'review',digest,actor,decision_captured_at);
 return review_id;
end $$;
