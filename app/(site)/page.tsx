import { Hero } from "@/components/Hero";
import { FeaturedCategories } from "@/components/FeaturedCategories";
import { HowItWorks } from "@/components/HowItWorks";
import { getFeaturedCatalogs } from "@/lib/catalogs";
import { ScrollRestore } from "@/components/ScrollRestore";

export default async function HomePage() {
  const catalogs = await getFeaturedCatalogs(8);

  return (
    <>
      <ScrollRestore storageKey="/" />
      <Hero />
      <FeaturedCategories catalogs={catalogs} />
      <HowItWorks />
    </>
  );
}
