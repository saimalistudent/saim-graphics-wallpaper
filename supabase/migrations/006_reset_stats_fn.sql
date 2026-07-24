-- Allow wiping analytics (service role / security definer)
create or replace function public.reset_site_stats()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  visits_deleted int;
  pdfs_deleted int;
begin
  delete from page_visits;
  get diagnostics visits_deleted = row_count;
  delete from pdf_views;
  get diagnostics pdfs_deleted = row_count;
  return json_build_object(
    'visits_deleted', visits_deleted,
    'pdf_views_deleted', pdfs_deleted
  );
end;
$$;

revoke all on function public.reset_site_stats() from public;
grant execute on function public.reset_site_stats() to service_role;
