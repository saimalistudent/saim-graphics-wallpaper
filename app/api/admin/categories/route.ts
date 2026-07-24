import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAdminAuthenticated } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/client";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("catalog_categories")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json(
      {
        error: error.message + " — Run 005_catalog_categories.sql?",
        _warning: true,
        categories: [],
      },
      { status: 200 }
    );
  }

  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim().toUpperCase();
  if (!name) {
    return NextResponse.json({ error: "Category name required" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: existing } = await supabase
    .from("catalog_categories")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1);

  const sort_order =
    typeof body.sort_order === "number"
      ? body.sort_order
      : (existing?.[0]?.sort_order ?? 0) + 1;

  const { data, error } = await supabase
    .from("catalog_categories")
    .insert({
      name,
      sort_order,
      enabled: body.enabled !== false,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message + " — Run 005_catalog_categories.sql?" },
      { status: 500 }
    );
  }

  revalidatePath("/catalogs");
  revalidatePath("/");
  return NextResponse.json(data, { status: 201 });
}

export async function PUT(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const id = String(body.id || "").trim();
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (typeof body.name === "string" && body.name.trim()) {
    updates.name = body.name.trim().toUpperCase();
  }
  if (typeof body.sort_order === "number") {
    updates.sort_order = body.sort_order;
  }
  if (typeof body.enabled === "boolean") {
    updates.enabled = body.enabled;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("catalog_categories")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath("/catalogs");
  revalidatePath("/");
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  // catalogs.category_id → ON DELETE SET NULL
  const { error } = await supabase
    .from("catalog_categories")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath("/catalogs");
  revalidatePath("/");
  return NextResponse.json({ success: true });
}
