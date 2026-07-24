-- Catalog categories (BED, ROOM, …) + optional link on catalogs

create table if not exists catalog_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0,
  enabled boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table catalogs
  add column if not exists category_id uuid references catalog_categories(id) on delete set null;

create index if not exists catalogs_category_id_idx on catalogs (category_id);

alter table catalog_categories enable row level security;

create policy "Public can read catalog_categories"
  on catalog_categories for select
  using (true);

-- Seed defaults once (ALL is UI-only, not stored)
insert into catalog_categories (name, sort_order, enabled)
select v.name, v.sort_order, true
from (
  values
    ('BED ROOM', 1),
    ('BETHAK', 2),
    ('PARLOUR', 3),
    ('SALON', 4),
    ('BORDER', 5)
) as v(name, sort_order)
where not exists (select 1 from catalog_categories limit 1);
