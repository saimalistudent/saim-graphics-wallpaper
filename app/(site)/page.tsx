import { Hero } from "@/components/Hero";
import { FeaturedCategories } from "@/components/FeaturedCategories";
import { HowItWorks } from "@/components/HowItWorks";
import { getFeaturedCatalogs } from "@/lib/catalogs";
import { getHeroSlides } from "@/lib/hero-slides";
import { ScrollRestore } from "@/components/ScrollRestore";

export default async function HomePage() {
  const [catalogs, slides] = await Promise.all([
    getFeaturedCatalogs(8),
    getHeroSlides(),
  ]);

  return (
    <>
      <ScrollRestore storageKey="/" />
      <Hero slides={slides} />
      <FeaturedCategories catalogs={catalogs} />
      <HowItWorks />
    </>
  );
}
