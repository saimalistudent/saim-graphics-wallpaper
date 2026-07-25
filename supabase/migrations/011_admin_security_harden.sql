-- Harden RLS for tables added after 008 (featured + multi-category links)
-- Public/anon: SELECT only. Admin writes use service role.

drop policy if exists "Public can insert featured_settings" on public.featured_settings;
drop policy if exists "Public can update featured_settings" on public.featured_settings;
drop policy if exists "Public can delete featured_settings" on public.featured_settings;
drop policy if exists "Enable insert for authenticated users only" on public.featured_settings;
drop policy if exists "Enable update for authenticated users only" on public.featured_settings;
drop policy if exists "Enable delete for authenticated users only" on public.featured_settings;

drop policy if exists "Public can insert catalog_category_links" on public.catalog_category_links;
drop policy if exists "Public can update catalog_category_links" on public.catalog_category_links;
drop policy if exists "Public can delete catalog_category_links" on public.catalog_category_links;
drop policy if exists "Enable insert for authenticated users only" on public.catalog_category_links;
drop policy if exists "Enable update for authenticated users only" on public.catalog_category_links;
drop policy if exists "Enable delete for authenticated users only" on public.catalog_category_links;

-- Ensure RLS stays on (no-op if already)
do $$
begin
  if to_regclass('public.featured_settings') is not null then
    execute 'alter table public.featured_settings enable row level security';
  end if;
  if to_regclass('public.catalog_category_links') is not null then
    execute 'alter table public.catalog_category_links enable row level security';
  end if;
end $$;
