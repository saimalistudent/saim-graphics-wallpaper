import { Hero } from "@/components/Hero";
import { FeaturedCategories } from "@/components/FeaturedCategories";
import { HowItWorks } from "@/components/HowItWorks";
import { getFeaturedCatalogs } from "@/lib/catalogs";
import { getContactSettings } from "@/lib/contact";
import { getHeroSlides } from "@/lib/hero-slides";
import { ScrollRestore } from "@/components/ScrollRestore";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const [catalogs, slides, contact] = await Promise.all([
    getFeaturedCatalogs(),
    getHeroSlides(),
    getContactSettings(),
  ]);

  return (
    <>
      <ScrollRestore storageKey="/" />
      <Hero
        slides={slides}
        facebookUrl={contact.facebook_url}
        tiktokUrl={contact.tiktok_url}
        locationUrl={contact.location_url}
      />
      <FeaturedCategories catalogs={catalogs} />
      <HowItWorks />
    </>
  );
}
