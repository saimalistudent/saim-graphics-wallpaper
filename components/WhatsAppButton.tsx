"use client";

import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { buildWhatsAppUrl, getWhatsAppNumber } from "@/lib/drive";
import { cn } from "@/lib/utils";
import { usePageReady } from "@/components/PageLoader";

type WhatsAppButtonProps = {
  message?: string;
  className?: string;
  label?: string;
};

export function WhatsAppButton({
  message = "Hi, I'm interested in your wallpaper designs.",
  className,
  label,
}: WhatsAppButtonProps) {
  const phoneNumber = getWhatsAppNumber();
  const isConfigured = phoneNumber.length > 0;
  const { ready } = usePageReady();
  const pathname = usePathname();

  // Hide floating WA on PDF viewer — sticky PDF action bar already has WhatsApp
  const onPdfPage =
    pathname.startsWith("/catalogs/") && pathname !== "/catalogs";

  if (!ready || onPdfPage) return null;

  if (!isConfigured) {
    return (
      <div
      className={cn(
          "wa-fab fixed z-50 flex items-center gap-2 rounded-full bg-whatsapp/60 px-4 py-3 text-white shadow-lg cursor-not-allowed",
          className
        )}
        title="WhatsApp contact coming soon"
      >
        <MessageCircle className="h-6 w-6" />
        <span className="hidden sm:inline text-sm font-medium">
          WhatsApp coming soon
        </span>
      </div>
    );
  }

  const href = buildWhatsAppUrl(phoneNumber, message);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "wa-fab fixed z-50 flex items-center gap-2 rounded-full bg-whatsapp px-4 py-3 text-white shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl hover:shadow-whatsapp/30",
        className
      )}
      aria-label="Contact us on WhatsApp"
    >
      <MessageCircle className="h-6 w-6" />
      {label && (
        <span className="hidden sm:inline text-sm font-medium">{label}</span>
      )}
    </a>
  );
}
