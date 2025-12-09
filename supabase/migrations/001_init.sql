create extension if not exists "pgcrypto";

create table if not exists epd_files (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,
  original_filename text not null,
  uploaded_at timestamptz not null default now(),
  raw_text text
);

create table if not exists epds (
  id uuid primary key default gen_random_uuid(),
  epd_file_id uuid references epd_files(id) on delete set null,
  product_name text not null,
  functional_unit text not null,
  producer_name text,
  lca_method text,
  pcr_version text,
  database_name text,
  publication_date date,
  expiration_date date,
  verifier_name text,
  standard_set text default 'UNKNOWN',
  custom_attributes jsonb not null default '{}'::jsonb
);

create table if not exists epd_impacts (
  id uuid primary key default gen_random_uuid(),
  epd_id uuid not null references epds(id) on delete cascade,
  indicator text not null,
  set_type text not null,
  stage text not null,
  value numeric
);
