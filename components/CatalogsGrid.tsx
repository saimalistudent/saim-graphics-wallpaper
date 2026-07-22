import { getCatalogs } from "@/lib/catalogs";
import { CatalogCard } from "@/components/CatalogCard";

export async function CatalogsGrid() {
  const catalogs = await getCatalogs();

  if (catalogs.length === 0) {
    return (
      <div className="text-center py-16 text-text-secondary">
        <p className="text-lg">No catalogs available yet.</p>
        <p className="mt-2 text-sm">Check back soon or contact us for designs.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5 lg:gap-6 items-stretch">
      {catalogs.map((catalog, i) => (
        <CatalogCard key={catalog.id} catalog={catalog} index={i} />
      ))}
    </div>
  );
}
