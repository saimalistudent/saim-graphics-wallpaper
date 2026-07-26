import { normalizePkPhone } from "@/lib/contact";
import { getSiteUrl } from "@/lib/site-url";
import type { Catalog } from "@/lib/types";

export const SEO_TITLE =
  "3D Panaflex Wallpaper & Flex Printing in Gujranwala | Saim Graphics";

/** 150–160 chars: location + services + CTA */
export const SEO_DESCRIPTION =
  "3D wallpaper Gujranwala — flex printing, panaflex wallpaper Pakistan & print on demand. Custom wallpaper printing near you. WhatsApp order at Saim Graphics.";

export const SEO_OG_DESCRIPTION =
  "3D panaflex wallpaper & flex printing in Gujranwala. Print on demand and custom wallpaper — order via WhatsApp at Saim Graphics.";

const GUJRANWALA_GEO = {
  latitude: 32.1877,
  longitude: 74.1945,
} as const;

function absoluteUrl(pathOrUrl: string, base: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${base}${path}`;
}

function toE164Plus(phone: string | null | undefined): string | undefined {
  const digits = normalizePkPhone(phone);
  return digits ? `+${digits}` : undefined;
}

export function buildLocalBusinessJsonLd(opts?: {
  telephone?: string | null;
  whatsapp?: string | null;
  facebookUrl?: string | null;
  tiktokUrl?: string | null;
  /** Maps / place URL for LocalBusiness hasMap only — not sameAs */
  locationUrl?: string | null;
}) {
  const base = getSiteUrl();
  const logo = absoluteUrl("/logo.webp", base);
  const telephone =
    toE164Plus(opts?.telephone) ?? toE164Plus(opts?.whatsapp);
  const sameAs = [opts?.facebookUrl, opts?.tiktokUrl]
    .map((u) => (u ?? "").trim())
    .filter((u) => /^https:\/\//i.test(u));
  const hasMap = (opts?.locationUrl ?? "").trim();

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "HomeAndConstructionBusiness"],
    "@id": `${base}/#business`,
    name: "Saim Graphics",
    alternateName: "SAIM GRAPHICS",
    description: SEO_DESCRIPTION,
    url: base,
    image: [logo, absoluteUrl("/icon.png", base)],
    logo,
    address: {
      "@type": "PostalAddress",
      addressLocality: "Gujranwala",
      addressRegion: "Punjab",
      addressCountry: "PK",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: GUJRANWALA_GEO.latitude,
      longitude: GUJRANWALA_GEO.longitude,
    },
    areaServed: [
      { "@type": "City", name: "Gujranwala" },
      { "@type": "City", name: "Lahore" },
      { "@type": "City", name: "Sialkot" },
      { "@type": "AdministrativeArea", name: "Punjab" },
      { "@type": "Country", name: "Pakistan" },
    ],
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer service",
        areaServed: "PK",
        availableLanguage: ["en", "ur"],
        ...(telephone ? { telephone } : {}),
      },
    ],
  };

  if (telephone) data.telephone = telephone;
  if (sameAs.length > 0) data.sameAs = sameAs;
  if (/^https:\/\//i.test(hasMap)) data.hasMap = hasMap;

  return data;
}

export function buildProductJsonLd(catalog: Catalog) {
  const base = getSiteUrl();
  const url = `${base}/catalogs/${catalog.id}`;
  const image = catalog.thumbnail_url
    ? absoluteUrl(catalog.thumbnail_url, base)
    : absoluteUrl("/logo.webp", base);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: catalog.title,
    description: `${catalog.title} — 3D panaflex wallpaper design catalog from Saim Graphics, Gujranwala.`,
    image,
    url,
    brand: {
      "@type": "Brand",
      name: "Saim Graphics",
    },
    category: "3D Panaflex Wallpaper",
  };
}
