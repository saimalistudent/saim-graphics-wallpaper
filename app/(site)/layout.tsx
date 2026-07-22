import { Navbar } from "@/components/layout/Navbar";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Footer } from "@/components/layout/Footer";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { PageVisitTracker } from "@/components/PageVisitTracker";
import { PageLoader } from "@/components/PageLoader";

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PageLoader>
      <PageVisitTracker />
      <div className="site-topbar">
        <Navbar />
        <AnnouncementBar />
      </div>
      <main className="flex-1">{children}</main>
      <Footer />
      <WhatsAppButton />
    </PageLoader>
  );
}
