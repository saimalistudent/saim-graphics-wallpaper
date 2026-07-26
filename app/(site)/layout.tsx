import { Navbar } from "@/components/layout/Navbar";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Footer } from "@/components/layout/Footer";
import { ContactFab } from "@/components/ContactFab";
import { PageVisitTracker } from "@/components/PageVisitTracker";
import { PageLoader } from "@/components/PageLoader";
import { PromoPopup } from "@/components/PromoPopup";
import { JsonLd } from "@/components/seo/JsonLd";
import { getActivePromoPopup, promoImageSrc } from "@/lib/promo-popup";
import { getHeroSlides } from "@/lib/hero-slides";
import { getCatalogs } from "@/lib/catalogs";
import { getContactSettings } from "@/lib/contact";
import { catalogPreviewSrc } from "@/lib/catalog-preview";
import { buildLocalBusinessJsonLd } from "@/lib/seo";

/** Always fresh — admin edits (contact, promo, hero, catalogs) must show immediately */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [promo, slides, catalogs, contact] = await Promise.all([
    getActivePromoPopup(),
    getHeroSlides(),
    getCatalogs(),
    getContactSettings(),
  ]);

  // Splash holds until logo, promo, hero slides, AND all PDF previews decode
  const preloadSrcs = [
    "/logo.webp",
    promoImageSrc(promo?.image_url),
    ...slides.map((s) => s.image_url),
    ...catalogs.map((c) => catalogPreviewSrc(c)),
  ].filter(Boolean) as string[];

  const localBusinessLd = buildLocalBusinessJsonLd({
    telephone: contact.call_phone,
    whatsapp: contact.whatsapp_phone,
    facebookUrl: contact.facebook_url,
    tiktokUrl: contact.tiktok_url,
    locationUrl: contact.location_url,
  });

  return (
    <>
      <JsonLd data={localBusinessLd} />
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
        <ContactFab settings={contact} />
        {promo && <PromoPopup promo={promo} />}
      </PageLoader>
    </>
  );
}
