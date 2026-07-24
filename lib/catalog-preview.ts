import { Catalog } from "@/lib/types";
import {
  extractDriveFileId,
  getDriveThumbnailUrl,
  isAutoDriveThumbnail,
} from "@/lib/drive";

/**
 * Exact URL CatalogCard will request for the preview image.
 * Used by PageLoader so splash waits until previews are decoded.
 */
export function catalogPreviewSrc(
  catalog: Pick<Catalog, "thumbnail_url" | "drive_file_id">
): string | null {
  const preferred = catalog.thumbnail_url?.trim() || null;
  if (preferred && !isAutoDriveThumbnail(preferred)) {
    return preferred;
  }
  if (preferred) return preferred;
  const fileId = extractDriveFileId(catalog.drive_file_id);
  if (!fileId) return null;
  return getDriveThumbnailUrl(fileId, 400);
}
