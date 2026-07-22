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
import { BRAND_NAME, BRAND_SUBTITLE } from "@/styles/tokens";

type PageReadyContextValue = {
  ready: boolean;
};

const PageReadyContext = createContext<PageReadyContextValue>({ ready: false });

export function usePageReady() {
  return useContext(PageReadyContext);
}

const MIN_LOADER_MS = 850;

function estimatePageProgress(): number {
  if (typeof document === "undefined") return 0;
  if (document.readyState === "complete") return 100;

  let pct = document.readyState === "interactive" ? 62 : 18;

  try {
    const resources = performance.getEntriesByType(
      "resource"
    ) as PerformanceResourceTiming[];
    if (resources.length > 0) {
      let done = 0;
      let weighted = 0;
      let weightSum = 0;
      for (const r of resources) {
        const size = r.transferSize || r.encodedBodySize || 1;
        weightSum += size;
        if (r.responseEnd > 0) {
          done += 1;
          weighted += size;
        }
      }
      const byCount = (done / Math.max(resources.length, 1)) * 100;
      const bySize =
        weightSum > 0 ? (weighted / weightSum) * 100 : byCount;
      const resourcePct = Math.round(byCount * 0.45 + bySize * 0.55);
      pct = Math.max(pct, Math.min(94, resourcePct));
    }
  } catch {
    // ignore
  }

  return Math.min(99, Math.round(pct));
}

export function PageLoader({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(6);
  const prefersReducedMotion = useReducedMotion();

  const finish = useCallback(
    (startedAt: number) => {
      setProgress(100);
      const elapsed = Date.now() - startedAt;
      const wait = Math.max(0, MIN_LOADER_MS - elapsed);

      window.setTimeout(() => {
        setLoading(false);
        window.setTimeout(() => setReady(true), prefersReducedMotion ? 0 : 280);
      }, prefersReducedMotion ? 80 : wait);
    },
    [prefersReducedMotion]
  );

  useEffect(() => {
    const startedAt = Date.now();
    document.documentElement.classList.add("loader-active");
    setProgress(8);

    const tick = window.setInterval(() => {
      setProgress((prev) => {
        const next = estimatePageProgress();
        // Keep bar moving forward only
        return Math.max(prev, next);
      });
    }, 120);

    const onLoad = () => {
      window.clearInterval(tick);
      finish(startedAt);
    };

    if (document.readyState === "complete") {
      onLoad();
    } else {
      window.addEventListener("load", onLoad);
    }

    const fallback = window.setTimeout(() => onLoad(), 4000);

    return () => {
      window.removeEventListener("load", onLoad);
      window.clearInterval(tick);
      window.clearTimeout(fallback);
      document.documentElement.classList.remove("loader-active");
    };
  }, [finish]);

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
            exit={{ opacity: 0, transition: { duration: 0.45, ease: "easeInOut" } }}
            aria-busy="true"
            aria-label="Loading website"
          >
            <div className="page-loader-inner">
              <motion.div
                className="page-loader-logo"
                initial={{ opacity: 0, scale: 0.88 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.55, ease: "easeOut" }}
              >
                <Image
                  src="/logo.png"
                  alt=""
                  width={96}
                  height={96}
                  className="object-contain"
                  priority
                />
              </motion.div>

              <motion.p
                className="page-loader-brand font-heading font-bold tracking-wide"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.45 }}
              >
                {BRAND_NAME}
              </motion.p>
              <motion.p
                className="page-loader-sub"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.28, duration: 0.4 }}
              >
                {BRAND_SUBTITLE}
              </motion.p>

              <div
                className="page-loader-bar page-loader-bar--pct"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
              >
                <span style={{ width: `${Math.max(6, progress)}%` }} />
              </div>
              <p className="page-loader-pct">{progress}%</p>
              <p className="page-loader-wait">Please wait...</p>
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
