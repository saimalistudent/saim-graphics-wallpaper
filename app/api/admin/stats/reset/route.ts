import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/client";

/**
 * Wipe analytics so dashboard counts start from 0.
 * Deletes all page_visits + pdf_views rows.
 */
export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();

  const [visits, pdfs] = await Promise.all([
    supabase.from("page_visits").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
    supabase.from("pdf_views").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
  ]);

  if (visits.error || pdfs.error) {
    return NextResponse.json(
      {
        error:
          visits.error?.message ||
          pdfs.error?.message ||
          "Stats reset fail",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
