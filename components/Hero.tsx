import Image from "next/image";
import Link from "next/link";
import { FadeUp } from "@/components/FadeUp";
import { BRAND_NAME, BRAND_SUBTITLE, BRAND_TAGLINE } from "@/styles/tokens";

export function Hero() {
  return (
    <section className="hero-section relative overflow-hidden text-white">
      <div className="hero-bg" aria-hidden>
        <span className="hero-base" />
        <span className="hero-spotlight" />
        <span className="hero-gold-accent" />
        <span className="hero-vignette" />
        <span className="hero-grain" />
      </div>
      <div className="relative mx-auto max-w-7xl px-4 pt-4 pb-10 sm:px-6 sm:pt-6 sm:pb-14 lg:px-8 lg:pt-7 lg:pb-16">
        <FadeUp>
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
            <Image
              src="/logo.png"
              alt="SAIM Graphics logo"
              width={140}
              height={140}
              className="hero-logo-pop object-contain"
              priority
            />
            <div className="text-center sm:text-left">
              <p className="text-white text-sm font-medium tracking-widest uppercase mb-2">
                Designing · Printing · Pasting
              </p>
              <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-black tracking-tight uppercase leading-[0.95]">
                <span className="hero-brand-title">{BRAND_NAME}</span>
              </h1>
              <p className="mt-1.5 text-[10px] sm:text-xs tracking-[0.14em] uppercase text-white/85 font-medium">
                {BRAND_SUBTITLE} · GUJRANWALA PAKISTAN
              </p>
              <p className="hero-glass-card mt-3 max-w-xl px-4 py-3 text-xs sm:text-sm leading-relaxed tracking-wide text-white/95">
                {BRAND_TAGLINE}
              </p>
              <div className="mt-6">
                <Link href="/catalogs" className="golden-button text-sm sm:text-base">
                  View Wallpaper Designs
                </Link>
              </div>
              <p className="hero-urdu-main mt-3 sm:mt-4">
                Transforming walls into timeless stories of elegance
              </p>
            </div>
          </div>
        </FadeUp>
      </div>
    </section>
  );
}
