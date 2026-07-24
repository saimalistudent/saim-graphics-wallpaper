import sharp from "sharp";

export type ImageOptimizeKind = "hero" | "promo" | "thumb" | "logo";

/** Display-aware caps — 2–3× CSS size so retina stays sharp, not soft */
const KIND_MAX_WIDTH: Record<ImageOptimizeKind, number> = {
  hero: 640,
  promo: 1080,
  thumb: 800,
  logo: 256,
};

const KIND_QUALITY: Record<ImageOptimizeKind, number> = {
  hero: 90,
  promo: 90,
  thumb: 88,
  logo: 90,
};

export function parseOptimizeKind(raw: string | null | undefined): ImageOptimizeKind {
  const k = (raw || "").trim().toLowerCase();
  if (k === "hero" || k === "promo" || k === "thumb" || k === "logo") return k;
  return "thumb";
}

/**
 * Compress uploads to HD WebP without visible blur.
 * Keeps aspect ratio; never upscales.
 */
export async function optimizeImageBuffer(
  input: Buffer,
  kind: ImageOptimizeKind = "thumb"
): Promise<{ buffer: Buffer; contentType: "image/webp"; ext: "webp" }> {
  const width = KIND_MAX_WIDTH[kind];
  const quality = KIND_QUALITY[kind];

  const buffer = await sharp(input)
    .rotate()
    .resize({
      width,
      withoutEnlargement: true,
      fit: "inside",
    })
    .webp({ quality, effort: 4 })
    .toBuffer();

  return { buffer, contentType: "image/webp", ext: "webp" };
}
