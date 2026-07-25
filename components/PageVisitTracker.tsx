"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

const VISIT_SESSION_KEY = "saim_visit_logged_v1";
/** Tab-local guard survives Strict Mode double-fire + sessionStorage failure */
let visitLoggedInTab = false;

function isLikelyBot(): boolean {
  if (typeof navigator === "undefined") return true;
  const ua = navigator.userAgent || "";
  return /bot|crawler|spider|preview|prerender|headless|lighthouse/i.test(ua);
}

function hasVisitBeenLogged(): boolean {
  if (visitLoggedInTab) return true;
  try {
    return sessionStorage.getItem(VISIT_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function markVisitLogged() {
  visitLoggedInTab = true;
  try {
    sessionStorage.setItem(VISIT_SESSION_KEY, "1");
  } catch {
    // ignore — module-level flag still guards this tab
  }
}

export function PageVisitTracker() {
  const pathname = usePathname();
  const firedRef = useRef(false);

  useEffect(() => {
    if (!isSupabaseConfigured() || pathname.startsWith("/admin")) return;
    if (isLikelyBot()) return;
    if (firedRef.current) return;
    if (hasVisitBeenLogged()) {
      firedRef.current = true;
      return;
    }
    firedRef.current = true;
    markVisitLogged();

    async function trackVisit() {
      try {
        const supabase = createSupabaseBrowserClient();
        await supabase.from("page_visits").insert({
          page_path: pathname,
          user_agent: navigator.userAgent,
        });
      } catch {
        // Silently fail — analytics should not break the site
      }
    }

    trackVisit();
  }, [pathname]);

  return null;
}
