import sharp from "sharp";

export type ImageOptimizeKind = "hero" | "promo" | "thumb" | "logo";

/**
 * Caps match on-screen CSS × ~3 (retina). Bigger uploads get shrunk;
 * never upscale. Keeps designs sharp without multi-MB CDN files.
 */
const KIND_MAX_WIDTH: Record<ImageOptimizeKind, number> = {
  // .hero-marquee-slide ≈ 8.25rem (~132px) → 3× ≈ 396
  hero: 420,
  // .promo-popup-card ≈ 21.5rem (~344px) → ~2.8× for crisp popup
  promo: 960,
  thumb: 720,
  logo: 192,
};

const KIND_QUALITY: Record<ImageOptimizeKind, number> = {
  hero: 86,
  promo: 88,
  thumb: 86,
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
    .webp({ quality, effort: 5 })
    .toBuffer();

  return { buffer, contentType: "image/webp", ext: "webp" };
}
