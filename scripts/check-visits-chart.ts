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
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const total = await sb.from("page_visits").select("*", {
    count: "exact",
    head: true,
  });
  const rpc30 = await sb.rpc("dashboard_visit_counts_by_day", { p_days: 30 });
  const rpc7 = await sb.rpc("dashboard_visit_counts_by_day", { p_days: 7 });
  const recent = await sb
    .from("page_visits")
    .select("timestamp,page_path")
    .order("timestamp", { ascending: false })
    .limit(10);

  const rows30 = (rpc30.data ?? []) as { day: string; visit_count: number }[];
  const rows7 = (rpc7.data ?? []) as { day: string; visit_count: number }[];
  const sum30 = rows30.reduce((a, r) => a + Number(r.visit_count || 0), 0);
  const sum7 = rows7.reduce((a, r) => a + Number(r.visit_count || 0), 0);

  console.log(
    JSON.stringify(
      {
        totalVisits: total.count,
        rpc30Error: rpc30.error?.message ?? null,
        rpc7Error: rpc7.error?.message ?? null,
        rpc30Days: rows30.length,
        rpc7Days: rows7.length,
        sum30,
        sum7,
        nonZero30: rows30.filter((r) => Number(r.visit_count) > 0),
        nonZero7: rows7.filter((r) => Number(r.visit_count) > 0),
        recent: recent.data,
      },
      null,
      2
    )
  );
}

main();
