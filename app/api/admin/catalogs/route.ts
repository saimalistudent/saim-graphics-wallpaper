import { NextRequest, NextResponse } from "next/server";
import { revalidatePublicSite } from "@/lib/revalidate-site";
import { isAdminAuthenticated } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/client";
import {
  parseCategoryIds,
  replaceCatalogCategoryLinks,
  selectCatalogsWithCategories,
} from "@/lib/catalog-categories";
import {
  applyCatalogThumbnailOverride,
  extractDriveFileId,
  resolveCatalogThumbnail,
} from "@/lib/drive";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await selectCatalogsWithCategories(supabase);

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json(data.map(applyCatalogThumbnailOverride));
}

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { title, drive_file_id, thumbnail_url, category_ids } = body;

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
      { error: "Invalid Google Drive link — or upload a PDF file" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseAdminClient();
  const ids = parseCategoryIds(category_ids);

  // Place new catalogs at the end of the ALL list
  const { data: lastRows } = await supabase
    .from("catalogs")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextSort =
    typeof lastRows?.[0]?.sort_order === "number"
      ? (lastRows[0].sort_order as number) + 1
      : 0;

  let { data, error } = await supabase
    .from("catalogs")
    .insert({
      title,
      drive_file_id: fileId,
      thumbnail_url: resolveCatalogThumbnail(fileId, thumbnail_url) || null,
      sort_order: nextSort,
      is_featured: false,
      featured_sort_order: 0,
    })
    .select()
    .single();

  // Pre-010 fallback
  if (error && /sort_order|is_featured|featured_sort/i.test(error.message)) {
    ({ data, error } = await supabase
      .from("catalogs")
      .insert({
        title,
        drive_file_id: fileId,
        thumbnail_url: resolveCatalogThumbnail(fileId, thumbnail_url) || null,
      })
      .select()
      .single());
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const linkResult = await replaceCatalogCategoryLinks(
    supabase,
    data.id as string,
    ids
  );
  if (linkResult.error) {
    return NextResponse.json(
      {
        error:
          linkResult.error +
          " — Run 009_catalog_multi_categories.sql in Supabase?",
      },
      { status: 500 }
    );
  }

  const { data: withCats } = await selectCatalogsWithCategories(supabase, {
    id: data.id as string,
  });

  revalidatePublicSite(data.id as string);
  return NextResponse.json(
    applyCatalogThumbnailOverride(
      withCats[0] ?? { ...data, category_ids: ids }
    ),
    { status: 201 }
  );
}

export async function PUT(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, title, drive_file_id, thumbnail_url, category_ids, sort_order } =
    body;

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
      { error: "Invalid Google Drive link — or upload a PDF file" },
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
  if (typeof sort_order === "number" && Number.isFinite(sort_order)) {
    updates.sort_order = Math.floor(sort_order);
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

  if (category_ids !== undefined) {
    const ids = parseCategoryIds(category_ids);
    const linkResult = await replaceCatalogCategoryLinks(supabase, id, ids);
    if (linkResult.error) {
      return NextResponse.json(
        {
          error:
            linkResult.error +
            " — Run 009_catalog_multi_categories.sql in Supabase?",
        },
        { status: 500 }
      );
    }
  }

  const { data: withCats } = await selectCatalogsWithCategories(supabase, {
    id,
  });

  revalidatePublicSite(id);
  return NextResponse.json(
    applyCatalogThumbnailOverride(
      withCats[0] ?? { ...data, category_ids: parseCategoryIds(category_ids) }
    )
  );
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

  revalidatePublicSite(id);
  return NextResponse.json({ success: true });
}
