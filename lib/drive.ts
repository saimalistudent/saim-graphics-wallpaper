/** Prefer a custom preview page for specific catalogs (title → page + local image) */
export const CATALOG_THUMBNAIL_OVERRIDES: Record<
  string,
  { url: string; page: number }
> = {
  "sg d1 (32) palling": {
    url: "/catalog-previews/sg-d1-32-palling-p2.jpg",
    page: 2,
  },
};

function normalizeCatalogTitle(title: string) {
  return title.toLowerCase().replace(/\s+/g, " ").trim();
}

export function getCatalogThumbnailOverride(title: string) {
  return CATALOG_THUMBNAIL_OVERRIDES[normalizeCatalogTitle(title)] ?? null;
}

export function applyCatalogThumbnailOverride<
  T extends { title: string; thumbnail_url: string | null },
>(catalog: T): T {
  const override = getCatalogThumbnailOverride(catalog.title);
  if (!override) return catalog;
  return { ...catalog, thumbnail_url: override.url };
}

export function getCatalogPreviewBadge(
  title: string,
  thumbnailUrl: string | null | undefined
): string | null {
  const override = getCatalogThumbnailOverride(title);
  if (override) return `Page ${override.page}`;
  if (isAutoDriveThumbnail(thumbnailUrl)) return "Page 1";
  return null;
}

export function getDriveEmbedUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

export function getDriveDownloadUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

/** First-page preview from Google Drive (no PDF download needed) */
export function getDriveThumbnailUrl(fileId: string, width = 1200): string {
  return `https://lh3.googleusercontent.com/d/${fileId}=w${width}`;
}

export function getDriveThumbnailFallbackUrl(fileId: string, width = 1200): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${width}`;
}

export function isAutoDriveThumbnail(url: string | null | undefined): boolean {
  if (!url) return false;
  return (
    url.includes("googleusercontent.com/d/") ||
    url.includes("drive.google.com/thumbnail")
  );
}

export function resolveCatalogThumbnail(
  driveFileId: string,
  uploadedThumb?: string | null
): string {
  if (uploadedThumb && uploadedThumb.trim()) {
    return uploadedThumb.trim();
  }
  return getDriveThumbnailUrl(extractDriveFileId(driveFileId));
}

export function extractDriveFileId(input: string): string {
  const trimmed = input.trim();

  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/,
    /^([a-zA-Z0-9_-]{10,})$/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) return match[1];
  }

  return trimmed;
}

export function buildWhatsAppUrl(
  phoneNumber: string,
  message: string
): string {
  const cleaned = phoneNumber.replace(/\D/g, "");
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
}

export function getWhatsAppNumber(): string {
  return process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.trim() ?? "";
}

export function getWhatsAppScreenshotMessage(catalogTitle: string): string {
  return `Hi, I like a design from ${catalogTitle}, sending screenshot`;
}
