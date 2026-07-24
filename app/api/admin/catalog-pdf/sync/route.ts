import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/client";
import { isAutoDriveThumbnail } from "@/lib/drive";
import { downloadDrivePdfBuffer } from "@/lib/drive-pdf-download";
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

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Auto: Drive PDF → Supabase catalog-pdfs (CDN).
 * Body: { catalogId, force?: boolean }
 */
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
            : "catalog-pdfs bucket create fail",
      },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const catalogId = String(body.catalogId || "").trim();
  const force = Boolean(body.force);

  if (!catalogId) {
    return NextResponse.json({ error: "catalogId required" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: catalog, error: catErr } = await supabase
    .from("catalogs")
    .select("id, drive_file_id, thumbnail_url, pdf_url, pdf_path")
    .eq("id", catalogId)
    .maybeSingle();

  if (catErr || !catalog) {
    return NextResponse.json(
      { error: catErr?.message || "Catalog nahi mili" },
      { status: 404 }
    );
  }

  if (catalog.pdf_url && catalog.pdf_path && !force) {
    return NextResponse.json({
      skipped: true,
      catalog,
      message: "CDN PDF pehle se maujood hai",
    });
  }

  if (!catalog.drive_file_id) {
    return NextResponse.json(
      { error: "Drive file ID missing — pehle Drive link save karein" },
      { status: 400 }
    );
  }

  let pdfBuf: Buffer;
  try {
    pdfBuf = await downloadDrivePdfBuffer(catalog.drive_file_id);
  } catch (e) {
    return NextResponse.json(
      {
        error:
          (e instanceof Error ? e.message : "Drive download fail") +
          " — file public sharing check karein",
      },
      { status: 502 }
    );
  }

  if (pdfBuf.byteLength > 50 * 1024 * 1024) {
    return NextResponse.json(
      { error: "PDF 50MB se bari hai" },
      { status: 400 }
    );
  }

  const objectPath = catalogPdfObjectPath(catalogId, "auto-sync.pdf");
  const { error: upErr } = await supabase.storage
    .from(PDF_BUCKET)
    .upload(objectPath, pdfBuf, {
      contentType: "application/pdf",
      upsert: true,
      cacheControl: "31536000",
    });

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const pdfUrl = publicObjectUrl(PDF_BUCKET, objectPath);
  const updates: Record<string, unknown> = {
    pdf_url: pdfUrl,
    pdf_path: objectPath,
    pdf_bytes: pdfBuf.byteLength,
  };

  const needsThumb =
    !catalog.thumbnail_url || isAutoDriveThumbnail(catalog.thumbnail_url);

  if (needsThumb) {
    let thumbUrl =
      (await cacheDriveFirstPageThumb(catalog.drive_file_id, catalogId)) ||
      null;
    if (!thumbUrl && pdfBuf.byteLength <= 18 * 1024 * 1024) {
      const webp = await renderPdfFirstPageWebp(pdfBuf);
      if (webp) thumbUrl = await uploadFirstPageWebp(catalogId, webp);
    }
    if (thumbUrl) updates.thumbnail_url = thumbUrl;
  }

  const previousPath = catalog.pdf_path as string | null;
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
          " — 004_catalog_pdf_storage.sql run hua hai?",
      },
      { status: 500 }
    );
  }

  if (previousPath && previousPath !== objectPath) {
    await deleteStorageObject(PDF_BUCKET, previousPath);
  }

  return NextResponse.json({
    skipped: false,
    catalog: updated,
    bytes: pdfBuf.byteLength,
  });
}
