import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAdminAuthenticated } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/client";

/** Wipe page_visits + pdf_views so dashboard counts return to 0. */
export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();

  // Prefer security-definer RPC (bypasses RLS edge cases)
  const rpc = await supabase.rpc("reset_site_stats");
  if (!rpc.error) {
    revalidatePath("/admin/dashboard");
    return NextResponse.json({ ok: true, ...(rpc.data as object) });
  }

  // Fallback: direct deletes
  const [visits, pdfs] = await Promise.all([
    supabase
      .from("page_visits")
      .delete()
      .gte("timestamp", "1970-01-01T00:00:00.000Z"),
    supabase
      .from("pdf_views")
      .delete()
      .gte("timestamp", "1970-01-01T00:00:00.000Z"),
  ]);

  if (visits.error || pdfs.error) {
    return NextResponse.json(
      {
        error:
          visits.error?.message ||
          pdfs.error?.message ||
          rpc.error.message ||
          "Stats reset failed. Run 006_reset_stats_fn.sql in Supabase.",
      },
      { status: 500 }
    );
  }

  revalidatePath("/admin/dashboard");
  return NextResponse.json({ ok: true, via: "direct-delete" });
}
