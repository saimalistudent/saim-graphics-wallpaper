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
    <section className="catalogs-page-section py-10 sm:py-14">
      <ScrollRestore storageKey="/catalogs" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FadeUp>
          <div className="catalogs-page-header">
            <p className="catalogs-page-eyebrow">SAIM GRAPHICS</p>
            <h1 className="catalogs-page-title font-heading font-black uppercase">
              Wallpaper Designs
            </h1>
            <div className="catalogs-page-rule" aria-hidden>
              <span />
              <i />
              <span />
            </div>
            <p className="catalogs-page-sub">
              Browse all our design collections
            </p>
          </div>
        </FadeUp>
        <div className="mt-8 sm:mt-10">
          <Suspense fallback={<CatalogGridSkeleton count={8} />}>
            <CatalogsGrid />
          </Suspense>
        </div>
      </div>
    </section>
  );
}
