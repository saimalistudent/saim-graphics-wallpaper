-- Catalog PDFs on Supabase Storage (CDN) — additive, Drive remains fallback

alter table catalogs
  add column if not exists pdf_url text,
  add column if not exists pdf_path text,
  add column if not exists pdf_bytes bigint;

comment on column catalogs.pdf_url is 'Public Supabase Storage URL for CDN-served PDF';
comment on column catalogs.pdf_path is 'Storage object path in catalog-pdfs bucket';
comment on column catalogs.pdf_bytes is 'PDF size in bytes (prefetch / UI)';

-- Storage bucket (also creatable via scripts/ensure-catalog-pdfs-bucket.ts):
-- name: catalog-pdfs
-- public: true
-- allowed mime: application/pdf
-- file size limit: 50MB
