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
  const { title, drive_file_id, thumbnail_url } = body;

  if (!title || !drive_file_id) {
    return NextResponse.json(
      { error: "Title and Drive file ID are required" },
      { status: 400 }
    );
  }

  const fileId = extractDriveFileId(String(drive_file_id));
  if (!fileId || fileId.length < 10) {
    return NextResponse.json(
      { error: "Invalid Google Drive file ID / link" },
      { status: 400 }
    );
  }
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("catalogs")
    .insert({
      title,
      drive_file_id: fileId,
      thumbnail_url: resolveCatalogThumbnail(fileId, thumbnail_url),
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
  const { id, title, drive_file_id, thumbnail_url } = body;

  if (!id || !title || !drive_file_id) {
    return NextResponse.json(
      { error: "ID, title and Drive file ID are required" },
      { status: 400 }
    );
  }

  const fileId = extractDriveFileId(String(drive_file_id));
  if (!fileId || fileId.length < 10) {
    return NextResponse.json(
      { error: "Invalid Google Drive file ID / link" },
      { status: 400 }
    );
  }
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("catalogs")
    .update({
      title,
      drive_file_id: fileId,
      thumbnail_url: resolveCatalogThumbnail(fileId, thumbnail_url),
    })
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
  const { error } = await supabase.from("catalogs").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
