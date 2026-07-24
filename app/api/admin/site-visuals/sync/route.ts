import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { isAdminAuthenticated } from "@/lib/auth";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/client";
import { isSupabaseVisualUrl, VISUALS_BUCKET } from "@/lib/site-visuals";

export const runtime = "nodejs";
export const maxDuration = 60;

function readPublicWebp(rel: string): Buffer {
  const full = path.join(process.cwd(), "public", rel);
  if (!existsSync(full)) throw new Error(`Missing ${rel}`);
  return readFileSync(full);
}

/** One-click: local hero/promo → Supabase CDN + DB update */
export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      { error: "Supabase admin not configured" },
      { status: 500 }
    );
  }

  const sb = createSupabaseAdminClient();
  const log: string[] = [];

  async function upload(rel: string, objectPath: string) {
    const buf = readPublicWebp(rel);
    const { error } = await sb.storage.from(VISUALS_BUCKET).upload(objectPath, buf, {
      contentType: "image/webp",
      upsert: true,
      cacheControl: "31536000",
    });
    if (error) throw new Error(error.message);
    const { data } = sb.storage.from(VISUALS_BUCKET).getPublicUrl(objectPath);
    return data.publicUrl;
  }

  try {
    const { data: slides, error: slideErr } = await sb
      .from("hero_slides")
      .select("*")
      .order("sort_order", { ascending: true });

    if (slideErr) {
      return NextResponse.json(
        { error: slideErr.message + " — 003_hero_slides.sql?" },
        { status: 500 }
      );
    }

    const rows = slides ?? [];
    if (!rows.length) {
      const seeded = [];
      for (let i = 1; i <= 5; i++) {
        const cdn = await upload(
          `hero-slides/${i}.webp`,
          `hero/seed-${i}.webp`
        );
        seeded.push({
          image_url: cdn,
          sort_order: i,
          enabled: true,
          updated_at: new Date().toISOString(),
        });
        log.push(`seed slide ${i}`);
      }
      const { error } = await sb.from("hero_slides").insert(seeded);
      if (error) throw new Error(error.message);
    } else {
      for (const row of rows) {
        if (isSupabaseVisualUrl(row.image_url)) {
          log.push(`slide ${row.sort_order} already CDN`);
          continue;
        }
        const n = Number(row.sort_order) || 1;
        const cdn = await upload(
          `hero-slides/${n}.webp`,
          `hero/slide-${n}-${Date.now()}.webp`
        );
        const { error } = await sb
          .from("hero_slides")
          .update({ image_url: cdn, updated_at: new Date().toISOString() })
          .eq("id", row.id);
        if (error) throw new Error(error.message);
        log.push(`slide ${n} → CDN`);
      }
    }

    const { data: promoRows, error: promoErr } = await sb
      .from("promo_popup")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1);

    if (promoErr) {
      return NextResponse.json(
        { error: promoErr.message + " — 002_promo_popup.sql?" },
        { status: 500 }
      );
    }

    const existing = promoRows?.[0];
    if (existing && isSupabaseVisualUrl(existing.image_url)) {
      log.push("promo already CDN");
    } else {
      const cdn = await upload(
        "promo-popup-sample.webp",
        `promo/sample-${Date.now()}.webp`
      );
      if (existing?.id) {
        const { error } = await sb
          .from("promo_popup")
          .update({ image_url: cdn, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await sb.from("promo_popup").insert({
          enabled: true,
          title: "Special Offer",
          body: "",
          image_url: cdn,
          updated_at: new Date().toISOString(),
        });
        if (error) throw new Error(error.message);
      }
      log.push("promo → CDN");
    }

    return NextResponse.json({ ok: true, log });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Migrate fail" },
      { status: 500 }
    );
  }
}
