import { Catalog } from "@/lib/types";
import { pdfApiUrlFor } from "@/lib/pdf-prefetch";

/** Prefer CDN Storage URL; fall back to Drive proxy (rollback-safe). */
export function catalogPdfUrl(catalog: Pick<Catalog, "drive_file_id" | "pdf_url">): string {
  const stored = catalog.pdf_url?.trim();
  if (stored) return stored;
  return pdfApiUrlFor(catalog.drive_file_id);
}

export function catalogHasCdnPdf(catalog: Pick<Catalog, "pdf_url">): boolean {
  return Boolean(catalog.pdf_url?.trim());
}

export function catalogPdfCacheKey(
  catalog: Pick<Catalog, "id" | "drive_file_id" | "pdf_path">
): string {
  return catalog.pdf_path?.trim() || catalog.id || catalog.drive_file_id;
}
