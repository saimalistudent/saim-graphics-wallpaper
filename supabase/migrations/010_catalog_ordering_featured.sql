-- Catalog list order + home "Trending Designs" control
-- Run in Supabase SQL Editor after 009.

alter table catalogs
  add column if not exists sort_order int not null default 0;

alter table catalogs
  add column if not exists is_featured boolean not null default false;

alter table catalogs
  add column if not exists featured_sort_order int not null default 0;

create index if not exists catalogs_sort_order_idx
  on catalogs (sort_order asc, created_at desc);

create index if not exists catalogs_featured_idx
  on catalogs (is_featured, featured_sort_order asc)
  where is_featured = true;

-- Backfill list order once (when every row still has default 0)
do $$
begin
  if exists (select 1 from catalogs)
     and (select count(distinct sort_order) from catalogs) <= 1 then
    with ranked as (
      select id, row_number() over (order by created_at desc) - 1 as rn
      from catalogs
    )
    update catalogs c
    set sort_order = ranked.rn
    from ranked
    where c.id = ranked.id;
  end if;
end $$;

create table if not exists featured_settings (
  id int primary key default 1 check (id = 1),
  display_count int not null default 8,
  updated_at timestamptz default now()
);

insert into featured_settings (id, display_count)
values (1, 8)
on conflict (id) do nothing;

alter table featured_settings enable row level security;

drop policy if exists "Public can read featured_settings" on featured_settings;
create policy "Public can read featured_settings"
  on featured_settings for select
  using (true);
