/**
 * Rename all catalogs.title to SEO-friendly Pakistan-focused English names.
 * Safe to re-run: skips rows already matching the derived SEO title.
 *
 * Does NOT change pdf_url / pdf_path / storage objects or category links.
 *
 * Usage:
 *   npx tsx scripts/seo-rename-catalogs.ts           # apply
 *   DRY_RUN=1 npx tsx scripts/seo-rename-catalogs.ts # preview only
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

loadEnvLocal();

const DRY_RUN = /^(1|true|yes)$/i.test(process.env.DRY_RUN || "");

type CatalogRow = {
  id: string;
  title: string;
  pdf_path: string | null;
  pdf_url: string | null;
  created_at: string | null;
};

/** Room/style hints → short SEO fragment. Order matters (more specific first). */
const STYLE_RULES: Array<{ re: RegExp; label: string }> = [
  { re: /\bgraceful+?\b|\bgracefull\b/i, label: "Graceful Full Room" },
  { re: /\bsingle\s*wall|\bsigle\s*wall/i, label: "Single Wall" },
  { re: /\bfull\s*room/i, label: "Full Room" },
  { re: /\bcrown/i, label: "Crown Room" },
  { re: /\bopal/i, label: "Opal Room" },
  { re: /\bmatt\b/i, label: "Matt Design" },
  { re: /\bplain/i, label: "Plain Design" },
  { re: /\bmarble/i, label: "Marble Look" },
  { re: /\bkids?\b|\bchildren\b|\bbaby\b/i, label: "Kids Room" },
  { re: /\bbethak\b|\bbaithak\b/i, label: "Bethak" },
  { re: /\bbedroom|bed\s*room/i, label: "Bedroom" },
  { re: /\bparlou?r\b/i, label: "Parlour" },
  { re: /\bliving/i, label: "Living Room" },
  { re: /\bdrawing/i, label: "Drawing Room" },
  { re: /\bdining/i, label: "Dining Room" },
  { re: /\btv\s*lounge|\blounge\b/i, label: "TV Lounge" },
  { re: /\bsalo+ns?\b/i, label: "Salon" },
  { re: /\bkitchen/i, label: "Kitchen" },
  { re: /\boffice/i, label: "Office" },
  { re: /\bschool/i, label: "School" },
  { re: /\bhall\b/i, label: "Hall" },
  { re: /\bborder\b/i, label: "Border" },
  { re: /\bpalling|panell?ing|panel\b/i, label: "Panel" },
  { re: /\bshutter|tiles?\b/i, label: "Tile Wall" },
  { re: /\bluxur/i, label: "Luxury Wall" },
  { re: /\bfloral\b/i, label: "Floral" },
  { re: /\bmodern\b/i, label: "Modern" },
  { re: /\bclassic|classy\b/i, label: "Classic" },
  { re: /\binfinity\b/i, label: "Infinity" },
  { re: /\bpremium\b/i, label: "Premium" },
  { re: /\bislamic\b|\bmosque\b/i, label: "Islamic Style" },
  { re: /\btexture\b/i, label: "Texture" },
  { re: /\bgeometric\b/i, label: "Geometric" },
  { re: /\bnature\b|\bforest\b/i, label: "Nature" },
  { re: /\babstract\b/i, label: "Abstract" },
  { re: /\bnew\s*design/i, label: "New Design" },
];

function env(name: string) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function normalizeHint(raw: string): string {
  return raw
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sourceHint(row: CatalogRow): string {
  const fromPath = row.pdf_path
    ? path.basename(row.pdf_path).replace(/\.pdf$/i, "")
    : "";
  return normalizeHint(`${row.title || ""} ${fromPath}`);
}

function detectStyle(hint: string): string | null {
  for (const rule of STYLE_RULES) {
    if (rule.re.test(hint)) return rule.label;
  }
  return null;
}

/** Extract SG D1 (N) style design code when present. */
function detectCode(hint: string): string | null {
  const sg = hint.match(/\bSG\s*D\s*(\d+)\s*\(?\s*(\d+)\s*\)?/i);
  if (sg) return `D${sg[1]}-${sg[2]}`;
  const d = hint.match(/\bD\s*(\d+)\s*\(?\s*(\d+)\s*\)?/i);
  if (d) return `D${d[1]}-${d[2]}`;
  const pack = hint.match(/\b(?:pack|vol|volume|set)\s*([A-Za-z0-9]+)\b/i);
  if (pack) return `Pack ${pack[1].toUpperCase()}`;
  return null;
}

/**
 * Build a unique SEO title, preferring ~60–70 characters.
 * Pattern: "3D Panaflex Wallpaper Design Pakistan – [Style] [Code|N]"
 */
function pickUnique(candidates: string[], used: Set<string>): string | null {
  for (const t of candidates) {
    if (t && !used.has(t) && t.length <= 75) return t;
  }
  return null;
}

function buildSeoTitle(
  hint: string,
  styleSeq: number,
  used: Set<string>
): string {
  const style = detectStyle(hint);
  const code = detectCode(hint);

  // 1) Style + design code (usually unique)
  if (style && code) {
    const hit = pickUnique(
      [
        `3D Panaflex Wallpaper Pakistan – ${style} ${code}`,
        `3D Wallpaper Design Pakistan – ${style} ${code}`,
      ],
      used
    );
    if (hit) return hit;
  }

  // 2) Style only — first free gets clean title; later ones get style number
  if (style) {
    const primary = `3D Panaflex Wallpaper Design Pakistan – ${style}`;
    if (!used.has(primary)) return primary;
    const numbered = `3D Panaflex Wallpaper Design Pakistan – ${style} ${styleSeq}`;
    if (!used.has(numbered)) return numbered;
    const alt = `3D Wallpaper Design Pakistan – ${style} ${styleSeq}`;
    if (!used.has(alt)) return alt;
  }

  // 3) Code only
  if (code) {
    const hit = pickUnique(
      [
        `3D Panaflex Wallpaper Design Pakistan – ${code}`,
        `3D Wallpaper Design Pakistan – ${code}`,
      ],
      used
    );
    if (hit) return hit;
  }

  // 4) Guaranteed unique fallback
  let n = 1;
  while (true) {
    const t = `3D Panaflex Wallpaper Design Pakistan ${n}`;
    if (!used.has(t)) return t;
    n += 1;
  }
}

function alreadyGoodSeo(title: string): boolean {
  const t = title.toLowerCase();
  const hasCore =
    t.includes("3d") &&
    (t.includes("panaflex") || t.includes("wallpaper")) &&
    (t.includes("pakistan") || t.includes("pakistani"));
  if (!hasCore) return false;
  // Reject obvious spam / keyword stuffing
  const wallpaperCount = (t.match(/wallpaper/g) || []).length;
  const pakistanCount = (t.match(/pakistan/g) || []).length;
  if (wallpaperCount > 2 || pakistanCount > 1) return false;
  return title.length <= 80;
}

async function main() {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("catalogs")
    .select("id, title, pdf_path, pdf_url, created_at")
    .order("created_at", { ascending: true });

  if (error) throw error;
  const rows = (data ?? []) as CatalogRow[];
  console.log(
    `Loaded ${rows.length} catalog(s). Mode: ${DRY_RUN ? "DRY_RUN" : "APPLY"}`
  );

  const used = new Set<string>();
  const styleCounters = new Map<string, number>();
  const plans: Array<{
    id: string;
    oldTitle: string;
    newTitle: string;
    skip: boolean;
  }> = [];

  for (const row of rows) {
    const oldTitle = String(row.title || "").trim();
    const hint = sourceHint(row);
    const style = detectStyle(hint) || "Collection";
    const count = (styleCounters.get(style) || 0) + 1;
    styleCounters.set(style, count);

    if (alreadyGoodSeo(oldTitle) && !used.has(oldTitle)) {
      used.add(oldTitle);
      plans.push({ id: row.id, oldTitle, newTitle: oldTitle, skip: true });
      continue;
    }

    const newTitle = buildSeoTitle(hint, count, used);
    used.add(newTitle);
    plans.push({
      id: row.id,
      oldTitle,
      newTitle,
      skip: oldTitle === newTitle,
    });
  }

  let renamed = 0;
  let skipped = 0;
  let failed = 0;

  for (const plan of plans) {
    if (plan.skip) {
      skipped += 1;
      console.log(`SKIP  ${plan.oldTitle}`);
      continue;
    }

    console.log(`RENAME "${plan.oldTitle}" → "${plan.newTitle}" (${plan.newTitle.length}c)`);

    if (DRY_RUN) {
      renamed += 1;
      continue;
    }

    const { error: upErr } = await supabase
      .from("catalogs")
      .update({ title: plan.newTitle })
      .eq("id", plan.id);

    if (upErr) {
      failed += 1;
      console.error(`  FAIL ${plan.id}:`, upErr.message);
    } else {
      renamed += 1;
    }
  }

  console.log("\n--- Summary ---");
  console.log(`Total: ${rows.length}`);
  console.log(`Renamed: ${renamed}`);
  console.log(`Skipped (already SEO / unchanged): ${skipped}`);
  console.log(`Failed: ${failed}`);

  const samples = plans.filter((p) => !p.skip).slice(0, 12);
  if (samples.length) {
    console.log("\nSample mapping:");
    for (const s of samples) {
      console.log(`  "${s.oldTitle}" → "${s.newTitle}"`);
    }
  }

  const featuredOld = [
    "SG D1 (6) crown room",
    "SG D1 (36) gracefull full room",
    "SG D1 (23) full room",
    "SG D1 (20) opal room",
    "SG D1 (15) plain design",
    "SG D1 (3) matt design",
    "SG D1 (25) full room",
    "SG D1 (21) single wall luxuary",
  ];
  console.log(
    "\nFeatured title remaps (update FEATURED_CATALOG_TITLES if needed):"
  );
  const featuredMap: Array<{ old: string; neu: string }> = [];
  for (const old of featuredOld) {
    const plan = plans.find(
      (p) =>
        p.oldTitle.toLowerCase().replace(/\s+/g, " ").trim() ===
        old.toLowerCase().replace(/\s+/g, " ").trim()
    );
    if (plan) {
      featuredMap.push({ old, neu: plan.newTitle });
      console.log(`  "${old}" → "${plan.newTitle}"`);
    } else {
      console.log(`  "${old}" → (not found)`);
    }
  }

  // Machine-readable for follow-up edits
  if (!DRY_RUN && featuredMap.length) {
    console.log("\nFEATURED_JSON=" + JSON.stringify(featuredMap));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
