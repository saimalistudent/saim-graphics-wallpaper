"use client";

import { useEffect } from "react";

/**
 * Remembers page scroll and restores it when the user returns (e.g. PDF → Back).
 */
export function ScrollRestore({ storageKey }: { storageKey: string }) {
  useEffect(() => {
    const key = `scroll:${storageKey}`;

    const restore = () => {
      const raw = sessionStorage.getItem(key);
      if (raw == null) return;
      const y = Number(raw);
      if (!Number.isFinite(y) || y <= 0) return;
      window.scrollTo({ top: y, left: 0, behavior: "instant" as ScrollBehavior });
    };

    // Restore after layout (catalogs grid / images)
    restore();
    const t1 = window.setTimeout(restore, 50);
    const t2 = window.setTimeout(restore, 200);
    const t3 = window.setTimeout(restore, 500);

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        sessionStorage.setItem(key, String(Math.round(window.scrollY)));
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", onScroll);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", onScroll);
      sessionStorage.setItem(key, String(Math.round(window.scrollY)));
    };
  }, [storageKey]);

  return null;
}
