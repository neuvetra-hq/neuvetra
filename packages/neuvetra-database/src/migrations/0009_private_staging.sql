-- M63 is explicitly installed only on a dedicated private synthetic staging target.
-- Role credentials are provisioned separately; this migration never contains a password.
create role neuvetra_runtime nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
revoke create on schema public from public;
revoke all on schema neuvetra from public, authenticated;
revoke all on all tables in schema neuvetra from public, authenticated;
revoke all on all functions in schema neuvetra from public, authenticated;
alter default privileges in schema neuvetra revoke all on tables from public, authenticated, neuvetra_runtime;
alter default privileges in schema neuvetra revoke execute on functions from public, authenticated, neuvetra_runtime;
alter default privileges in schema neuvetra revoke all on sequences from public, authenticated, neuvetra_runtime;

create table neuvetra.staging_access (
 user_id uuid primary key references auth.users(id),
 company_id uuid references neuvetra.companies(id),
 active boolean not null default false,
 approved_at timestamptz not null default now()
);
alter table neuvetra.staging_access enable row level security;
alter table neuvetra.staging_access force row level security;

-- All existing mutation functions use current_user_id()/can_manage_company().
-- An inactive invitation therefore denies the security-definer path itself.
create or replace function neuvetra.current_user_id() returns uuid
language sql stable security definer set search_path=pg_catalog,neuvetra,pg_temp as $$
 select a.user_id from neuvetra.staging_access a where a.user_id=auth.uid() and a.active
$$;
create function neuvetra.has_staging_access() returns boolean
language sql stable security definer set search_path=pg_catalog,neuvetra,pg_temp as $$
 select exists(select 1 from neuvetra.staging_access a
 join neuvetra.company_members m on m.user_id=a.user_id and m.company_id=a.company_id
 where a.user_id=auth.uid() and a.active)
$$;
-- Tie membership to the approved workspace as well as the active invitation.
create or replace function neuvetra.is_company_member(target_company_id uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,neuvetra,pg_temp as $$
 select exists(select 1 from neuvetra.company_members m join neuvetra.staging_access a
 on a.user_id=m.user_id and a.company_id=m.company_id
 where m.company_id=target_company_id and m.user_id=auth.uid() and a.active)
$$;
create or replace function neuvetra.can_manage_company(target_company_id uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,neuvetra,pg_temp as $$
 select exists(select 1 from neuvetra.company_members m join neuvetra.staging_access a
 on a.user_id=m.user_id and a.company_id=m.company_id
 where m.company_id=target_company_id and m.user_id=auth.uid() and a.active and m.role in ('owner','admin'))
$$;

-- Copy only the existing SELECT policies to the dedicated role; never inherit authenticated.
do $$ declare p record; begin
 for p in select tablename,policyname,qual from pg_policies where schemaname='neuvetra' and cmd='SELECT' loop
  execute format('create policy %I on neuvetra.%I for select to neuvetra_runtime using (%s)', 'm63_'||p.policyname,p.tablename,p.qual);
  execute format('grant select on neuvetra.%I to neuvetra_runtime',p.tablename);
 end loop;
end $$;
grant usage on schema neuvetra to neuvetra_runtime;
grant execute on function neuvetra.current_user_id(),neuvetra.has_staging_access(),neuvetra.is_company_member(uuid),neuvetra.can_manage_company(uuid) to neuvetra_runtime;
revoke all on function neuvetra.current_user_id(),neuvetra.has_staging_access(),neuvetra.is_company_member(uuid),neuvetra.can_manage_company(uuid) from public,authenticated;

-- Exact domain entrypoint allowlist. No table writes, workspace/member creation,
-- provisioning, trigger helpers or arbitrary execution granted to the web login.
grant execute on function neuvetra.ingest_synthetic_bill(uuid,uuid,uuid,uuid,uuid,uuid,uuid,bytea,text,text) to neuvetra_runtime;
grant execute on function neuvetra.correct_synthetic_bill(uuid,uuid,uuid,uuid,uuid,uuid,uuid,numeric,text) to neuvetra_runtime;
grant execute on function neuvetra.link_synthetic_bill(uuid,uuid,uuid,uuid,uuid,uuid) to neuvetra_runtime;
grant execute on function neuvetra.create_synthetic_bill_calculation(uuid,uuid,uuid,uuid,uuid,uuid,text,text) to neuvetra_runtime;
grant execute on function neuvetra.create_synthetic_scope2_inventory(uuid,uuid,uuid,uuid,uuid,text,text) to neuvetra_runtime;
grant execute on function neuvetra.record_synthetic_inventory_review(uuid,uuid,uuid,uuid,text,text,text[],uuid,text) to neuvetra_runtime;
grant execute on function neuvetra.create_annual_source_register(uuid,uuid,uuid,uuid,text,text,uuid,text) to neuvetra_runtime;
grant execute on function neuvetra.complete_annual_source_register(uuid,uuid,uuid,uuid,text,text,text,uuid,text) to neuvetra_runtime;
grant execute on function neuvetra.create_annual_inventory_v2(uuid,uuid,uuid,uuid,text,text,uuid,text) to neuvetra_runtime;
grant execute on function neuvetra.review_annual_inventory_v2(uuid,uuid,uuid,uuid,text,text,text[],uuid,text) to neuvetra_runtime;
grant execute on function neuvetra.create_inventory_evidence_pack(uuid,uuid,uuid,uuid,text,text,text,bytea,text,integer,uuid,text) to neuvetra_runtime;
grant execute on function neuvetra.create_inventory_draft_report(uuid,uuid,uuid,uuid,uuid,text,text,bytea,text,integer,text,text,uuid,text) to neuvetra_runtime;
grant execute on function neuvetra.review_inventory_draft_report(uuid,uuid,uuid,uuid,uuid,text,text,text[],text,text,text,text,text,text,text,uuid,text,uuid,text) to neuvetra_runtime;
