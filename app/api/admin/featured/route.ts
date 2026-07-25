import { NextRequest, NextResponse } from "next/server";
import { revalidatePublicSite } from "@/lib/revalidate-site";
import { isAdminAuthenticated } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/client";
import { selectCatalogsWithCategories } from "@/lib/catalog-categories";
import { applyCatalogThumbnailOverride } from "@/lib/drive";
import { getFeaturedSettings } from "@/lib/catalogs";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const settings = await getFeaturedSettings();
  const { data, error } = await selectCatalogsWithCategories(supabase);

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  const catalogs = data.map(applyCatalogThumbnailOverride);
  const featured = catalogs
    .filter((c) => c.is_featured)
    .sort(
      (a, b) =>
        (a.featured_sort_order ?? 0) - (b.featured_sort_order ?? 0) ||
        (a.sort_order ?? 0) - (b.sort_order ?? 0)
    );

  return NextResponse.json({
    display_count: settings.display_count,
    featured,
    catalogs,
  });
}

/**
 * Save trending section:
 * - display_count: how many cards on home
 * - catalog_ids: ordered list of featured PDFs (first = leftmost)
 */
export async function PUT(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const displayCountRaw = Number(body.display_count);
  const display_count =
    Number.isFinite(displayCountRaw) && displayCountRaw > 0
      ? Math.min(24, Math.floor(displayCountRaw))
      : 8;

  const catalog_ids = Array.isArray(body.catalog_ids)
    ? [
        ...new Set(
          body.catalog_ids
            .map((id: unknown) => (typeof id === "string" ? id.trim() : ""))
            .filter(Boolean)
        ),
      ]
    : [];

  const supabase = createSupabaseAdminClient();

  const { error: settingsErr } = await supabase.from("featured_settings").upsert(
    {
      id: 1,
      display_count,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (settingsErr) {
    return NextResponse.json(
      {
        error:
          settingsErr.message +
          " — Run 010_catalog_ordering_featured.sql in Supabase?",
      },
      { status: 500 }
    );
  }

  // Clear all featured flags first
  const { error: clearErr } = await supabase
    .from("catalogs")
    .update({ is_featured: false, featured_sort_order: 0 })
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (clearErr) {
    return NextResponse.json(
      {
        error:
          clearErr.message +
          " — Run 010_catalog_ordering_featured.sql in Supabase?",
      },
      { status: 500 }
    );
  }

  for (let i = 0; i < catalog_ids.length; i++) {
    const { error } = await supabase
      .from("catalogs")
      .update({
        is_featured: true,
        featured_sort_order: i,
      })
      .eq("id", catalog_ids[i]);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  revalidatePublicSite();

  return NextResponse.json({
    success: true,
    display_count,
    featured_count: catalog_ids.length,
  });
}
