import { Suspense } from "react";
import { FadeUp } from "@/components/FadeUp";
import { CatalogGridSkeleton } from "@/components/ui/Skeleton";
import { CatalogsGrid } from "@/components/CatalogsGrid";
import { ScrollRestore } from "@/components/ScrollRestore";

export const metadata = {
  title: "Catalogs | SAIM GRAPHICS | 3D PANAFLEX WALLPAPER",
};

export default function CatalogsPage() {
  return (
    <section className="py-12 sm:py-16">
      <ScrollRestore storageKey="/catalogs" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FadeUp>
          <h1 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-burgundy uppercase leading-[0.95]">
            Wallpaper Catalogs
          </h1>
          <p className="mt-2 text-text-secondary">
            Browse all our design collections
          </p>
        </FadeUp>
        <div className="mt-10">
          <Suspense fallback={<CatalogGridSkeleton count={8} />}>
            <CatalogsGrid />
          </Suspense>
        </div>
      </div>
    </section>
  );
}
