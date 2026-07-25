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

/** pdfjs + @napi-rs/canvas — works on Windows where sharp/libvips PDF is unavailable. */
async function renderPdfFirstPageWithPdfjs(
  pdfBytes: Buffer
): Promise<Buffer | null> {
  try {
    const { createCanvas } = await import("@napi-rs/canvas");
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const data = new Uint8Array(pdfBytes);
    const doc = await pdfjs.getDocument({
      data,
      useSystemFonts: true,
      disableFontFace: true,
    }).promise;
    try {
      const page = await doc.getPage(1);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(1.5, 800 / Math.max(base.width, 1));
      const viewport = page.getViewport({ scale });
      const w = Math.max(1, Math.min(1200, Math.ceil(viewport.width)));
      const h = Math.max(1, Math.min(1600, Math.ceil(viewport.height)));
      const canvas = createCanvas(w, h);
      const ctx = canvas.getContext("2d");
      const fitVp = page.getViewport({
        scale: Math.min(w / base.width, h / base.height),
      });
      await page.render({
        canvasContext: ctx as unknown as CanvasRenderingContext2D,
        viewport: fitVp,
        canvas: canvas as unknown as HTMLCanvasElement,
      }).promise;
      const out = canvas.toBuffer("image/webp");
      return out.byteLength > 500 ? out : null;
    } finally {
      await doc.cleanup?.();
    }
  } catch {
    return null;
  }
}

/**
 * Best-effort first page render → WebP.
 * Tries sharp (libvips PDF) first, then pdfjs + @napi-rs/canvas (Windows-safe).
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
    if (out.byteLength > 500) return out;
  } catch {
    // sharp PDF unsupported on many Windows hosts
  }
  return renderPdfFirstPageWithPdfjs(pdfBytes);
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

/** Remove every PDF object under catalogs/{catalogId}/ */
export async function deleteCatalogPdfObjects(catalogId: string) {
  if (!catalogId.trim() || !isSupabaseAdminConfigured()) return;
  const supabase = createSupabaseAdminClient();
  const prefix = `catalogs/${catalogId.trim()}`;
  const { data, error } = await supabase.storage.from(PDF_BUCKET).list(prefix, {
    limit: 100,
    offset: 0,
  });
  if (error || !data?.length) return;
  const paths = data
    .map((f) => f.name)
    .filter(Boolean)
    .map((name) => `${prefix}/${name}`);
  if (paths.length) {
    await supabase.storage.from(PDF_BUCKET).remove(paths);
  }
}
