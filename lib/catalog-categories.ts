import { Catalog } from "@/lib/types";
import { SupabaseClient } from "@supabase/supabase-js";

type LinkRow = { category_id: string };
type CatalogRow = Catalog & {
  category_id?: string | null;
  catalog_category_links?: LinkRow[] | null;
};

const CATALOG_WITH_LINKS =
  "*, catalog_category_links(category_id)" as const;

function isMissingLinksRelation(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("catalog_category_links") ||
    m.includes("does not exist") ||
    m.includes("could not find")
  );
}

/** Normalize DB row → Catalog with category_ids (junction or legacy FK). */
export function attachCategoryIds(row: CatalogRow): Catalog {
  const links = row.catalog_category_links;
  let category_ids: string[] = [];

  if (Array.isArray(links)) {
    category_ids = [
      ...new Set(
        links
          .map((l) => l?.category_id)
          .filter((id): id is string => Boolean(id))
      ),
    ];
  } else if (row.category_id) {
    category_ids = [row.category_id];
  }

  // Strip join/legacy fields — app uses category_ids only
  const rest = { ...row } as CatalogRow & Record<string, unknown>;
  delete rest.catalog_category_links;
  delete rest.category_id;

  return {
    ...(rest as Omit<Catalog, "category_ids">),
    category_ids,
  };
}

export function parseCategoryIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const ids = input
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);
  return [...new Set(ids)];
}

/**
 * Fetch catalogs with category links. Falls back to legacy category_id
 * when migration 009 is not applied yet.
 */
export async function selectCatalogsWithCategories(
  supabase: SupabaseClient,
  opts?: { id?: string; order?: boolean }
): Promise<{ data: Catalog[]; error: string | null }> {
  const order = opts?.order !== false;

  let query = supabase.from("catalogs").select(CATALOG_WITH_LINKS);
  if (opts?.id) query = query.eq("id", opts.id);
  if (order) {
    query = query
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
  }

  let { data, error } = opts?.id
    ? await query.maybeSingle()
    : await query;

  // Pre-010: sort_order column missing — retry by created_at
  if (
    error &&
    /sort_order/i.test(error.message) &&
    !opts?.id &&
    order
  ) {
    const fallback = await supabase
      .from("catalogs")
      .select(CATALOG_WITH_LINKS)
      .order("created_at", { ascending: false });
    data = fallback.data;
    error = fallback.error;
  } else if (
    error &&
    /sort_order/i.test(error.message) &&
    opts?.id
  ) {
    const fallback = await supabase
      .from("catalogs")
      .select(CATALOG_WITH_LINKS)
      .eq("id", opts.id)
      .maybeSingle();
    data = fallback.data;
    error = fallback.error;
  }

  if (!error) {
    if (opts?.id) {
      if (!data) return { data: [], error: null };
      return { data: [attachCategoryIds(data as CatalogRow)], error: null };
    }
    return {
      data: ((data ?? []) as CatalogRow[]).map(attachCategoryIds),
      error: null,
    };
  }

  if (!isMissingLinksRelation(error.message)) {
    return { data: [], error: error.message };
  }

  // Pre-009: single category_id column
  let legacy = supabase.from("catalogs").select("*");
  if (opts?.id) legacy = legacy.eq("id", opts.id);
  if (order) legacy = legacy.order("created_at", { ascending: false });

  const legacyRes = opts?.id
    ? await legacy.maybeSingle()
    : await legacy;

  if (legacyRes.error) {
    return { data: [], error: legacyRes.error.message };
  }

  if (opts?.id) {
    if (!legacyRes.data) return { data: [], error: null };
    return {
      data: [attachCategoryIds(legacyRes.data as CatalogRow)],
      error: null,
    };
  }

  return {
    data: ((legacyRes.data ?? []) as CatalogRow[]).map(attachCategoryIds),
    error: null,
  };
}

/**
 * Replace category membership for a catalog (delete + insert).
 * Falls back to legacy catalogs.category_id when junction is missing.
 */
export async function replaceCatalogCategoryLinks(
  supabase: SupabaseClient,
  catalogId: string,
  categoryIds: string[]
): Promise<{ error: string | null }> {
  const { error: delError } = await supabase
    .from("catalog_category_links")
    .delete()
    .eq("catalog_id", catalogId);

  if (delError) {
    if (!isMissingLinksRelation(delError.message)) {
      return { error: delError.message };
    }
    // Legacy single FK (pre-009)
    const { error: legacyErr } = await supabase
      .from("catalogs")
      .update({ category_id: categoryIds[0] ?? null })
      .eq("id", catalogId);
    return { error: legacyErr?.message ?? null };
  }

  if (categoryIds.length === 0) return { error: null };

  const { error: insError } = await supabase
    .from("catalog_category_links")
    .insert(
      categoryIds.map((category_id) => ({
        catalog_id: catalogId,
        category_id,
      }))
    );

  return { error: insError?.message ?? null };
}
