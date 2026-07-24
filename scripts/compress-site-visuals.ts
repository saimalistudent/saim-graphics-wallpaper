/**
 * Re-compress existing CDN hero slides + promo to display-sized WebP.
 *
 * Usage: npx tsx scripts/compress-site-visuals.ts
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { optimizeImageBuffer } from "../lib/image-optimize";
import {
  VISUALS_BUCKET,
  visualsObjectPath,
  thumbnailsObjectPath,
} from "../lib/site-visuals";

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

function env(name: string) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

async function main() {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  async function recompress(
    label: string,
    imageUrl: string,
    kind: "hero" | "promo"
  ): Promise<{ url: string; before: number; after: number } | null> {
    const res = await fetch(imageUrl, {
      headers: { "User-Agent": "SaimGraphics-Visual-Compress/1.0" },
    });
    if (!res.ok) throw new Error(`download ${res.status}`);
    const input = Buffer.from(await res.arrayBuffer());
    const optimized = await optimizeImageBuffer(input, kind);
    // Skip rewrite if already tiny / no real savings
    if (optimized.buffer.byteLength >= input.byteLength * 0.95) {
      console.log(`  ${label}: skip (already small ${Math.round(input.length / 1024)}KB)`);
      return null;
    }

    const objectPath = visualsObjectPath(kind, optimized.ext);
    const { error: upErr } = await sb.storage
      .from(VISUALS_BUCKET)
      .upload(objectPath, optimized.buffer, {
        contentType: optimized.contentType,
        upsert: false,
        cacheControl: "31536000",
      });
    if (upErr) throw upErr;

    const { data: pub } = sb.storage
      .from(VISUALS_BUCKET)
      .getPublicUrl(objectPath);

    const oldPath = thumbnailsObjectPath(imageUrl);
    if (oldPath && oldPath !== objectPath) {
      await sb.storage.from(VISUALS_BUCKET).remove([oldPath]);
    }

    console.log(
      `  ${label}: ${Math.round(input.length / 1024)}KB → ${Math.round(optimized.buffer.byteLength / 1024)}KB`
    );
    return {
      url: pub.publicUrl,
      before: input.byteLength,
      after: optimized.buffer.byteLength,
    };
  }

  console.log("=== Hero slides ===");
  const { data: slides, error: slideErr } = await sb
    .from("hero_slides")
    .select("id, sort_order, image_url")
    .order("sort_order", { ascending: true });
  if (slideErr) throw slideErr;

  for (const row of slides ?? []) {
    if (!row.image_url?.includes("/storage/v1/object/public/thumbnails/")) {
      console.log(`  slide ${row.sort_order}: skip (not CDN)`);
      continue;
    }
    try {
      const result = await recompress(`slide ${row.sort_order}`, row.image_url, "hero");
      if (!result) continue;
      const { error } = await sb
        .from("hero_slides")
        .update({
          image_url: result.url,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (error) throw error;
    } catch (e) {
      console.log(
        `  slide ${row.sort_order}: FAIL`,
        e instanceof Error ? e.message : e
      );
    }
  }

  console.log("=== Promo popup ===");
  const { data: promo, error: promoErr } = await sb
    .from("promo_popup")
    .select("id, image_url")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (promoErr) throw promoErr;

  if (promo?.image_url?.includes("/storage/v1/object/public/thumbnails/")) {
    try {
      const result = await recompress("promo", promo.image_url, "promo");
      if (result) {
        const { error } = await sb
          .from("promo_popup")
          .update({
            image_url: result.url,
            updated_at: new Date().toISOString(),
          })
          .eq("id", promo.id);
        if (error) throw error;
      }
    } catch (e) {
      console.log("  promo: FAIL", e instanceof Error ? e.message : e);
    }
  } else {
    console.log("  promo: skip (not CDN)");
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
