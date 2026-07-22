/** Shared Edge + Node helpers for signed admin session cookies */

export const ADMIN_SESSION_COOKIE = "saim_admin_session";
const SESSION_DAYS = 7;

export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD?.trim() ?? "";
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

export async function createAdminSessionToken(
  password = getAdminPassword()
): Promise<string | null> {
  if (!password) return null;
  const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const body = String(exp);
  const sig = await sha256Hex(`${password}|${body}`);
  return `${body}.${sig}`;
}

export async function verifyAdminSessionToken(
  token: string | undefined | null,
  password = getAdminPassword()
): Promise<boolean> {
  if (!token || !password) return false;
  const [body, sig] = token.split(".");
  if (!body || !sig) return false;
  const exp = Number(body);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  const expected = await sha256Hex(`${password}|${body}`);
  return timingSafeEqual(sig, expected);
}

export function adminSessionCookieOptions(maxAgeSeconds?: number) {
  const secure = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge:
      typeof maxAgeSeconds === "number"
        ? maxAgeSeconds
        : SESSION_DAYS * 24 * 60 * 60,
  };
}
