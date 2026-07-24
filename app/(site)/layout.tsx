import { Navbar } from "@/components/layout/Navbar";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Footer } from "@/components/layout/Footer";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { PageVisitTracker } from "@/components/PageVisitTracker";
import { PageLoader } from "@/components/PageLoader";
import { PromoPopup } from "@/components/PromoPopup";
import { getActivePromoPopup, promoImageSrc } from "@/lib/promo-popup";
import { getHeroSlides } from "@/lib/hero-slides";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [promo, slides] = await Promise.all([
    getActivePromoPopup(),
    getHeroSlides(),
  ]);

  // Only block splash on first 2 slides + promo — rest lazy-load after open
  const preloadSrcs = [
    promoImageSrc(promo?.image_url),
    ...slides.slice(0, 2).map((s) => s.image_url),
  ];

  return (
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
  );
}
