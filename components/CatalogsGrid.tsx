import { getCatalogs } from "@/lib/catalogs";
import { getCatalogCategories } from "@/lib/categories";
import { CatalogsBrowser } from "@/components/CatalogsBrowser";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export async function CatalogsGrid() {
  const [catalogs, categories] = await Promise.all([
    getCatalogs(),
    getCatalogCategories(),
  ]);

  if (catalogs.length === 0) {
    const misconfigured = !isSupabaseConfigured();
    return (
      <div className="text-center py-16 text-text-secondary">
        <p className="text-lg">
          {misconfigured
            ? "Catalog database is not connected."
            : "No catalogs available yet."}
        </p>
        <p className="mt-2 text-sm">
          {misconfigured
            ? "Add Supabase environment variables in Netlify and redeploy."
            : "Check back soon or contact us for designs."}
        </p>
      </div>
    );
  }

  return <CatalogsBrowser catalogs={catalogs} categories={categories} />;
}
