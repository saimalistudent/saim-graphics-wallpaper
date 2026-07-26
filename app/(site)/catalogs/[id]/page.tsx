import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCatalogById } from "@/lib/catalogs";
import { getContactSettings } from "@/lib/contact";
import { PdfViewer } from "@/components/PdfViewer";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildProductJsonLd, SEO_DESCRIPTION } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const catalog = await getCatalogById(id);
  const base = getSiteUrl();

  if (!catalog) {
    return {
      title: "Catalog",
      description: SEO_DESCRIPTION,
    };
  }

  const title = `${catalog.title} — 3D Wallpaper Catalog`;
  const description = `${catalog.title}: 3D panaflex wallpaper designs from Saim Graphics in Gujranwala. Browse & order flex wallpaper printing via WhatsApp.`;
  const image = catalog.thumbnail_url || "/logo.webp";
  const url = `${base}/catalogs/${catalog.id}`;

  return {
    title,
    description,
    alternates: { canonical: `/catalogs/${catalog.id}` },
    openGraph: {
      type: "website",
      locale: "en_PK",
      url,
      siteName: "Saim Graphics",
      title: `${title} | Saim Graphics`,
      description,
      images: [{ url: image, alt: catalog.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | Saim Graphics`,
      description,
      images: [image],
    },
  };
}

export default async function CatalogViewerPage({ params }: Props) {
  const { id } = await params;
  const [catalog, contact] = await Promise.all([
    getCatalogById(id),
    getContactSettings(),
  ]);

  if (!catalog) {
    notFound();
  }

  return (
    <section className="pdf-page-section">
      <JsonLd data={buildProductJsonLd(catalog)} />
      <div className="w-full h-full pdf-page-inner">
        <PdfViewer key={catalog.id} catalog={catalog} contact={contact} />
      </div>
    </section>
  );
}
