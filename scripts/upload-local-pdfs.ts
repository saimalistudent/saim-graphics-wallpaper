/**
 * Upload local PDFs from a folder into Supabase catalog-pdfs + catalogs rows.
 *
 * Usage:
 *   npx tsx scripts/upload-local-pdfs.ts
 *   FOLDER="C:\\path\\to\\pdfs" npx tsx scripts/upload-local-pdfs.ts
 *   SKIP_THUMBS=1 npx tsx scripts/upload-local-pdfs.ts
 */
import { createClient } from "@supabase/supabase-js";
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
} from "fs";
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

loadEnvLocal();

const PDF_BUCKET = "catalog-pdfs";
const THUMB_BUCKET = "thumbnails";
const DEFAULT_FOLDER =
  "c:\\Users\\ARSAM\\Desktop\\3D PANAFLEX WALLPAPER Design";

function env(name: string) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function cleanTitle(fileName: string) {
  return fileName
    .replace(/\.pdf$/i, "")
    .replace(/\s+ok$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function safePdfBase(fileName: string) {
  return (
    fileName
      .replace(/\.pdf$/i, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "catalog"
  );
}

function listPdfsRecursive(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listPdfsRecursive(full));
    } else if (entry.isFile() && /\.pdf$/i.test(entry.name)) {
      out.push(full);
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function isPdf(buf: Buffer) {
  return buf.byteLength >= 100 && buf.subarray(0, 5).toString("ascii") === "%PDF-";
}

async function renderFirstPageWebp(pdfBytes: Buffer): Promise<Buffer | null> {
  try {
    const sharp = (await import("sharp")).default;
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

async function main() {
  const folder = (process.env.FOLDER || DEFAULT_FOLDER).trim();
  const skipThumbs = /^(1|true|yes)$/i.test(process.env.SKIP_THUMBS || "");

  if (!existsSync(folder)) {
    console.error(`Folder not found: ${folder}`);
    process.exit(1);
  }

  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.some((b) => b.name === PDF_BUCKET)) {
    const { error } = await supabase.storage.createBucket(PDF_BUCKET, {
      public: true,
      fileSizeLimit: 50 * 1024 * 1024,
      allowedMimeTypes: ["application/pdf"],
    });
    if (error) throw error;
    console.log("Created bucket", PDF_BUCKET);
  }

  const pdfPaths = listPdfsRecursive(folder);
  console.log(`Found ${pdfPaths.length} PDF(s) in ${folder}`);

  const { data: existingRows, error: listErr } = await supabase
    .from("catalogs")
    .select("id, title, pdf_url, pdf_path, thumbnail_url");
  if (listErr) throw listErr;

  const byTitle = new Map<string, { id: string; pdf_url: string | null; pdf_path: string | null; thumbnail_url: string | null }>();
  for (const row of existingRows ?? []) {
    const keyTitle = String(row.title || "").trim().toLowerCase();
    if (keyTitle && !byTitle.has(keyTitle)) {
      byTitle.set(keyTitle, {
        id: row.id,
        pdf_url: row.pdf_url,
        pdf_path: row.pdf_path,
        thumbnail_url: row.thumbnail_url,
      });
    }
  }

  let uploaded = 0;
  let failed = 0;
  let created = 0;
  let updated = 0;
  let thumbsOk = 0;
  let thumbsSkip = 0;
  const failures: string[] = [];

  for (const filePath of pdfPaths) {
    const baseName = path.basename(filePath);
    const title = cleanTitle(baseName);
    const titleKey = title.toLowerCase();
    const bytes = statSync(filePath).size;
    process.stdout.write(`→ ${title} (${Math.round(bytes / 1024 / 1024)}MB) ... `);

    try {
      const buf = readFileSync(filePath);
      if (!isPdf(buf)) throw new Error("Not a valid PDF header");

      let catalogId: string;
      const existing = byTitle.get(titleKey);
      const isUpdate = Boolean(existing);

      if (existing) {
        catalogId = existing.id;
        if (existing.pdf_path) {
          await supabase.storage.from(PDF_BUCKET).remove([existing.pdf_path]);
        }
      } else {
        const driveFileId = `manual-pdf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const { data: inserted, error: insErr } = await supabase
          .from("catalogs")
          .insert({
            title,
            drive_file_id: driveFileId,
            thumbnail_url: null,
          })
          .select("id")
          .single();
        if (insErr || !inserted?.id) {
          throw new Error(insErr?.message || "Insert failed");
        }
        catalogId = inserted.id;
        byTitle.set(titleKey, {
          id: catalogId,
          pdf_url: null,
          pdf_path: null,
          thumbnail_url: null,
        });
        created += 1;
      }

      const objectPath = `catalogs/${catalogId}/${Date.now()}-${safePdfBase(baseName)}.pdf`;
      const { error: upErr } = await supabase.storage
        .from(PDF_BUCKET)
        .upload(objectPath, buf, {
          contentType: "application/pdf",
          upsert: true,
          cacheControl: "31536000",
        });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage
        .from(PDF_BUCKET)
        .getPublicUrl(objectPath);

      const patch: Record<string, unknown> = {
        pdf_url: pub.publicUrl,
        pdf_path: objectPath,
        pdf_bytes: bytes,
        title,
      };

      let thumbNote = "thumb=skip";
      if (!skipThumbs) {
        const webp = await renderFirstPageWebp(buf);
        if (webp) {
          const thumbPath = `catalog-previews/${catalogId}-p1-${Date.now()}.webp`;
          const { error: thumbErr } = await supabase.storage
            .from(THUMB_BUCKET)
            .upload(thumbPath, webp, {
              contentType: "image/webp",
              upsert: true,
              cacheControl: "31536000",
            });
          if (!thumbErr) {
            const { data: thumbPub } = supabase.storage
              .from(THUMB_BUCKET)
              .getPublicUrl(thumbPath);
            patch.thumbnail_url = thumbPub.publicUrl;
            thumbsOk += 1;
            thumbNote = "thumb=ok";
          } else {
            thumbsSkip += 1;
            thumbNote = `thumb=upload-fail`;
          }
        } else {
          thumbsSkip += 1;
          thumbNote = "thumb=render-unsupported";
        }
      } else {
        thumbsSkip += 1;
      }

      const { error: updErr } = await supabase
        .from("catalogs")
        .update(patch)
        .eq("id", catalogId);
      if (updErr) throw updErr;

      byTitle.set(titleKey, {
        id: catalogId,
        pdf_url: pub.publicUrl,
        pdf_path: objectPath,
        thumbnail_url: (patch.thumbnail_url as string) || existing?.thumbnail_url || null,
      });

      if (isUpdate) updated += 1;
      uploaded += 1;
      console.log(`OK ${isUpdate ? "update" : "create"} ${thumbNote}`);
    } catch (e) {
      failed += 1;
      const msg = e instanceof Error ? e.message : String(e);
      failures.push(`${title}: ${msg}`);
      console.log("FAIL", msg);
    }
  }

  console.log("\n=== Summary ===");
  console.log(`Found: ${pdfPaths.length}`);
  console.log(`Uploaded OK: ${uploaded}`);
  console.log(`Created catalogs: ${created}`);
  console.log(`Updated catalogs: ${updated}`);
  console.log(`Failed: ${failed}`);
  console.log(`Thumbs OK: ${thumbsOk}`);
  console.log(`Thumbs skipped/failed: ${thumbsSkip}`);
  if (failures.length) {
    console.log("Failures:");
    for (const f of failures) console.log(`  - ${f}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
