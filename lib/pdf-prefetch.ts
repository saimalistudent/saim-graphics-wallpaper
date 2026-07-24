import { isPdfBuffer } from "@/lib/pdf-local-cache";

const PREFETCH_CACHE = "saim-pdf-prefetch-v1";
const SMALL_PDF_MAX = 12 * 1024 * 1024;

export function pdfApiUrlFor(fileId: string) {
  return `/api/drive-pdf/${encodeURIComponent(fileId.trim())}`;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(null), ms);
    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        window.clearTimeout(timer);
        resolve(null);
      });
  });
}

/** Warm small PDFs only — never pull 35MB crown-room files into Cache API. */
export function prefetchCatalogPdf(
  url: string,
  knownBytes?: number | null
) {
  if (typeof window === "undefined" || !url) return;
  const key = url.trim();
  const w = window as Window & { __saimPrefetch?: Set<string> };
  w.__saimPrefetch = w.__saimPrefetch || new Set();
  if (w.__saimPrefetch.has(key)) return;
  w.__saimPrefetch.add(key);

  void (async () => {
    try {
      if (typeof knownBytes === "number" && knownBytes > 0) {
        if (knownBytes > SMALL_PDF_MAX) return;
      } else if (key.startsWith("/api/drive-pdf")) {
        const head = await fetch(key, { method: "HEAD", cache: "force-cache" });
        const len = Number(head.headers.get("content-length") || 0);
        if (!len || len > SMALL_PDF_MAX) return;
      }

      const cache = await caches.open(PREFETCH_CACHE);
      if (await cache.match(key)) return;
      await cache.add(key);
    } catch {
      // ignore
    }
  })();
}

/**
 * Read a prefetched PDF only when it is small.
 * IMPORTANT: never arrayBuffer() a 30MB+ response on phones — that freezes loading.
 */
export async function readPrefetchedPdf(
  url: string
): Promise<ArrayBuffer | null> {
  try {
    const cache = await withTimeout(caches.open(PREFETCH_CACHE), 400);
    if (!cache) return null;
    const res = await withTimeout(cache.match(url), 400);
    if (!res) return null;

    const len = Number(res.headers.get("content-length") || 0);
    if (len > SMALL_PDF_MAX) {
      void cache.delete(url);
      return null;
    }

    if (!len) {
      const isMobile =
        typeof navigator !== "undefined" &&
        /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isMobile) {
        void cache.delete(url);
        return null;
      }
    }

    const data = await withTimeout(res.arrayBuffer(), 2500);
    if (!data || !isPdfBuffer(data) || data.byteLength > SMALL_PDF_MAX) {
      if (data && data.byteLength > SMALL_PDF_MAX) void cache.delete(url);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}
