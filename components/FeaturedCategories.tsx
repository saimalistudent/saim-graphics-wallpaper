import { Catalog } from "@/lib/types";
import { CatalogCard } from "@/components/CatalogCard";
import { FadeUp } from "@/components/FadeUp";
import Link from "next/link";
import { Flame, Images } from "lucide-react";

type FeaturedCategoriesProps = {
  catalogs: Catalog[];
};

export function FeaturedCategories({ catalogs }: FeaturedCategoriesProps) {
  if (catalogs.length === 0) {
    return (
    <section className="pt-3 pb-10 sm:pt-4 sm:pb-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
        <FadeUp>
          <h2 className="trending-title font-heading font-black uppercase">
            <Flame className="trending-fire" aria-hidden strokeWidth={2.25} />
            3D Trending Designs
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
    <section className="pt-3 pb-10 sm:pt-4 sm:pb-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FadeUp>
          <div className="mb-3 sm:mb-5">
            <h2 className="trending-title font-heading font-black uppercase">
              <Flame className="trending-fire" aria-hidden strokeWidth={2.25} />
              3D Trending Designs
            </h2>
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
              <span className="hero-cta-icon" aria-hidden>
                <Images className="h-3.5 w-3.5" strokeWidth={2.25} />
              </span>
              <span>View All Designs</span>
            </Link>
          </div>
        </FadeUp>
      </div>
    </section>
  );
}
