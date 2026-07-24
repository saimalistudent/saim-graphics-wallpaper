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
  if (!url || !key) throw new Error("Missing env");

  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await sb
    .from("catalogs")
    .select("id, title, pdf_url, pdf_bytes, pdf_path")
    .order("title");

  if (error) {
    console.error("ERR", error.message);
    process.exit(1);
  }

  const rows = data ?? [];
  const ok = rows.filter((r) => r.pdf_url);
  const missing = rows.filter((r) => !r.pdf_url);

  console.log("TOTAL", rows.length);
  console.log("CDN_OK", ok.length);
  console.log("MISSING", missing.length);
  if (missing.length) {
    console.log("--- missing ---");
    for (const r of missing) console.log("-", r.title);
  }
  if (ok[0]) {
    const mb = Math.round(((ok[0].pdf_bytes as number) || 0) / 1024 / 1024);
    console.log("SAMPLE_OK", ok[0].title, `${mb}MB`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
