import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/client";
import { isAutoDriveThumbnail } from "@/lib/drive";
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
            : "catalog-pdfs bucket create fail — Supabase Storage check karein",
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
      { error: "PDF 50MB se chhoti honi chahiye" },
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
      { error: catErr?.message || "Catalog nahi mili" },
      { status: 404 }
    );
  }

  const path = catalogPdfObjectPath(catalogId, fileName);
  const { data, error } = await supabase.storage
    .from(PDF_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "Signed URL fail" },
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
      { error: catErr?.message || "Catalog nahi mili" },
      { status: 404 }
    );
  }

  const pdfUrl = publicObjectUrl(PDF_BUCKET, path);

  const updates: Record<string, unknown> = {
    pdf_url: pdfUrl,
    pdf_path: path,
    pdf_bytes: bytes > 0 ? bytes : null,
  };

  // Phase 4: first-page preview → our CDN when still on Drive auto thumb / empty
  const needsThumb =
    !catalog.thumbnail_url || isAutoDriveThumbnail(catalog.thumbnail_url);

  if (needsThumb) {
    let thumbUrl =
      (await cacheDriveFirstPageThumb(catalog.drive_file_id, catalogId)) ||
      null;

    if (!thumbUrl) {
      try {
        const { data: fileData, error: dlErr } = await supabase.storage
          .from(PDF_BUCKET)
          .download(path);
        if (!dlErr && fileData) {
          const buf = Buffer.from(await fileData.arrayBuffer());
          // Only try render on modest files to protect function memory
          if (buf.byteLength <= 18 * 1024 * 1024) {
            const webp = await renderPdfFirstPageWebp(buf);
            if (webp) thumbUrl = await uploadFirstPageWebp(catalogId, webp);
          }
        }
      } catch {
        // ignore — Drive/auto thumb remains
      }
    }

    if (thumbUrl) updates.thumbnail_url = thumbUrl;
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
          " — pehle Supabase mein 004_catalog_pdf_storage.sql run karein",
      },
      { status: 500 }
    );
  }

  const oldPath = previousPath || catalog.pdf_path;
  if (oldPath && oldPath !== path) {
    await deleteStorageObject(PDF_BUCKET, oldPath);
  }

  return NextResponse.json(updated);
}
