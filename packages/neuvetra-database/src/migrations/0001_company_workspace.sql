create schema if not exists neuvetra;

create type neuvetra.member_role as enum ('owner', 'admin', 'member');
create type neuvetra.boundary_approach as enum ('operational_control', 'financial_control', 'equity_share');
create type neuvetra.boundary_status as enum ('draft', 'under_review', 'approved');

create table neuvetra.companies (
  id uuid primary key,
  name text not null check (length(btrim(name)) between 1 and 120),
  country_code text not null check (country_code = 'US'),
  state_code text not null check (state_code = 'CA'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (created_by, name)
);

create table neuvetra.company_members (
  company_id uuid not null references neuvetra.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  role neuvetra.member_role not null,
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

create table neuvetra.facilities (
  id uuid primary key,
  company_id uuid not null references neuvetra.companies(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  country_code text not null check (country_code = 'US'),
  state_code text not null check (state_code = 'CA'),
  egrid_subregion text,
  created_at timestamptz not null default now(),
  unique (id, company_id)
);

create table neuvetra.reporting_boundaries (
  id uuid primary key,
  company_id uuid not null references neuvetra.companies(id) on delete cascade,
  reporting_year integer not null check (reporting_year between 1990 and 2100),
  approach neuvetra.boundary_approach not null,
  status neuvetra.boundary_status not null default 'draft',
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  unique (id, company_id),
  unique (company_id, reporting_year, version)
);

create table neuvetra.boundary_facilities (
  company_id uuid not null references neuvetra.companies(id) on delete cascade,
  boundary_id uuid not null,
  facility_id uuid not null,
  included boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (boundary_id, facility_id),
  foreign key (boundary_id, company_id) references neuvetra.reporting_boundaries(id, company_id) on delete cascade,
  foreign key (facility_id, company_id) references neuvetra.facilities(id, company_id) on delete cascade
);

create table neuvetra.audit_events (
  id uuid primary key,
  company_id uuid not null references neuvetra.companies(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id),
  event_type text not null check (event_type in ('workspace.created')),
  subject_id uuid not null,
  event_data jsonb not null,
  created_at timestamptz not null default now()
);

create function neuvetra.current_user_id() returns uuid
language sql stable
as $$ select auth.uid() $$;

create function neuvetra.is_company_member(target_company_id uuid) returns boolean
language sql stable security definer
set search_path = neuvetra, pg_temp
as $$
  select exists (
    select 1 from neuvetra.company_members
    where company_id = target_company_id and user_id = neuvetra.current_user_id()
  )
$$;

revoke all on function neuvetra.is_company_member(uuid) from public;
grant execute on function neuvetra.is_company_member(uuid) to authenticated;

create function neuvetra.can_manage_company(target_company_id uuid) returns boolean
language sql stable security definer
set search_path = neuvetra, pg_temp
as $$
  select exists (
    select 1 from neuvetra.company_members
    where company_id = target_company_id
      and user_id = neuvetra.current_user_id()
      and role in ('owner', 'admin')
  )
$$;

revoke all on function neuvetra.can_manage_company(uuid) from public;
grant execute on function neuvetra.can_manage_company(uuid) to authenticated;

alter table neuvetra.companies enable row level security;
alter table neuvetra.companies force row level security;
alter table neuvetra.company_members enable row level security;
alter table neuvetra.company_members force row level security;
alter table neuvetra.facilities enable row level security;
alter table neuvetra.facilities force row level security;
alter table neuvetra.reporting_boundaries enable row level security;
alter table neuvetra.reporting_boundaries force row level security;
alter table neuvetra.boundary_facilities enable row level security;
alter table neuvetra.boundary_facilities force row level security;
alter table neuvetra.audit_events enable row level security;
alter table neuvetra.audit_events force row level security;

create policy companies_member_select on neuvetra.companies
for select to authenticated using (neuvetra.is_company_member(id));
create policy members_member_select on neuvetra.company_members
for select to authenticated using (neuvetra.is_company_member(company_id));
create policy facilities_member_select on neuvetra.facilities
for select to authenticated using (neuvetra.is_company_member(company_id));
create policy facilities_manager_write on neuvetra.facilities
for all to authenticated using (neuvetra.can_manage_company(company_id))
with check (neuvetra.can_manage_company(company_id));
create policy boundaries_member_select on neuvetra.reporting_boundaries
for select to authenticated using (neuvetra.is_company_member(company_id));
create policy boundaries_manager_write on neuvetra.reporting_boundaries
for all to authenticated using (neuvetra.can_manage_company(company_id))
with check (neuvetra.can_manage_company(company_id));
create policy boundary_facilities_member_select on neuvetra.boundary_facilities
for select to authenticated using (neuvetra.is_company_member(company_id));
create policy boundary_facilities_manager_write on neuvetra.boundary_facilities
for all to authenticated using (neuvetra.can_manage_company(company_id))
with check (neuvetra.can_manage_company(company_id));
create policy audit_member_select on neuvetra.audit_events
for select to authenticated using (neuvetra.is_company_member(company_id));

create function neuvetra.create_company_workspace(
  company_id uuid,
  company_name text,
  facility_id uuid,
  facility_name text,
  boundary_id uuid,
  reporting_year integer,
  audit_event_id uuid
) returns uuid
language plpgsql security definer
set search_path = neuvetra, pg_temp
as $$
declare
  actor_id uuid := neuvetra.current_user_id();
begin
  if actor_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  insert into neuvetra.companies (id, name, country_code, state_code, created_by)
  values (company_id, btrim(company_name), 'US', 'CA', actor_id);
  insert into neuvetra.company_members (company_id, user_id, role)
  values (company_id, actor_id, 'owner');
  insert into neuvetra.facilities (id, company_id, name, country_code, state_code, egrid_subregion)
  values (facility_id, company_id, btrim(facility_name), 'US', 'CA', 'CAMX');
  insert into neuvetra.reporting_boundaries (id, company_id, reporting_year, approach)
  values (boundary_id, company_id, reporting_year, 'operational_control');
  insert into neuvetra.boundary_facilities (company_id, boundary_id, facility_id)
  values (company_id, boundary_id, facility_id);
  insert into neuvetra.audit_events (id, company_id, actor_user_id, event_type, subject_id, event_data)
  values (audit_event_id, company_id, actor_id, 'workspace.created', company_id,
    jsonb_build_object('boundary_id', boundary_id, 'facility_id', facility_id, 'version', 1));
  return company_id;
end
$$;

revoke all on function neuvetra.create_company_workspace(uuid, text, uuid, text, uuid, integer, uuid) from public;
grant execute on function neuvetra.create_company_workspace(uuid, text, uuid, text, uuid, integer, uuid) to authenticated;
grant usage on schema neuvetra to authenticated;
grant select on all tables in schema neuvetra to authenticated;
grant insert, update, delete on neuvetra.facilities, neuvetra.reporting_boundaries, neuvetra.boundary_facilities to authenticated;
