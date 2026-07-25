/** Canonical public origin (no trailing slash). */
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  if (process.env.URL?.trim()) return process.env.URL.trim().replace(/\/$/, "");
  if (process.env.DEPLOY_PRIME_URL?.trim()) {
    return process.env.DEPLOY_PRIME_URL.trim().replace(/\/$/, "");
  }
  return "http://localhost:3000";
}
