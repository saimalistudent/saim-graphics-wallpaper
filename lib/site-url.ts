/** Canonical public origin (no trailing slash). */
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");

  // Prefer production domain for SEO (sitemap / robots / OG / JSON-LD)
  if (
    process.env.NODE_ENV === "production" ||
    process.env.CONTEXT === "production"
  ) {
    return "https://saimgraphics.com";
  }

  // Netlify injects URL on non-production deploys (branch / preview)
  if (process.env.URL?.trim()) return process.env.URL.trim().replace(/\/$/, "");
  if (process.env.DEPLOY_PRIME_URL?.trim()) {
    return process.env.DEPLOY_PRIME_URL.trim().replace(/\/$/, "");
  }

  return "http://localhost:3000";
}
