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
        setError(
          "Supabase mein 005_catalog_categories.sql migration run karein."
        );
        setCategories([]);
      } else if (!res.ok) {
        throw new Error(data.error || "Categories load fail");
      } else {
        setCategories(data as CatalogCategory[]);
        setError("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load fail");
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
      if (!res.ok) throw new Error(data.error || "Add fail");
      setNewName("");
      setSuccess(`Category add: ${data.name}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Add fail");
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
      if (!res.ok) throw new Error(data.error || "Update fail");
      setEditingId(null);
      setSuccess(`Renamed → ${data.name}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update fail");
    } finally {
      setBusy(false);
    }
  }

  async function removeCategory(id: string, name: string) {
    if (
      !confirm(
        `"${name}" delete? Linked catalogs se category hat jayegi (designs delete nahi hongi).`
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(
        `/api/admin/categories?id=${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Delete fail");
      setSuccess(`Deleted: ${name}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete fail");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-card space-y-4">
      <div>
        <h2 className="admin-card-title">Design Categories</h2>
        <p className="text-sm text-text-secondary mt-1">
          Website catalogs page pe ye filters dikhengi.{" "}
          <strong>ALL</strong> hamesha default selected rehti hai (saare designs).
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
          <label className="admin-label">Nayi category</label>
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
        <p className="text-sm text-text-secondary">
          Abhi koi category nahi — migration run karein ya add karein.
        </p>
      ) : (
        <ul className="divide-y divide-burgundy/10 border border-burgundy/10 rounded-xl overflow-hidden">
          {categories.map((cat) => (
            <li
              key={cat.id}
              className="flex items-center gap-2 px-3 py-2.5 bg-white/60"
            >
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
                  <span className="flex-1 font-heading font-semibold tracking-wide text-burgundy">
                    {cat.name}
                  </span>
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
