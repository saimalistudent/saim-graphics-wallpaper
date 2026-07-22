"use client";

import { useEffect } from "react";
import { restoreCatalogListScroll } from "@/lib/scroll-restore";

/**
 * Restores catalog/home list scroll when user returns from a PDF (Back).
 * Waits for async grid cards so position is not lost.
 */
export function ScrollRestore({ storageKey }: { storageKey: string }) {
  useEffect(() => {
    const scrollKey = `scroll:${storageKey}`;
    let cancelled = false;
    let observer: MutationObserver | null = null;
    const timers: number[] = [];

    const stopWatching = () => {
      observer?.disconnect();
      observer = null;
    };

    const attempt = () => {
      if (cancelled) return;
      if (restoreCatalogListScroll(storageKey)) {
        stopWatching();
      }
    };

    attempt();

    for (const ms of [50, 120, 250, 450, 700, 1000, 1500, 2200, 3200]) {
      timers.push(window.setTimeout(attempt, ms));
    }

    observer = new MutationObserver(() => attempt());
    observer.observe(document.body, { childList: true, subtree: true });

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        try {
          sessionStorage.setItem(scrollKey, String(Math.round(window.scrollY)));
        } catch {
          // ignore
        }
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", onScroll);

    return () => {
      cancelled = true;
      stopWatching();
      for (const t of timers) window.clearTimeout(t);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", onScroll);
      try {
        sessionStorage.setItem(scrollKey, String(Math.round(window.scrollY)));
      } catch {
        // ignore
      }
    };
  }, [storageKey]);

  return null;
}
