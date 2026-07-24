"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { usePageReady } from "@/components/PageLoader";
import { promoImageSrc } from "@/lib/promo-popup";
import { PromoPopup as PromoPopupType } from "@/lib/types";

const SHOW_DELAY_MS = 3000;

type Props = {
  promo: PromoPopupType;
};

export function PromoPopup({ promo }: Props) {
  const { ready } = usePageReady();
  const prefersReducedMotion = useReducedMotion();
  const [open, setOpen] = useState(false);

  const displaySrc = promoImageSrc(promo.image_url);

  useEffect(() => {
    if (!ready || !displaySrc) return;

    const timer = window.setTimeout(() => {
      setOpen(true);
    }, prefersReducedMotion ? 400 : SHOW_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [ready, prefersReducedMotion, displaySrc]);

  useEffect(() => {
    if (!open) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!displaySrc) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="promo-popup-root"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: prefersReducedMotion ? 0.18 : 0.45,
            ease: "easeOut",
          }}
          role="presentation"
        >
          <motion.button
            type="button"
            className="promo-popup-backdrop"
            aria-label="Close offer"
            onClick={() => setOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          />

          <motion.div
            className="promo-popup-shell"
            initial={
              prefersReducedMotion
                ? { opacity: 1, scale: 1 }
                : { opacity: 0, scale: 0.88, y: 28 }
            }
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.94, y: 12 }
            }
            transition={{
              duration: prefersReducedMotion ? 0.2 : 0.55,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <button
              type="button"
              className="promo-popup-close"
              aria-label="Close"
              onClick={() => setOpen(false)}
            >
              <X className="promo-popup-close-icon" strokeWidth={2.25} />
            </button>

            <div
              className="promo-popup-card"
              role="dialog"
              aria-modal="true"
              aria-label={promo.title.trim() || "Offer"}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={displaySrc}
                alt={promo.title.trim() || "Offer"}
                className="promo-popup-image"
                decoding="async"
                draggable={false}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
