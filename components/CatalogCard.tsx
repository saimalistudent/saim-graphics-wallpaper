"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Catalog } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { FadeUp } from "@/components/FadeUp";
import { ImageIcon, Sparkles } from "lucide-react";
import {
  extractDriveFileId,
  getCatalogPreviewBadge,
  getDriveThumbnailFallbackUrl,
  getDriveThumbnailUrl,
  isAutoDriveThumbnail,
} from "@/lib/drive";
import { cn } from "@/lib/utils";
import { rememberCatalogScroll } from "@/lib/scroll-restore";
import { prefetchCatalogPdf } from "@/lib/pdf-prefetch";

type CatalogCardProps = {
  catalog: Catalog;
  index?: number;
  compact?: boolean;
};

function buildDriveCandidates(fileId: string, preferred?: string | null) {
  const list = [
    preferred?.trim() || null,
    getDriveThumbnailUrl(fileId, 800),
    getDriveThumbnailFallbackUrl(fileId, 800),
    getDriveThumbnailUrl(fileId, 400),
    getDriveThumbnailFallbackUrl(fileId, 400),
    `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`,
  ].filter(Boolean) as string[];

  return Array.from(new Set(list));
}

export function CatalogCard({
  catalog,
  index = 0,
  compact = false,
}: CatalogCardProps) {
  const pathname = usePathname();
  const pageBadge = getCatalogPreviewBadge(
    catalog.title,
    catalog.thumbnail_url
  );
  const fileId = extractDriveFileId(catalog.drive_file_id);
  const isDriveAuto = isAutoDriveThumbnail(catalog.thumbnail_url);
  const isLocalThumb = Boolean(catalog.thumbnail_url?.startsWith("/"));

  const candidates = useMemo(() => {
    if (isLocalThumb || !isDriveAuto) {
      return catalog.thumbnail_url ? [catalog.thumbnail_url] : [];
    }
    return buildDriveCandidates(fileId, catalog.thumbnail_url);
  }, [catalog.thumbnail_url, fileId, isDriveAuto, isLocalThumb]);

  const [candidateIndex, setCandidateIndex] = useState(0);
  const [thumbFailed, setThumbFailed] = useState(candidates.length === 0);
  const [selected, setSelected] = useState(false);

  useEffect(() => {
    setCandidateIndex(0);
    setThumbFailed(candidates.length === 0);
  }, [catalog.id, candidates]);

  const thumbSrc = !thumbFailed ? candidates[candidateIndex] ?? null : null;

  function handleThumbError() {
    setCandidateIndex((current) => {
      const next = current + 1;
      if (next >= candidates.length) {
        setThumbFailed(true);
        return current;
      }
      return next;
    });
  }

  function handleSelect() {
    setSelected(true);
    rememberCatalogScroll(pathname || "/catalogs", catalog.id);
    // Warm cache in background only if missing — do not compete with open
    if (fileId) prefetchCatalogPdf(fileId);
  }

  return (
    <FadeUp delay={index * 0.05} className="h-full">
      <Card className={cn("h-full", selected && "catalog-card--selected")}>
        <Link
          href={`/catalogs/${catalog.id}`}
          data-catalog-id={catalog.id}
          className={cn(
            "catalog-card-link flex h-full flex-col group",
            selected && "is-selected"
          )}
          scroll={false}
          onClick={handleSelect}
        >
          <div
            className={`catalog-preview-frame relative shrink-0 bg-background overflow-hidden ${
              compact ? "aspect-[5/4] sm:aspect-[4/3]" : "aspect-[4/3]"
            }`}
          >
            {thumbSrc ? (
              <>
                {isDriveAuto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={thumbSrc}
                    src={thumbSrc}
                    alt={catalog.title}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading={index < 4 ? "eager" : "lazy"}
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onError={handleThumbError}
                  />
                ) : (
                  <Image
                    key={thumbSrc}
                    src={thumbSrc}
                    alt={catalog.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    onError={handleThumbError}
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
              <div className="flex h-full items-center justify-center bg-burgundy/5">
                <ImageIcon className="h-12 w-12 text-text-secondary/40" />
              </div>
            )}

            {selected && (
              <div className="catalog-selected-overlay" aria-live="polite">
                <span className="catalog-selected-badge">Opening…</span>
              </div>
            )}
          </div>
          <div
            className={`flex flex-1 flex-col ${
              compact
                ? "p-2 sm:p-3 gap-1.5 sm:gap-2.5"
                : "p-2.5 sm:p-4 gap-2 sm:gap-3"
            }`}
          >
            <h3
              className={`font-heading font-semibold text-burgundy line-clamp-2 break-words ${
                compact
                  ? "text-xs sm:text-base min-h-[2rem] sm:min-h-[2.75rem]"
                  : "text-sm sm:text-lg min-h-[2.5rem] sm:min-h-[3.5rem]"
              }`}
            >
              {catalog.title}
            </h3>
            <span
              className={`catalog-view-btn gold-btn mt-auto ${
                compact ? "catalog-view-btn--compact" : ""
              } ${selected ? "catalog-view-btn--selected" : ""}`}
            >
              {selected ? "Selected" : "View Designs"}
            </span>
          </div>
        </Link>
      </Card>
    </FadeUp>
  );
}
