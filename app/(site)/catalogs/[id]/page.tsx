import { notFound } from "next/navigation";
import { getCatalogById } from "@/lib/catalogs";
import { getContactSettings } from "@/lib/contact";
import { PdfViewer } from "@/components/PdfViewer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const catalog = await getCatalogById(id);
  return {
    title: catalog
      ? `${catalog.title} | SAIM GRAPHICS`
      : "Catalog | SAIM GRAPHICS",
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
      <div className="w-full h-full pdf-page-inner">
        <PdfViewer key={catalog.id} catalog={catalog} contact={contact} />
      </div>
    </section>
  );
}
