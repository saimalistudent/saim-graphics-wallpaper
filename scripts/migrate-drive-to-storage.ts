/**
 * Migrate Drive PDFs → Supabase Storage (catalog-pdfs).
 *
 * Prerequisites:
 * 1. Run supabase/migrations/004_catalog_pdf_storage.sql
 * 2. Ensure .env.local has NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage: npx tsx scripts/migrate-drive-to-storage.ts
 */
import { createClient } from "@supabase/supabase-js";
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  statSync,
} from "fs";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
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

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const PDF_BUCKET = "catalog-pdfs";
const TMP = path.join(process.cwd(), ".pdf-migrate-tmp");

function env(name: string) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function driveUrls(fileId: string, confirm?: string) {
  const c = confirm ? `&confirm=${encodeURIComponent(confirm)}` : "&confirm=t";
  return [
    `https://drive.usercontent.google.com/download?id=${fileId}&export=download${c}`,
    `https://drive.google.com/uc?export=download&id=${fileId}${c}`,
  ];
}

function extractConfirm(html: string) {
  const m =
    html.match(/confirm=([0-9A-Za-z_-]+)/) ||
    html.match(/name="confirm"\s+value="([^"]+)"/);
  return m?.[1] && m[1] !== "t" ? m[1] : null;
}

function isPdf(buf: Buffer) {
  if (buf.byteLength < 5000) return false;
  if (buf.subarray(0, 5).toString("ascii") !== "%PDF-") return false;
  return buf.subarray(-8192).includes(Buffer.from("%%EOF"));
}

async function downloadDrive(fileId: string, outPath: string) {
  let confirm: string | undefined;
  for (let attempt = 0; attempt < 4; attempt++) {
    for (const url of driveUrls(fileId, confirm)) {
      const res = await fetch(url, {
        headers: { "User-Agent": UA },
        redirect: "follow",
      });
      if (!res.ok || !res.body) continue;
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("text/html")) {
        const html = await res.text();
        const token = extractConfirm(html);
        if (token) {
          confirm = token;
          break;
        }
        continue;
      }
      await pipeline(
        Readable.fromWeb(
          res.body as unknown as import("stream/web").ReadableStream
        ),
        createWriteStream(outPath)
      );
      const buf = readFileSync(outPath);
      if (!isPdf(buf)) {
        unlinkSync(outPath);
        throw new Error("Incomplete PDF");
      }
      return buf.byteLength;
    }
  }
  throw new Error("Drive download failed");
}

async function main() {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (!existsSync(TMP)) mkdirSync(TMP, { recursive: true });

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

  const { data: rows, error } = await supabase
    .from("catalogs")
    .select("id, title, drive_file_id, pdf_url, thumbnail_url")
    .order("title");

  if (error) throw error;

  const list = (rows ?? []).filter((r) => r.drive_file_id && !r.pdf_url);
  console.log(`To migrate: ${list.length}`);

  for (const row of list) {
    const tmpFile = path.join(TMP, `${row.id}.pdf`);
    process.stdout.write(`→ ${row.title} ... `);
    try {
      const localCache = path.join(
        process.cwd(),
        ".pdf-cache",
        `${row.drive_file_id}.pdf`
      );
      let bytes = 0;
      if (existsSync(localCache) && isPdf(readFileSync(localCache))) {
        bytes = statSync(localCache).size;
        await pipeline(
          Readable.from(readFileSync(localCache)),
          createWriteStream(tmpFile)
        );
      } else {
        bytes = await downloadDrive(row.drive_file_id, tmpFile);
      }

      const objectPath = `catalogs/${row.id}/migrated-${Date.now()}.pdf`;
      const fileBuf = readFileSync(tmpFile);
      const { error: upErr } = await supabase.storage
        .from(PDF_BUCKET)
        .upload(objectPath, fileBuf, {
          contentType: "application/pdf",
          upsert: true,
          cacheControl: "31536000",
        });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage
        .from(PDF_BUCKET)
        .getPublicUrl(objectPath);

      const { error: updErr } = await supabase
        .from("catalogs")
        .update({
          pdf_url: pub.publicUrl,
          pdf_path: objectPath,
          pdf_bytes: bytes,
        })
        .eq("id", row.id);
      if (updErr) throw updErr;

      console.log(`OK (${Math.round(bytes / 1024 / 1024)}MB)`);
    } catch (e) {
      console.log("FAIL", e instanceof Error ? e.message : e);
    } finally {
      try {
        if (existsSync(tmpFile)) unlinkSync(tmpFile);
      } catch {
        // ignore
      }
    }
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
