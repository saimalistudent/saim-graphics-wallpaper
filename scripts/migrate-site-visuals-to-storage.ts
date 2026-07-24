/**
 * Upload local hero slides + promo sample to Supabase Storage (CDN)
 * and point DB rows at those URLs.
 *
 * Usage: npx tsx scripts/migrate-site-visuals-to-storage.ts
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "fs";
import path from "path";

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

function isCdn(url: string | null | undefined) {
  return Boolean(url && url.includes("/storage/v1/object/public/thumbnails/"));
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Missing Supabase env");

  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const bucket = "thumbnails";
  const { data: buckets } = await sb.storage.listBuckets();
  if (!buckets?.some((b) => b.name === bucket)) {
    const { error } = await sb.storage.createBucket(bucket, {
      public: true,
      fileSizeLimit: 12 * 1024 * 1024,
    });
    if (error) throw error;
    console.log("Created bucket", bucket);
  }

  async function uploadLocal(
    localRel: string,
    objectPath: string
  ): Promise<string> {
    const full = path.join(process.cwd(), "public", localRel);
    if (!existsSync(full)) throw new Error(`Missing file ${localRel}`);
    const buf = readFileSync(full);
    const { error } = await sb.storage.from(bucket).upload(objectPath, buf, {
      contentType: "image/webp",
      upsert: true,
      cacheControl: "31536000",
    });
    if (error) throw error;
    const { data } = sb.storage.from(bucket).getPublicUrl(objectPath);
    return data.publicUrl;
  }

  // --- Hero slides ---
  const { data: slides, error: slideErr } = await sb
    .from("hero_slides")
    .select("*")
    .order("sort_order", { ascending: true });

  if (slideErr) {
    console.log("HERO_TABLE_ERR", slideErr.message);
    console.log("→ 003_hero_slides.sql run karein");
  } else {
    let rows = slides ?? [];
    if (!rows.length) {
      const seeded = [];
      for (let i = 1; i <= 5; i++) {
        const cdn = await uploadLocal(
          `hero-slides/${i}.webp`,
          `hero/seed-${i}.webp`
        );
        seeded.push({
          image_url: cdn,
          sort_order: i,
          enabled: true,
          updated_at: new Date().toISOString(),
        });
        console.log(`Seeded slide ${i}`);
      }
      const { error } = await sb.from("hero_slides").insert(seeded);
      if (error) throw error;
      rows = seeded as typeof rows;
    } else {
      for (const row of rows) {
        if (isCdn(row.image_url)) {
          console.log(`Slide ${row.sort_order}: already CDN`);
          continue;
        }
        const n = Number(row.sort_order) || 1;
        const local = `hero-slides/${n}.webp`;
        const objectPath = `hero/slide-${n}-${Date.now()}.webp`;
        const cdn = await uploadLocal(local, objectPath);
        const { error } = await sb
          .from("hero_slides")
          .update({
            image_url: cdn,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        if (error) throw error;
        console.log(`Slide ${n}: → CDN`);
      }
    }
  }

  // --- Promo ---
  const { data: promoRows, error: promoErr } = await sb
    .from("promo_popup")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1);

  if (promoErr) {
    console.log("PROMO_TABLE_ERR", promoErr.message);
    console.log("→ 002_promo_popup.sql run karein");
  } else {
    const existing = promoRows?.[0];
    if (existing && isCdn(existing.image_url)) {
      console.log("Promo: already CDN");
    } else {
      const cdn = await uploadLocal(
        "promo-popup-sample.webp",
        `promo/sample-${Date.now()}.webp`
      );
      if (existing?.id) {
        const { error } = await sb
          .from("promo_popup")
          .update({
            image_url: cdn,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("promo_popup").insert({
          enabled: true,
          title: "Special Offer",
          body: "",
          image_url: cdn,
          updated_at: new Date().toISOString(),
        });
        if (error) throw error;
      }
      console.log("Promo: → CDN");
    }
  }

  console.log("Done — site visuals on Supabase CDN.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
