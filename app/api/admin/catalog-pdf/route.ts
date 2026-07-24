import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAdminAuthenticated } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/client";
import {
  PDF_BUCKET,
  cacheDriveFirstPageThumb,
  catalogPdfObjectPath,
  deleteStorageObject,
  ensureCatalogPdfsBucket,
  publicObjectUrl,
  renderPdfFirstPageWebp,
  uploadFirstPageWebp,
} from "@/lib/catalog-pdf-storage";

/** Create a signed upload URL so the browser uploads PDF straight to Storage. */
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureCatalogPdfsBucket();
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "catalog-pdfs bucket create failed — check Supabase Storage",
      },
      { status: 500 }
    );
  }

  const body = await request.json();
  const catalogId = String(body.catalogId || "").trim();
  const fileName = String(body.fileName || "catalog.pdf").trim();
  const bytes = Number(body.bytes || 0);

  if (!catalogId) {
    return NextResponse.json({ error: "catalogId required" }, { status: 400 });
  }
  if (bytes > 50 * 1024 * 1024) {
    return NextResponse.json(
      { error: "PDF must be under 50MB" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data: catalog, error: catErr } = await supabase
    .from("catalogs")
    .select("id, pdf_path")
    .eq("id", catalogId)
    .maybeSingle();

  if (catErr || !catalog) {
    return NextResponse.json(
      { error: catErr?.message || "Catalog not found" },
      { status: 404 }
    );
  }

  const path = catalogPdfObjectPath(catalogId, fileName);
  const { data, error } = await supabase.storage
    .from(PDF_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "Signed URL failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    path,
    token: data.token,
    signedUrl: data.signedUrl,
    previousPath: catalog.pdf_path ?? null,
  });
}

/** After client upload: save pdf_url on catalog + best-effort first-page thumb. */
export async function PUT(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const catalogId = String(body.catalogId || "").trim();
  const path = String(body.path || "").trim();
  const bytes = Number(body.bytes || 0);
  const previousPath =
    typeof body.previousPath === "string" ? body.previousPath.trim() : "";

  if (!catalogId || !path) {
    return NextResponse.json(
      { error: "catalogId and path required" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data: catalog, error: catErr } = await supabase
    .from("catalogs")
    .select("id, drive_file_id, thumbnail_url, pdf_path")
    .eq("id", catalogId)
    .maybeSingle();

  if (catErr || !catalog) {
    return NextResponse.json(
      { error: catErr?.message || "Catalog not found" },
      { status: 404 }
    );
  }

  const pdfUrl = publicObjectUrl(PDF_BUCKET, path);

  const updates: Record<string, unknown> = {
    pdf_url: pdfUrl,
    pdf_path: path,
    pdf_bytes: bytes > 0 ? bytes : null,
  };

  // After manual PDF upload: build display-sized CDN preview (PDF itself stays as uploaded)
  let thumbUrl: string | null = null;
  try {
    const { data: fileData, error: dlErr } = await supabase.storage
      .from(PDF_BUCKET)
      .download(path);
    if (!dlErr && fileData) {
      const buf = Buffer.from(await fileData.arrayBuffer());
      if (buf.byteLength <= 40 * 1024 * 1024) {
        const webp = await renderPdfFirstPageWebp(buf);
        if (webp) thumbUrl = await uploadFirstPageWebp(catalogId, webp);
      }
    }
  } catch {
    // ignore
  }

  if (!thumbUrl) {
    thumbUrl =
      (await cacheDriveFirstPageThumb(catalog.drive_file_id, catalogId)) ||
      null;
  }

  if (thumbUrl) {
    updates.thumbnail_url = thumbUrl;
  }

  const { data: updated, error: updErr } = await supabase
    .from("catalogs")
    .update(updates)
    .eq("id", catalogId)
    .select("*")
    .single();

  if (updErr) {
    return NextResponse.json(
      {
        error:
          updErr.message +
          " — run 004_catalog_pdf_storage.sql in Supabase first",
      },
      { status: 500 }
    );
  }

  const oldPath = previousPath || catalog.pdf_path;
  if (oldPath && oldPath !== path) {
    await deleteStorageObject(PDF_BUCKET, oldPath);
  }

  revalidatePath("/catalogs");
  revalidatePath("/");
  return NextResponse.json(updated);
}

/** Remove CDN PDF from Storage + clear pdf_* fields (catalog row stays). */
export async function DELETE(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const catalogId = searchParams.get("catalogId")?.trim() || "";
  if (!catalogId) {
    return NextResponse.json({ error: "catalogId required" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: catalog, error: catErr } = await supabase
    .from("catalogs")
    .select("id, pdf_path, pdf_url")
    .eq("id", catalogId)
    .maybeSingle();

  if (catErr || !catalog) {
    return NextResponse.json(
      { error: catErr?.message || "Catalog not found" },
      { status: 404 }
    );
  }

  const { deleteCatalogPdfObjects, deleteStorageObject } = await import(
    "@/lib/catalog-pdf-storage"
  );
  await deleteCatalogPdfObjects(catalogId);
  if (catalog.pdf_path) {
    await deleteStorageObject(PDF_BUCKET, catalog.pdf_path as string);
  }

  const { data: updated, error: updErr } = await supabase
    .from("catalogs")
    .update({
      pdf_url: null,
      pdf_path: null,
      pdf_bytes: null,
    })
    .eq("id", catalogId)
    .select("*")
    .single();

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  revalidatePath("/catalogs");
  revalidatePath("/");
  return NextResponse.json(updated);
}
