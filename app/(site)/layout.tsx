import { Navbar } from "@/components/layout/Navbar";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Footer } from "@/components/layout/Footer";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { PageVisitTracker } from "@/components/PageVisitTracker";
import { PageLoader } from "@/components/PageLoader";
import { PromoPopup } from "@/components/PromoPopup";
import { getActivePromoPopup, promoImageSrc } from "@/lib/promo-popup";
import { getHeroSlides } from "@/lib/hero-slides";
import { getCatalogs } from "@/lib/catalogs";
import { catalogPreviewSrc } from "@/lib/catalog-preview";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [promo, slides, catalogs] = await Promise.all([
    getActivePromoPopup(),
    getHeroSlides(),
    getCatalogs(),
  ]);

  // Splash holds until logo, promo, hero slides, AND all PDF previews decode
  const preloadSrcs = [
    "/logo.webp",
    promoImageSrc(promo?.image_url),
    ...slides.map((s) => s.image_url),
    ...catalogs.map((c) => catalogPreviewSrc(c)),
  ].filter(Boolean) as string[];

  return (
    <>
      {preloadSrcs.map((src) => (
        <link key={src} rel="preload" as="image" href={src} />
      ))}
      <PageLoader preloadSrcs={preloadSrcs}>
        <PageVisitTracker />
        <div className="site-topbar">
          <Navbar />
          <AnnouncementBar />
        </div>
        <main className="flex-1">{children}</main>
        <Footer />
        <WhatsAppButton />
        {promo && <PromoPopup promo={promo} />}
      </PageLoader>
    </>
  );
}
