import { Catalog } from "@/lib/types";
import { CatalogCard } from "@/components/CatalogCard";
import { FadeUp } from "@/components/FadeUp";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

type FeaturedCategoriesProps = {
  catalogs: Catalog[];
};

export function FeaturedCategories({ catalogs }: FeaturedCategoriesProps) {
  if (catalogs.length === 0) {
    return (
      <section className="pt-5 pb-10 sm:pt-7 sm:pb-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <FadeUp>
            <h2 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-burgundy uppercase">
              Trending Design
            </h2>
            <p className="mt-2 text-sm text-text-secondary">
              Catalogs will appear here once added via the admin panel.
            </p>
          </FadeUp>
        </div>
      </section>
    );
  }

  return (
    <section className="pt-5 pb-10 sm:pt-7 sm:pb-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FadeUp>
          <div className="mb-4 sm:mb-6">
            <h2 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-burgundy uppercase leading-[0.95]">
              Trending Design
            </h2>
            <p className="mt-1.5 text-sm text-text-secondary hidden sm:block">
              Browse our latest wallpaper catalogs
            </p>
          </div>
        </FadeUp>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5 lg:gap-6 items-stretch">
          {catalogs.map((catalog, i) => (
            <CatalogCard key={catalog.id} catalog={catalog} index={i} compact />
          ))}
        </div>
        <FadeUp>
          <div className="mt-6 sm:mt-8 flex justify-center">
            <Link href="/catalogs" className="view-all-catalogs-btn">
              View All Catalogs
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        </FadeUp>
      </div>
    </section>
  );
}
