-- Social profile URLs on contact_settings (singleton row)
-- Icons on home “3D Trending Designs” + LocalBusiness sameAs

alter table public.contact_settings
  add column if not exists facebook_url text not null default '',
  add column if not exists tiktok_url text not null default '';
