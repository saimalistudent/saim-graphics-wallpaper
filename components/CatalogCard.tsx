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

type CatalogCardProps = {
  catalog: Catalog;
  index?: number;
  /** Tighter layout so home can preview 2 cards under the hero */
  compact?: boolean;
};

function rememberScroll(pathname: string) {
  try {
    sessionStorage.setItem(
      `scroll:${pathname}`,
      String(Math.round(window.scrollY))
    );
    sessionStorage.setItem("scroll:return", pathname);
  } catch {
    // ignore
  }
}

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
  const isLocalThumb = Boolean(
    catalog.thumbnail_url?.startsWith("/")
  );

  const candidates = useMemo(() => {
    if (isLocalThumb || !isDriveAuto) {
      return catalog.thumbnail_url ? [catalog.thumbnail_url] : [];
    }
    return buildDriveCandidates(fileId, catalog.thumbnail_url);
  }, [catalog.thumbnail_url, fileId, isDriveAuto, isLocalThumb]);

  const [candidateIndex, setCandidateIndex] = useState(0);
  const [thumbFailed, setThumbFailed] = useState(candidates.length === 0);

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

  return (
    <FadeUp delay={index * 0.05} className="h-full">
      <Card className="h-full">
        <Link
          href={`/catalogs/${catalog.id}`}
          className="flex h-full flex-col group"
          scroll={false}
          onClick={() => rememberScroll(pathname || "/catalogs")}
        >
          <div
            className={`catalog-preview-frame relative shrink-0 bg-background overflow-hidden ${
              compact ? "aspect-[5/4] sm:aspect-[4/3]" : "aspect-[4/3]"
            }`}
          >
            {thumbSrc ? (
              <>
                {isDriveAuto ? (
                  // Native img + no-referrer: Drive often blocks localhost Referer on desktop
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
              className={`catalog-view-btn mt-auto ${
                compact ? "catalog-view-btn--compact" : ""
              }`}
            >
              View Designs
            </span>
          </div>
        </Link>
      </Card>
    </FadeUp>
  );
}
