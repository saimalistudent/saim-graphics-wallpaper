import type { Metadata } from "next";
import { Suspense } from "react";
import { FadeUp } from "@/components/FadeUp";
import { CatalogGridSkeleton } from "@/components/ui/Skeleton";
import { CatalogsGrid } from "@/components/CatalogsGrid";
import { ScrollRestore } from "@/components/ScrollRestore";
import { getSiteUrl } from "@/lib/site-url";

const title = "3D Wallpaper Design Catalogs in Gujranwala";
const description =
  "Browse 3D panaflex wallpaper catalogs from Saim Graphics in Gujranwala. Flex printing, custom wallpaper & print on demand — order via WhatsApp.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/catalogs" },
  openGraph: {
    type: "website",
    locale: "en_PK",
    url: `${getSiteUrl()}/catalogs`,
    siteName: "Saim Graphics",
    title: `${title} | Saim Graphics`,
    description,
    images: [
      {
        url: "/logo.webp",
        alt: "Saim Graphics wallpaper catalogs",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: `${title} | Saim Graphics`,
    description,
    images: ["/logo.webp"],
  },
};

/** Always fetch fresh categories + catalogs (admin edits must show live) */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function CatalogsPage() {
  return (
    <section className="catalogs-page-section py-10 sm:py-14">
      <ScrollRestore storageKey="/catalogs" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FadeUp>
          <header className="catalogs-page-header">
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
          </header>
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
