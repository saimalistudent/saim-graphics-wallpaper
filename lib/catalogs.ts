import { Catalog, FeaturedSettings } from "@/lib/types";
import { applyCatalogThumbnailOverride } from "@/lib/drive";
import { selectCatalogsWithCategories } from "@/lib/catalog-categories";
import {
  createSupabaseServerClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

const DEFAULT_FEATURED_COUNT = 8;

export async function getCatalogs(): Promise<Catalog[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = createSupabaseServerClient();
  const { data, error } = await selectCatalogsWithCategories(supabase);

  if (error) {
    console.error("Failed to fetch catalogs:", error);
    return [];
  }

  return data.map(applyCatalogThumbnailOverride);
}

export async function getCatalogById(id: string): Promise<Catalog | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = createSupabaseServerClient();
  const { data, error } = await selectCatalogsWithCategories(supabase, {
    id,
  });

  if (error) {
    console.error("Failed to fetch catalog:", error);
    return null;
  }

  const catalog = data[0];
  return catalog ? applyCatalogThumbnailOverride(catalog) : null;
}

export async function getFeaturedSettings(): Promise<FeaturedSettings> {
  const fallback: FeaturedSettings = {
    id: 1,
    display_count: DEFAULT_FEATURED_COUNT,
    updated_at: new Date(0).toISOString(),
  };

  if (!isSupabaseConfigured()) return fallback;

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("featured_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (error || !data) return fallback;
    const count = Number((data as FeaturedSettings).display_count);
    return {
      ...(data as FeaturedSettings),
      display_count:
        Number.isFinite(count) && count > 0
          ? Math.min(24, Math.floor(count))
          : DEFAULT_FEATURED_COUNT,
    };
  } catch {
    return fallback;
  }
}

/** Home “3D Trending Designs” — admin-controlled featured list + display count */
export async function getFeaturedCatalogs(limit?: number): Promise<Catalog[]> {
  const catalogs = await getCatalogs();
  if (catalogs.length === 0) return [];

  const settings = await getFeaturedSettings();
  const max = limit ?? settings.display_count;

  const featured = catalogs
    .filter((c) => c.is_featured)
    .sort(
      (a, b) =>
        (a.featured_sort_order ?? 0) - (b.featured_sort_order ?? 0) ||
        (a.sort_order ?? 0) - (b.sort_order ?? 0)
    );

  if (featured.length > 0) {
    return featured.slice(0, max);
  }

  // No featured picks yet — show first N by catalog list order
  return catalogs.slice(0, max);
}
