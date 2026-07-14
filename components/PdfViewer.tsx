"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, MessageCircle, ExternalLink } from "lucide-react";
import { Catalog } from "@/lib/types";
import {
  buildWhatsAppUrl,
  getDriveDownloadUrl,
  getDriveEmbedUrl,
  getWhatsAppNumber,
  getWhatsAppScreenshotMessage,
} from "@/lib/drive";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type PdfViewerProps = {
  catalog: Catalog;
};

export function PdfViewer({ catalog }: PdfViewerProps) {
  const router = useRouter();
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const [mounted, setMounted] = useState(false);
  const phoneNumber = getWhatsAppNumber();
  const whatsappMessage = getWhatsAppScreenshotMessage(catalog.title);
  const whatsappUrl = phoneNumber
    ? buildWhatsAppUrl(phoneNumber, whatsappMessage)
    : null;
  const embedUrl = getDriveEmbedUrl(catalog.drive_file_id);
  const downloadUrl = getDriveDownloadUrl(catalog.drive_file_id);

  useEffect(() => {
    setMounted(true);
    document.documentElement.classList.add("pdf-viewing");
    return () => document.documentElement.classList.remove("pdf-viewing");
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
        // Silently fail
      }
    }

    logPdfView();
  }, [catalog.id]);

  useEffect(() => {
    if (iframeLoaded || iframeError) return;
    const timer = window.setTimeout(() => {
      setIframeError(true);
    }, 12000);
    return () => window.clearTimeout(timer);
  }, [iframeLoaded, iframeError]);

  function handleBack() {
    let returnTo = "/catalogs";
    try {
      returnTo = sessionStorage.getItem("scroll:return") || "/catalogs";
    } catch {
      // ignore
    }
    router.push(returnTo, { scroll: false });
  }

  const actionBar = (
    <div className="pdf-action-bar" role="toolbar" aria-label="PDF actions">
      <a
        href={downloadUrl}
        className="pdf-action-download"
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
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={handleBack}
            className="pdf-back-chip shrink-0"
            aria-label="Back to catalogs"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </button>
          <h1 className="font-heading text-base sm:text-xl font-bold text-burgundy truncate">
            {catalog.title}
          </h1>
        </div>
        <p
          className="sm:hidden mt-2 text-[13px] text-text-secondary bg-gold/10 rounded-lg px-3 py-2 border border-gold/20 text-right leading-relaxed font-urdu"
          dir="rtl"
          lang="ur"
        >
          اپنی پسندیدہ ڈیزائن کا اسکرین شاٹ لیں اور نیچے WhatsApp بٹن دبا کر ہمیں بھیج دیں
        </p>
      </div>

      <div className="pdf-stage">
        {!iframeLoaded && !iframeError && (
          <div className="pdf-loading absolute inset-0 z-10 flex flex-col items-center justify-center gap-3">
            <div className="pdf-spinner" />
            <p className="text-sm text-burgundy/80">Opening PDF...</p>
          </div>
        )}
        {iframeError && !iframeLoaded ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-4 text-center bg-[#0f0f0f]">
            <p className="text-sm text-white/90">
              PDF open nahi ho saka. Niche download try karein ya Drive mein kholen.
            </p>
            <a
              href={embedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-gold/90 px-4 py-2.5 text-sm font-semibold text-burgundy"
            >
              <ExternalLink className="h-4 w-4" />
              Open in Drive
            </a>
          </div>
        ) : (
          <div className="pdf-frame-clip">
            <iframe
              src={embedUrl}
              allow="autoplay"
              className={`pdf-frame w-full border-0 transition-opacity duration-500 ${
                iframeLoaded ? "opacity-100" : "opacity-0"
              }`}
              onLoad={() => {
                setIframeLoaded(true);
                setIframeError(false);
              }}
              title={`${catalog.title} PDF viewer`}
            />
          </div>
        )}
      </div>

      {mounted ? createPortal(actionBar, document.body) : null}
    </div>
  );
}
