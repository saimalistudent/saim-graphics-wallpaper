"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Phone, X } from "lucide-react";
import { ContactSettings } from "@/lib/types";
import { toTelHref, toWhatsAppHref } from "@/lib/contact";

/** Official WhatsApp glyph (uses currentColor so button gradient shows through) */
function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.143-.73-2.09-.832-2.335-.143-.372-.214-.487-.6-.487-.187 0-.36-.043-.53-.043-.302 0-.53.115-.746.315-.688.645-1.032 1.318-1.06 2.264v.114c-.015.99.472 1.977 1.033 2.78 1.26 1.834 2.548 3.395 4.556 4.442.616.316 2.19 1.005 2.834 1.005.5 0 2.104-.416 2.104-1.318 0-.63-1.146-1.892-1.375-1.892z"
      />
      <path
        fill="currentColor"
        d="M16.153 5.5C10.383 5.5 5.677 10.204 5.677 15.976a10.42 10.42 0 0 0 1.502 5.402L5.5 27.5l6.29-1.652a10.5 10.5 0 0 0 4.366.947h.005c5.77 0 10.476-4.704 10.476-10.476 0-2.798-1.09-5.428-3.067-7.406-1.978-1.98-4.607-3.412-7.412-3.413h-.005zm0 19.213h-.005a8.7 8.7 0 0 1-4.437-1.216l-.318-.19-3.297.865.88-3.21-.208-.33a8.72 8.72 0 0 1-1.334-4.634c.002-4.816 3.92-8.732 8.734-8.732 2.334 0 4.526.91 6.175 2.56 1.65 1.65 2.559 3.845 2.557 6.176-.003 4.816-3.919 8.712-8.747 8.712z"
      />
    </svg>
  );
}

type Props = {
  open: boolean;
  onClose: () => void;
  settings: ContactSettings;
};

export function ContactPopup({ open, onClose, settings }: Props) {
  const prefersReducedMotion = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);

    // Focus close button so screen-reader users hear the dialog land
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 60);

    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(focusTimer);
    };
  }, [open, onClose]);

  if (!mounted) return null;

  const telHref = toTelHref(settings.call_phone);
  const waHref = toWhatsAppHref(settings.whatsapp_phone);
  const canCall = telHref.length > 0;
  const canWhatsApp = waHref.length > 0;

  const callLabel = settings.call_button_label.trim() || "CALL ONLY";
  const waLabel = settings.whatsapp_button_label.trim() || "WHATSAPP ONLY";
  const callUrdu =
    settings.call_intro_ur.trim() ||
    "ہم سے فون کال پر رابطہ کرنے کے لئے اس نیچے دیے گئے بٹن پر کلک کریں";
  const waUrdu =
    settings.whatsapp_intro_ur.trim() ||
    "ہم سے واٹس ایپ پر رابطہ کرنے کے لئے نیچے دیے گئے بٹن پر کلک کریں";

  const content = (
    <AnimatePresence>
      {open && (
        <motion.div
          className="contact-popup-root"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: prefersReducedMotion ? 0.15 : 0.32,
            ease: "easeOut",
          }}
          role="presentation"
        >
          <motion.button
            type="button"
            className="contact-popup-backdrop"
            aria-label="Close contact popup"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28 }}
          />

          <motion.div
            className="contact-popup-shell"
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-popup-heading"
            initial={
              prefersReducedMotion
                ? { opacity: 1, scale: 1, y: 0 }
                : { opacity: 0, scale: 0.9, y: 24 }
            }
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.94, y: 12 }
            }
            transition={{
              duration: prefersReducedMotion ? 0.18 : 0.42,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <button
              ref={closeRef}
              type="button"
              className="contact-popup-close"
              aria-label="Close"
              onClick={onClose}
            >
              <X className="h-4 w-4" strokeWidth={2.25} />
            </button>

            <h2 id="contact-popup-heading" className="contact-popup-title">
              Contact Us
            </h2>
            <p className="contact-popup-sub">
              Choose how you want to reach us
            </p>

            <div className="contact-popup-section">
              <p className="contact-popup-urdu font-urdu" dir="rtl" lang="ur">
                {callUrdu}
              </p>
              {canCall ? (
                <a
                  href={telHref}
                  className="contact-popup-call-btn"
                  aria-label={`Call ${settings.call_phone}`}
                >
                  <Phone className="h-5 w-5" strokeWidth={2.25} />
                  <span>{callLabel}</span>
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  className="contact-popup-call-btn contact-popup-btn-disabled"
                >
                  <Phone className="h-5 w-5" strokeWidth={2.25} />
                  <span>Call unavailable</span>
                </button>
              )}
            </div>

            <div className="contact-popup-section">
              <p className="contact-popup-urdu font-urdu" dir="rtl" lang="ur">
                {waUrdu}
              </p>
              {canWhatsApp ? (
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="contact-popup-wa-btn"
                  aria-label="Open WhatsApp chat"
                >
                  <WhatsAppGlyph className="h-5 w-5" />
                  <span>{waLabel}</span>
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  className="contact-popup-wa-btn contact-popup-btn-disabled"
                >
                  <WhatsAppGlyph className="h-5 w-5" />
                  <span>WhatsApp unavailable</span>
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}
