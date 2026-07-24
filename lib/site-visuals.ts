import { ImageOptimizeKind } from "@/lib/image-optimize";

const VISUALS_BUCKET = "thumbnails";

const KIND_FOLDER: Record<ImageOptimizeKind, string> = {
  hero: "hero",
  promo: "promo",
  thumb: "thumbs",
  logo: "logo",
};

export function visualsObjectPath(
  kind: ImageOptimizeKind,
  ext = "webp"
): string {
  const folder = KIND_FOLDER[kind] || "thumbs";
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  return `${folder}/${name}`;
}

/** Extract object path from public thumbnails URL (any folder). */
export function thumbnailsObjectPath(
  url: string | null | undefined
): string | null {
  if (!url || url.startsWith("/")) return null;
  const marker = "/storage/v1/object/public/thumbnails/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const path = decodeURIComponent(url.slice(idx + marker.length).split("?")[0]);
  return path || null;
}

export function isSupabaseVisualUrl(url: string | null | undefined): boolean {
  return Boolean(url && url.includes("/storage/v1/object/public/thumbnails/"));
}

export { VISUALS_BUCKET };
