create table neuvetra.bill_evidence (
  id uuid primary key,
  company_id uuid not null references neuvetra.companies(id) on delete cascade,
  original_name text not null check (length(original_name) between 1 and 120),
  media_type text not null check (media_type = 'application/pdf'),
  byte_length integer not null check (byte_length between 1 and 1048576),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  original_bytes bytea not null,
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (id, company_id),
  unique (company_id, sha256)
);

create table neuvetra.extraction_jobs (
  id uuid primary key,
  company_id uuid not null references neuvetra.companies(id) on delete cascade,
  evidence_id uuid not null,
  parser_version text not null check (parser_version = 'm55-fixed-pdf-v1'),
  status text not null check (status = 'completed'),
  extracted_payload jsonb not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (evidence_id, parser_version),
  foreign key (evidence_id, company_id) references neuvetra.bill_evidence(id, company_id)
);

create table neuvetra.bill_versions (
  id uuid primary key,
  company_id uuid not null references neuvetra.companies(id) on delete cascade,
  evidence_id uuid not null,
  facility_id uuid,
  previous_version_id uuid,
  version integer not null check (version > 0),
  supplier_name text not null,
  bill_number text not null,
  service_period_start date not null,
  service_period_end date not null check (service_period_end >= service_period_start),
  electricity_kwh numeric(18,3) not null check (electricity_kwh > 0),
  correction_reason text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (id, company_id),
  unique (evidence_id, version),
  foreign key (evidence_id, company_id) references neuvetra.bill_evidence(id, company_id),
  foreign key (facility_id, company_id) references neuvetra.facilities(id, company_id),
  foreign key (previous_version_id, company_id) references neuvetra.bill_versions(id, company_id),
  check ((version = 1 and previous_version_id is null and facility_id is null and correction_reason is null) or
         (version > 1 and previous_version_id is not null and facility_id is not null and length(btrim(correction_reason)) between 1 and 200))
);

create table neuvetra.inventory_activity_versions (
  id uuid primary key,
  company_id uuid not null references neuvetra.companies(id) on delete cascade,
  boundary_id uuid not null,
  facility_id uuid not null,
  bill_version_id uuid not null,
  previous_activity_id uuid,
  version integer not null check (version > 0),
  quantity_mwh numeric(18,6) not null check (quantity_mwh > 0),
  unit text not null check (unit = 'MWh'),
  status text not null check (status = 'draft'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (id, company_id),
  unique (bill_version_id),
  foreign key (boundary_id, company_id) references neuvetra.reporting_boundaries(id, company_id),
  foreign key (facility_id, company_id) references neuvetra.facilities(id, company_id),
  foreign key (bill_version_id, company_id) references neuvetra.bill_versions(id, company_id),
  foreign key (previous_activity_id, company_id) references neuvetra.inventory_activity_versions(id, company_id),
  check ((version = 1 and previous_activity_id is null) or (version > 1 and previous_activity_id is not null))
);

create table neuvetra.evidence_search_documents (
  id uuid primary key,
  company_id uuid not null references neuvetra.companies(id) on delete cascade,
  evidence_id uuid not null,
  search_text text not null check (search_text = 'synthetic electricity bill january 2023'),
  created_at timestamptz not null default now(),
  unique (company_id, evidence_id),
  foreign key (evidence_id, company_id) references neuvetra.bill_evidence(id, company_id)
);

create table neuvetra.bill_summary_cache (
  id uuid primary key,
  company_id uuid not null references neuvetra.companies(id) on delete cascade,
  evidence_id uuid not null,
  bill_version_id uuid not null,
  summary jsonb not null,
  created_at timestamptz not null default now(),
  unique (bill_version_id),
  foreign key (evidence_id, company_id) references neuvetra.bill_evidence(id, company_id),
  foreign key (bill_version_id, company_id) references neuvetra.bill_versions(id, company_id)
);

create table neuvetra.evidence_audit_log (
  id uuid primary key,
  company_id uuid not null references neuvetra.companies(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id),
  event_type text not null check (event_type in ('bill.ingested', 'bill.corrected', 'bill.linked')),
  subject_id uuid not null,
  event_meta jsonb not null,
  created_at timestamptz not null default now()
);

do $$
declare table_name text;
begin
  foreach table_name in array array['bill_evidence','extraction_jobs','bill_versions','inventory_activity_versions','evidence_search_documents','bill_summary_cache','evidence_audit_log']
  loop
    execute format('alter table neuvetra.%I enable row level security', table_name);
    execute format('alter table neuvetra.%I force row level security', table_name);
    execute format('create policy %I on neuvetra.%I for select to authenticated using (neuvetra.is_company_member(company_id))', table_name || '_member_select', table_name);
  end loop;
end $$;

create function neuvetra.ingest_synthetic_bill(
  target_company_id uuid, evidence_id uuid, job_id uuid, bill_version_id uuid,
  search_id uuid, cache_id uuid, log_id uuid, original_bytes bytea,
  original_sha256 text, original_name text
) returns uuid
language plpgsql security definer
set search_path = neuvetra, pg_temp
as $$
declare actor_id uuid := neuvetra.current_user_id(); stored_evidence_id uuid;
begin
  if actor_id is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if not neuvetra.can_manage_company(target_company_id) then raise exception 'workspace not found' using errcode = '42501'; end if;
  if original_sha256 <> '0a97cd0976c03af0776214fc19bdc3d4f0c00e9c835f3e116574a6f375c8e135'
     or octet_length(original_bytes) <> 4605
     or original_bytes <> decode('255044462d312e340a25938c8b9e205265706f72744c61622047656e6572617465642050444620646f63756d656e7420286f70656e736f75726365290a312030206f626a0a3c3c0a2f4631203220302052202f46322033203020520a3e3e0a656e646f626a0a322030206f626a0a3c3c0a2f42617365466f6e74202f48656c766574696361202f456e636f64696e67202f57696e416e7369456e636f64696e67202f4e616d65202f4631202f53756274797065202f5479706531202f54797065202f466f6e740a3e3e0a656e646f626a0a332030206f626a0a3c3c0a2f42617365466f6e74202f48656c7665746963612d426f6c64202f456e636f64696e67202f57696e416e7369456e636f64696e67202f4e616d65202f4632202f53756274797065202f5479706531202f54797065202f466f6e740a3e3e0a656e646f626a0a342030206f626a0a3c3c0a2f436f6e74656e7473203820302052202f4d65646961426f78205b203020302036313220373932205d202f506172656e74203720302052202f5265736f7572636573203c3c0a2f466f6e74203120302052202f50726f63536574205b202f504446202f54657874202f496d61676542202f496d61676543202f496d61676549205d0a3e3e202f526f746174652030202f5472616e73203c3c0a0a3e3e200a20202f54797065202f506167650a3e3e0a656e646f626a0a352030206f626a0a3c3c0a2f506167654d6f6465202f5573654e6f6e65202f5061676573203720302052202f54797065202f436174616c6f670a3e3e0a656e646f626a0a362030206f626a0a3c3c0a2f417574686f7220284e65757665747261206c6f63616c20646576656c6f706d656e74206669787475726529202f4372656174696f6e446174652028443a32303030303130313030303030302b30302730302729202f43726561746f722028616e6f6e796d6f757329202f4b6579776f726473202829202f4d6f64446174652028443a32303030303130313030303030302b30302730302729202f50726f647563657220285265706f72744c616220504446204c696272617279202d205c286f70656e736f757263655c2929200a20202f5375626a656374202846697865642073796e74686574696320656c6563747269636974792062696c6c3b206e6f20637573746f6d6572206461746129202f5469746c6520284e65757665747261204d35352053796e74686574696320456c6563747269636974792042696c6c29202f54726170706564202f46616c73650a3e3e0a656e646f626a0a372030206f626a0a3c3c0a2f436f756e742031202f4b696473205b203420302052205d202f54797065202f50616765730a3e3e0a656e646f626a0a382030206f626a0a3c3c0a2f4c656e67746820333136360a3e3e0a73747265616d0a312030203020312030203020636d20204254202f46312031322054662031342e3420544c2045540a2e303836323735202e313936303738202e3136383632372072670a6e203020363830203631322031313220726520662a0a31203120312072670a4254202f46322031382054662032312e3620544c2045540a425420312030203020312034362037333420546d202853594e54484554494320474f4c44454e20535441544520454c4543545249432920546a20542a2045540a4254202f463120392054662031302e3820544c2045540a425420312030203020312034362037313420546d202853594e54484554494320444556454c4f504d454e542046495854555245202d204e4f542041205245414c205554494c4954592042494c4c2920546a20542a2045540a4254202f463220313520546620313820544c2045540a42542031203020302031203433362e37392037333420546d2028456c6563747269632073746174656d656e742920546a20542a2045540a4254202f463120392054662031302e3820544c2045540a42542031203020302031203433312e3432332037313420546d202853746174656d656e7420646174653a20466562727561727920352c20323032332920546a20542a2045540a2e313231353639202e313630373834202e3134353039382072670a4254202f463220313020546620313220544c2045540a425420312030203020312034362036343220546d20285345525649434520464f522920546a20542a2045540a4254202f46322031332054662031352e3620544c2045540a425420312030203020312034362036323220546d202853796e7468657469632043616c69666f726e6961206f66666963652920546a20542a2045540a4254202f463120313020546620313220544c2045540a425420312030203020312034362036303520546d2028313030204578616d706c65205761792920546a20542a2045540a425420312030203020312034362035393020546d20284f616b6c616e642c2043412039343630372920546a20542a2045540a2e393333333333202e393536383633202e3934313137362072670a6e0a33353820353732206d0a35333820353732206c0a3534322e343232342035373220353436203537352e35373736203534362035383020630a35343620363436206c0a353436203635302e34323234203534322e3432323420363534203533382036353420630a33353820363534206c0a3335332e353737362036353420333530203635302e34323234203335302036343620630a33353020353830206c0a333530203537352e35373736203335332e3537373620353732203335382035373220630a680a662a0a2e343037383433202e3435303938202e3433313337332072670a4254202f4632203820546620392e3620544c2045540a42542031203020302031203337302036333220546d2028414d4f554e54204455452920546a20542a2045540a2e303836323735202e313936303738202e3136383632372072670a4254202f463220323520546620333020544c2045540a42542031203020302031203337302036303420546d202824322c3135302e37302920546a20542a2045540a2e343037383433202e3435303938202e3433313337332072670a4254202f463120392054662031302e3820544c2045540a42542031203020302031203337302035383720546d20284475652046656272756172792032322c20323032332920546a20542a2045540a2e313231353639202e313630373834202e3134353039382072670a4254202f463220313020546620313220544c2045540a425420312030203020312034362035343020546d202853544154454d454e542044455441494c532920546a20542a2045540a2e3835303938202e383836323735202e3836363636372052470a6e20343620353034206d2035343620353034206c20530a2e343037383433202e3435303938202e3433313337332072670a4254202f463120392054662031302e3820544c2045540a425420312030203020312034362035313420546d20284143434f554e542920546a20542a2045540a2e313231353639202e313630373834202e3134353039382072670a4254202f46322031312054662031332e3220544c2045540a42542031203020302031203435352e3533362035313420546d202853594e5448455449432d303030312920546a20542a2045540a2e3835303938202e383836323735202e3836363636372052470a6e20343620343636206d2035343620343636206c20530a2e343037383433202e3435303938202e3433313337332072670a4254202f463120392054662031302e3820544c2045540a425420312030203020312034362034373620546d202842494c4c204e554d4245522920546a20542a2045540a2e313231353639202e313630373834202e3134353039382072670a4254202f46322031312054662031332e3220544c2045540a42542031203020302031203435392e3831352034373620546d202853594e2d43412d323032332d30312920546a20542a2045540a2e3835303938202e383836323735202e3836363636372052470a6e20343620343238206d2035343620343238206c20530a2e343037383433202e3435303938202e3433313337332072670a4254202f463120392054662031302e3820544c2045540a425420312030203020312034362034333820546d20285345525649434520504552494f442920546a20542a2045540a2e313231353639202e313630373834202e3134353039382072670a4254202f46322031312054662031332e3220544c2045540a42542031203020302031203339362e3830372034333820546d20284a616e756172792031202d204a616e756172792033312c20323032332920546a20542a2045540a2e3835303938202e383836323735202e3836363636372052470a6e20343620333930206d2035343620333930206c20530a2e343037383433202e3435303938202e3433313337332072670a4254202f463120392054662031302e3820544c2045540a425420312030203020312034362034303020546d2028454c4543545249434954592055534147452920546a20542a2045540a2e313231353639202e313630373834202e3134353039382072670a4254202f46322031312054662031332e3220544c2045540a42542031203020302031203438362e3038332034303020546d202831322c333435206b57682920546a20542a2045540a2e303836323735202e313936303738202e3136383632372072670a4254202f46322031332054662031352e3620544c2045540a425420312030203020312034362033343420546d202855736167652073756d6d6172792920546a20542a2045540a2e393333333333202e393536383633202e3934313137362072670a6e0a353420323430206d0a35333820323430206c0a3534322e343232342032343020353436203234332e35373736203534362032343820630a35343620333134206c0a353436203331382e34323234203534322e3432323420333232203533382033323220630a353420333232206c0a34392e3537373620333232203436203331382e343232342034362033313420630a343620323438206c0a3436203234332e353737362034392e35373736203234302035342032343020630a680a662a0a2e343037383433202e3435303938202e3433313337332072670a4254202f463120392054662031302e3820544c2045540a425420312030203020312036362032393620546d20284d45544552454420454c4543545249434954592920546a20542a2045540a2e333039383034202e343738343331202e3339363037382072670a6e203636203235372033363020313820726520662a0a2e303836323735202e313936303738202e3136383632372072670a4254202f46322031322054662031342e3420544c2045540a42542031203020302031203433382032363020546d202831322c333435206b57682920546a20542a2045540a2e343037383433202e3435303938202e3433313337332072670a4254202f4631203820546620392e3620544c2045540a4254203120302030203120343620373420546d20285468697320646f63756d656e742069732066696374696f6e616c20616e6420636f6e7461696e73206e6f20637573746f6d657220646174612e2043726561746564206f6e6c7920666f72204e65757665747261204d3535206c6f63616c2074657374696e672e2920546a20542a2045540a42542031203020302031203530352e303820373420546d2028506167652031206f6620312920546a20542a2045540a200a656e6473747265616d0a656e646f626a0a787265660a3020390a303030303030303030302036353533352066200a30303030303030303631203030303030206e200a30303030303030313032203030303030206e200a30303030303030323039203030303030206e200a30303030303030333231203030303030206e200a30303030303030353134203030303030206e200a30303030303030353832203030303030206e200a30303030303030393338203030303030206e200a30303030303030393937203030303030206e200a747261696c65720a3c3c0a2f4944200a5b3c33663538386330306164333534336635343264356134393131313034643439323e3c33663538386330306164333534336635343264356134393131313034643439323e5d0a25205265706f72744c61622067656e6572617465642050444620646f63756d656e74202d2d2064696765737420286f70656e736f75726365290a0a2f496e666f2036203020520a2f526f6f742035203020520a2f53697a6520390a3e3e0a7374617274787265660a343231340a2525454f460a', 'hex')
     or original_name <> 'neuvetra-m55-synthetic-electricity-bill.pdf' then
    raise exception 'synthetic bill fixture mismatch' using errcode = '22023';
  end if;

  insert into neuvetra.bill_evidence values
    (evidence_id, target_company_id, original_name, 'application/pdf', octet_length(original_bytes), original_sha256, original_bytes, actor_id, now())
    on conflict on constraint bill_evidence_company_id_sha256_key do nothing returning id into stored_evidence_id;
  if stored_evidence_id is null then
    select id into stored_evidence_id from neuvetra.bill_evidence where company_id = target_company_id and sha256 = original_sha256;
    return stored_evidence_id;
  end if;
  insert into neuvetra.extraction_jobs values
    (job_id, target_company_id, evidence_id, 'm55-fixed-pdf-v1', 'completed',
     '{"supplier_name":"Synthetic Golden State Electric","account_label":"SYNTHETIC-0001","bill_number":"SYN-CA-2023-01","service_period_start":"2023-01-01","service_period_end":"2023-01-31","electricity_kwh":"12345.000","unit":"kWh","facility_id":null,"source_locators":{"service_period":{"start_byte":3119,"end_byte":3147},"electricity_kwh":{"start_byte":3384,"end_byte":3394}}}'::jsonb,
     actor_id, now());
  insert into neuvetra.bill_versions values
    (bill_version_id, target_company_id, evidence_id, null, null, 1, 'Synthetic Golden State Electric', 'SYN-CA-2023-01', '2023-01-01', '2023-01-31', 12345.000, null, actor_id, now());
  insert into neuvetra.evidence_search_documents values
    (search_id, target_company_id, evidence_id, 'synthetic electricity bill january 2023', now());
  insert into neuvetra.bill_summary_cache values
    (cache_id, target_company_id, evidence_id, bill_version_id, '{"state":"needs_review","period":"2023-01","electricity_kwh":"12345.000","unit":"kWh","version":1}'::jsonb, now());
  insert into neuvetra.evidence_audit_log values
    (log_id, target_company_id, actor_id, 'bill.ingested', evidence_id, jsonb_build_object('sha256', original_sha256, 'byte_length', octet_length(original_bytes)), now());
  return stored_evidence_id;
end
$$;

create function neuvetra.correct_synthetic_bill(
  target_company_id uuid, target_facility_id uuid, evidence_id uuid, prior_bill_version_id uuid,
  bill_version_id uuid, cache_id uuid, log_id uuid, corrected_kwh numeric, requested_reason text
) returns uuid
language plpgsql security definer
set search_path = neuvetra, pg_temp
as $$
declare actor_id uuid := neuvetra.current_user_id(); stored_version_id uuid;
begin
  if actor_id is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if not neuvetra.can_manage_company(target_company_id) then raise exception 'workspace not found' using errcode = '42501'; end if;
  if corrected_kwh <> 12346.000 or requested_reason <> 'Synthetic review exercise' then
    raise exception 'synthetic correction mismatch' using errcode = '22023';
  end if;

  insert into neuvetra.bill_versions
    select bill_version_id, prior.company_id, prior.evidence_id, target_facility_id, prior.id, 2, prior.supplier_name, prior.bill_number,
      prior.service_period_start, prior.service_period_end, corrected_kwh, requested_reason, actor_id, now()
    from neuvetra.bill_versions prior
    where prior.id = prior_bill_version_id and prior.company_id = target_company_id and prior.evidence_id = correct_synthetic_bill.evidence_id and prior.version = 1
    on conflict on constraint bill_versions_evidence_id_version_key do nothing returning id into stored_version_id;
  if stored_version_id is null then
    select existing.id into stored_version_id from neuvetra.bill_versions existing where existing.company_id = target_company_id and existing.evidence_id = correct_synthetic_bill.evidence_id and existing.version = 2;
    if stored_version_id is null then raise exception 'bill not found' using errcode = '42501'; end if;
    return stored_version_id;
  end if;

  insert into neuvetra.bill_summary_cache values
    (cache_id, target_company_id, evidence_id, bill_version_id, '{"state":"reviewed","period":"2023-01","electricity_kwh":"12346.000","unit":"kWh","version":2}'::jsonb, now());
  insert into neuvetra.evidence_audit_log values
    (log_id, target_company_id, actor_id, 'bill.corrected', bill_version_id,
     jsonb_build_object('reason_recorded', true, 'previous_version_id', prior_bill_version_id), now());
  return stored_version_id;
end
$$;

create function neuvetra.link_synthetic_bill(
  target_company_id uuid, target_boundary_id uuid, target_facility_id uuid,
  bill_version_id uuid, activity_id uuid, log_id uuid
) returns uuid
language plpgsql security definer
set search_path = neuvetra, pg_temp
as $$
declare actor_id uuid := neuvetra.current_user_id(); stored_activity_id uuid;
begin
  if actor_id is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if not neuvetra.can_manage_company(target_company_id) then raise exception 'workspace not found' using errcode = '42501'; end if;

  insert into neuvetra.inventory_activity_versions
    select activity_id, target_company_id, target_boundary_id, target_facility_id, reviewed.id, null, 1,
      12.346000, 'MWh', 'draft', actor_id, now()
    from neuvetra.bill_versions reviewed
    where reviewed.id = bill_version_id and reviewed.company_id = target_company_id and reviewed.facility_id = target_facility_id
      and reviewed.version = 2 and reviewed.service_period_start >= '2023-01-01' and reviewed.service_period_end <= '2023-12-31'
      and exists (
        select 1 from neuvetra.reporting_boundaries boundary_record
        join neuvetra.boundary_facilities included on included.company_id = boundary_record.company_id and included.boundary_id = boundary_record.id
        where boundary_record.id = target_boundary_id and boundary_record.company_id = target_company_id
          and boundary_record.reporting_year = 2023 and boundary_record.approach = 'operational_control'
          and boundary_record.status = 'draft' and boundary_record.version = 1
          and included.facility_id = target_facility_id and included.included = true
      )
    on conflict on constraint inventory_activity_versions_bill_version_id_key do nothing returning id into stored_activity_id;
  if stored_activity_id is null then
    select existing.id into stored_activity_id from neuvetra.inventory_activity_versions existing where existing.company_id = target_company_id and existing.bill_version_id = link_synthetic_bill.bill_version_id;
    if stored_activity_id is null then raise exception 'reviewed bill not found' using errcode = '42501'; end if;
    return stored_activity_id;
  end if;

  insert into neuvetra.evidence_audit_log values
    (log_id, target_company_id, actor_id, 'bill.linked', activity_id, jsonb_build_object('bill_version_id', bill_version_id), now());
  return stored_activity_id;
end
$$;

revoke all on function neuvetra.ingest_synthetic_bill(uuid, uuid, uuid, uuid, uuid, uuid, uuid, bytea, text, text) from public;
revoke all on function neuvetra.correct_synthetic_bill(uuid, uuid, uuid, uuid, uuid, uuid, uuid, numeric, text) from public;
revoke all on function neuvetra.link_synthetic_bill(uuid, uuid, uuid, uuid, uuid, uuid) from public;
grant execute on function neuvetra.ingest_synthetic_bill(uuid, uuid, uuid, uuid, uuid, uuid, uuid, bytea, text, text) to authenticated;
grant execute on function neuvetra.correct_synthetic_bill(uuid, uuid, uuid, uuid, uuid, uuid, uuid, numeric, text) to authenticated;
grant execute on function neuvetra.link_synthetic_bill(uuid, uuid, uuid, uuid, uuid, uuid) to authenticated;
grant select on neuvetra.bill_evidence, neuvetra.extraction_jobs, neuvetra.bill_versions,
  neuvetra.inventory_activity_versions, neuvetra.evidence_search_documents,
  neuvetra.bill_summary_cache, neuvetra.evidence_audit_log to authenticated;
