import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
} from "@/lib/admin-session";

export { ADMIN_SESSION_COOKIE, getAdminPassword } from "@/lib/admin-session";

export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_SESSION_COOKIE);
  return verifyAdminSessionToken(session?.value);
}
