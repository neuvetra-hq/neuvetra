create schema neuvetra_beta;
revoke all on schema neuvetra_beta from public;
alter default privileges in schema neuvetra_beta revoke all on tables from public;
alter default privileges in schema neuvetra_beta revoke all on sequences from public;
alter default privileges in schema neuvetra_beta revoke execute on functions from public;

create table neuvetra_beta.target (
  singleton boolean primary key default true check (singleton),
  profile text not null check (profile = 'neuvetra.beta-access.synthetic-rehearsal.v1'),
  database_name text not null,
  runtime_role text not null,
  owner_role text not null,
  operator_role text not null,
  module_name text not null check (module_name = '0001_access.sql'),
  module_sha256 text not null check (module_sha256 ~ '^[0-9a-f]{64}$'),
  fixture_manifest_sha256 text not null check (fixture_manifest_sha256 ~ '^[0-9a-f]{64}$')
);

create table neuvetra_beta.schema_migrations (
  name text primary key,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  applied_at timestamptz not null default clock_timestamp()
);

create table neuvetra_beta.baseline_receipts (
  name text primary key,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$')
);

create table neuvetra_beta.tenant_admissions (
  company_id uuid primary key references neuvetra.companies(id),
  admission_id uuid not null unique,
  fixture_manifest_sha256 text not null check (fixture_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  display_label text not null check (display_label ~ '^[A-Za-z0-9 ._-]{1,80}$'),
  data_classification text not null check (data_classification = 'synthetic_rehearsal'),
  active boolean not null default true,
  tombstoned_at timestamptz,
  admitted_at timestamptz not null default clock_timestamp(),
  unique (company_id, admission_id),
  check (not active or tombstoned_at is null)
);

create table neuvetra_beta.invitations (
  id uuid primary key,
  company_id uuid not null,
  admission_id uuid not null,
  token_digest text not null unique check (token_digest ~ '^[0-9a-f]{64}$'),
  recipient_email text not null check (recipient_email = lower(btrim(recipient_email)) and recipient_email ~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9][a-z0-9.-]*\.[a-z]{2,63}$'),
  role text not null check (role in ('owner', 'member')),
  status text not null default 'pending' check (status in ('pending', 'redeemed', 'revoked')),
  issued_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  issuer_decision_reference text not null check (issuer_decision_reference ~ '^[A-Za-z0-9._:/-]{1,160}$'),
  redeemed_by uuid,
  redeemed_at timestamptz,
  redeemed_request_id uuid,
  unique (company_id, id),
  foreign key (company_id, admission_id) references neuvetra_beta.tenant_admissions(company_id, admission_id),
  check (expires_at > issued_at),
  check ((status = 'redeemed') = (redeemed_by is not null and redeemed_at is not null and redeemed_request_id is not null))
);

create table neuvetra_beta.memberships (
  company_id uuid not null references neuvetra_beta.tenant_admissions(company_id),
  user_id uuid not null,
  role text not null check (role in ('owner', 'member')),
  active boolean not null default true,
  source_invitation_id uuid not null,
  generation bigint not null default 1 check (generation > 0),
  admitted_at timestamptz not null default clock_timestamp(),
  revoked_at timestamptz,
  primary key (company_id, user_id),
  foreign key (company_id, source_invitation_id) references neuvetra_beta.invitations(company_id, id),
  check ((active and revoked_at is null) or (not active and revoked_at is not null))
);

create table neuvetra_beta.requests (
  actor_id uuid not null,
  request_id uuid not null,
  token_digest text not null check (token_digest ~ '^[0-9a-f]{64}$'),
  invitation_id uuid not null,
  company_id uuid not null,
  admission_id uuid not null,
  role text not null check (role in ('owner', 'member')),
  membership_generation bigint not null check (membership_generation > 0),
  committed_at timestamptz not null default clock_timestamp(),
  primary key (actor_id, request_id),
  foreign key (company_id, invitation_id) references neuvetra_beta.invitations(company_id, id),
  foreign key (company_id, actor_id) references neuvetra_beta.memberships(company_id, user_id)
);

create table neuvetra_beta.audit (
  id uuid primary key,
  event_type text not null check (event_type in ('admission_created', 'invitation_issued', 'invitation_redeemed', 'invitation_revoked', 'membership_revoked', 'admission_disabled', 'admission_tombstoned')),
  company_id uuid not null,
  invitation_id uuid,
  actor_id uuid,
  membership_generation bigint,
  created_at timestamptz not null default clock_timestamp(),
  decision_reference text not null check (decision_reference ~ '^[A-Za-z0-9._:/-]{1,160}$')
);

create function neuvetra_beta.assert_runtime_target() returns void
language plpgsql security definer
set search_path = pg_catalog, neuvetra_beta, auth, pg_temp
as $$
declare expected neuvetra_beta.target%rowtype;
begin
  select * into strict expected from neuvetra_beta.target;
  if current_database() <> expected.database_name or session_user <> expected.runtime_role or current_user <> expected.operator_role then
    raise exception 'beta access unavailable' using errcode = '55000';
  end if;
  if not exists (
      select 1 from pg_roles r where r.rolname = expected.runtime_role
        and not r.rolsuper and not r.rolinherit and not r.rolcreatedb and not r.rolcreaterole
        and not r.rolreplication and not r.rolbypassrls
        and not exists (select 1 from pg_auth_members where member = r.oid or roleid = r.oid)
    )
    or not exists (
      select 1 from pg_roles r where r.rolname = expected.owner_role
        and not r.rolcanlogin and not r.rolsuper and not r.rolinherit and not r.rolcreatedb and not r.rolcreaterole
        and not r.rolreplication and not r.rolbypassrls
        and not exists (select 1 from pg_auth_members where member = r.oid or roleid = r.oid)
    )
    or not has_schema_privilege(expected.runtime_role, 'neuvetra_beta', 'USAGE')
    or has_schema_privilege(expected.runtime_role, 'neuvetra_beta', 'CREATE')
    or has_schema_privilege(expected.runtime_role, 'neuvetra', 'USAGE')
    or has_schema_privilege(expected.runtime_role, 'auth', 'USAGE')
    or exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname in ('neuvetra_beta', 'neuvetra', 'auth') and c.relkind in ('r','p','v','m','f')
        and has_table_privilege(expected.runtime_role, c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    )
    or exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname in ('neuvetra_beta', 'neuvetra', 'auth')
        and case when c.relkind = 'S' then has_sequence_privilege(expected.runtime_role, c.oid, 'USAGE,SELECT,UPDATE') else false end
    )
    or (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'neuvetra_beta' and has_function_privilege(expected.runtime_role, p.oid, 'EXECUTE')) <> 3
    or exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'neuvetra_beta' and has_function_privilege(expected.runtime_role, p.oid, 'EXECUTE')
        and (p.proname, pg_get_function_identity_arguments(p.oid)) not in (
          ('redeem_invitation', 'token_digest text, request_id uuid, verified_email text'),
          ('read_session', ''),
          ('read_workspace', 'requested_company_id uuid')
        )
    )
    or not has_schema_privilege(expected.owner_role, 'neuvetra_beta', 'USAGE,CREATE')
    or has_schema_privilege(expected.owner_role, 'auth', 'USAGE')
    or has_schema_privilege(expected.owner_role, 'neuvetra', 'USAGE')
    or exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname in ('neuvetra', 'auth') and c.relkind in ('r','p','v','m','f')
        and has_table_privilege(expected.owner_role, c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    )
    or exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname in ('neuvetra', 'auth')
        and case when c.relkind = 'S' then has_sequence_privilege(expected.owner_role, c.oid, 'USAGE,SELECT,UPDATE') else false end
    )
    or exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('neuvetra', 'auth') and has_function_privilege(expected.owner_role, p.oid, 'EXECUTE')
    )
    or (select pg_get_userbyid(nspowner) from pg_namespace where nspname = 'neuvetra_beta') <> expected.owner_role
    or (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'neuvetra_beta' and c.relkind = 'r'
          and pg_get_userbyid(c.relowner) = expected.owner_role) <> 8
    or (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'neuvetra_beta' and c.relkind = 'r') <> 8
    or (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'neuvetra_beta') <> 5
    or exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'neuvetra_beta' and (
        (p.proname in ('assert_runtime_target','require_identity') and pg_get_userbyid(p.proowner) <> expected.operator_role)
        or (p.proname in ('redeem_invitation','read_session','read_workspace') and pg_get_userbyid(p.proowner) <> expected.owner_role)
        or p.proname not in ('assert_runtime_target','require_identity','redeem_invitation','read_session','read_workspace')
      )
    )
    or exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
        lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      where n.nspname = 'neuvetra_beta' and a.grantee = 0 and a.privilege_type = 'EXECUTE'
    )
    or (select count(*) from pg_default_acl d join pg_roles r on r.oid = d.defaclrole
        where r.rolname = expected.owner_role) <> 1
    or not exists (
      select 1 from pg_default_acl d join pg_roles r on r.oid = d.defaclrole
      where r.rolname = expected.owner_role and d.defaclnamespace = 0 and d.defaclobjtype = 'f'
        and not exists (select 1 from aclexplode(d.defaclacl) a where a.grantee = 0 and a.privilege_type = 'EXECUTE')
    )
    or not has_function_privilege(expected.owner_role, 'neuvetra_beta.assert_runtime_target()', 'EXECUTE')
    or not has_function_privilege(expected.owner_role, 'neuvetra_beta.require_identity(text)', 'EXECUTE')
    or has_function_privilege(expected.runtime_role, 'neuvetra_beta.assert_runtime_target()', 'EXECUTE')
    or has_function_privilege(expected.runtime_role, 'neuvetra_beta.require_identity(text)', 'EXECUTE')
    or exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
        lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      join pg_roles grantee on grantee.oid = a.grantee
      where n.nspname = 'neuvetra_beta'
        and p.proname in ('assert_runtime_target','require_identity')
        and grantee.rolname not in (expected.operator_role, expected.owner_role)
    )
    or exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
        lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      join pg_roles grantee on grantee.oid = a.grantee
      where n.nspname = 'neuvetra_beta'
        and p.proname in ('redeem_invitation','read_session','read_workspace')
        and grantee.rolname not in (expected.owner_role, expected.runtime_role)
    ) then
    raise exception 'beta access unavailable' using errcode = '55000';
  end if;
  if (select count(*) from neuvetra.schema_migrations) <> 22
    or exists (
      (select name, sha256 from neuvetra.schema_migrations except select name, sha256 from neuvetra_beta.baseline_receipts)
      union all
      (select name, sha256 from neuvetra_beta.baseline_receipts except select name, sha256 from neuvetra.schema_migrations)
    )
    or (select count(*) from neuvetra_beta.schema_migrations where name = expected.module_name and sha256 = expected.module_sha256) <> 1
    or (select count(*) from neuvetra_beta.schema_migrations) <> 1 then
    raise exception 'beta access unavailable' using errcode = '55000';
  end if;
end $$;

create function neuvetra_beta.require_identity(supplied_email text) returns uuid
language plpgsql security definer
set search_path = pg_catalog, neuvetra_beta, auth, pg_temp
as $$
declare
  actor uuid := auth.uid();
  stored_email text;
  normalized_email text := lower(btrim(supplied_email));
begin
  if actor is null then return null; end if;
  if supplied_email is null then
    raise exception 'invitation unavailable' using errcode = 'P0002';
  end if;
  select lower(btrim(email)) into stored_email
  from auth.users
  where id = actor and email_confirmed_at is not null and email is not null
  for update;
  if not found or stored_email <> normalized_email then
    raise exception 'invitation unavailable' using errcode = 'P0002';
  end if;
  return actor;
end $$;

-- beta-owner-entrypoints-begin
create function neuvetra_beta.redeem_invitation(token_digest text, request_id uuid, verified_email text)
returns table(company_id uuid, role text, membership_generation bigint, state text, replayed boolean)
language plpgsql security definer
set search_path = pg_catalog, neuvetra_beta, pg_temp
as $$
#variable_conflict use_column
declare
  actor uuid;
  normalized_email text := lower(btrim(verified_email));
  prior neuvetra_beta.requests%rowtype;
  invitation neuvetra_beta.invitations%rowtype;
  admission neuvetra_beta.tenant_admissions%rowtype;
  member neuvetra_beta.memberships%rowtype;
begin
  perform neuvetra_beta.assert_runtime_target();
  if token_digest !~ '^[0-9a-f]{64}$' or request_id is null or normalized_email !~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9][a-z0-9.-]*\.[a-z]{2,63}$' then
    raise exception 'invitation unavailable' using errcode = 'P0002';
  end if;
  actor := neuvetra_beta.require_identity(normalized_email);
  if actor is null then raise exception 'invitation unavailable' using errcode = 'P0002'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text, 80253));

  select * into prior from neuvetra_beta.requests r where r.actor_id = actor and r.request_id = redeem_invitation.request_id;
  if found then
    if prior.token_digest <> redeem_invitation.token_digest then
      raise exception 'request conflict' using errcode = '23505';
    end if;
    select * into admission from neuvetra_beta.tenant_admissions a where a.company_id = prior.company_id for update;
    select * into invitation from neuvetra_beta.invitations i where i.id = prior.invitation_id for update;
    select * into member from neuvetra_beta.memberships m where m.company_id = prior.company_id and m.user_id = actor for update;
    if not found or not admission.active or admission.tombstoned_at is not null or admission.fixture_manifest_sha256 <> (select fixture_manifest_sha256 from neuvetra_beta.target)
      or admission.admission_id <> prior.admission_id
      or invitation.company_id <> prior.company_id or invitation.admission_id <> prior.admission_id
      or invitation.status <> 'redeemed' or invitation.recipient_email <> normalized_email or invitation.redeemed_by <> actor
      or invitation.redeemed_request_id <> prior.request_id or invitation.token_digest <> prior.token_digest
      or not member.active or member.generation <> prior.membership_generation or member.role <> prior.role
      or member.source_invitation_id <> prior.invitation_id then
      raise exception 'invitation unavailable' using errcode = 'P0002';
    end if;
    company_id := prior.company_id; role := prior.role; membership_generation := prior.membership_generation;
    state := 'access_admitted_setup_pending'; replayed := true; return next; return;
  end if;

  select * into invitation from neuvetra_beta.invitations i where i.token_digest = redeem_invitation.token_digest;
  if not found then raise exception 'invitation unavailable' using errcode = 'P0002'; end if;
  select * into admission from neuvetra_beta.tenant_admissions a where a.company_id = invitation.company_id for update;
  select * into invitation from neuvetra_beta.invitations i where i.id = invitation.id for update;
  if not found or not admission.active or admission.tombstoned_at is not null
    or admission.admission_id <> invitation.admission_id or admission.fixture_manifest_sha256 <> (select fixture_manifest_sha256 from neuvetra_beta.target)
    or invitation.status <> 'pending' or invitation.expires_at <= clock_timestamp() or invitation.recipient_email <> normalized_email then
    raise exception 'invitation unavailable' using errcode = 'P0002';
  end if;
  if exists (select 1 from neuvetra_beta.memberships m where m.company_id = invitation.company_id and m.user_id = actor) then
    raise exception 'invitation unavailable' using errcode = 'P0002';
  end if;
  insert into neuvetra_beta.memberships(company_id, user_id, role, source_invitation_id)
  values(invitation.company_id, actor, invitation.role, invitation.id)
  returning * into member;
  update neuvetra_beta.invitations set status = 'redeemed', redeemed_by = actor,
    redeemed_at = clock_timestamp(), redeemed_request_id = redeem_invitation.request_id where id = invitation.id;
  insert into neuvetra_beta.requests(actor_id, request_id, token_digest, invitation_id, company_id, admission_id, role, membership_generation)
  values(actor, redeem_invitation.request_id, redeem_invitation.token_digest, invitation.id, invitation.company_id, invitation.admission_id, invitation.role, member.generation);
  insert into neuvetra_beta.audit(id, event_type, company_id, invitation_id, actor_id, membership_generation, decision_reference)
  values(gen_random_uuid(), 'invitation_redeemed', invitation.company_id, invitation.id, actor, member.generation, invitation.issuer_decision_reference);
  company_id := invitation.company_id; role := invitation.role; membership_generation := member.generation;
  state := 'access_admitted_setup_pending'; replayed := false; return next;
end $$;

create function neuvetra_beta.read_session()
returns table(company_id uuid, role text, membership_generation bigint, display_label text, state text)
language plpgsql security definer
set search_path = pg_catalog, neuvetra_beta, pg_temp
as $$
declare actor uuid;
begin
  perform neuvetra_beta.assert_runtime_target();
  actor := neuvetra_beta.require_identity(current_setting('request.jwt.claim.email', true));
  if actor is null then return; end if;
  return query select m.company_id, m.role, m.generation, a.display_label, 'access_admitted_setup_pending'::text
  from neuvetra_beta.memberships m join neuvetra_beta.tenant_admissions a using(company_id)
  where m.user_id = actor and m.active and a.active and a.tombstoned_at is null
    and a.fixture_manifest_sha256 = (select fixture_manifest_sha256 from neuvetra_beta.target) order by m.company_id;
end $$;

create function neuvetra_beta.read_workspace(requested_company_id uuid)
returns table(company_id uuid, role text, membership_generation bigint, display_label text, state text)
language plpgsql security definer
set search_path = pg_catalog, neuvetra_beta, pg_temp
as $$
declare actor uuid;
begin
  perform neuvetra_beta.assert_runtime_target();
  actor := neuvetra_beta.require_identity(current_setting('request.jwt.claim.email', true));
  if actor is null then return; end if;
  return query select m.company_id, m.role, m.generation, a.display_label, 'access_admitted_setup_pending'::text
  from neuvetra_beta.memberships m join neuvetra_beta.tenant_admissions a using(company_id)
  where m.user_id = actor and m.company_id = requested_company_id and m.active and a.active and a.tombstoned_at is null
    and a.fixture_manifest_sha256 = (select fixture_manifest_sha256 from neuvetra_beta.target);
end $$;
-- beta-owner-entrypoints-end

revoke all on all tables in schema neuvetra_beta from public;
revoke all on all sequences in schema neuvetra_beta from public;
revoke all on all functions in schema neuvetra_beta from public;

do $$
declare table_name text;
begin
  foreach table_name in array array['target','schema_migrations','baseline_receipts','tenant_admissions','invitations','memberships','requests','audit'] loop
    execute format('alter table neuvetra_beta.%I enable row level security', table_name);
    execute format('alter table neuvetra_beta.%I force row level security', table_name);
    execute format('create policy owner_only on neuvetra_beta.%I using (current_user = pg_get_userbyid((select c.relowner from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname=''neuvetra_beta'' and c.relname=%L))) with check (current_user = pg_get_userbyid((select c.relowner from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname=''neuvetra_beta'' and c.relname=%L)))', table_name, table_name, table_name);
  end loop;
end $$;
