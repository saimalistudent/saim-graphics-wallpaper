"use client";

import { useMemo, useState } from "react";
import { Catalog, CatalogCategory } from "@/lib/types";
import { CatalogCard } from "@/components/CatalogCard";
import { cn } from "@/lib/utils";

type Props = {
  catalogs: Catalog[];
  categories: CatalogCategory[];
};

export function CatalogsBrowser({ catalogs, categories }: Props) {
  const [selected, setSelected] = useState<string>("all");

  const filtered = useMemo(() => {
    if (selected === "all") return catalogs;
    return catalogs.filter((c) => c.category_id === selected);
  }, [catalogs, selected]);

  return (
    <div className="space-y-6 sm:space-y-8">
      <div
        className="catalog-category-bar"
        role="tablist"
        aria-label="Design categories"
      >
        <button
          type="button"
          role="tab"
          aria-selected={selected === "all"}
          className={cn(
            "catalog-category-chip",
            selected === "all" && "catalog-category-chip--active"
          )}
          onClick={() => setSelected("all")}
        >
          ALL
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            role="tab"
            aria-selected={selected === cat.id}
            className={cn(
              "catalog-category-chip",
              selected === cat.id && "catalog-category-chip--active"
            )}
            onClick={() => setSelected(cat.id)}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-14 text-text-secondary">
          <p className="text-lg">Is category mein abhi koi design nahi.</p>
          <p className="mt-2 text-sm">ALL select karke saari collections dekhein.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5 lg:gap-6 items-stretch">
          {filtered.map((catalog, i) => (
            <CatalogCard key={catalog.id} catalog={catalog} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
