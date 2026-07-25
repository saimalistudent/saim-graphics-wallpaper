import { DashboardStats } from "@/lib/types";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/client";

function localDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function emptyDaySeries(days: number): { date: string; count: number }[] {
  const out: { date: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - i);
    out.push({ date: localDayKey(d), count: 0 });
  }
  return out;
}

function groupVisitsByDay(
  visits: { timestamp: string }[],
  days: number
): { date: string; count: number }[] {
  const series = emptyDaySeries(days);
  const counts = new Map(series.map((s) => [s.date, 0]));

  for (const visit of visits) {
    const date = localDayKey(new Date(visit.timestamp));
    if (counts.has(date)) {
      counts.set(date, (counts.get(date) ?? 0) + 1);
    }
  }

  return series.map((s) => ({ date: s.date, count: counts.get(s.date) ?? 0 }));
}

export async function getDashboardStats(days = 30): Promise<DashboardStats> {
  if (!isSupabaseAdminConfigured()) {
    return {
      totalVisits: 0,
      totalPdfOpens: 0,
      mostViewed: [],
      visitsByDay: emptyDaySeries(days),
    };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (days - 1));

    const [
      visitsCountRes,
      pdfCountRes,
      byDayRpc,
      pdfCountsRpc,
      catalogsRes,
    ] = await Promise.all([
      supabase.from("page_visits").select("*", { count: "exact", head: true }),
      supabase.from("pdf_views").select("*", { count: "exact", head: true }),
      supabase.rpc("dashboard_visit_counts_by_day", { p_days: days }),
      supabase.rpc("dashboard_pdf_view_counts"),
      supabase.from("catalogs").select("*"),
    ]);

    const catalogs = catalogsRes.data ?? [];
    const viewCounts = new Map<string, number>();

    if (!pdfCountsRpc.error && Array.isArray(pdfCountsRpc.data)) {
      for (const row of pdfCountsRpc.data as {
        catalog_id: string;
        view_count: number | string;
      }[]) {
        viewCounts.set(row.catalog_id, Number(row.view_count) || 0);
      }
    } else {
      // Fallback before 008 migration — may undercount past PostgREST row cap
      const pdfViewsRes = await supabase
        .from("pdf_views")
        .select("catalog_id");
      for (const view of pdfViewsRes.data ?? []) {
        if (!view.catalog_id) continue;
        viewCounts.set(
          view.catalog_id,
          (viewCounts.get(view.catalog_id) ?? 0) + 1
        );
      }
    }

    let visitsByDay: { date: string; count: number }[];
    if (!byDayRpc.error && Array.isArray(byDayRpc.data)) {
      const map = new Map(
        (
          byDayRpc.data as { day: string; visit_count: number | string }[]
        ).map((r) => [r.day, Number(r.visit_count) || 0])
      );
      visitsByDay = emptyDaySeries(days).map((s) => ({
        date: s.date,
        count: map.get(s.date) ?? 0,
      }));
    } else {
      const visitsRes = await supabase
        .from("page_visits")
        .select("timestamp")
        .gte("timestamp", since.toISOString());
      visitsByDay = groupVisitsByDay(visitsRes.data ?? [], days);
    }

    const mostViewed = catalogs
      .map((catalog) => ({
        ...catalog,
        view_count: viewCounts.get(catalog.id) ?? 0,
      }))
      .filter((c) => c.view_count > 0)
      .sort((a, b) => b.view_count - a.view_count);

    return {
      totalVisits: visitsCountRes.count ?? 0,
      totalPdfOpens: pdfCountRes.count ?? 0,
      mostViewed,
      visitsByDay,
    };
  } catch (error) {
    console.error("Dashboard stats failed:", error);
    return {
      totalVisits: 0,
      totalPdfOpens: 0,
      mostViewed: [],
      visitsByDay: emptyDaySeries(days),
    };
  }
}
