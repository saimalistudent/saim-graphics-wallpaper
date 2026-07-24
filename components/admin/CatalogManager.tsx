"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Catalog } from "@/lib/types";
import {
  extractDriveFileId,
  getCatalogPreviewBadge,
  getDriveThumbnailFallbackUrl,
  getDriveThumbnailUrl,
  isAutoDriveThumbnail,
} from "@/lib/drive";
import { ImageIcon, Pencil, Trash2, Plus, Sparkles } from "lucide-react";

export function CatalogManager() {
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [driveFileId, setDriveFileId] = useState("");
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
      const res = await fetch("/api/admin/catalogs");
      if (res.ok) {
        setCatalogs(await res.json());
        setError("");
      } else {
        setError("Catalogs load nahi hue. Supabase tables check karein.");
      }
    } catch {
      setError("Network error — dubara try karein.");
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
      throw new Error("Photo 5MB se chhoti honi chahiye");
    }
    if (!thumbnailFile.type.startsWith("image/")) {
      throw new Error("Sirf image file upload karein");
    }

    const formData = new FormData();
    formData.append("file", thumbnailFile);

    const res = await fetch("/api/admin/upload?kind=thumb", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? "Photo upload fail");
    }

    const data = await res.json();
    return data.url;
  }

  async function uploadCdnPdfToStorage(catalogId: string, file: File) {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      throw new Error("Sirf PDF file upload karein");
    }
    if (file.size > 50 * 1024 * 1024) {
      throw new Error("PDF 50MB se chhoti honi chahiye");
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
    if (!signRes.ok) throw new Error(signData.error || "Signed URL fail");

    const putRes = await fetch(signData.signedUrl as string, {
      method: "PUT",
      headers: {
        "Content-Type": "application/pdf",
        "x-upsert": "true",
      },
      body: file,
    });
    if (!putRes.ok) {
      throw new Error("PDF Storage upload fail — bucket catalog-pdfs check karein");
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
        confirmData.error || "PDF save fail — 004 migration run karein?"
      );
    }
  }

  async function syncCdnFromDrive(catalogId: string, force = false) {
    const res = await fetch("/api/admin/catalog-pdf/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catalogId, force }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "CDN sync fail");
    return data as { skipped?: boolean; bytes?: number; message?: string };
  }

  async function uploadCdnPdf(catalogId: string, file: File) {
    setPdfUploadingId(catalogId);
    setError("");
    setSuccess("");
    try {
      await uploadCdnPdfToStorage(catalogId, file);
      setSuccess("CDN PDF save ho gayi — users ko jaldi open hogi.");
      await fetchCatalogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF upload fail");
    } finally {
      setPdfUploadingId(null);
    }
  }

  function resetForm() {
    setTitle("");
    setDriveFileId("");
    setThumbnailFile(null);
    setPdfFile(null);
    setPreviewUrl(null);
    setEditingId(null);
    setExistingThumb(null);
    setError("");
    setAutoThumbFailed(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      let uploaded: string | null = null;
      if (thumbnailFile) {
        uploaded = await uploadThumbnail();
      } else if (editingId && existingThumb && !isAutoDriveThumbnail(existingThumb)) {
        uploaded = existingThumb;
      }

      const payload = {
        title: title.trim(),
        drive_file_id: driveFileId.trim(),
        thumbnail_url: uploaded,
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
        throw new Error(data.error ?? "Save fail");
      }

      const saved = (await res.json()) as Catalog;

      // Auto → Supabase CDN (direct PDF file OR Drive sync)
      setCdnSyncing(true);
      setSuccess("Catalog save ho gaya — CDN PDF upload ho rahi hai…");
      try {
        if (pdfFile) {
          await uploadCdnPdfToStorage(saved.id, pdfFile);
          setSuccess("Catalog + CDN PDF ready — users ko jaldi open hogi.");
        } else {
          const prevDrive = editingId
            ? catalogs.find((c) => c.id === editingId)?.drive_file_id
            : null;
          const driveChanged = Boolean(
            prevDrive && prevDrive !== saved.drive_file_id
          );
          const sync = await syncCdnFromDrive(saved.id, driveChanged);
          if (sync.skipped) {
            setSuccess("Catalog update ho gaya — CDN PDF pehle se ready thi.");
          } else {
            const mb = sync.bytes
              ? ` (${Math.round(sync.bytes / 1024 / 1024)}MB)`
              : "";
            setSuccess(
              `Catalog save + CDN PDF auto upload ho gayi${mb}.`
            );
          }
        }
      } catch (cdnErr) {
        setError(
          (cdnErr instanceof Error ? cdnErr.message : "CDN upload fail") +
            " — catalog save ho gaya; neeche se CDN PDF dubara try karein."
        );
        setSuccess("");
      } finally {
        setCdnSyncing(false);
      }

      resetForm();
      await fetchCatalogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kuch galat ho gaya");
    } finally {
      setSubmitting(false);
      setCdnSyncing(false);
    }
  }

  function startEdit(catalog: Catalog) {
    setEditingId(catalog.id);
    setTitle(catalog.title);
    setDriveFileId(catalog.drive_file_id);
    setExistingThumb(catalog.thumbnail_url);
    setThumbnailFile(null);
    setError("");
    setSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(id: string) {
    if (!confirm("Ye catalog delete karna hai?")) return;

    setError("");
    setSuccess("");
    const res = await fetch(`/api/admin/catalogs?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      if (editingId === id) resetForm();
      await fetchCatalogs();
      setSuccess("Catalog delete ho gaya.");
    } else {
      setError("Delete nahi hua.");
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="admin-card space-y-5">
        <div className="flex items-center gap-2">
          <Plus className="h-5 w-5 text-gold" />
          <h2 className="admin-card-title">
            {editingId ? "Catalog Edit karein" : "Naya Catalog Add karein"}
          </h2>
        </div>

        <p className="text-sm text-text-secondary">
          Name + Google Drive link enough hai. Save pe PDF <strong>auto Supabase CDN</strong>{" "}
          pe chali jati hai. Optional: seedha PDF file bhi choose kar sakte ho.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">
            <div>
              <label className="admin-label">1. Catalog Name</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="admin-input"
                placeholder="Example: Kitchen Walls"
                required
              />
            </div>
            <div>
              <label className="admin-label">2. Google Drive Link / File ID</label>
              <input
                value={driveFileId}
                onChange={(e) => setDriveFileId(e.target.value)}
                className="admin-input"
                placeholder="Drive share link paste karein"
                required
              />
              <p className="mt-1 text-xs text-text-secondary">
                Drive pe file &quot;Anyone with the link can view&quot; rakhein.
              </p>
            </div>
            <div>
              <label className="admin-label">
                3. Preview Photo <span className="font-normal text-text-secondary">(optional)</span>
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setThumbnailFile(e.target.files?.[0] ?? null)}
                className="admin-input file:mr-3 file:rounded-md file:border-0 file:bg-gold/15 file:px-3 file:py-1.5 file:text-sm file:text-burgundy"
              />
              <p className="mt-1 text-xs text-text-secondary">
                Agar empty chhoro to system PDF page 1 se auto preview nikalega.
              </p>
            </div>
            <div>
              <label className="admin-label">
                4. PDF file{" "}
                <span className="font-normal text-text-secondary">
                  (optional — warna Drive se auto CDN)
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
                  : "Empty = Drive PDF auto Supabase pe upload hogi save ke baad."}
              </p>
            </div>
          </div>

          <div>
            <label className="admin-label">Live Preview</label>
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
                      Auto from PDF page 1
                    </span>
                  )}
                  <div className="catalog-preview-shine" aria-hidden />
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-text-secondary px-3 text-center">
                  <ImageIcon className="h-8 w-8 opacity-40" />
                  <span className="text-xs">
                    Drive link paste karo — preview yahan auto aayega
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-emerald-700">{success}</p>}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            className="golden-button text-sm"
            disabled={submitting || cdnSyncing}
          >
            {submitting || cdnSyncing
              ? cdnSyncing
                ? "CDN upload…"
                : "Saving..."
              : editingId
                ? "Update Catalog"
                : "Add Catalog"}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="admin-chip">
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="admin-card">
        <h2 className="admin-card-title mb-1">
          Aapke Catalogs ({catalogs.length})
        </h2>
        <p className="text-sm text-text-secondary mb-5">
          Edit / delete yahan se. Har catalog pe <strong>Upload CDN PDF</strong> se
          Storage pe PDF rakhein — users ko Drive wait nahi lagegi. Ya CLI:{" "}
          <code className="text-xs">npm run migrate:pdfs</code>
        </p>

        {loading ? (
          <p className="text-text-secondary text-sm">Loading...</p>
        ) : catalogs.length === 0 ? (
          <p className="text-text-secondary text-sm">
            Abhi koi catalog nahi. Upar form se pehla add karein.
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
                      {catalog.pdf_url
                        ? `CDN PDF ready${
                            catalog.pdf_bytes
                              ? ` · ${Math.round(catalog.pdf_bytes / 1024 / 1024)}MB`
                              : ""
                          }`
                        : "CDN PDF missing — Drive fallback"}
                    </p>
                    <label className="admin-chip w-full inline-flex items-center justify-center gap-1 cursor-pointer">
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
                        ? "Uploading PDF…"
                        : catalog.pdf_url
                          ? "Replace CDN PDF"
                          : "Upload CDN PDF"}
                    </label>
                    {!catalog.pdf_url && (
                      <button
                        type="button"
                        className="admin-chip w-full"
                        disabled={cdnSyncing || pdfUploadingId === catalog.id}
                        onClick={() => {
                          void (async () => {
                            setPdfUploadingId(catalog.id);
                            setError("");
                            try {
                              await syncCdnFromDrive(catalog.id, true);
                              setSuccess(`CDN sync OK: ${catalog.title}`);
                              await fetchCatalogs();
                            } catch (err) {
                              setError(
                                err instanceof Error
                                  ? err.message
                                  : "CDN sync fail"
                              );
                            } finally {
                              setPdfUploadingId(null);
                            }
                          })();
                        }}
                      >
                        Sync from Drive → CDN
                      </button>
                    )}
                    <div className="flex gap-2">
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
