import { notFound } from "next/navigation";
import { getCatalogById } from "@/lib/catalogs";
import { PdfViewer } from "@/components/PdfViewer";

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
  const catalog = await getCatalogById(id);

  if (!catalog) {
    notFound();
  }

  return (
    <section className="pdf-page-section">
      <div className="mx-auto max-w-none px-1.5 sm:px-3 lg:px-4 h-full pdf-page-inner">
        <PdfViewer key={catalog.id} catalog={catalog} />
      </div>
    </section>
  );
}
