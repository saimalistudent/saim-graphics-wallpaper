"use client";

import { useEffect, useState } from "react";
import { CatalogCategory } from "@/lib/types";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";

export function CategoryManager() {
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/categories");
      const data = await res.json();
      if (data._warning) {
        setError("Run 005_catalog_categories.sql in Supabase first.");
        setCategories([]);
      } else if (!res.ok) {
        throw new Error(data.error || "Failed to load categories");
      } else {
        setCategories(data as CatalogCategory[]);
        setError("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Add failed");
      setNewName("");
      setSuccess(`Added ${data.name}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Add failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: editName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      setEditingId(null);
      setSuccess(`Renamed to ${data.name}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeCategory(id: string, name: string) {
    if (!confirm(`Delete "${name}"? Catalogs keep their designs.`)) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(
        `/api/admin/categories?id=${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setSuccess(`Deleted ${name}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-card space-y-4">
      <div>
        <h2 className="admin-card-title">Categories</h2>
        <p className="text-sm text-text-secondary mt-1">
          Filters on the catalogs page. <strong>ALL</strong> is always available
          and selected by default.
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

      <form onSubmit={addCategory} className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[10rem]">
          <label className="admin-label">New category</label>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="admin-input uppercase"
            placeholder="e.g. KITCHEN"
            disabled={busy}
          />
        </div>
        <button
          type="submit"
          disabled={busy || !newName.trim()}
          className="admin-chip inline-flex items-center gap-1"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-text-secondary">Loading…</p>
      ) : categories.length === 0 ? (
        <p className="text-sm text-text-secondary">No categories yet.</p>
      ) : (
        <ul className="admin-category-list">
          {categories.map((cat) => (
            <li key={cat.id} className="admin-category-row">
              {editingId === cat.id ? (
                <>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="admin-input flex-1 uppercase py-1.5"
                    autoFocus
                    disabled={busy}
                  />
                  <button
                    type="button"
                    className="admin-chip"
                    disabled={busy}
                    onClick={() => void saveEdit(cat.id)}
                    aria-label="Save"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="admin-chip"
                    disabled={busy}
                    onClick={() => setEditingId(null)}
                    aria-label="Cancel"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <span className="admin-category-name">{cat.name}</span>
                  <button
                    type="button"
                    className="admin-chip inline-flex items-center gap-1"
                    disabled={busy}
                    onClick={() => {
                      setEditingId(cat.id);
                      setEditName(cat.name);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Rename
                  </button>
                  <button
                    type="button"
                    className="admin-chip-danger inline-flex items-center gap-1"
                    disabled={busy}
                    onClick={() => void removeCategory(cat.id, cat.name)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
