-- Hero wallpaper slides (ordered gallery for home hero marquee)

create table if not exists hero_slides (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  sort_order int not null default 0,
  enabled boolean not null default true,
  updated_at timestamptz default now()
);

alter table hero_slides enable row level security;

create policy "Public can read hero_slides"
  on hero_slides for select
  using (true);

-- Seed 5 default slides if empty
insert into hero_slides (image_url, sort_order, enabled)
select v.image_url, v.sort_order, true
from (
  values
    ('/hero-slides/1.png', 1),
    ('/hero-slides/2.png', 2),
    ('/hero-slides/3.png', 3),
    ('/hero-slides/4.png', 4),
    ('/hero-slides/5.png', 5)
) as v(image_url, sort_order)
where not exists (select 1 from hero_slides limit 1);
