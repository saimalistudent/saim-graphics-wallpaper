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

export function PageLoader({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const finish = useCallback((startedAt: number) => {
    const elapsed = Date.now() - startedAt;
    const wait = Math.max(0, MIN_LOADER_MS - elapsed);

    window.setTimeout(() => {
      setLoading(false);
      window.setTimeout(() => setReady(true), prefersReducedMotion ? 0 : 280);
    }, prefersReducedMotion ? 0 : wait);
  }, [prefersReducedMotion]);

  useEffect(() => {
    const startedAt = Date.now();
    document.documentElement.classList.add("loader-active");

    const onLoad = () => finish(startedAt);

    if (document.readyState === "complete") {
      onLoad();
    } else {
      window.addEventListener("load", onLoad);
    }

    // Fallback if load event hangs
    const fallback = window.setTimeout(() => onLoad(), 3500);

    return () => {
      window.removeEventListener("load", onLoad);
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
                className="page-loader-brand"
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

              <div className="page-loader-bar" aria-hidden>
                <span />
              </div>
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
