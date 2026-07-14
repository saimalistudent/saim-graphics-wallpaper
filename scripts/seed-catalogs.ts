/**
 * Bulk-import catalogs into Supabase from seed-data.json
 * After you make the Drive folder public (Anyone with the link),
 * I'll fill seed-data.json with real file IDs and run this.
 *
 * Usage: npm run seed
 */

import { readFileSync, existsSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { resolve } from "path";

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i === -1) continue;
    const key = line.slice(0, i).trim();
    const val = line.slice(i + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const SEED_FILE = resolve(process.cwd(), "scripts/seed-data.json");

function cleanTitle(name: string) {
  return name
    .replace(/\.pdf$/i, "")
    .replace(/\s+ok$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function thumb(fileId: string) {
  return `https://lh3.googleusercontent.com/d/${fileId}=w1200`;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Missing Supabase env in .env.local");
    process.exit(1);
  }

  if (!existsSync(SEED_FILE)) {
    console.error(`Missing ${SEED_FILE}`);
    process.exit(1);
  }

  const items = JSON.parse(readFileSync(SEED_FILE, "utf-8")) as Array<{
    title: string;
    drive_file_id: string;
    thumbnail_url?: string | null;
  }>;

  if (!items.length) {
    console.error("seed-data.json is empty — waiting for Drive file IDs");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  // Clear existing catalogs so we don't duplicate on re-import
  const { error: delError } = await supabase
    .from("catalogs")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (delError) {
    console.warn("Could not clear old catalogs:", delError.message);
  }

  let ok = 0;
  for (const item of items) {
    const fileId = item.drive_file_id.trim();
    if (!fileId || fileId.includes("PASTE")) {
      console.warn(`Skip (no file id): ${item.title}`);
      continue;
    }

    const title = cleanTitle(item.title);
    const { error } = await supabase.from("catalogs").insert({
      title,
      drive_file_id: fileId,
      thumbnail_url: item.thumbnail_url || thumb(fileId),
    });

    if (error) {
      console.error(`FAIL ${title}:`, error.message);
    } else {
      ok += 1;
      console.log(`OK (${ok}): ${title}`);
    }
  }

  console.log(`\nDone. Imported ${ok}/${items.length} catalogs.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
