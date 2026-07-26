/**
 * Check which core migrations appear applied in Supabase.
 * Usage: npx tsx scripts/check-migrations.ts
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const p = resolve(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i === -1) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(url, key);

async function tableOk(name: string): Promise<boolean> {
  const { error } = await sb.from(name).select("*").limit(1);
  if (!error) return true;
  const m = (error.message || "").toLowerCase();
  if (
    m.includes("does not exist") ||
    m.includes("could not find") ||
    error.code === "42P01" ||
    error.code === "PGRST205"
  ) {
    return false;
  }
  return true;
}

async function colOk(table: string, col: string): Promise<boolean> {
  const { error } = await sb.from(table).select(col).limit(1);
  if (!error) return true;
  const m = (error.message || "").toLowerCase();
  if (error.code === "PGRST204") return false;
  if (m.includes(col.toLowerCase()) && m.includes("could not find")) return false;
  if (m.includes("does not exist")) return false;
  return true;
}

async function rpcOk(name: string, args: Record<string, unknown>): Promise<boolean> {
  const { error } = await sb.rpc(name, args);
  if (!error) return true;
  const m = (error.message || "").toLowerCase();
  if (
    m.includes("could not find") ||
    m.includes("does not exist") ||
    error.code === "PGRST202"
  ) {
    return false;
  }
  return true;
}

type Row = { mig: string; item: string; ok: boolean };

async function main() {
  const rows: Row[] = [];
  const add = (mig: string, item: string, ok: boolean) =>
    rows.push({ mig, item, ok });

  add("001", "catalogs", await tableOk("catalogs"));
  add("001", "page_visits", await tableOk("page_visits"));
  add("001", "pdf_views", await tableOk("pdf_views"));
  add("002", "promo_popup", await tableOk("promo_popup"));
  add("003", "hero_slides", await tableOk("hero_slides"));
  add("004", "catalogs.pdf_url", await colOk("catalogs", "pdf_url"));
  add("004", "catalogs.pdf_path", await colOk("catalogs", "pdf_path"));
  add("005", "catalog_categories", await tableOk("catalog_categories"));
  add("006", "reset_site_stats()", await rpcOk("reset_site_stats", {}));
  add("007", "contact_settings", await tableOk("contact_settings"));
  add(
    "008",
    "dashboard_visit_counts_by_day",
    await rpcOk("dashboard_visit_counts_by_day", { p_days: 7 })
  );
  add("008", "dashboard_pdf_view_counts", await rpcOk("dashboard_pdf_view_counts", {}));
  add("009", "catalog_category_links", await tableOk("catalog_category_links"));
  // After 009, legacy category_id should be gone
  add("009", "catalogs.category_id removed", !(await colOk("catalogs", "category_id")));
  add("010", "catalogs.sort_order", await colOk("catalogs", "sort_order"));
  add("010", "catalogs.is_featured", await colOk("catalogs", "is_featured"));
  add("010", "featured_settings", await tableOk("featured_settings"));
  add(
    "013",
    "contact_settings.facebook_url",
    await colOk("contact_settings", "facebook_url")
  );
  add(
    "013",
    "contact_settings.tiktok_url",
    await colOk("contact_settings", "tiktok_url")
  );
  add(
    "014",
    "contact_settings.location_url",
    await colOk("contact_settings", "location_url")
  );

  console.log("\nMigration check (live Supabase):\n");
  for (const r of rows) {
    console.log(`${r.ok ? "OK  " : "MISS"}  ${r.mig.padEnd(4)} ${r.item}`);
  }

  const missing = rows.filter((r) => !r.ok);
  console.log("\n---");
  if (missing.length === 0) {
    console.log("All core migrations look applied.");
    console.log(
      "Note: 005b (BED+ROOM merge) and 011 (RLS harden) are optional/policy-only — re-run safe if unsure."
    );
  } else {
    console.log("Still missing:");
    for (const m of missing) console.log(`  - ${m.mig}: ${m.item}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
