"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/layout/BrandMark";
import { LogoutButton } from "@/components/admin/LogoutButton";
import { cn } from "@/lib/utils";
import { ExternalLink } from "lucide-react";

const adminLinks = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/catalogs", label: "Catalogs" },
  { href: "/admin/promo", label: "Promo" },
  { href: "/admin/hero", label: "Hero" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <header className="navbar-red-gradient text-white border-b border-gold/35 shadow-lg sticky top-0 z-40">
      <div className="mx-auto max-w-7xl px-3 py-2.5 sm:px-6 sm:py-3 lg:px-8 flex items-center justify-between gap-2 sm:gap-4 min-w-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <BrandMark href="/admin/dashboard" size="sm" />
          <span className="hidden md:inline text-[10px] tracking-[0.18em] uppercase text-gold-light/90 border-l border-gold/30 pl-3 shrink-0">
            Admin Panel
          </span>
        </div>
        <nav className="flex items-center gap-1 sm:gap-3 shrink-0">
          {adminLinks.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "inline-flex items-center justify-center min-h-10 px-2.5 sm:px-3 rounded-md text-[0.72rem] sm:text-[0.75rem] tracking-wide font-medium transition-colors",
                  active
                    ? "bg-white/15 text-gold-light"
                    : "text-white/85 hover:bg-white/10 hover:text-gold-light"
                )}
              >
                {link.label}
              </Link>
            );
          })}
          <Link
            href="/"
            target="_blank"
            className="hidden sm:inline-flex items-center gap-1 min-h-10 px-2 text-[0.7rem] tracking-wide text-white/75 hover:text-gold-light transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Website
          </Link>
          <LogoutButton />
        </nav>
      </div>
    </header>
  );
}

