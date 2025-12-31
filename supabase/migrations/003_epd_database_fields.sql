alter table if exists epds
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists manufacturer text,
  add column if not exists determination_method_name text,
  add column if not exists determination_method_version text,
  add column if not exists database_version text,
  add column if not exists product_category text,
  add column if not exists mki_a1a3 numeric,
  add column if not exists mki_d numeric,
  add column if not exists co2_a1a3 numeric,
  add column if not exists co2_d numeric,
  add column if not exists raw_extracted jsonb not null default '{}'::jsonb,
  add column if not exists status text not null default 'ok',
  add column if not exists status_reason text;

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists epds_set_updated_at on epds;
create trigger epds_set_updated_at
before update on epds
for each row execute function set_updated_at();

update epds
set manufacturer = producer_name
where manufacturer is null and producer_name is not null;

update epds
set created_at = now()
where created_at is null;

update epds
set updated_at = now()
where updated_at is null;

update epds
set determination_method_name = 'NMD Bepalingsmethode'
where determination_method_name is null;

create unique index if not exists epds_unique_key_idx
  on epds (product_name, producer_name, functional_unit, determination_method_version, pcr_version, database_version);

create index if not exists epds_product_name_idx on epds (product_name);
create index if not exists epds_producer_name_idx on epds (producer_name);
create index if not exists epds_determination_method_version_idx on epds (determination_method_version);
create index if not exists epds_pcr_version_idx on epds (pcr_version);
create index if not exists epds_database_version_idx on epds (database_version);
create index if not exists epds_product_category_idx on epds (product_category);
