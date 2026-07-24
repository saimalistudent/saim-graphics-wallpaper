-- Promo / offers popup (singleton row — admin upserts one post)

create table if not exists promo_popup (
  id uuid primary key default gen_random_uuid(),
  enabled boolean not null default true,
  title text not null default '',
  body text not null default '',
  image_url text,
  cta_label text,
  cta_url text,
  updated_at timestamptz default now()
);

alter table promo_popup enable row level security;

create policy "Public can read promo_popup"
  on promo_popup for select
  using (true);

-- Seed one sample post (skip if any row already exists)
insert into promo_popup (enabled, title, body, image_url, cta_label, cta_url)
select
  true,
  'Special Offer',
  '5% OFF on 5,000 ft work — premium 3D panaflex designs in Gujranwala. Browse catalogs and send your favourite screenshot on WhatsApp.',
  '/promo-popup-sample.png',
  'View Designs',
  '/catalogs'
where not exists (select 1 from promo_popup limit 1);
