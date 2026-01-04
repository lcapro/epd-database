create type if not exists organization_role as enum ('owner', 'admin', 'member');

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role organization_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create or replace function public.is_org_member(org_id uuid, target_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from organization_members
    where organization_id = org_id
      and user_id = target_user_id
  );
$$;

create or replace function public.is_org_admin(org_id uuid, target_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from organization_members
    where organization_id = org_id
      and user_id = target_user_id
      and role in ('owner', 'admin')
  );
$$;

alter table if exists epds
  add column if not exists organization_id uuid references organizations(id) on delete set null;

alter table if exists epd_impacts
  add column if not exists organization_id uuid references organizations(id) on delete set null;

drop index if exists epds_unique_key_idx;
create unique index if not exists epds_unique_key_idx
  on epds (organization_id, product_name, producer_name, functional_unit, determination_method_version, pcr_version, database_version);

create index if not exists organizations_slug_idx on organizations (slug);
create index if not exists organization_members_org_id_idx on organization_members (organization_id);
create index if not exists organization_members_user_id_idx on organization_members (user_id);
create index if not exists epds_org_id_idx on epds (organization_id);
create index if not exists epd_impacts_org_id_idx on epd_impacts (organization_id);

alter table organizations enable row level security;
alter table organization_members enable row level security;
alter table epds enable row level security;
alter table epd_impacts enable row level security;

create policy "orgs_select_member"
  on organizations for select
  using (public.is_org_member(id));

create policy "orgs_insert_owner"
  on organizations for insert
  with check (auth.uid() = created_by);

create policy "orgs_update_admin"
  on organizations for update
  using (public.is_org_admin(id));

create policy "orgs_delete_admin"
  on organizations for delete
  using (public.is_org_admin(id));

create policy "org_members_select_member"
  on organization_members for select
  using (public.is_org_member(organization_id));

create policy "org_members_insert_admin"
  on organization_members for insert
  with check (
    auth.uid() = user_id
    and (
      public.is_org_admin(organization_id)
      or auth.uid() = (select created_by from organizations where id = organization_id)
    )
  );

create policy "org_members_update_admin"
  on organization_members for update
  using (public.is_org_admin(organization_id));

create policy "org_members_delete_admin"
  on organization_members for delete
  using (public.is_org_admin(organization_id) or auth.uid() = user_id);

create policy "epds_select_org"
  on epds for select
  using (public.is_org_member(organization_id));

create policy "epds_insert_org"
  on epds for insert
  with check (public.is_org_member(organization_id));

create policy "epds_update_org"
  on epds for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "epds_delete_org"
  on epds for delete
  using (public.is_org_member(organization_id));

create policy "epd_impacts_select_org"
  on epd_impacts for select
  using (public.is_org_member(organization_id));

create policy "epd_impacts_insert_org"
  on epd_impacts for insert
  with check (public.is_org_member(organization_id));

create policy "epd_impacts_update_org"
  on epd_impacts for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "epd_impacts_delete_org"
  on epd_impacts for delete
  using (public.is_org_member(organization_id));
