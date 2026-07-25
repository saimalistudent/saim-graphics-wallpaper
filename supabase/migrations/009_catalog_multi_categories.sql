-- Multi-category support: one catalog/PDF can belong to many categories
-- Run in Supabase SQL Editor after 005 / 005b (and preferably after 008).
-- Safe to re-run: skips backfill if legacy catalogs.category_id is already gone.

create table if not exists catalog_category_links (
  catalog_id uuid not null references catalogs(id) on delete cascade,
  category_id uuid not null references catalog_categories(id) on delete cascade,
  primary key (catalog_id, category_id)
);

create index if not exists catalog_category_links_category_id_idx
  on catalog_category_links (category_id);

alter table catalog_category_links enable row level security;

drop policy if exists "Public can read catalog_category_links" on catalog_category_links;
create policy "Public can read catalog_category_links"
  on catalog_category_links for select
  using (true);

-- No anon write policies — admin uses service role (bypasses RLS).
drop policy if exists "Public can insert catalog_category_links" on catalog_category_links;
drop policy if exists "Public can update catalog_category_links" on catalog_category_links;
drop policy if exists "Public can delete catalog_category_links" on catalog_category_links;

-- Backfill from legacy single FK only if that column still exists
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'catalogs'
      and column_name = 'category_id'
  ) then
    insert into catalog_category_links (catalog_id, category_id)
    select c.id, c.category_id
    from catalogs c
    where c.category_id is not null
    on conflict do nothing;

    drop index if exists catalogs_category_id_idx;
    alter table catalogs drop column if exists category_id;
  end if;
end $$;
