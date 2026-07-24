"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BRAND_NAME } from "@/styles/tokens";

type PageReadyContextValue = {
  ready: boolean;
};

const PageReadyContext = createContext<PageReadyContextValue>({ ready: false });

export function usePageReady() {
  return useContext(PageReadyContext);
}

/** Brief brand beat after assets are ready — not a fake long wait */
const MIN_LOADER_MS = 480;
/** Only show slow-net tip after this wait (fast nets finish earlier) */
const SLOW_HINT_MS = 3800;
/** Hard safety so a broken image never traps the user forever */
const MAX_WAIT_MS = 28000;

const SLOW_NET_TIP = "Make sure your internet speed is fast";

function estimatePageProgress(): number {
  if (typeof document === "undefined") return 0;
  if (document.readyState === "complete") return 100;

  let pct = document.readyState === "interactive" ? 58 : 18;

  try {
    const resources = performance.getEntriesByType(
      "resource"
    ) as PerformanceResourceTiming[];
    if (resources.length > 0) {
      let done = 0;
      for (const r of resources) {
        if (r.responseEnd > 0) done += 1;
      }
      pct = Math.max(
        pct,
        Math.min(90, Math.round((done / Math.max(resources.length, 1)) * 100))
      );
    }
  } catch {
    // ignore
  }

  return Math.min(96, Math.round(pct));
}

function uniqueSrcs(srcs: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of srcs) {
    const src = raw?.trim();
    if (!src || seen.has(src)) continue;
    seen.add(src);
    out.push(src);
  }
  return out;
}

function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new window.Image();
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const afterLoad = () => {
      if (typeof img.decode === "function") {
        void img.decode().then(done).catch(done);
      } else {
        done();
      }
    };
    img.onload = afterLoad;
    img.onerror = done;
    img.src = src;
    if (img.complete && img.naturalWidth > 0) afterLoad();
  });
}

type NetworkConnection = {
  effectiveType?: string;
  saveData?: boolean;
  downlink?: number;
};

function isLikelySlowNetwork(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & {
    connection?: NetworkConnection;
    mozConnection?: NetworkConnection;
    webkitConnection?: NetworkConnection;
  };
  const c = nav.connection || nav.mozConnection || nav.webkitConnection;
  if (!c) return false;
  if (c.saveData) return true;
  const type = c.effectiveType;
  if (type === "slow-2g" || type === "2g" || type === "3g") return true;
  if (typeof c.downlink === "number" && c.downlink > 0 && c.downlink < 1.5) {
    return true;
  }
  return false;
}

type PageLoaderProps = {
  children: React.ReactNode;
  /** Critical visuals (hero slides + promo) — site waits until these load */
  preloadSrcs?: Array<string | null | undefined>;
};

export function PageLoader({ children, preloadSrcs }: PageLoaderProps) {
  const assets = uniqueSrcs(preloadSrcs ?? []);
  const assetsKey = assets.join("|");
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(10);
  const [showSlowTip, setShowSlowTip] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const finish = useCallback(
    (startedAt: number) => {
      setProgress(100);
      const elapsed = Date.now() - startedAt;
      const wait = Math.max(0, MIN_LOADER_MS - elapsed);

      window.setTimeout(() => {
        setLoading(false);
        window.setTimeout(() => setReady(true), prefersReducedMotion ? 0 : 220);
      }, prefersReducedMotion ? 40 : wait);
    },
    [prefersReducedMotion]
  );

  useEffect(() => {
    const startedAt = Date.now();
    document.documentElement.classList.add("loader-active");
    setProgress(12);
    setShowSlowTip(false);

    let cancelled = false;
    let pageLoaded = document.readyState === "complete";
    let assetsReady = assets.length === 0;
    let finished = false;

    const tick = window.setInterval(() => {
      setProgress((prev) => Math.max(prev, estimatePageProgress()));
    }, 120);

    const tryFinish = () => {
      if (cancelled || finished || !pageLoaded || !assetsReady) return;
      finished = true;
      window.clearInterval(tick);
      window.clearTimeout(slowHintTimer);
      window.clearTimeout(safetyTimer);
      finish(startedAt);
    };

    const onLoad = () => {
      pageLoaded = true;
      tryFinish();
    };

    if (pageLoaded) {
      onLoad();
    } else {
      window.addEventListener("load", onLoad);
    }

    if (assets.length > 0) {
      let loaded = 0;
      void Promise.all(
        assets.map((src) =>
          preloadImage(src).then(() => {
            if (cancelled) return;
            loaded += 1;
            const assetPct = Math.round((loaded / assets.length) * 100);
            setProgress((p) =>
              Math.max(p, Math.min(96, 20 + Math.round(assetPct * 0.72)))
            );
          })
        )
      ).then(() => {
        if (cancelled) return;
        assetsReady = true;
        setProgress((p) => Math.max(p, 94));
        tryFinish();
      });
    }

    // Fast nets usually finish before this — tip never appears.
    // Known-slow connections get the tip earlier; otherwise only if still waiting.
    const hintDelay = isLikelySlowNetwork() ? 1600 : SLOW_HINT_MS;
    const slowHintTimer = window.setTimeout(() => {
      if (cancelled || finished) return;
      setShowSlowTip(true);
    }, hintDelay);

    // Last resort only — broken URLs must not lock the splash forever
    const safetyTimer = window.setTimeout(() => {
      if (cancelled || finished) return;
      pageLoaded = true;
      assetsReady = true;
      tryFinish();
    }, MAX_WAIT_MS);

    return () => {
      cancelled = true;
      window.removeEventListener("load", onLoad);
      window.clearInterval(tick);
      window.clearTimeout(slowHintTimer);
      window.clearTimeout(safetyTimer);
      document.documentElement.classList.remove("loader-active");
    };
    // assetsKey tracks the same URL set without depending on array identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetsKey, finish]);

  useEffect(() => {
    if (!loading) {
      document.documentElement.classList.remove("loader-active");
    }
  }, [loading]);

  return (
    <PageReadyContext.Provider value={{ ready }}>
      <AnimatePresence>
        {loading && (
          <motion.div
            className="page-loader"
            initial={{ opacity: 1 }}
            exit={{
              opacity: 0,
              transition: { duration: 0.28, ease: "easeOut" },
            }}
            aria-busy="true"
            aria-label="Loading website"
          >
            <div className="page-loader-inner">
              <motion.div
                className="page-loader-mark"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
              >
                <Image
                  src="/logo.png"
                  alt=""
                  width={72}
                  height={72}
                  className="page-loader-logo"
                  priority
                />
              </motion.div>

              <motion.p
                className="page-loader-brand"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.08, duration: 0.3 }}
              >
                {BRAND_NAME}
              </motion.p>

              <div
                className="page-loader-bar"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
              >
                <span style={{ width: `${Math.max(10, progress)}%` }} />
              </div>

              <p className="page-loader-wait">Please Wait</p>

              {showSlowTip && (
                <p className="page-loader-slow-tip" role="status">
                  {SLOW_NET_TIP}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={ready ? "site-shell site-shell-ready" : "site-shell"}>
        {children}
      </div>
    </PageReadyContext.Provider>
  );
}
