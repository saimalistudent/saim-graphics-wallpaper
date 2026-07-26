/** Canonical public origin (no trailing slash). */
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  // Netlify injects URL on deploy
  if (process.env.URL?.trim()) return process.env.URL.trim().replace(/\/$/, "");
  if (process.env.DEPLOY_PRIME_URL?.trim()) {
    return process.env.DEPLOY_PRIME_URL.trim().replace(/\/$/, "");
  }
  // Production domain fallback for SEO (sitemap / robots / OG)
  if (process.env.NODE_ENV === "production") {
    return "https://saimgraphics.com";
  }
  return "http://localhost:3000";
}
