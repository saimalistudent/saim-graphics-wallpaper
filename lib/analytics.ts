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

function groupVisitsByDay(
  visits: { timestamp: string }[],
  days: number
): { date: string; count: number }[] {
  const counts = new Map<string, number>();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - i);
    counts.set(localDayKey(d), 0);
  }

  for (const visit of visits) {
    const date = localDayKey(new Date(visit.timestamp));
    if (counts.has(date)) {
      counts.set(date, (counts.get(date) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries()).map(([date, count]) => ({ date, count }));
}

export async function getDashboardStats(days = 30): Promise<DashboardStats> {
  if (!isSupabaseAdminConfigured()) {
    return {
      totalVisits: 0,
      totalPdfOpens: 0,
      mostViewed: [],
      visitsByDay: [],
    };
  }

  try {
    const supabase = createSupabaseAdminClient();

    const [visitsRes, pdfViewsRes, catalogsRes] = await Promise.all([
      supabase.from("page_visits").select("timestamp"),
      supabase.from("pdf_views").select("catalog_id, timestamp"),
      supabase.from("catalogs").select("*"),
    ]);

    const visits = visitsRes.data ?? [];
    const pdfViews = pdfViewsRes.data ?? [];
    const catalogs = catalogsRes.data ?? [];

    const viewCounts = new Map<string, number>();
    for (const view of pdfViews) {
      viewCounts.set(
        view.catalog_id,
        (viewCounts.get(view.catalog_id) ?? 0) + 1
      );
    }

    const mostViewed = catalogs
      .map((catalog) => ({
        ...catalog,
        view_count: viewCounts.get(catalog.id) ?? 0,
      }))
      .sort((a, b) => b.view_count - a.view_count);

    return {
      totalVisits: visits.length,
      totalPdfOpens: pdfViews.length,
      mostViewed,
      visitsByDay: groupVisitsByDay(visits, days),
    };
  } catch (error) {
    console.error("Dashboard stats failed:", error);
    return {
      totalVisits: 0,
      totalPdfOpens: 0,
      mostViewed: [],
      visitsByDay: [],
    };
  }
}
