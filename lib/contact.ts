import { ContactSettings } from "@/lib/types";
import {
  createSupabaseServerClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

/** Local fallback when Supabase table is empty / not migrated yet — site must never break */
export const DEFAULT_CONTACT_SETTINGS: ContactSettings = {
  id: "local-default",
  enabled: true,
  call_intro_ur:
    "ہم سے فون کال پر رابطہ کرنے کے لئے اس نیچے دیے گئے بٹن پر کلک کریں",
  call_button_label: "CALL ONLY",
  call_phone: "0318 7976294",
  whatsapp_intro_ur:
    "ہم سے واٹس ایپ پر رابطہ کرنے کے لئے نیچے دیے گئے بٹن پر کلک کریں",
  whatsapp_button_label: "WHATSAPP ONLY",
  whatsapp_phone: "03127290072",
  updated_at: new Date(0).toISOString(),
};

/**
 * Convert any Pakistan phone shape → E.164 digits (no plus, no spaces).
 * Handles:
 *   "0318 7976294"    → "923187976294"
 *   "03127290072"     → "923127290072"
 *   "+92 318 7976294" → "923187976294"
 *   "923187976294"    → "923187976294"
 *   "3187976294"      → "923187976294"
 */
export function normalizePkPhone(input: string | null | undefined): string {
  const digits = (input ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0092")) return "92" + digits.slice(4);
  if (digits.startsWith("92")) return digits;
  if (digits.startsWith("0")) return "92" + digits.slice(1);
  // Bare Pakistan mobile like "3187976294"
  if (digits.length === 10 && digits.startsWith("3")) return "92" + digits;
  return digits;
}

/** tel: link in E.164 — works reliably on mobile dialers + desktop */
export function toTelHref(input: string | null | undefined): string {
  const digits = normalizePkPhone(input);
  if (!digits) return "";
  return `tel:+${digits}`;
}

/** Shared WhatsApp deep link — Meta universal send URL (popup + PDF viewer) */
export function toWhatsAppHref(
  input: string | null | undefined,
  message?: string
): string {
  const digits = normalizePkPhone(input);
  if (!digits) return "";
  const params = new URLSearchParams({ phone: digits });
  if (message?.trim()) params.set("text", message.trim());
  return `https://api.whatsapp.com/send?${params.toString()}`;
}

function isAndroidUa(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

function isIosUa(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * Open WhatsApp Messenger directly on mobile (never Business via https).
 * Android: intent:// with package=com.whatsapp.
 * iOS: whatsapp:// consumer scheme.
 * Desktop: leave default <a target="_blank"> (api.whatsapp.com → web).
 */
export function openWhatsAppChat(
  href: string,
  event?: { preventDefault(): void }
): void {
  if (!href || typeof window === "undefined") return;

  const android = isAndroidUa();
  const ios = isIosUa();
  if (!android && !ios) return;

  event?.preventDefault();

  let phone = "";
  let text = "";
  try {
    const url = new URL(href, window.location.origin);
    phone = url.searchParams.get("phone") ?? "";
    text = url.searchParams.get("text") ?? "";
  } catch {
    window.location.assign(href);
    return;
  }

  const params = new URLSearchParams();
  if (phone) params.set("phone", phone);
  if (text) params.set("text", text);
  const query = params.toString();

  if (android) {
    const intent =
      `intent://send/?${query}` +
      `#Intent;scheme=whatsapp;package=com.whatsapp;` +
      `S.browser_fallback_url=${encodeURIComponent(href)};end`;
    window.location.assign(intent);
    return;
  }

  window.location.assign(`whatsapp://send?${query}`);
}

export function getWhatsAppScreenshotMessage(catalogTitle: string): string {
  return `Hi, I like a design from ${catalogTitle}, sending screenshot`;
}

export async function getContactSettings(): Promise<ContactSettings> {
  if (!isSupabaseConfigured()) return DEFAULT_CONTACT_SETTINGS;

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("contact_settings")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return DEFAULT_CONTACT_SETTINGS;
    // Merge so an empty column falls back to the default (never renders blank Urdu)
    return { ...DEFAULT_CONTACT_SETTINGS, ...(data as ContactSettings) };
  } catch {
    return DEFAULT_CONTACT_SETTINGS;
  }
}
