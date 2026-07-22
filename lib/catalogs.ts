import { Catalog } from "@/lib/types";
import { applyCatalogThumbnailOverride } from "@/lib/drive";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/client";

export async function getCatalogs(): Promise<Catalog[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("catalogs")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch catalogs:", error.message);
    return [];
  }

  return ((data ?? []) as Catalog[]).map(applyCatalogThumbnailOverride);
}

export async function getCatalogById(id: string): Promise<Catalog | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("catalogs")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Failed to fetch catalog:", error.message);
    return null;
  }

  return applyCatalogThumbnailOverride(data as Catalog);
}

/** Preferred Featured Designs order (home page top) */
export const FEATURED_CATALOG_TITLES = [
  "SG D1 (6) crown room",
  "SG D1 (36) gracefull full room",
  "SG D1 (23) full room",
  "SG D1 (20) opal room",
  "SG D1 (15) plain design",
  "SG D1 (3) matt design",
  "SG D1 (25) full room",
  "SG D1 (21) single wall luxuary",
] as const;

function normalizeTitle(title: string) {
  return title.toLowerCase().replace(/\s+/g, " ").trim();
}

export async function getFeaturedCatalogs(limit = 8): Promise<Catalog[]> {
  const catalogs = await getCatalogs();
  if (catalogs.length === 0) return [];

  const byNorm = new Map(
    catalogs.map((c) => [normalizeTitle(c.title), c] as const)
  );

  const featured: Catalog[] = [];
  const used = new Set<string>();

  for (const preferred of FEATURED_CATALOG_TITLES) {
    const match = byNorm.get(normalizeTitle(preferred));
    if (match && !used.has(match.id)) {
      featured.push(match);
      used.add(match.id);
    }
    if (featured.length >= limit) break;
  }

  // Fill remaining slots if some titles were missing
  if (featured.length < limit) {
    for (const catalog of catalogs) {
      if (used.has(catalog.id)) continue;
      featured.push(catalog);
      used.add(catalog.id);
      if (featured.length >= limit) break;
    }
  }

  return featured;
}
