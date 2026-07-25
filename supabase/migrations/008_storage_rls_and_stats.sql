-- Production security: storage read-only for anon + accurate dashboard aggregates
-- Admin writes use service role (bypasses RLS). Run in Supabase SQL Editor after 007.

-- ---------------------------------------------------------------------------
-- Buckets (idempotent)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'thumbnails',
    'thumbnails',
    true,
    12582912,
    array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
  ),
  (
    'catalog-pdfs',
    'catalog-pdfs',
    true,
    52428800,
    array['application/pdf']
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Drop any existing storage.objects policies that touch these buckets
-- (dashboard wizards sometimes allow public upload/delete)
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and (
        coalesce(qual::text, '') like '%thumbnails%'
        or coalesce(with_check::text, '') like '%thumbnails%'
        or coalesce(qual::text, '') like '%catalog-pdfs%'
        or coalesce(with_check::text, '') like '%catalog-pdfs%'
      )
  loop
    execute format('drop policy if exists %I on storage.objects', r.policyname);
  end loop;
end $$;

-- Public may read CDN assets only — no insert/update/delete policies for anon
create policy "Public read thumbnails"
  on storage.objects for select
  to public
  using (bucket_id = 'thumbnails');

create policy "Public read catalog-pdfs"
  on storage.objects for select
  to public
  using (bucket_id = 'catalog-pdfs');

-- ---------------------------------------------------------------------------
-- Table RLS reminders: write policies must stay absent for anon.
-- Drop common wizard write policies if someone created them by mistake.
-- ---------------------------------------------------------------------------
drop policy if exists "Enable insert for authenticated users only" on public.catalogs;
drop policy if exists "Enable update for authenticated users only" on public.catalogs;
drop policy if exists "Enable delete for authenticated users only" on public.catalogs;
drop policy if exists "Public can insert catalogs" on public.catalogs;
drop policy if exists "Public can update catalogs" on public.catalogs;
drop policy if exists "Public can delete catalogs" on public.catalogs;

drop policy if exists "Public can insert promo_popup" on public.promo_popup;
drop policy if exists "Public can update promo_popup" on public.promo_popup;
drop policy if exists "Public can delete promo_popup" on public.promo_popup;

drop policy if exists "Public can insert hero_slides" on public.hero_slides;
drop policy if exists "Public can update hero_slides" on public.hero_slides;
drop policy if exists "Public can delete hero_slides" on public.hero_slides;

drop policy if exists "Public can insert catalog_categories" on public.catalog_categories;
drop policy if exists "Public can update catalog_categories" on public.catalog_categories;
drop policy if exists "Public can delete catalog_categories" on public.catalog_categories;

drop policy if exists "Public can insert contact_settings" on public.contact_settings;
drop policy if exists "Public can update contact_settings" on public.contact_settings;
drop policy if exists "Public can delete contact_settings" on public.contact_settings;

drop policy if exists "Public can update page_visits" on public.page_visits;
drop policy if exists "Public can delete page_visits" on public.page_visits;
drop policy if exists "Public can select page_visits" on public.page_visits;

drop policy if exists "Public can update pdf_views" on public.pdf_views;
drop policy if exists "Public can delete pdf_views" on public.pdf_views;
drop policy if exists "Public can select pdf_views" on public.pdf_views;

-- ---------------------------------------------------------------------------
-- Dashboard aggregates (service_role only) — avoids PostgREST 1000-row cap
-- ---------------------------------------------------------------------------
create or replace function public.dashboard_visit_counts_by_day(p_days int default 30)
returns table(day text, visit_count bigint)
language sql
security definer
set search_path = public
as $$
  with days as (
    select generate_series(
      (current_date - greatest(coalesce(p_days, 30), 1) + 1),
      current_date,
      interval '1 day'
    )::date as d
  )
  select
    to_char(days.d, 'YYYY-MM-DD') as day,
    coalesce(count(pv.id), 0)::bigint as visit_count
  from days
  left join page_visits pv
    on (pv.timestamp at time zone 'UTC')::date = days.d
  group by days.d
  order by days.d;
$$;

create or replace function public.dashboard_pdf_view_counts()
returns table(catalog_id uuid, view_count bigint)
language sql
security definer
set search_path = public
as $$
  select catalog_id, count(*)::bigint as view_count
  from pdf_views
  where catalog_id is not null
  group by catalog_id;
$$;

revoke all on function public.dashboard_visit_counts_by_day(int) from public;
revoke all on function public.dashboard_pdf_view_counts() from public;
grant execute on function public.dashboard_visit_counts_by_day(int) to service_role;
grant execute on function public.dashboard_pdf_view_counts() to service_role;
