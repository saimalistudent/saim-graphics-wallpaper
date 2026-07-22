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

    const res = await fetch("/api/admin/upload", {
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

  function resetForm() {
    setTitle("");
    setDriveFileId("");
    setThumbnailFile(null);
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

      setSuccess(
        editingId
          ? "Catalog update ho gaya!"
          : uploaded
            ? "Catalog add ho gaya!"
            : "Catalog add ho gaya — PDF page 1 preview auto ban gaya!"
      );
      resetForm();
      await fetchCatalogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kuch galat ho gaya");
    } finally {
      setSubmitting(false);
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
          Name + Google Drive link enough hai. Preview photo <strong>optional</strong> —
          agar photo nahi doge to PDF ka pehla page khud preview ban jayega.
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
          <button type="submit" className="golden-button text-sm" disabled={submitting}>
            {submitting
              ? "Saving..."
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
          Edit ya delete yahan se karein.
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
