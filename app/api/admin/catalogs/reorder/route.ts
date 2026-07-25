import { NextRequest, NextResponse } from "next/server";
import { revalidatePublicSite } from "@/lib/revalidate-site";
import { isAdminAuthenticated } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/client";

/**
 * Set /catalogs (ALL) display order.
 * Body: { ordered_ids: string[] } — first id shows first.
 */
export async function PUT(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const ordered_ids = Array.isArray(body.ordered_ids)
    ? body.ordered_ids
        .map((id: unknown) => (typeof id === "string" ? id.trim() : ""))
        .filter(Boolean)
    : [];

  if (ordered_ids.length === 0) {
    return NextResponse.json(
      { error: "ordered_ids required" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseAdminClient();

  for (let i = 0; i < ordered_ids.length; i++) {
    const { error } = await supabase
      .from("catalogs")
      .update({ sort_order: i })
      .eq("id", ordered_ids[i]);
    if (error) {
      return NextResponse.json(
        {
          error:
            error.message +
            " — Run 010_catalog_ordering_featured.sql in Supabase?",
        },
        { status: 500 }
      );
    }
  }

  revalidatePublicSite();
  return NextResponse.json({ success: true, count: ordered_ids.length });
}
