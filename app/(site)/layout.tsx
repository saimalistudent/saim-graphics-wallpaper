import { Navbar } from "@/components/layout/Navbar";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Footer } from "@/components/layout/Footer";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { PageVisitTracker } from "@/components/PageVisitTracker";
import { PageLoader } from "@/components/PageLoader";
import { PromoPopup } from "@/components/PromoPopup";
import { getActivePromoPopup } from "@/lib/promo-popup";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const promo = await getActivePromoPopup();

  return (
    <PageLoader preloadSrc={promo?.image_url}>
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
