-- SAIM GRAPHICS & 3D WALLPAPER — Supabase schema

create table if not exists catalogs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  thumbnail_url text,
  drive_file_id text not null,
  created_at timestamptz default now()
);

create table if not exists pdf_views (
  id uuid primary key default gen_random_uuid(),
  catalog_id uuid references catalogs(id) on delete cascade,
  timestamp timestamptz default now(),
  user_agent text
);

create table if not exists page_visits (
  id uuid primary key default gen_random_uuid(),
  page_path text not null,
  timestamp timestamptz default now(),
  user_agent text
);

alter table catalogs enable row level security;
alter table pdf_views enable row level security;
alter table page_visits enable row level security;

create policy "Public can read catalogs"
  on catalogs for select
  using (true);

create policy "Public can insert pdf_views"
  on pdf_views for insert
  with check (true);

create policy "Public can insert page_visits"
  on page_visits for insert
  with check (true);

-- Storage bucket for thumbnails (run in Supabase dashboard or via API):
-- create bucket 'thumbnails' with public access
