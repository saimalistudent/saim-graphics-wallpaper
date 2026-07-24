/**
 * Audit catalog-pdfs bucket vs DB rows: list orphans/duplicates, report status.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
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

async function listAllFiles(
  sb: SupabaseClient,
  prefix: string
): Promise<{ name: string; id?: string; metadata?: { size?: number } }[]> {
  const out: { name: string; id?: string; metadata?: { size?: number } }[] = [];
  const { data, error } = await sb.storage.from("catalog-pdfs").list(prefix, {
    limit: 1000,
    offset: 0,
  });
  if (error) throw error;
  for (const item of data ?? []) {
    const full = prefix ? `${prefix}/${item.name}` : item.name;
    // folders have null metadata / id quirks — recurse if no size and looks like folder
    const size = item.metadata?.size;
    if (size == null && item.id == null) {
      // likely a folder
      const nested = await listAllFiles(sb, full);
      out.push(...nested);
    } else {
      out.push({ name: full, id: item.id, metadata: item.metadata });
    }
  }
  return out;
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Missing env");

  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: rows, error } = await sb
    .from("catalogs")
    .select("id, title, pdf_url, pdf_path, pdf_bytes, drive_file_id")
    .order("title");
  if (error) throw error;

  const catalogs = rows ?? [];
  const referenced = new Set(
    catalogs.map((c) => c.pdf_path).filter(Boolean) as string[]
  );

  console.log("=== DB catalogs ===");
  console.log("TOTAL", catalogs.length);
  const ok = catalogs.filter((c) => c.pdf_url && c.pdf_path);
  const missing = catalogs.filter((c) => !c.pdf_url || !c.pdf_path);
  console.log("CDN_OK", ok.length);
  console.log("MISSING_OR_INCOMPLETE", missing.length);
  for (const m of missing) {
    console.log("  MISSING:", m.title, m.id);
  }

  // list storage under catalogs/
  const files = await listAllFiles(sb, "catalogs");
  console.log("\n=== Storage files ===");
  console.log("FILE_COUNT", files.length);

  // group by catalog folder id: catalogs/{uuid}/filename
  const byCatalog = new Map<string, typeof files>();
  for (const f of files) {
    const parts = f.name.split("/");
    // catalogs / {id} / file
    const catId = parts[1];
    if (!catId) continue;
    const list = byCatalog.get(catId) ?? [];
    list.push(f);
    byCatalog.set(catId, list);
  }

  const orphanPaths: string[] = [];
  const duplicatePaths: string[] = [];

  for (const [catId, list] of byCatalog) {
    const catalog = catalogs.find((c) => c.id === catId);
    if (!catalog) {
      for (const f of list) orphanPaths.push(f.name);
      continue;
    }
    const keep = catalog.pdf_path;
    for (const f of list) {
      if (keep && f.name === keep) continue;
      if (keep && f.name !== keep) {
        duplicatePaths.push(f.name);
      } else if (!keep) {
        // no pdf_path set — keep newest later, mark extras
        duplicatePaths.push(f.name);
      }
    }
  }

  // files not under any known pattern
  for (const f of files) {
    if (!referenced.has(f.name)) {
      const catId = f.name.split("/")[1];
      const catalog = catalogs.find((c) => c.id === catId);
      if (!catalog) {
        if (!orphanPaths.includes(f.name)) orphanPaths.push(f.name);
      } else if (catalog.pdf_path !== f.name) {
        if (!duplicatePaths.includes(f.name)) duplicatePaths.push(f.name);
      }
    }
  }

  console.log("\nDUPLICATES_NOT_IN_DB_PATH", duplicatePaths.length);
  for (const p of duplicatePaths.slice(0, 50)) console.log("  DUP:", p);
  if (duplicatePaths.length > 50) console.log("  ...");

  console.log("\nORPHANS_NO_CATALOG", orphanPaths.length);
  for (const p of orphanPaths.slice(0, 30)) console.log("  ORPHAN:", p);

  // catalogs with multiple files
  console.log("\n=== Multi-file catalog folders ===");
  for (const [catId, list] of byCatalog) {
    if (list.length <= 1) continue;
    const cat = catalogs.find((c) => c.id === catId);
    console.log(
      `  ${cat?.title ?? catId}: ${list.length} files, keep=${cat?.pdf_path ?? "NONE"}`
    );
    for (const f of list) {
      const sz = f.metadata?.size
        ? `${Math.round(f.metadata.size / 1024 / 1024)}MB`
        : "?";
      const mark = f.name === cat?.pdf_path ? "KEEP" : "DEL?";
      console.log(`    [${mark}] ${f.name} (${sz})`);
    }
  }

  // write report JSON for cleanup script
  const report = {
    missing: missing.map((m) => ({
      id: m.id,
      title: m.title,
      drive_file_id: m.drive_file_id,
    })),
    duplicates: duplicatePaths,
    orphans: orphanPaths,
  };
  const outPath = path.join(process.cwd(), ".pdf-migrate-tmp", "cleanup-report.json");
  const { mkdirSync, writeFileSync } = await import("fs");
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log("\nREPORT", outPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
