-- Business location / Maps URL on contact_settings (singleton row)
-- Pin icon next to home “3D Trending Designs” (not sameAs)

alter table public.contact_settings
  add column if not exists location_url text not null default '';
