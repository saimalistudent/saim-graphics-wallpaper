"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { usePageReady } from "@/components/PageLoader";
import { ContactPopup } from "@/components/ContactPopup";
import { ContactSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Official WhatsApp glyph — signals "chat with us" on the FAB */
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
  settings: ContactSettings;
  className?: string;
};

export function ContactFab({ settings, className }: Props) {
  const { ready } = usePageReady();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  // Hide on PDF viewer — sticky PDF action bar already has WhatsApp / Download
  const onPdfPage =
    pathname.startsWith("/catalogs/") && pathname !== "/catalogs";

  if (!ready || onPdfPage || !settings.enabled) return null;

  return (
    <>
      <motion.div
        className={cn("wa-fab fixed z-50 inline-flex", className)}
        initial={
          prefersReducedMotion
            ? { opacity: 1, scale: 1, y: 0 }
            : { opacity: 0, scale: 0.4, y: 28 }
        }
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.2 }}
      >
        {!prefersReducedMotion && (
          <>
            <span className="wa-fab-ring" aria-hidden />
            <span className="wa-fab-ring wa-fab-ring-delay" aria-hidden />
          </>
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="wa-fab-btn relative inline-flex h-14 w-14 items-center justify-center rounded-full text-white sm:h-auto sm:w-auto sm:gap-2.5 sm:px-5 sm:py-3.5"
          aria-label="Open contact options"
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <WhatsAppGlyph className="h-7 w-7 shrink-0 sm:h-6 sm:w-6" />
          <span className="wa-fab-label hidden text-sm font-semibold tracking-wide sm:inline">
            Contact Us
          </span>
        </button>
      </motion.div>
      <ContactPopup
        open={open}
        onClose={() => setOpen(false)}
        settings={settings}
      />
    </>
  );
}
