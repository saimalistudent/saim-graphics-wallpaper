"use client";

import { useEffect, useState } from "react";
import { Catalog } from "@/lib/types";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Flame,
  Loader2,
  Plus,
  X,
} from "lucide-react";

export function TrendingManager() {
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [featuredIds, setFeaturedIds] = useState<string[]>([]);
  const [displayCount, setDisplayCount] = useState(8);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/featured");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setCatalogs(data.catalogs as Catalog[]);
      setDisplayCount(Number(data.display_count) || 8);
      setFeaturedIds(
        (data.featured as Catalog[]).map((c) => c.id)
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const byId = new Map(catalogs.map((c) => [c.id, c]));
  const featured = featuredIds
    .map((id) => byId.get(id))
    .filter((c): c is Catalog => Boolean(c));
  const available = catalogs.filter((c) => !featuredIds.includes(c.id));

  function move(id: string, dir: -1 | 1) {
    setFeaturedIds((prev) => {
      const i = prev.indexOf(id);
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function add(id: string) {
    setFeaturedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setPickerOpen(false);
  }

  function remove(id: string) {
    setFeaturedIds((prev) => prev.filter((x) => x !== id));
  }

  async function save() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/featured", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_count: displayCount,
          catalog_ids: featuredIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setSuccess(
        `Saved — home shows up to ${displayCount} trending design(s).`
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-text-secondary flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </p>
    );
  }

  return (
    <div className="admin-card space-y-5">
      <div>
        <h2 className="admin-card-title inline-flex items-center gap-2">
          <Flame className="h-4 w-4 text-burgundy" />
          Trending Designs
        </h2>
        <p className="text-sm text-text-secondary mt-1">
          Choose which PDFs appear under the hero on the home page, how many
          cards to show, and their order (top = first).
        </p>
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

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="admin-label">Show on home</label>
          <input
            type="number"
            min={1}
            max={24}
            value={displayCount}
            onChange={(e) =>
              setDisplayCount(
                Math.min(24, Math.max(1, Number(e.target.value) || 1))
              )
            }
            className="admin-input w-24"
          />
        </div>
        <p className="text-xs text-text-secondary pb-2">
          Home shows the first {displayCount} of your featured list (
          {featured.length} selected).
        </p>
      </div>

      <div className="space-y-2">
        {featured.length === 0 ? (
          <p className="text-sm text-text-secondary">
            No featured PDFs yet — add from the list below. Until then the site
            shows the first catalogs by list order.
          </p>
        ) : (
          featured.map((cat, index) => (
            <div
              key={cat.id}
              className="flex items-center gap-3 rounded-lg border border-gold/25 bg-white px-3 py-2"
            >
              <span className="text-xs font-semibold text-burgundy w-6">
                {index + 1}
              </span>
              <div className="h-12 w-10 rounded overflow-hidden bg-[#1a0a0e] shrink-0 border border-gold/20">
                {cat.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cat.thumbnail_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full opacity-30" />
                )}
              </div>
              <p className="flex-1 text-sm text-text-primary line-clamp-2 min-w-0">
                {cat.title}
              </p>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  className="admin-chip"
                  disabled={index === 0}
                  onClick={() => move(cat.id, -1)}
                  aria-label="Move up"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className="admin-chip"
                  disabled={index === featured.length - 1}
                  onClick={() => move(cat.id, 1)}
                  aria-label="Move down"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className="admin-chip-danger"
                  onClick={() => remove(cat.id)}
                  aria-label="Remove"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="admin-chip inline-flex items-center gap-1"
          onClick={() => setPickerOpen((v) => !v)}
        >
          <Plus className="h-3.5 w-3.5" />
          Add PDF
        </button>
        <button
          type="button"
          className="golden-button text-sm px-4 inline-flex items-center gap-1.5"
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          Save trending
        </button>
      </div>

      {pickerOpen && (
        <div className="rounded-lg border border-gold/30 bg-[#fffdf8] p-3 max-h-64 overflow-y-auto space-y-1">
          {available.length === 0 ? (
            <p className="text-sm text-text-secondary">All catalogs already added.</p>
          ) : (
            available.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className="w-full flex items-center gap-2 text-left px-2 py-1.5 rounded hover:bg-gold/10 text-sm"
                onClick={() => add(cat.id)}
              >
                <div className="h-9 w-7 rounded overflow-hidden bg-[#1a0a0e] shrink-0">
                  {cat.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={cat.thumbnail_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <span className="line-clamp-2">{cat.title}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
