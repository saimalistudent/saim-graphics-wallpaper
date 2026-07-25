 -- Visits Over Time: count by Pakistan (Asia/Karachi) calendar day
-- so the admin chart matches local "today" for SAIM GRAPHICS.

create or replace function public.dashboard_visit_counts_by_day(p_days int default 30)
returns table(day text, visit_count bigint)
language sql
security definer
set search_path = public
as $$
  with bounds as (
    select (timezone('Asia/Karachi', now()))::date as today
  ),
  days as (
    select generate_series(
      (select today from bounds) - greatest(coalesce(p_days, 30), 1) + 1,
      (select today from bounds),
      interval '1 day'
    )::date as d
  )
  select
    to_char(days.d, 'YYYY-MM-DD') as day,
    coalesce(count(pv.id), 0)::bigint as visit_count
  from days
  left join page_visits pv
    on (timezone('Asia/Karachi', pv.timestamp))::date = days.d
  group by days.d
  order by days.d;
$$;

revoke all on function public.dashboard_visit_counts_by_day(int) from public;
grant execute on function public.dashboard_visit_counts_by_day(int) to service_role;
