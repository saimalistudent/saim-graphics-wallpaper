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

/** Short branded splash — not a long wait screen */
const MIN_LOADER_MS = 520;
const PRELOAD_TIMEOUT_MS = 2500;

function estimatePageProgress(): number {
  if (typeof document === "undefined") return 0;
  if (document.readyState === "complete") return 100;

  let pct = document.readyState === "interactive" ? 68 : 22;

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
        Math.min(94, Math.round((done / Math.max(resources.length, 1)) * 100))
      );
    }
  } catch {
    // ignore
  }

  return Math.min(99, Math.round(pct));
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
    img.onload = done;
    img.onerror = done;
    img.src = src;
    window.setTimeout(done, PRELOAD_TIMEOUT_MS);
  });
}

type PageLoaderProps = {
  children: React.ReactNode;
  /** Preload before revealing site (e.g. promo popup image) */
  preloadSrc?: string | null;
};

export function PageLoader({ children, preloadSrc }: PageLoaderProps) {
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(12);
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
    setProgress(14);

    let cancelled = false;
    let pageLoaded = document.readyState === "complete";
    let assetsReady = !preloadSrc;

    const tick = window.setInterval(() => {
      setProgress((prev) => Math.max(prev, estimatePageProgress()));
    }, 100);

    const tryFinish = () => {
      if (cancelled || !pageLoaded || !assetsReady) return;
      window.clearInterval(tick);
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

    if (preloadSrc) {
      void preloadImage(preloadSrc).then(() => {
        if (cancelled) return;
        assetsReady = true;
        setProgress((p) => Math.max(p, 88));
        tryFinish();
      });
    }

    const fallback = window.setTimeout(() => {
      pageLoaded = true;
      assetsReady = true;
      tryFinish();
    }, 3200);

    return () => {
      cancelled = true;
      window.removeEventListener("load", onLoad);
      window.clearInterval(tick);
      window.clearTimeout(fallback);
      document.documentElement.classList.remove("loader-active");
    };
  }, [finish, preloadSrc]);

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
