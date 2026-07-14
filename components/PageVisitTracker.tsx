"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

export function PageVisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!isSupabaseConfigured() || pathname.startsWith("/admin")) return;

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
