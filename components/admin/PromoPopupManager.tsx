"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import { PromoPopup } from "@/lib/types";
import { DEFAULT_PROMO_POPUP } from "@/lib/promo-popup";

export function PromoPopupManager() {
  const [promo, setPromo] = useState<PromoPopup>(DEFAULT_PROMO_POPUP);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/promo");
        if (!res.ok) throw new Error("Promo load nahi hui");
        const data = (await res.json()) as PromoPopup & { _warning?: string };
        if (cancelled) return;
        setPromo({
          ...DEFAULT_PROMO_POPUP,
          ...data,
          enabled: Boolean(data.enabled),
          image_url: data.image_url ?? null,
        });
        if (data._warning) {
          setError(
            "Supabase mein 002_promo_popup.sql migration run karein — abhi sample image use ho rahi hai."
          );
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Load failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function savePromo(next: {
    enabled: boolean;
    image_url: string;
  }) {
    const res = await fetch("/api/admin/promo", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Save failed");
    return data as PromoPopup;
  }

  async function handleUpload(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError(null);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      const saved = await savePromo({
        enabled: promo.enabled,
        image_url: data.url,
      });
      setPromo(saved);
      setMessage("Nayi promo image save ho gayi — purani hata di.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!promo.image_url?.trim()) {
      setError("Pehle popup image upload karein.");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await savePromo({
        enabled: promo.enabled,
        image_url: promo.image_url,
      });
      setPromo(saved);
      setMessage("Promo popup save ho gaya.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-text-secondary text-sm">Loading promo…</p>;
  }

  const previewSrc = promo.image_url?.trim() || null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
      <form onSubmit={handleSave} className="admin-card space-y-5">
        <label className="flex items-center gap-3 text-sm font-medium text-burgundy">
          <input
            type="checkbox"
            checked={promo.enabled}
            onChange={(e) =>
              setPromo((p) => ({ ...p, enabled: e.target.checked }))
            }
            className="h-4 w-4 accent-[#4A0404]"
          />
          Popup website pe show ho
        </label>

        <div>
          <label className="admin-label">Popup image (2:3 ratio best)</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            disabled={uploading}
            onChange={(e) => {
              void handleUpload(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
            className="admin-input file:mr-3 file:rounded-md file:border-0 file:bg-gold/15 file:px-3 file:py-1.5 file:text-sm file:text-burgundy"
          />
          <p className="mt-1.5 text-xs text-text-secondary">
            {uploading
              ? "Uploading & replacing…"
              : "Nayi image select karo — purani auto delete ho jayegi"}
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        {message && (
          <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            {message}
          </p>
        )}

        <button
          type="submit"
          className="golden-button"
          disabled={saving || uploading}
        >
          {saving ? "Saving…" : "Save ON/OFF"}
        </button>
      </form>

      <aside className="admin-card">
        <p className="text-xs uppercase tracking-wider text-text-secondary mb-3">
          Preview
        </p>
        <div className="rounded-xl overflow-hidden border border-gold/30 bg-[#1a0a0e]">
          {previewSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewSrc}
              alt=""
              className="w-full aspect-[2/3] object-cover"
            />
          ) : (
            <div className="aspect-[2/3] flex items-center justify-center bg-burgundy/5">
              <Image src="/logo.png" alt="" width={64} height={64} />
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
