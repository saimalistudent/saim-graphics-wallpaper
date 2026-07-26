import type { MetadataRoute } from "next";
import { getCatalogs } from "@/lib/catalogs";
import { getSiteUrl } from "@/lib/site-url";

/** Always include latest catalogs for Google Search Console */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const now = new Date();

  let catalogs: Awaited<ReturnType<typeof getCatalogs>> = [];
  try {
    catalogs = await getCatalogs();
  } catch {
    catalogs = [];
  }

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: base,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${base}/catalogs`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];

  const catalogEntries: MetadataRoute.Sitemap = catalogs.map((c) => ({
    url: `${base}/catalogs/${c.id}`,
    lastModified: c.created_at ? new Date(c.created_at) : now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticEntries, ...catalogEntries];
}
