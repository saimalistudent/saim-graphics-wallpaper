import Image from "next/image";
import Link from "next/link";
import { Images } from "lucide-react";
import { FadeUp } from "@/components/FadeUp";
import { BRAND_NAME, BRAND_SUBTITLE } from "@/styles/tokens";

export function Hero() {
  return (
    <section className="hero-section relative overflow-hidden text-white">
      <div className="hero-bg" aria-hidden>
        <span className="hero-base" />
        <span className="hero-spotlight" />
        <span className="hero-vignette" />
        <span className="hero-grain" />
      </div>

      <div className="hero-inner relative mx-auto max-w-xl px-4 pt-4 pb-5 sm:px-6 sm:pt-5 sm:pb-6">
        <FadeUp className="flex flex-col items-center text-center">
          <div className="hero-logo-wrap">
            <Image
              src="/logo.png"
              alt="SAIM Graphics logo"
              width={112}
              height={112}
              className="hero-logo-pop object-contain"
              priority
            />
          </div>

          <p className="hero-services">
            Designing<span className="hero-dot">•</span>
            Printing<span className="hero-dot">•</span>
            Pasting
          </p>

          <div className="hero-rule" aria-hidden>
            <span className="hero-rule-line" />
            <span className="hero-rule-flare" />
            <span className="hero-rule-line" />
          </div>

          <h1 className="hero-brand-title font-heading font-bold tracking-wide">
            {BRAND_NAME}
          </h1>

          <p className="hero-location">
            {BRAND_SUBTITLE} — Gujranwala Pakistan
          </p>

          <Link href="/catalogs" className="hero-cta gold-btn">
            <span className="hero-cta-icon" aria-hidden>
              <Images className="h-3.5 w-3.5" strokeWidth={2.25} />
            </span>
            <span>View Wallpaper Designs</span>
          </Link>

          <p className="hero-motto">
            Transforming walls into timeless stories of elegance
          </p>
        </FadeUp>
      </div>
    </section>
  );
}
