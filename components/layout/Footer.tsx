import Link from "next/link";
import Image from "next/image";
import { BRAND_FULL, BRAND_NAME, BRAND_SUBTITLE } from "@/styles/tokens";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer site-footer-safe mt-auto">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center gap-5">
          <Link href="/" className="group inline-flex flex-col items-center gap-3">
            <Image
              src="/logo.webp"
              alt="SAIM Graphics logo"
              width={72}
              height={72}
              className="object-contain"
            />
            <span className="flex flex-col items-center gap-1">
              <span className="font-heading text-xl sm:text-2xl font-bold tracking-wide text-gold-light group-hover:text-[#f5d76e] transition-colors">
                {BRAND_NAME}
              </span>
              <span className="text-[10px] sm:text-xs font-medium tracking-[0.22em] uppercase text-white/80">
                {BRAND_SUBTITLE}
              </span>
            </span>
          </Link>

          <div className="footer-ornament" aria-hidden>
            <span />
            <i />
            <span />
          </div>

          <p className="max-w-md text-xs sm:text-sm text-white/70 leading-relaxed tracking-wide uppercase">
            Premium 3D panaflex wallpaper designs for every space
          </p>

          <p className="text-[10px] sm:text-xs tracking-[0.2em] uppercase text-gold-light/80">
            Designing · Printing · Pasting
          </p>

          <nav className="flex items-center gap-5 sm:gap-7 pt-1">
            <Link href="/" className="footer-link">
              Home
            </Link>
            <span className="nav-divider" aria-hidden />
            <Link href="/catalogs" className="footer-link">
              Catalogs
            </Link>
          </nav>
        </div>

        <div className="footer-bottom mt-10 pt-6 text-center">
          <p className="text-[11px] sm:text-xs text-white/45 tracking-wide">
            &copy; {year} {BRAND_FULL}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
