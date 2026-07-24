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

async function main() {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error("Missing Supabase env");
    process.exit(1);
  }

  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: selErr } = await sb
    .from("catalogs")
    .select("id,pdf_url,pdf_path,pdf_bytes")
    .limit(1);

  if (selErr) {
    console.log("COLUMNS_MISSING:", selErr.message);
    console.log(
      "→ Supabase SQL Editor mein 004_catalog_pdf_storage.sql run karein"
    );
  } else {
    console.log("COLUMNS_OK");
  }

  const { data: buckets } = await sb.storage.listBuckets();
  if (!buckets?.some((b) => b.name === "catalog-pdfs")) {
    const { error } = await sb.storage.createBucket("catalog-pdfs", {
      public: true,
      fileSizeLimit: 50 * 1024 * 1024,
      allowedMimeTypes: ["application/pdf"],
    });
    console.log(error ? `BUCKET_ERR: ${error.message}` : "BUCKET_CREATED");
  } else {
    console.log("BUCKET_EXISTS");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
