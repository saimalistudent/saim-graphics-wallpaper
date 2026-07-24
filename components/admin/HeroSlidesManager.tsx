"use client";

import { useEffect, useState } from "react";
import { HeroSlide } from "@/lib/types";
import { DEFAULT_HERO_SLIDES } from "@/lib/hero-slides";

export function HeroSlidesManager() {
  const [slides, setSlides] = useState<HeroSlide[]>(DEFAULT_HERO_SLIDES);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/hero-slides");
        if (!res.ok) throw new Error("Slides load nahi huin");
        const data = await res.json();
        if (cancelled) return;
        if (data._warning) {
          setError(
            "Supabase mein 003_hero_slides.sql migration run karein — abhi local images use ho rahi hain."
          );
          setSlides(data.slides ?? DEFAULT_HERO_SLIDES);
        } else {
          setSlides(
            Array.isArray(data) && data.length
              ? (data as HeroSlide[])
              : DEFAULT_HERO_SLIDES
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

  async function replaceSlide(slide: HeroSlide, file: File) {
    setBusyId(slide.id);
    setError(null);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const up = await fetch("/api/admin/upload", {
        method: "POST",
        body: form,
      });
      const upData = await up.json();
      if (!up.ok) throw new Error(upData.error || "Upload failed");

      const res = await fetch("/api/admin/hero-slides", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: slide.id.startsWith("local-") ? undefined : slide.id,
          sort_order: slide.sort_order,
          image_url: upData.url,
          enabled: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");

      setSlides((prev) =>
        prev.map((s) =>
          s.sort_order === slide.sort_order ? (data as HeroSlide) : s
        )
      );
      setMessage(`Slide ${slide.sort_order} update ho gayi.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <p className="text-text-secondary text-sm">Loading slides…</p>;
  }

  return (
    <div className="space-y-4">
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {slides
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((slide) => (
            <div key={slide.id} className="admin-card space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-burgundy">
                Slide {slide.sort_order}
              </p>
              <div className="rounded-lg overflow-hidden border border-gold/25 bg-[#1a0a0e]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={slide.image_url}
                  alt=""
                  className="w-full aspect-[3/2] object-cover"
                />
              </div>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                disabled={busyId === slide.id}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void replaceSlide(slide, file);
                  e.target.value = "";
                }}
                className="admin-input file:mr-3 file:rounded-md file:border-0 file:bg-gold/15 file:px-3 file:py-1.5 file:text-sm file:text-burgundy"
              />
              <p className="text-xs text-text-secondary">
                {busyId === slide.id
                  ? "Uploading…"
                  : "Nayi image = purani replace + delete"}
              </p>
            </div>
          ))}
      </div>
    </div>
  );
}
