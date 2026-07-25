"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Catalog, CatalogCategory } from "@/lib/types";
import {
  extractDriveFileId,
  getCatalogPreviewBadge,
  getDriveThumbnailFallbackUrl,
  getDriveThumbnailUrl,
  isAutoDriveThumbnail,
} from "@/lib/drive";
import { ImageIcon, Pencil, Trash2, Plus, Sparkles, ArrowUp, ArrowDown } from "lucide-react";

export function CatalogManager() {
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [driveFileId, setDriveFileId] = useState("");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [existingThumb, setExistingThumb] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [autoThumbFailed, setAutoThumbFailed] = useState(false);

  const parsedDriveId = useMemo(() => {
    const raw = driveFileId.trim();
    if (!raw) return "";
    return extractDriveFileId(raw);
  }, [driveFileId]);

  const autoThumbUrl = parsedDriveId
    ? autoThumbFailed
      ? getDriveThumbnailFallbackUrl(parsedDriveId)
      : getDriveThumbnailUrl(parsedDriveId)
    : null;

  const [pdfUploadingId, setPdfUploadingId] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [cdnSyncing, setCdnSyncing] = useState(false);

  async function fetchCatalogs() {
    setLoading(true);
    try {
      const [catRes, categoriesRes] = await Promise.all([
        fetch("/api/admin/catalogs"),
        fetch("/api/admin/categories"),
      ]);
      if (catRes.ok) {
        setCatalogs(await catRes.json());
        setError("");
      } else {
        setError("Could not load catalogs. Check Supabase tables.");
      }
      if (categoriesRes.ok) {
        const data = await categoriesRes.json();
        if (!data._warning && Array.isArray(data)) {
          setCategories(data as CatalogCategory[]);
        }
      }
    } catch {
      setError("Network error — try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCatalogs();
  }, []);

  useEffect(() => {
    setAutoThumbFailed(false);
  }, [parsedDriveId]);

  useEffect(() => {
    if (!thumbnailFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(thumbnailFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [thumbnailFile]);

  const livePreview =
    previewUrl ||
    (thumbnailFile ? null : existingThumb && !isAutoDriveThumbnail(existingThumb) ? existingThumb : null) ||
    autoThumbUrl;

  const usingAutoPreview = Boolean(!previewUrl && !thumbnailFile && autoThumbUrl && livePreview === autoThumbUrl);

  async function uploadThumbnail(): Promise<string | null> {
    if (!thumbnailFile) return null;

    if (thumbnailFile.size > 5 * 1024 * 1024) {
      throw new Error("Image must be under 5MB");
    }
    if (!thumbnailFile.type.startsWith("image/")) {
      throw new Error("Upload an image file only");
    }

    const formData = new FormData();
    formData.append("file", thumbnailFile);

    const res = await fetch("/api/admin/upload?kind=thumb", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? "Photo upload failed");
    }

    const data = await res.json();
    return data.url;
  }

  async function uploadCdnPdfToStorage(catalogId: string, file: File) {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      throw new Error("Upload a PDF file only");
    }
    if (file.size > 50 * 1024 * 1024) {
      throw new Error("PDF must be under 50MB");
    }

    const signRes = await fetch("/api/admin/catalog-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        catalogId,
        fileName: file.name,
        bytes: file.size,
      }),
    });
    const signData = await signRes.json();
    if (!signRes.ok) throw new Error(signData.error || "Signed URL failed");

    const putRes = await fetch(signData.signedUrl as string, {
      method: "PUT",
      headers: {
        "Content-Type": "application/pdf",
        "x-upsert": "true",
      },
      body: file,
    });
    if (!putRes.ok) {
      throw new Error("PDF upload failed — check catalog-pdfs bucket");
    }

    const confirmRes = await fetch("/api/admin/catalog-pdf", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        catalogId,
        path: signData.path,
        bytes: file.size,
        previousPath: signData.previousPath,
      }),
    });
    const confirmData = await confirmRes.json();
    if (!confirmRes.ok) {
      throw new Error(
        confirmData.error || "PDF save failed — run 004 migration?"
      );
    }
    return confirmData as { preview_generated?: boolean; thumbnail_url?: string };
  }

  async function syncCdnFromDrive(catalogId: string, force = false) {
    const res = await fetch("/api/admin/catalog-pdf/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catalogId, force }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "CDN sync failed");
    return data as { skipped?: boolean; bytes?: number; message?: string };
  }

  async function uploadCdnPdf(catalogId: string, file: File) {
    setPdfUploadingId(catalogId);
    setError("");
    setSuccess("");
    try {
      const saved = await uploadCdnPdfToStorage(catalogId, file);
      setSuccess(
        saved?.preview_generated
          ? "PDF on CDN — page 1 preview generated for site + admin."
          : "PDF on CDN. Preview missing — run npm run generate:previews or re-upload."
      );
      await fetchCatalogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF upload failed");
    } finally {
      setPdfUploadingId(null);
    }
  }

  async function saveCatalogOrder(next: Catalog[]) {
    setCatalogs(next);
    setError("");
    try {
      const res = await fetch("/api/admin/catalogs/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordered_ids: next.map((c) => c.id) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reorder failed");
      setSuccess("Catalog order saved — live on /catalogs.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reorder failed");
      await fetchCatalogs();
    }
  }

  function moveCatalog(id: string, dir: -1 | 1) {
    const i = catalogs.findIndex((c) => c.id === id);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= catalogs.length) return;
    const next = [...catalogs];
    [next[i], next[j]] = [next[j], next[i]];
    void saveCatalogOrder(next);
  }

  function resetForm() {
    setTitle("");
    setDriveFileId("");
    setCategoryIds([]);
    setThumbnailFile(null);
    setPdfFile(null);
    setPreviewUrl(null);
    setEditingId(null);
    setExistingThumb(null);
    setError("");
    setAutoThumbFailed(false);
  }

  function toggleCategory(id: string) {
    setCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function categoryLabels(ids: string[] | undefined): string {
    if (!ids?.length) return "No category";
    const names = ids
      .map((id) => categories.find((c) => c.id === id)?.name)
      .filter(Boolean);
    return names.length ? names.join(", ") : "No category";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      if (!title.trim()) throw new Error("Catalog name is required");
      if (!driveFileId.trim() && !pdfFile) {
        throw new Error("Add a Drive link or a PDF file");
      }

      let uploaded: string | null = null;
      if (thumbnailFile) {
        uploaded = await uploadThumbnail();
      } else if (
        editingId &&
        existingThumb &&
        !isAutoDriveThumbnail(existingThumb)
      ) {
        uploaded = existingThumb;
      }

      const drivePayload =
        driveFileId.trim() || `manual-pdf-${Date.now()}`;

      const payload = {
        title: title.trim(),
        drive_file_id: drivePayload,
        thumbnail_url: uploaded,
        category_ids: categoryIds,
      };

      const res = editingId
        ? await fetch("/api/admin/catalogs", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: editingId, ...payload }),
          })
        : await fetch("/api/admin/catalogs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Save failed");
      }

      const saved = (await res.json()) as Catalog;

      // Always land PDF on Supabase CDN — site reads pdf_url first (fast)
      setCdnSyncing(true);
      setSuccess("Catalog saved — uploading PDF to CDN…");
      try {
        if (pdfFile) {
          const pdfSaved = await uploadCdnPdfToStorage(saved.id, pdfFile);
          setSuccess(
            pdfSaved?.preview_generated
              ? "PDF on CDN — page 1 preview ready on site + admin."
              : "PDF on CDN. Preview missing — re-upload or run generate:previews."
          );
        } else {
          const needsForce = !saved.pdf_url;
          const sync = await syncCdnFromDrive(saved.id, needsForce);
          if (sync.skipped && saved.pdf_url) {
            setSuccess("Catalog updated — CDN PDF already ready.");
          } else {
            const mb = sync.bytes
              ? ` (${Math.round(Number(sync.bytes) / 1024 / 1024)}MB)`
              : "";
            setSuccess(`PDF synced to CDN${mb}.`);
          }
        }
      } catch (cdnErr) {
        setError(
          (cdnErr instanceof Error ? cdnErr.message : "CDN upload failed") +
            " — catalog saved; use Upload CDN PDF below."
        );
        setSuccess("");
      } finally {
        setCdnSyncing(false);
      }

      resetForm();
      await fetchCatalogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
      setCdnSyncing(false);
    }
  }

  function startEdit(catalog: Catalog) {
    setEditingId(catalog.id);
    setTitle(catalog.title);
    setDriveFileId(catalog.drive_file_id);
    setCategoryIds(catalog.category_ids ?? []);
    setExistingThumb(catalog.thumbnail_url);
    setThumbnailFile(null);
    setError("");
    setSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function removeCdnPdf(catalogId: string, catalogTitle: string) {
    if (
      !confirm(
        `Remove CDN PDF for "${catalogTitle}"? Catalog stays; Drive fallback will be used.`
      )
    ) {
      return;
    }
    setPdfUploadingId(catalogId);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(
        `/api/admin/catalog-pdf?catalogId=${encodeURIComponent(catalogId)}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "PDF remove failed");
      setSuccess(`CDN PDF removed: ${catalogTitle}`);
      await fetchCatalogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF remove failed");
    } finally {
      setPdfUploadingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this catalog?")) return;

    setError("");
    setSuccess("");
    const res = await fetch(`/api/admin/catalogs?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      if (editingId === id) resetForm();
      await fetchCatalogs();
      setSuccess("Catalog deleted.");
    } else {
      setError("Delete failed.");
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="admin-card space-y-5">
        <div className="flex items-center gap-2">
          <Plus className="h-5 w-5 text-gold" />
          <h2 className="admin-card-title">
            {editingId ? "Edit PDF" : "Add new PDF"}
          </h2>
        </div>

        <div className="admin-tip">
          <strong>Easy steps:</strong> 1) Name → 2) Upload PDF → 3) Categories
          (optional) → 4) Save. Preview = PDF page 1 (automatic).
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">
            <div>
              <label className="admin-label">1. Name (shows on website)</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="admin-input"
                placeholder="Example: 3D Panaflex Wallpaper Pakistan – Kitchen"
                required
              />
            </div>
            <div>
              <label className="admin-label">
                2. PDF file{" "}
                <span className="font-normal text-text-secondary">
                  {editingId
                    ? "(optional — leave empty to keep current)"
                    : "(required)"}
                </span>
              </label>
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                className="admin-input file:mr-3 file:rounded-md file:border-0 file:bg-gold/15 file:px-3 file:py-1.5 file:text-sm file:text-burgundy"
              />
              <p className="mt-1 text-xs text-text-secondary">
                {pdfFile
                  ? `Selected: ${pdfFile.name}`
                  : "Max 50MB. Preview is created from page 1 after save."}
              </p>
            </div>
            <div>
              <label className="admin-label">
                3. Categories{" "}
                <span className="font-normal text-text-secondary">
                  (tap to select — can pick many)
                </span>
              </label>
              {categories.length === 0 ? (
                <p className="text-xs text-text-secondary mt-1">
                  No categories yet — open <strong>Categories</strong> in the top
                  menu first. Without categories it still shows under ALL.
                </p>
              ) : (
                <div
                  className="mt-1.5 flex flex-wrap gap-2"
                  role="group"
                  aria-label="Catalog categories"
                >
                  {categories.map((c) => {
                    const active = categoryIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleCategory(c.id)}
                        className={`admin-chip ${active ? "admin-chip-active" : ""}`}
                        aria-pressed={active}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <details className="admin-advanced">
              <summary>Advanced (optional)</summary>
              <div className="space-y-4 pt-3">
                <div>
                  <label className="admin-label">Google Drive link</label>
                  <input
                    value={driveFileId}
                    onChange={(e) => setDriveFileId(e.target.value)}
                    className="admin-input"
                    placeholder="Only if you use Drive instead of a PDF file"
                  />
                </div>
                <div>
                  <label className="admin-label">Custom preview photo</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      setThumbnailFile(e.target.files?.[0] ?? null)
                    }
                    className="admin-input file:mr-3 file:rounded-md file:border-0 file:bg-gold/15 file:px-3 file:py-1.5 file:text-sm file:text-burgundy"
                  />
                  <p className="mt-1 text-xs text-text-secondary">
                    Skip this — PDF page 1 is used automatically.
                  </p>
                </div>
              </div>
            </details>
          </div>

          <div>
            <label className="admin-label">Preview</label>
            <div className={`admin-thumb-box ${usingAutoPreview ? "admin-thumb-auto" : ""}`}>
              {livePreview ? (
                <>
                  {usingAutoPreview || isAutoDriveThumbnail(livePreview) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={livePreview}
                      alt="Preview"
                      className="absolute inset-0 h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={() => {
                        if (usingAutoPreview && !autoThumbFailed) {
                          setAutoThumbFailed(true);
                        }
                      }}
                    />
                  ) : (
                    <Image
                      src={livePreview}
                      alt="Preview"
                      fill
                      className="object-cover"
                      unoptimized={Boolean(previewUrl)}
                    />
                  )}
                  {usingAutoPreview && (
                    <span className="catalog-auto-badge admin-live-badge">
                      <Sparkles className="h-3 w-3" />
                      Auto page 1
                    </span>
                  )}
                  <div className="catalog-preview-shine" aria-hidden />
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-text-secondary px-3 text-center">
                  <ImageIcon className="h-8 w-8 opacity-40" />
                  <span className="text-xs">
                    After save, page 1 of your PDF appears here
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        {success && (
          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            {success}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            className="golden-button text-sm min-h-11 px-6"
            disabled={submitting || cdnSyncing}
          >
            {submitting || cdnSyncing
              ? cdnSyncing
                ? "Uploading PDF…"
                : "Saving…"
              : editingId
                ? "Save changes"
                : "Save PDF"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="admin-chip min-h-11"
            >
              Cancel edit
            </button>
          )}
        </div>
      </form>

      <div className="admin-card">
        <h2 className="admin-card-title mb-1">
          Your PDFs ({catalogs.length})
        </h2>
        <p className="text-sm text-text-secondary mb-5">
          ↑ ↓ = order on the website list (top = first). Replace PDF updates
          file + preview automatically.
        </p>

        {loading ? (
          <p className="text-text-secondary text-sm">Loading...</p>
        ) : catalogs.length === 0 ? (
          <p className="text-text-secondary text-sm">
            No catalogs yet. Add one with the form above.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {catalogs.map((catalog) => {
              const auto = isAutoDriveThumbnail(catalog.thumbnail_url);
              const pageBadge = getCatalogPreviewBadge(
                catalog.title,
                catalog.thumbnail_url
              );
              return (
                <div key={catalog.id} className="admin-catalog-item">
                  <div className="catalog-preview-frame relative aspect-[4/3] bg-background overflow-hidden">
                    {catalog.thumbnail_url ? (
                      <>
                        {auto ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={catalog.thumbnail_url}
                            alt={catalog.title}
                            className="absolute inset-0 h-full w-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <Image
                            src={catalog.thumbnail_url}
                            alt={catalog.title}
                            fill
                            className="object-cover"
                          />
                        )}
                        {pageBadge && (
                          <span className="catalog-auto-badge">
                            <Sparkles className="h-2 w-2" />
                            {pageBadge}
                          </span>
                        )}
                        <div className="catalog-preview-shine" aria-hidden />
                      </>
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-text-secondary/40" />
                      </div>
                    )}
                  </div>
                  <div className="p-3 space-y-3">
                    <h3 className="font-heading font-semibold text-burgundy line-clamp-2">
                      {catalog.title}
                    </h3>
                    <p className="text-[11px] text-text-secondary">
                      {categoryLabels(catalog.category_ids)}
                      {" · "}
                      {catalog.pdf_url
                        ? `PDF ready${
                            catalog.pdf_bytes
                              ? ` · ${Math.round(catalog.pdf_bytes / 1024 / 1024)}MB`
                              : ""
                          }`
                        : "No PDF yet — upload below"}
                    </p>
                    <label className="admin-chip w-full inline-flex items-center justify-center gap-1 cursor-pointer min-h-10">
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        className="sr-only"
                        disabled={pdfUploadingId === catalog.id || cdnSyncing}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void uploadCdnPdf(catalog.id, file);
                          e.target.value = "";
                        }}
                      />
                      {pdfUploadingId === catalog.id
                        ? "Uploading…"
                        : catalog.pdf_url
                          ? "Replace PDF"
                          : "Upload PDF"}
                    </label>
                    {catalog.pdf_url && (
                      <button
                        type="button"
                        className="admin-chip-danger w-full min-h-10"
                        disabled={cdnSyncing || pdfUploadingId === catalog.id}
                        onClick={() => void removeCdnPdf(catalog.id, catalog.title)}
                      >
                        {pdfUploadingId === catalog.id
                          ? "Removing…"
                          : "Remove PDF file"}
                      </button>
                    )}
                    {!catalog.pdf_url &&
                      catalog.drive_file_id &&
                      !catalog.drive_file_id.startsWith("manual-pdf-") && (
                      <button
                        type="button"
                        className="admin-chip w-full min-h-10"
                        disabled={cdnSyncing || pdfUploadingId === catalog.id}
                        onClick={() => {
                          void (async () => {
                            setPdfUploadingId(catalog.id);
                            setError("");
                            try {
                              await syncCdnFromDrive(catalog.id, true);
                              setSuccess(`Synced: ${catalog.title}`);
                              await fetchCatalogs();
                            } catch (err) {
                              setError(
                                err instanceof Error
                                  ? err.message
                                  : "Sync failed"
                              );
                            } finally {
                              setPdfUploadingId(null);
                            }
                          })();
                        }}
                      >
                        Import from Drive
                      </button>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="admin-chip"
                        aria-label="Move earlier"
                        disabled={catalogs[0]?.id === catalog.id}
                        onClick={() => moveCatalog(catalog.id, -1)}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="admin-chip"
                        aria-label="Move later"
                        disabled={
                          catalogs[catalogs.length - 1]?.id === catalog.id
                        }
                        onClick={() => moveCatalog(catalog.id, 1)}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => startEdit(catalog)}
                        className="admin-chip flex-1 inline-flex items-center justify-center gap-1"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(catalog.id)}
                        className="admin-chip-danger flex-1 inline-flex items-center justify-center gap-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
