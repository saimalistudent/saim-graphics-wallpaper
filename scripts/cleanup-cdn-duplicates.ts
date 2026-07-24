/**
 * Delete duplicate/orphan PDFs in catalog-pdfs that are NOT the current catalogs.pdf_path.
 * Does not touch DB rows. Safe: only removes storage objects not referenced by pdf_path.
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

async function main() {
  loadEnvLocal();
  const reportPath = path.join(
    process.cwd(),
    ".pdf-migrate-tmp",
    "cleanup-report.json"
  );
  if (!existsSync(reportPath)) {
    throw new Error("Run scripts/audit-cdn-pdfs.ts first");
  }

  const report = JSON.parse(readFileSync(reportPath, "utf8")) as {
    duplicates: string[];
    orphans: string[];
    missing: unknown[];
  };

  const toDelete = [...new Set([...(report.duplicates || []), ...(report.orphans || [])])];
  console.log("TO_DELETE", toDelete.length);
  if (report.missing?.length) {
    console.log("MISSING_STILL", report.missing.length, "(re-run migrate for these)");
  }

  if (toDelete.length === 0) {
    console.log("Nothing to delete.");
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Missing env");

  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Safety: never delete a path that is currently pdf_path
  const { data: rows, error } = await sb
    .from("catalogs")
    .select("pdf_path");
  if (error) throw error;
  const keep = new Set(
    (rows ?? []).map((r) => r.pdf_path).filter(Boolean) as string[]
  );

  const safe = toDelete.filter((p) => !keep.has(p));
  const blocked = toDelete.filter((p) => keep.has(p));
  if (blocked.length) {
    console.log("BLOCKED_KEEP_PATHS", blocked.length);
  }

  // delete in chunks of 50
  let deleted = 0;
  for (let i = 0; i < safe.length; i += 50) {
    const chunk = safe.slice(i, i + 50);
    const { error: delErr } = await sb.storage
      .from("catalog-pdfs")
      .remove(chunk);
    if (delErr) {
      console.error("DELETE_FAIL", delErr.message, chunk[0]);
      process.exit(1);
    }
    deleted += chunk.length;
    console.log(`Deleted ${deleted}/${safe.length}`);
  }

  console.log("DONE_DELETED", deleted);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
