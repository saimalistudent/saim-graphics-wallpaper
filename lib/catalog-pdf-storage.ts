import sharp from "sharp";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/client";
import { getDriveThumbnailUrl } from "@/lib/drive";
import { optimizeImageBuffer } from "@/lib/image-optimize";

const PDF_BUCKET = "catalog-pdfs";
const THUMB_BUCKET = "thumbnails";

export { PDF_BUCKET, THUMB_BUCKET };

export function catalogPdfObjectPath(catalogId: string, fileName?: string) {
  const safe =
    (fileName || "catalog.pdf")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/\.pdf$/i, "")
      .slice(0, 80) || "catalog";
  return `catalogs/${catalogId}/${Date.now()}-${safe}.pdf`;
}

export async function ensureCatalogPdfsBucket() {
  if (!isSupabaseAdminConfigured()) {
    throw new Error("Supabase admin not configured");
  }
  const supabase = createSupabaseAdminClient();
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === PDF_BUCKET);
  if (exists) return;

  const { error } = await supabase.storage.createBucket(PDF_BUCKET, {
    public: true,
    fileSizeLimit: 50 * 1024 * 1024,
    allowedMimeTypes: ["application/pdf"],
  });
  if (error && !/already exists/i.test(error.message)) {
    throw new Error(error.message);
  }
}

export function publicObjectUrl(bucket: string, path: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/** Cache Drive first-page thumb into our CDN (fast list previews). */
export async function cacheDriveFirstPageThumb(
  driveFileId: string,
  catalogId: string
): Promise<string | null> {
  if (!isSupabaseAdminConfigured() || !driveFileId) return null;

  try {
    const src = getDriveThumbnailUrl(driveFileId, 800);
    const res = await fetch(src, {
      headers: { "User-Agent": "Mozilla/5.0" },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("text/html")) return null;

    const input = Buffer.from(await res.arrayBuffer());
    if (input.byteLength < 1000) return null;

    const optimized = await optimizeImageBuffer(input, "thumb");
    const supabase = createSupabaseAdminClient();
    const path = `catalog-previews/${catalogId}-${Date.now()}.webp`;

    const { error } = await supabase.storage
      .from(THUMB_BUCKET)
      .upload(path, optimized.buffer, {
        contentType: optimized.contentType,
        upsert: true,
        cacheControl: "31536000",
      });
    if (error) return null;

    return publicObjectUrl(THUMB_BUCKET, path);
  } catch {
    return null;
  }
}

/**
 * Best-effort first page render from PDF bytes via sharp (when libvips PDF works).
 * Returns null if unsupported on this host — caller should keep Drive/auto thumb.
 */
export async function renderPdfFirstPageWebp(
  pdfBytes: Buffer
): Promise<Buffer | null> {
  try {
    const out = await sharp(pdfBytes, { density: 120, page: 0 })
      .rotate()
      .resize({ width: 800, withoutEnlargement: true })
      .webp({ quality: 88, effort: 4 })
      .toBuffer();
    return out.byteLength > 500 ? out : null;
  } catch {
    return null;
  }
}

export async function uploadFirstPageWebp(
  catalogId: string,
  webp: Buffer
): Promise<string | null> {
  if (!isSupabaseAdminConfigured()) return null;
  const supabase = createSupabaseAdminClient();
  const path = `catalog-previews/${catalogId}-p1-${Date.now()}.webp`;
  const { error } = await supabase.storage.from(THUMB_BUCKET).upload(path, webp, {
    contentType: "image/webp",
    upsert: true,
    cacheControl: "31536000",
  });
  if (error) return null;
  return publicObjectUrl(THUMB_BUCKET, path);
}

export async function deleteStorageObject(
  bucket: string,
  path: string | null | undefined
) {
  if (!path?.trim() || !isSupabaseAdminConfigured()) return;
  const supabase = createSupabaseAdminClient();
  await supabase.storage.from(bucket).remove([path.trim()]);
}
