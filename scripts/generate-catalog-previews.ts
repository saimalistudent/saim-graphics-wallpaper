/**
 * Render page 1 of each catalog PDF → WebP thumb → Supabase thumbnails bucket.
 *
 * Usage:
 *   npx tsx scripts/generate-catalog-previews.ts
 *   FORCE=1 npx tsx scripts/generate-catalog-previews.ts
 */
import { createClient } from "@supabase/supabase-js";
import { createCanvas } from "@napi-rs/canvas";
import { existsSync, readFileSync } from "fs";
import path from "path";
import sharp from "sharp";

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

const PDF_BUCKET = "catalog-pdfs";
const THUMB_BUCKET = "thumbnails";

function env(name: string) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function hasValidCdnThumb(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  const u = url.trim();
  return (
    u.includes("/storage/v1/object/public/thumbnails/") ||
    (u.includes("supabase") && u.includes("/thumbnails/") && u.includes("catalog-previews"))
  );
}

async function renderWithSharp(pdfBytes: Buffer): Promise<Buffer | null> {
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

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

async function renderWithPdfjs(pdfBytes: Buffer): Promise<Buffer | null> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(pdfBytes);
  const doc = await pdfjs.getDocument({
    data,
    useSystemFonts: true,
    disableFontFace: true,
    isEvalSupported: false,
    verbosity: 0,
  }).promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    // Cap resolution so huge pages don't OOM on Windows
    const scale = Math.min(1.5, 800 / Math.max(base.width, 1));
    const viewport = page.getViewport({ scale });
    const w = Math.max(1, Math.min(1200, Math.ceil(viewport.width)));
    const h = Math.max(1, Math.min(1600, Math.ceil(viewport.height)));
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext("2d");
    // If we capped size, re-fit viewport to canvas
    const fitVp = page.getViewport({
      scale: Math.min(w / base.width, h / base.height),
    });
    await page.render({
      canvasContext: ctx as unknown as CanvasRenderingContext2D,
      viewport: fitVp,
      canvas,
    }).promise;
    const out = canvas.toBuffer("image/webp");
    return out.byteLength > 500 ? out : null;
  } finally {
    await doc.cleanup?.();
  }
}

async function renderFirstPageWebp(pdfBytes: Buffer): Promise<Buffer | null> {
  // Skip sharp on Windows — libvips PDF usually unsupported and only wastes time
  if (process.platform !== "win32") {
    const viaSharp = await renderWithSharp(pdfBytes);
    if (viaSharp) return viaSharp;
  }
  return renderWithPdfjs(pdfBytes);
}

async function main() {
  const force = /^(1|true|yes)$/i.test(process.env.FORCE || "");
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: rows, error } = await supabase
    .from("catalogs")
    .select("id, title, pdf_url, pdf_path, thumbnail_url")
    .order("title", { ascending: true });
  if (error) throw error;

  const catalogs = (rows ?? []).filter((r) => r.pdf_path || r.pdf_url);
  console.log(
    `Catalogs with PDF: ${catalogs.length} (FORCE=${force ? "1" : "0"})`
  );

  let ok = 0;
  let skipped = 0;
  let failed = 0;
  const failures: string[] = [];

  for (let i = 0; i < catalogs.length; i++) {
    const cat = catalogs[i];
    const label = `[${i + 1}/${catalogs.length}] ${cat.title}`;

    if (!force && hasValidCdnThumb(cat.thumbnail_url)) {
      skipped += 1;
      console.log(`${label} … skip (thumb exists)`);
      continue;
    }

    process.stdout.write(`${label} … `);
    try {
      const work = (async () => {
        let pdfBuf: Buffer | null = null;

        if (cat.pdf_path) {
          const { data, error: dlErr } = await supabase.storage
            .from(PDF_BUCKET)
            .download(cat.pdf_path);
          if (dlErr || !data) {
            throw new Error(dlErr?.message || "PDF download failed");
          }
          pdfBuf = Buffer.from(await data.arrayBuffer());
        } else if (cat.pdf_url) {
          const res = await fetch(cat.pdf_url, { redirect: "follow" });
          if (!res.ok) throw new Error(`HTTP ${res.status} fetching pdf_url`);
          pdfBuf = Buffer.from(await res.arrayBuffer());
        }

        if (!pdfBuf || pdfBuf.byteLength < 100) {
          throw new Error("Empty PDF bytes");
        }
        if (pdfBuf.subarray(0, 5).toString("ascii") !== "%PDF-") {
          throw new Error("Not a PDF");
        }

        const webp = await renderFirstPageWebp(pdfBuf);
        if (!webp) throw new Error("Render returned empty");

        const thumbPath = `catalog-previews/${cat.id}-p1-${Date.now()}.webp`;
        const { error: upErr } = await supabase.storage
          .from(THUMB_BUCKET)
          .upload(thumbPath, webp, {
            contentType: "image/webp",
            upsert: true,
            cacheControl: "31536000",
          });
        if (upErr) throw new Error(`Upload: ${upErr.message}`);

        const { data: pub } = supabase.storage
          .from(THUMB_BUCKET)
          .getPublicUrl(thumbPath);

        const { error: updErr } = await supabase
          .from("catalogs")
          .update({ thumbnail_url: pub.publicUrl })
          .eq("id", cat.id);
        if (updErr) throw new Error(`DB: ${updErr.message}`);

        return webp;
      })();

      const webp = await withTimeout(work, 120_000, "preview");
      ok += 1;
      console.log(`OK (${Math.round(webp.byteLength / 1024)}KB)`);
    } catch (e) {
      failed += 1;
      const msg = e instanceof Error ? e.message : String(e);
      failures.push(`${cat.title}: ${msg}`);
      console.log(`FAIL ${msg}`);
    }
  }

  console.log("\n=== Summary ===");
  console.log(`Generated: ${ok}`);
  console.log(`Skipped (existing): ${skipped}`);
  console.log(`Failed: ${failed}`);
  if (failures.length) {
    console.log("Failures:");
    for (const f of failures) console.log(`  - ${f}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
