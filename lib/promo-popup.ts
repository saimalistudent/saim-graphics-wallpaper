import { PromoPopup } from "@/lib/types";
import {
  createSupabaseServerClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

/** Local fallback when Supabase table is empty / not migrated yet */
export const DEFAULT_PROMO_POPUP: PromoPopup = {
  id: "local-default",
  enabled: true,
  title: "Special Offer",
  body: "5% OFF on 5,000 ft work — premium 3D panaflex designs in Gujranwala. Browse catalogs and send your favourite screenshot on WhatsApp.",
  image_url: "/promo-popup-sample.webp",
  cta_label: "View Designs",
  cta_url: "/catalogs",
  updated_at: new Date(0).toISOString(),
};

export async function getPromoPopup(): Promise<PromoPopup> {
  if (!isSupabaseConfigured()) return DEFAULT_PROMO_POPUP;

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("promo_popup")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return DEFAULT_PROMO_POPUP;
    const row = data as PromoPopup;
    return {
      ...row,
      image_url: row.image_url?.replace(
        "/promo-popup-sample.png",
        "/promo-popup-sample.webp"
      ) ?? null,
    };
  } catch {
    return DEFAULT_PROMO_POPUP;
  }
}

export async function getActivePromoPopup(): Promise<PromoPopup | null> {
  const promo = await getPromoPopup();
  if (!promo.enabled) return null;
  if (!promo.image_url?.trim()) return null;
  return promo;
}

/** Same URL PromoPopup renders */
export function promoImageSrc(imageUrl: string | null | undefined): string | null {
  const url = imageUrl?.trim() || null;
  if (!url) return null;
  // Local fallback only — CDN URLs pass through unchanged
  if (url === "/promo-popup-sample.webp" || url === "/promo-popup-sample.png") {
    return `/promo-popup-sample.webp?v=4`;
  }
  return url;
}
