"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Download,
  MessageCircle,
  Minus,
  Plus,
  RotateCcw,
} from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Catalog } from "@/lib/types";
import {
  buildWhatsAppUrl,
  getDriveDownloadUrl,
  getWhatsAppNumber,
  getWhatsAppScreenshotMessage,
} from "@/lib/drive";
import {
  createSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import { getScrollReturnPath } from "@/lib/scroll-restore";
import {
  fetchPdfWithProgress,
  getCachedPdf,
  isPdfBuffer,
  removeCachedPdf,
  setCachedPdf,
} from "@/lib/pdf-local-cache";
import { readPrefetchedPdf } from "@/lib/pdf-prefetch";

type PdfViewerProps = {
  catalog: Catalog;
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const LARGE_PDF_BYTES = 12 * 1024 * 1024;
const SMALL_PDF_MAX = 12 * 1024 * 1024;
const MIN_PDF_LOADER_MS = 220;

/** Short, pleasant lines — keep the wait calm without feeling stuck */
const PDF_LOAD_STAGES = [
  "Opening designs",
  "Almost ready",
  "Just a moment",
] as const;

/** Same-session reopen without touching IndexedDB */
const memoryPdfCache = new Map<string, ArrayBuffer>();

function isMobileUa() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
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

function rememberPdf(fileId: string, data: ArrayBuffer) {
  if (!fileId || !isPdfBuffer(data)) return;
  memoryPdfCache.set(fileId, data);
  // Never persist huge catalogs on phone storage APIs (causes endless loading)
  if (data.byteLength <= SMALL_PDF_MAX) {
    void setCachedPdf(fileId, data.slice(0));
  }
}

function releasePdfDoc(doc: PDFDocumentProxy | null | undefined) {
  if (!doc) return;
  try {
    void (doc as unknown as { cleanup?: () => Promise<void> | void }).cleanup?.();
  } catch {
    // ignore
  }
}

type MapUpsertProto = typeof Map.prototype & {
  getOrInsertComputed?: (
    key: unknown,
    callbackFn: (key: unknown) => unknown
  ) => unknown;
  getOrInsert?: (key: unknown, value: unknown) => unknown;
};

async function loadPdfJs() {
  // pdf.js 5.5+/6 needs Map upsert APIs; polyfill for older mobile Chrome
  const mapProto = Map.prototype as MapUpsertProto;
  if (typeof mapProto.getOrInsertComputed !== "function") {
    Object.defineProperty(mapProto, "getOrInsertComputed", {
      value(this: Map<unknown, unknown>, key: unknown, callbackFn: (key: unknown) => unknown) {
        if (this.has(key)) return this.get(key);
        const value = callbackFn(key);
        this.set(key, value);
        return value;
      },
      writable: true,
      configurable: true,
    });
  }
  if (typeof mapProto.getOrInsert !== "function") {
    Object.defineProperty(mapProto, "getOrInsert", {
      value(this: Map<unknown, unknown>, key: unknown, value: unknown) {
        if (this.has(key)) return this.get(key);
        this.set(key, value);
        return value;
      },
      writable: true,
      configurable: true,
    });
  }

  // Legacy build includes broader browser polyfills (critical for mobile)
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Absolute worker URL — relative paths break on some mobile WebViews
  pdfjs.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.mjs`;
  return pdfjs;
}

const PDFJS_ASSET = {
  cMapUrl: "/pdfjs/cmaps/",
  cMapPacked: true,
  standardFontDataUrl: "/pdfjs/standard_fonts/",
  wasmUrl: "/pdfjs/wasm/",
} as const;

function pdfJsAssets() {
  if (typeof window === "undefined") return { ...PDFJS_ASSET };
  const origin = window.location.origin;
  return {
    cMapUrl: `${origin}/pdfjs/cmaps/`,
    cMapPacked: true as const,
    standardFontDataUrl: `${origin}/pdfjs/standard_fonts/`,
    wasmUrl: `${origin}/pdfjs/wasm/`,
  };
}

function distance(a: Touch, b: Touch) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

function midPoint(a: Touch, b: Touch) {
  return {
    x: (a.clientX + b.clientX) / 2,
    y: (a.clientY + b.clientY) / 2,
  };
}

let renderActive = 0;
const renderQueue: Array<() => void> = [];
const MAX_PARALLEL_RENDERS = 2;

function enqueueRender(task: () => Promise<void>) {
  return new Promise<void>((resolve) => {
    const run = () => {
      renderActive += 1;
      Promise.resolve()
        .then(task)
        .catch(() => undefined)
        .finally(() => {
          renderActive -= 1;
          resolve();
          const next = renderQueue.shift();
          if (next) next();
        });
    };
    if (renderActive < MAX_PARALLEL_RENDERS) run();
    else renderQueue.push(run);
  });
}

function PdfPage({
  pdf,
  pageNumber,
  width,
  quality,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  width: number;
  quality: number;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paintedQualityRef = useRef(0);
  const [nearView, setNearView] = useState(pageNumber <= 3);
  const [ready, setReady] = useState(false);
  const [cssHeight, setCssHeight] = useState(Math.round(width * 0.75));

  // Keep sheet height correct even before paint (smooth scroll for large PDFs)
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;
        const unscaled = page.getViewport({ scale: 1 });
        const height = Math.round(unscaled.height * (width / unscaled.width));
        if (height > 40) setCssHeight(height);
      } catch {
        // keep estimate
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdf, pageNumber, width]);

  // Only paint pages near the scroller viewport (crown room has 26 heavy pages)
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    const root = sheet.closest(".pdf-scroller");
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target === sheet) setNearView(entry.isIntersecting);
        }
      },
      {
        root: root instanceof Element ? root : null,
        rootMargin: "1400px 0px",
        threshold: 0.01,
      }
    );
    io.observe(sheet);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!nearView || width < 40) return;
    // Already painted at this quality (or better) — don't flash skeleton / requeue
    if (ready && paintedQualityRef.current >= quality - 0.08) return;

    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<void> } | null =
      null;

    void enqueueRender(async () => {
      if (cancelled || !canvasRef.current) return;
      try {
        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;

        const unscaled = page.getViewport({ scale: 1 });
        const cssScale = width / unscaled.width;
        const height = Math.round(unscaled.height * cssScale);
        setCssHeight(height);

        const mul = Math.min(3, Math.max(1.1, quality));
        const viewport = page.getViewport({ scale: cssScale * mul });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = "100%";
        canvas.style.height = `${height}px`;

        renderTask = page.render({
          canvas,
          viewport,
          intent: "display",
        });
        await renderTask.promise;
        if (!cancelled) {
          paintedQualityRef.current = quality;
          setReady(true);
        }
      } catch (err) {
        if (
          cancelled ||
          (err instanceof Error && /cancel/i.test(err.message))
        ) {
          return;
        }
      }
    });

    return () => {
      cancelled = true;
      try {
        renderTask?.cancel();
      } catch {
        // ignore
      }
    };
  }, [pdf, pageNumber, width, quality, nearView, ready]);

  return (
    <div
      ref={sheetRef}
      className="pdf-page-sheet"
      data-page={pageNumber}
      style={{ minHeight: cssHeight }}
    >
      {!ready && <div className="pdf-page-skeleton" />}
      <canvas
        ref={canvasRef}
        className="pdf-page-canvas"
        dir="ltr"
        style={{ direction: "ltr" }}
      />
    </div>
  );
}

export function PdfViewer({ catalog }: PdfViewerProps) {
  const router = useRouter();
  const stageRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const savedScrollTopRef = useRef(0);
  const pinchRef = useRef<{
    startDist: number;
    startScale: number;
    startOffset: { x: number; y: number };
    origin: { x: number; y: number };
  } | null>(null);
  const panRef = useRef<{
    x: number;
    y: number;
    ox: number;
    oy: number;
  } | null>(null);
  const lastTapRef = useRef(0);
  const tapPointRef = useRef<{ x: number; y: number } | null>(null);
  const didPinchRef = useRef(false);
  const movedRef = useRef(false);
  const qualityTimer = useRef<number | null>(null);

  const [mounted, setMounted] = useState(false);
  const [baseWidth, setBaseWidth] = useState(360);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [gestureLock, setGestureLock] = useState(false);
  const [numPages, setNumPages] = useState(0);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadStage, setLoadStage] = useState(0);
  const [loadProgress, setLoadProgress] = useState(0);
  const [visibleUntil, setVisibleUntil] = useState(2);
  const [largePdf, setLargePdf] = useState(false);
  const [quality, setQuality] = useState(1.3);

  const phoneNumber = getWhatsAppNumber();
  const whatsappMessage = getWhatsAppScreenshotMessage(catalog.title);
  const whatsappUrl = phoneNumber
    ? buildWhatsAppUrl(phoneNumber, whatsappMessage)
    : null;
  const downloadUrl = getDriveDownloadUrl(catalog.drive_file_id);
  const pdfApiUrl = useMemo(
    () => `/api/drive-pdf/${encodeURIComponent(catalog.drive_file_id)}`,
    [catalog.drive_file_id]
  );

  // Always fit stage width — zoom is CSS transform (no layout jump / no L-R free scroll at 1x)
  const pageWidth = baseWidth;
  const zoomed = scale > 1.02 || gestureLock;

  const scheduleQuality = useCallback((z: number, isLarge: boolean) => {
    if (qualityTimer.current) window.clearTimeout(qualityTimer.current);
    qualityTimer.current = window.setTimeout(() => {
      const dpr =
        typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1.5;
      if (z <= 1.05) {
        // Keep first paint light on heavy catalogs (crown room)
        setQuality(isLarge ? Math.min(1.2, dpr) : Math.min(1.7, 1.2 * dpr));
      } else if (z < 2) {
        setQuality(Math.min(2.4, z * Math.min(dpr, 2)));
      } else {
        setQuality(Math.min(2.8, z * Math.min(dpr, 2.1)));
      }
    }, 160);
  }, []);

  /** Bake scroller position into transform so pinch/double-tap don't jump up */
  function absorbScrollIntoOffset() {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const st = scroller.scrollTop;
    if (st === 0) return;
    const next = {
      x: offsetRef.current.x,
      y: offsetRef.current.y - st * scaleRef.current,
    };
    offsetRef.current = next;
    setOffset(next);
    scroller.scrollTop = 0;
  }

  function lockScroller() {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollTop = 0;
    // Sync lock — React class update is too late and browser scrolls up mid-pinch
    scroller.style.overflow = "hidden";
    scroller.style.touchAction = "none";
  }

  function unlockScroller() {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.style.overflow = "";
    scroller.style.touchAction = "";
  }

  function clampOffset(nextScale: number, x: number, y: number) {
    const stage = stageRef.current;
    const content = contentRef.current;
    if (!stage || !content) return { x, y };
    const sw = stage.clientWidth;
    const cw = content.scrollWidth * nextScale;
    const minX = Math.min(0, sw - cw);
    return {
      x: Math.max(minX, Math.min(0, x)),
      // Never pull Y upward (that jumps to top when few pages are loaded)
      y: Math.min(0, y),
    };
  }

  /** Map screen point zoom from a known previous scale/offset → new offset */
  function offsetAround(
    prevScale: number,
    prevOffset: { x: number; y: number },
    nextScale: number,
    around: { x: number; y: number }
  ) {
    const stage = stageRef.current;
    if (!stage) return prevOffset;
    const rect = stage.getBoundingClientRect();
    const sx = around.x - rect.left;
    const sy = around.y - rect.top;
    const prev = Math.max(prevScale, 0.0001);
    const cx = (sx - prevOffset.x) / prev;
    const cy = (sy - prevOffset.y) / prev;
    return {
      x: sx - cx * nextScale,
      y: sy - cy * nextScale,
    };
  }

  function scrollTopFromTransform() {
    const s = Math.max(scaleRef.current, 0.0001);
    return Math.max(0, Math.round(-offsetRef.current.y / s));
  }

  /** Stay in CSS-zoom mode (used during live pinch — never jumps to native scroll) */
  function setLiveZoom(
    next: number,
    nextOffset: { x: number; y: number }
  ) {
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    let nx = nextOffset.x;
    const ny = Math.min(0, nextOffset.y);
    const stageEl = stageRef.current;
    const content = contentRef.current;
    if (stageEl && content) {
      const sw = stageEl.clientWidth;
      const cw = content.scrollWidth * clamped;
      const minX = Math.min(0, sw - cw);
      nx = Math.max(minX, Math.min(0, nx));
    }
    scaleRef.current = clamped;
    offsetRef.current = { x: nx, y: ny };
    setScale(clamped);
    setOffset({ x: nx, y: ny });
  }

  /** Leave zoom: native vertical scroll at the page you were viewing */
  function exitToFitWidth(preferredScrollTop?: number) {
    const restoreTop =
      preferredScrollTop !== undefined
        ? preferredScrollTop
        : scrollTopFromTransform();
    savedScrollTopRef.current = restoreTop;
    scaleRef.current = 1;
    offsetRef.current = { x: 0, y: 0 };
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setGestureLock(false);
    unlockScroller();
    scheduleQuality(1, largePdf);
    requestAnimationFrame(() => {
      const scroller = scrollerRef.current;
      if (!scroller) return;
      scroller.scrollTop = restoreTop;
      requestAnimationFrame(() => {
        scroller.scrollTop = restoreTop;
      });
    });
  }

  function applyScale(next: number, around?: { x: number; y: number }) {
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    const prev = Math.max(scaleRef.current, 0.0001);
    let nextOffset = { ...offsetRef.current };

    if (around) {
      nextOffset = offsetAround(prev, offsetRef.current, clamped, around);
    }

    if (clamped <= 1.02) {
      // Intentional exit (double-tap / buttons) — keep pre-zoom page position
      exitToFitWidth(savedScrollTopRef.current);
      return;
    }

    setLiveZoom(clamped, nextOffset);
    scheduleQuality(clamped, largePdf);
  }

  useEffect(() => {
    setMounted(true);
    document.documentElement.classList.add("pdf-viewing");
    window.scrollTo(0, 0);
    return () => {
      document.documentElement.classList.remove("pdf-viewing");
      if (qualityTimer.current) window.clearTimeout(qualityTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    async function logPdfView() {
      try {
        const supabase = createSupabaseBrowserClient();
        await supabase.from("pdf_views").insert({
          catalog_id: catalog.id,
          user_agent: navigator.userAgent,
        });
      } catch {
        // ignore
      }
    }
    logPdfView();
  }, [catalog.id]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    function measure() {
      if (!el) return;
      setBaseWidth(Math.max(280, Math.floor(el.clientWidth - 2)));
    }
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let doc: PDFDocumentProxy | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let loadingTask: any = null;
    let hintTimer: number | null = null;
    let tickTimer: number | null = null;
    const openedAt = Date.now();

    function finishOpen(opened: PDFDocumentProxy, isLarge: boolean) {
      if (hintTimer) window.clearInterval(hintTimer);
      if (tickTimer) window.clearInterval(tickTimer);
      setLoadProgress(100);
      setLoadStage(PDF_LOAD_STAGES.length - 1);

      const reveal = () => {
        if (cancelled) return;
        setPdf(opened);
        setNumPages(opened.numPages);
        setLargePdf(isLarge);
        // Few pages first = first paint sooner on heavy catalogs
        setVisibleUntil(Math.min(opened.numPages, isLarge ? 2 : 3));
        scaleRef.current = 1;
        offsetRef.current = { x: 0, y: 0 };
        savedScrollTopRef.current = 0;
        setScale(1);
        setOffset({ x: 0, y: 0 });
        setGestureLock(false);
        unlockScroller();
        scheduleQuality(1, isLarge);
        setLoading(false);
        setLoadStage(0);
        window.setTimeout(() => {
          if (cancelled) return;
          setVisibleUntil((v) =>
            Math.min(opened.numPages, Math.max(v, isLarge ? 5 : 7))
          );
        }, 400);
      };

      const wait = Math.max(0, MIN_PDF_LOADER_MS - (Date.now() - openedAt));
      if (wait > 0) window.setTimeout(reveal, wait);
      else reveal();
    }

    async function openFromUrl(): Promise<boolean> {
      const pdfjs = await loadPdfJs();
      if (cancelled) return false;
      setLoadStage((s) => Math.max(s, 1));
      setLoadProgress((p) => Math.max(p, 18));

      loadingTask = pdfjs.getDocument({
        url: pdfApiUrl,
        stopAtErrors: false,
        verbosity: 0,
        disableAutoFetch: false,
        disableStream: false,
        // Mobile: progressive full GET (hits cold stream) — avoids waiting on Range+full cache
        disableRange: isMobileUa(),
        rangeChunkSize: isMobileUa() ? 65536 : 65536 * 2,
        ...pdfJsAssets(),
      });

      let reportedTotal = 0;
      loadingTask.onProgress = (prog: { loaded: number; total: number }) => {
        if (cancelled) return;
        // Progress bar is calm/fake — only track size for large-PDF mode
        if (prog.total > 0) {
          reportedTotal = prog.total;
          if (prog.total >= LARGE_PDF_BYTES) setLargePdf(true);
        }
      };

      doc = await withTimeout(loadingTask.promise, isMobileUa() ? 90000 : 120000);
      if (!doc) {
        try {
          loadingTask?.destroy?.();
        } catch {
          // ignore
        }
        throw new Error("PDF open timeout");
      }
      if (cancelled) {
        releasePdfDoc(doc);
        return false;
      }
      if (!doc?.numPages) return false;
      const isLarge = reportedTotal >= LARGE_PDF_BYTES || doc.numPages >= 20;
      finishOpen(doc, isLarge);

      // Never re-download huge catalogs into phone storage (freezes UI)
      if (
        !isMobileUa() &&
        reportedTotal > 0 &&
        reportedTotal <= SMALL_PDF_MAX
      ) {
        void fetchPdfWithProgress(pdfApiUrl, () => undefined)
          .then((data) => {
            if (!cancelled) rememberPdf(catalog.drive_file_id, data);
          })
          .catch(() => undefined);
      }
      return true;
    }

    async function openFromData(data: ArrayBuffer, fromCache: boolean) {
      if (!isPdfBuffer(data)) throw new Error("Invalid PDF data");
      const pdfjs = await loadPdfJs();
      if (cancelled) return;
      if (fromCache) {
        setLoadStage((s) => Math.max(s, 2));
        setLoadProgress((p) => Math.max(p, 72));
      }
      loadingTask = pdfjs.getDocument({
        data,
        stopAtErrors: false,
        verbosity: 0,
        ...pdfJsAssets(),
      });
      doc = await loadingTask.promise;
      if (cancelled) {
        releasePdfDoc(doc);
        return;
      }
      if (!doc?.numPages) throw new Error("Empty");
      finishOpen(
        doc,
        data.byteLength >= LARGE_PDF_BYTES || doc.numPages >= 20
      );
      rememberPdf(catalog.drive_file_id, data);
    }

    async function openPdf() {
      setLoading(true);
      setPdf(null);
      setNumPages(0);
      setVisibleUntil(3);
      setLoadStage(0);
      setLoadProgress(6);
      setLargePdf(false);
      savedScrollTopRef.current = 0;
      scaleRef.current = 1;
      offsetRef.current = { x: 0, y: 0 };
      setScale(1);
      setOffset({ x: 0, y: 0 });

      const mobile = isMobileUa();

      // Calm % — only moves forward, not tied to byte download (avoids 90→10 jumps)
      hintTimer = window.setInterval(() => {
        if (cancelled || doc) return;
        setLoadStage((s) => Math.min(s + 1, PDF_LOAD_STAGES.length - 1));
      }, 2400);

      tickTimer = window.setInterval(() => {
        if (cancelled || doc) return;
        setLoadProgress((p) => {
          if (p >= 94) return p;
          if (p >= 86) return p + 1;
          if (p >= 70) return p + 1;
          return p + 2;
        });
      }, 700);

      const fileId = catalog.drive_file_id;

      try {
        const pdfjsReady = loadPdfJs();
        setLoadProgress((p) => Math.max(p, 10));

        // Same-tab memory (small only)
        const mem = memoryPdfCache.get(fileId);
        if (mem && isPdfBuffer(mem) && mem.byteLength <= SMALL_PDF_MAX) {
          await pdfjsReady;
          if (cancelled) return;
          await openFromData(mem, true);
          return;
        }

        // Phones: skip Cache/IDB — reading 35MB from them freezes "Please wait"
        if (!mobile) {
          const prefetched = await withTimeout(
            readPrefetchedPdf(pdfApiUrl),
            800
          );
          if (cancelled) return;
          if (prefetched && prefetched.byteLength <= SMALL_PDF_MAX) {
            await pdfjsReady;
            if (cancelled) return;
            try {
              await openFromData(prefetched, true);
              return;
            } catch {
              // fall through
            }
          }

          const cached = await withTimeout(getCachedPdf(fileId), 800);
          if (cancelled) return;
          if (cached && cached.byteLength <= SMALL_PDF_MAX) {
            await pdfjsReady;
            if (cancelled) return;
            try {
              await openFromData(cached, true);
              return;
            } catch {
              await removeCachedPdf(fileId);
            }
          }
        } else {
          void removeCachedPdf(fileId);
        }

        await pdfjsReady;
        if (cancelled) return;

        // Stream from server (works on mobile LAN / production)
        try {
          if (await openFromUrl()) return;
        } catch {
          if (cancelled) return;
        }

        setLoadStage((s) => Math.max(s, 1));
        setLoadProgress((p) => Math.max(p, 28));
        const data = await fetchPdfWithProgress(pdfApiUrl, (loaded, total) => {
          if (cancelled) return;
          if (total >= LARGE_PDF_BYTES) setLargePdf(true);
          // Do not map bytes → % (keeps bar calm & forward-only)
          if (total > 0) {
            const ratio = loaded / total;
            if (ratio >= 0.55) setLoadStage((s) => Math.max(s, 2));
            else if (ratio >= 0.2) setLoadStage((s) => Math.max(s, 1));
          }
        });
        if (cancelled) return;
        await openFromData(data, false);
      } catch {
        if (cancelled) return;
        setLoadStage((s) => Math.max(s, 1));
        setLoadProgress((p) => Math.max(p, 32));
        window.setTimeout(() => {
          if (cancelled) return;
          void openFromUrl().catch(() => {
            if (!cancelled) setLoadStage((s) => Math.max(s, 2));
          });
        }, 600);
      }
    }

    openPdf();
    return () => {
      cancelled = true;
      if (hintTimer) window.clearInterval(hintTimer);
      if (tickTimer) window.clearInterval(tickTimer);
      try {
        loadingTask?.destroy?.();
      } catch {
        // ignore
      }
      releasePdfDoc(doc);
    };
  }, [pdfApiUrl, catalog.drive_file_id, scheduleQuality]);

  // Auto load more pages while scrolling vertically
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !numPages) return;

    function grow(by: number) {
      setVisibleUntil((v) => Math.min(numPages, v + by));
    }

    function onScroll() {
      if (!scroller) return;
      const remaining =
        scroller.scrollHeight - (scroller.scrollTop + scroller.clientHeight);
      // Load ahead early so crown room never feels "stuck" mid-catalog
      if (remaining < Math.max(1400, scroller.clientHeight * 1.8)) {
        grow(largePdf ? 4 : 3);
      }
    }

    scroller.addEventListener("scroll", onScroll, { passive: true });
    const kick = window.setInterval(() => {
      if (!scroller) return;
      const remaining =
        scroller.scrollHeight - (scroller.scrollTop + scroller.clientHeight);
      if (remaining < 1600 || scroller.scrollHeight <= scroller.clientHeight + 40) {
        grow(largePdf ? 4 : 3);
      }
    }, 450);

    return () => {
      scroller.removeEventListener("scroll", onScroll);
      window.clearInterval(kick);
    };
  }, [numPages, pdf, largePdf, visibleUntil]);

  // Pinch + double-tap + pan (zoomed). Single finger at 1x = native vertical scroll only.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    function beginPinch(e: TouchEvent) {
      didPinchRef.current = true;
      movedRef.current = true;
      panRef.current = null;
      lastTapRef.current = 0;
      if (scaleRef.current <= 1.02) {
        const scroller = scrollerRef.current;
        savedScrollTopRef.current =
          scroller?.scrollTop ?? savedScrollTopRef.current;
      }
      setGestureLock(true);
      absorbScrollIntoOffset();
      lockScroller();
      pinchRef.current = {
        startDist: distance(e.touches[0], e.touches[1]),
        startScale: Math.max(scaleRef.current, 1),
        startOffset: { ...offsetRef.current },
        origin: midPoint(e.touches[0], e.touches[1]),
      };
    }

    function onStart(e: TouchEvent) {
      if (e.touches.length >= 2) {
        e.preventDefault();
        e.stopPropagation();
        beginPinch(e);
        return;
      }

      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      movedRef.current = false;
      tapPointRef.current = { x: t.clientX, y: t.clientY };

      if (scaleRef.current > 1.02) {
        e.preventDefault();
        panRef.current = {
          x: t.clientX,
          y: t.clientY,
          ox: offsetRef.current.x,
          oy: offsetRef.current.y,
        };
      }
    }

    function onMove(e: TouchEvent) {
      if (e.touches.length >= 2) {
        e.preventDefault();
        e.stopPropagation();
        if (!pinchRef.current) beginPinch(e);
        lockScroller();

        const pinch = pinchRef.current!;
        const dist = distance(e.touches[0], e.touches[1]);
        const ratio = dist / Math.max(pinch.startDist, 1);
        const nextScale = Math.min(
          MAX_ZOOM,
          Math.max(MIN_ZOOM, pinch.startScale * ratio)
        );
        // From pinch-start + fixed origin → zoom-out returns to same page
        const nextOffset = offsetAround(
          pinch.startScale,
          pinch.startOffset,
          nextScale,
          pinch.origin
        );
        setLiveZoom(nextScale, nextOffset);
        return;
      }

      if (e.touches.length === 1) {
        const t = e.touches[0];
        const start = tapPointRef.current;
        if (
          start &&
          Math.hypot(t.clientX - start.x, t.clientY - start.y) > 10
        ) {
          movedRef.current = true;
          lastTapRef.current = 0;
        }

        if (panRef.current && scaleRef.current > 1.02) {
          e.preventDefault();
          e.stopPropagation();
          const limited = clampOffset(
            scaleRef.current,
            panRef.current.ox + (t.clientX - panRef.current.x),
            panRef.current.oy + (t.clientY - panRef.current.y)
          );
          offsetRef.current = limited;
          setOffset(limited);
        }
      }
    }

    function onEnd(e: TouchEvent) {
      if (e.touches.length < 2) pinchRef.current = null;
      if (e.touches.length === 0) panRef.current = null;

      if (didPinchRef.current) {
        if (e.touches.length === 0) {
          didPinchRef.current = false;
          lastTapRef.current = 0;
          if (scaleRef.current < 1.08) {
            // Keep the page you were looking at (from live transform), not PDF start
            const at = scrollTopFromTransform();
            savedScrollTopRef.current = at;
            exitToFitWidth(at);
            scheduleQuality(1, largePdf);
          } else {
            setGestureLock(false);
            scheduleQuality(scaleRef.current, largePdf);
          }
        }
        return;
      }

      // Double-tap: zoom in at point; second tap restores exact prior scroll
      if (
        e.changedTouches.length === 1 &&
        e.touches.length === 0 &&
        !movedRef.current
      ) {
        const t = e.changedTouches[0];
        const now = Date.now();
        if (now - lastTapRef.current < 320) {
          e.preventDefault();
          if (scaleRef.current > 1.08) {
            exitToFitWidth(savedScrollTopRef.current);
          } else {
            const scroller = scrollerRef.current;
            savedScrollTopRef.current = scroller?.scrollTop ?? 0;
            setGestureLock(true);
            absorbScrollIntoOffset();
            lockScroller();
            applyScale(2.45, { x: t.clientX, y: t.clientY });
          }
          lastTapRef.current = 0;
        } else {
          lastTapRef.current = now;
        }
      }
    }

    el.addEventListener("touchstart", onStart, { passive: false, capture: true });
    el.addEventListener("touchmove", onMove, { passive: false, capture: true });
    el.addEventListener("touchend", onEnd, { passive: false, capture: true });
    el.addEventListener("touchcancel", onEnd, { passive: false, capture: true });

    return () => {
      el.removeEventListener("touchstart", onStart, true);
      el.removeEventListener("touchmove", onMove, true);
      el.removeEventListener("touchend", onEnd, true);
      el.removeEventListener("touchcancel", onEnd, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [largePdf, catalog.id, pdf]);

  function handleBack() {
    router.push(getScrollReturnPath(), { scroll: false });
  }

  function zoomBy(delta: number) {
    if (scaleRef.current <= 1.02 && delta > 0) {
      const scroller = scrollerRef.current;
      savedScrollTopRef.current = scroller?.scrollTop ?? 0;
    }
    setGestureLock(true);
    absorbScrollIntoOffset();
    lockScroller();
    const stage = stageRef.current;
    if (!stage) {
      applyScale(scaleRef.current + delta);
      return;
    }
    const rect = stage.getBoundingClientRect();
    applyScale(scaleRef.current + delta, {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
  }

  function zoomReset() {
    exitToFitWidth(savedScrollTopRef.current);
  }

  const pagesToRender = Math.min(numPages, visibleUntil);

  const actionBar = (
    <div className="pdf-action-bar" role="toolbar" aria-label="PDF actions">
      <a
        href={downloadUrl}
        className="pdf-action-download gold-btn"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Download className="h-4 w-4 shrink-0" />
        <span>Download PDF</span>
      </a>
      {whatsappUrl ? (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="pdf-action-whatsapp"
        >
          <MessageCircle className="h-4 w-4 shrink-0" />
          <span>WhatsApp</span>
        </a>
      ) : (
        <button
          type="button"
          disabled
          className="pdf-action-whatsapp opacity-60 cursor-not-allowed"
        >
          <MessageCircle className="h-4 w-4 shrink-0" />
          <span>WhatsApp</span>
        </button>
      )}
    </div>
  );

  return (
    <div className="pdf-viewer-shell">
      <div className="pdf-viewer-top">
        <div className="pdf-viewer-top-row">
          <button
            type="button"
            onClick={handleBack}
            className="pdf-back-chip gold-btn shrink-0"
            aria-label="Back to catalogs"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back</span>
          </button>
          <h1 className="pdf-viewer-title font-heading font-bold text-burgundy truncate">
            {catalog.title}
          </h1>
        </div>
        <p
          className="pdf-viewer-tip sm:hidden font-urdu"
          dir="rtl"
          lang="ur"
        >
          اپنی پسندیدہ ڈیزائن کا اسکرین شاٹ لیں اور نیچے WhatsApp بٹن دبا کر ہمیں بھیج دیں
        </p>
      </div>

      <div
        ref={stageRef}
        className={`pdf-viewer-container pdf-stage ${zoomed ? "pdf-stage--zoomed" : ""}`}
      >
        {pdf && numPages > 0 && (
          <div className="pdf-zoom-controls" role="group" aria-label="Zoom">
            <button
              type="button"
              className="pdf-zoom-btn"
              aria-label="Zoom out"
              onClick={() => zoomBy(-0.35)}
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="pdf-zoom-btn"
              aria-label="Reset zoom"
              onClick={zoomReset}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="pdf-zoom-btn"
              aria-label="Zoom in"
              onClick={() => zoomBy(0.35)}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        )}

        {loading && (
          <div className="pdf-loading absolute inset-0 z-10 flex flex-col items-center justify-center px-6">
            <div className="pdf-loading-panel" aria-busy="true" aria-live="polite">
              <div className="pdf-loading-mark">
                <Image
                  src="/logo.webp"
                  alt=""
                  width={72}
                  height={72}
                  className="pdf-loading-logo"
                  priority
                />
              </div>
              <p className="pdf-loading-brand">SAIM GRAPHICS</p>
              <p className="pdf-loading-wait">Please Wait</p>
              <div
                className="pdf-loading-bar"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={loadProgress}
                aria-label="Catalog loading progress"
              >
                <span
                  className="pdf-loading-bar-fill"
                  style={{ width: `${Math.max(8, loadProgress)}%` }}
                />
              </div>
              <p className="pdf-loading-pct">{loadProgress}%</p>
              <p className="pdf-loading-stage" key={loadStage}>
                {PDF_LOAD_STAGES[Math.min(loadStage, PDF_LOAD_STAGES.length - 1)]}
              </p>
            </div>
          </div>
        )}

        {pdf && numPages > 0 && (
          <div
            ref={scrollerRef}
            className={`pdf-scroller ${zoomed ? "pdf-scroller--zoomed" : ""}`}
          >
            <div
              ref={contentRef}
              className="pdf-zoom-content"
              style={
                zoomed
                  ? {
                      transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
                    }
                  : undefined
              }
            >
              <div className="pdf-pages">
                {Array.from({ length: pagesToRender }, (_, i) => (
                  <PdfPage
                    key={`${catalog.id}-p${i + 1}`}
                    pdf={pdf}
                    pageNumber={i + 1}
                    width={pageWidth}
                    quality={quality}
                  />
                ))}
                {pagesToRender < numPages && (
                  <button
                    type="button"
                    className="pdf-load-more"
                    onClick={() =>
                      setVisibleUntil((v) => Math.min(numPages, v + 6))
                    }
                  >
                    Next designs ({pagesToRender}/{numPages})
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {mounted ? createPortal(actionBar, document.body) : null}
    </div>
  );
}
