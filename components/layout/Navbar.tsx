"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/layout/BrandMark";

const links = [
  { href: "/", label: "Home" },
  { href: "/catalogs", label: "Catalogs" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="navbar-red-gradient text-white shadow-lg border-b border-gold/35">
      <nav className="mx-auto flex max-w-7xl items-center gap-3 sm:gap-6 px-3 py-2.5 sm:px-6 sm:py-3 lg:px-8 min-w-0">
        <div className="min-w-0 flex-1 overflow-hidden pr-1">
          <BrandMark
            size="md"
            className="max-w-full"
            subtitle="Designer & Developer"
            alwaysShowSubtitle
          />
        </div>
        <ul className="nav-classic flex items-center gap-2.5 sm:gap-7 shrink-0 pl-3 border-l border-white/20">
          {links.map((link, index) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);

            return (
              <li key={link.href} className="flex items-center gap-2.5 sm:gap-7">
                {index > 0 && <span className="nav-divider hidden sm:block" aria-hidden />}
                <Link
                  href={link.href}
                  className={cn("nav-text-link", active && "nav-text-link-active")}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
