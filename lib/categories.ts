import { CatalogCategory } from "@/lib/types";
import {
  createSupabaseServerClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

/** Fallback when migration 005 not applied yet */
export const DEFAULT_CATEGORIES: CatalogCategory[] = [
  "BED ROOM",
  "BETHAK",
  "PARLOUR",
  "SALON",
  "BORDER",
].map((name, i) => ({
  id: `local-${name.toLowerCase().replace(/\s+/g, "-")}`,
  name,
  sort_order: i + 1,
  enabled: true,
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
}));

export async function getCatalogCategories(): Promise<CatalogCategory[]> {
  if (!isSupabaseConfigured()) return DEFAULT_CATEGORIES;

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("catalog_categories")
      .select("*")
      .eq("enabled", true)
      .order("sort_order", { ascending: true });

    // Table missing / misconfigured → local fallbacks for first paint
    if (error) return DEFAULT_CATEGORIES;
    return (data ?? []) as CatalogCategory[];
  } catch {
    return DEFAULT_CATEGORIES;
  }
}

export async function getAllCatalogCategoriesAdmin(): Promise<
  CatalogCategory[] | null
> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("catalog_categories")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) return null;
    return (data ?? []) as CatalogCategory[];
  } catch {
    return null;
  }
}
