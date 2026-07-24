import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/client";
import {
  applyCatalogThumbnailOverride,
  extractDriveFileId,
  resolveCatalogThumbnail,
} from "@/lib/drive";
import { Catalog } from "@/lib/types";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("catalogs")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    ((data ?? []) as Catalog[]).map(applyCatalogThumbnailOverride)
  );
}

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { title, drive_file_id, thumbnail_url, category_id } = body;

  if (!title || !drive_file_id) {
    return NextResponse.json(
      { error: "Title and Drive file ID / PDF upload required" },
      { status: 400 }
    );
  }

  const rawDrive = String(drive_file_id).trim();
  const fileId = rawDrive.startsWith("manual-pdf-")
    ? rawDrive
    : extractDriveFileId(rawDrive);
  if (!fileId || fileId.length < 10) {
    return NextResponse.json(
      { error: "Invalid Google Drive file ID / link (ya PDF file choose karein)" },
      { status: 400 }
    );
  }
  const supabase = createSupabaseAdminClient();
  const catId =
    typeof category_id === "string" && category_id.trim()
      ? category_id.trim()
      : null;
  const { data, error } = await supabase
    .from("catalogs")
    .insert({
      title,
      drive_file_id: fileId,
      thumbnail_url: resolveCatalogThumbnail(fileId, thumbnail_url) || null,
      category_id: catId,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function PUT(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, title, drive_file_id, thumbnail_url, category_id } = body;

  if (!id || !title || !drive_file_id) {
    return NextResponse.json(
      { error: "ID, title and Drive file ID are required" },
      { status: 400 }
    );
  }

  const rawDrive = String(drive_file_id).trim();
  const fileId = rawDrive.startsWith("manual-pdf-")
    ? rawDrive
    : extractDriveFileId(rawDrive);
  if (!fileId || fileId.length < 10) {
    return NextResponse.json(
      { error: "Invalid Google Drive file ID / link (ya PDF file choose karein)" },
      { status: 400 }
    );
  }
  const supabase = createSupabaseAdminClient();

  const updates: Record<string, unknown> = {
    title,
    drive_file_id: fileId,
  };
  if (thumbnail_url !== undefined) {
    updates.thumbnail_url =
      resolveCatalogThumbnail(fileId, thumbnail_url) || null;
  }
  if (category_id !== undefined) {
    updates.category_id =
      typeof category_id === "string" && category_id.trim()
        ? category_id.trim()
        : null;
  }

  const { data, error } = await supabase
    .from("catalogs")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: existing } = await supabase
    .from("catalogs")
    .select("pdf_path, thumbnail_url")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("catalogs").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { deleteCatalogPdfObjects, deleteStorageObject, THUMB_BUCKET } =
    await import("@/lib/catalog-pdf-storage");
  const { thumbnailsObjectPath } = await import("@/lib/site-visuals");

  await deleteCatalogPdfObjects(id);
  if (existing?.pdf_path) {
    await deleteStorageObject("catalog-pdfs", existing.pdf_path as string);
  }
  const thumbPath = thumbnailsObjectPath(existing?.thumbnail_url as string);
  if (thumbPath?.startsWith("catalog-previews/")) {
    await deleteStorageObject(THUMB_BUCKET, thumbPath);
  }

  return NextResponse.json({ success: true });
}
