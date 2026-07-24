"use client";

import Link from "next/link";
import { Images } from "lucide-react";
import { FadeUp } from "@/components/FadeUp";
import { BRAND_NAME, BRAND_SUBTITLE } from "@/styles/tokens";
import { HeroSlide } from "@/lib/types";

type Props = {
  slides: HeroSlide[];
};

export function Hero({ slides }: Props) {
  const list = slides.length > 0 ? slides : [];
  const track = [...list, ...list];

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
          {list.length > 0 && (
            <div className="hero-marquee" aria-hidden>
              <div className="hero-marquee-track">
                {track.map((slide, i) => (
                  <div key={`${slide.id}-${i}`} className="hero-marquee-slide">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={slide.image_url}
                      alt=""
                      className="hero-marquee-image"
                      loading={i < 2 ? "eager" : "lazy"}
                      decoding="async"
                      fetchPriority={i < 2 ? "high" : "low"}
                      draggable={false}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="hero-rule" aria-hidden>
            <span className="hero-rule-line" />
            <span className="hero-rule-flare" />
            <span className="hero-rule-line" />
          </div>

            <h1 className="hero-brand-title font-heading font-bold tracking-wide">
              {BRAND_SUBTITLE}
            </h1>

            <p className="hero-location">
              {BRAND_NAME} — Gujranwala Pakistan
            </p>

          <Link href="/catalogs" className="hero-cta gold-btn">
            <span className="hero-cta-icon" aria-hidden>
              <Images className="h-3.5 w-3.5" strokeWidth={2.25} />
            </span>
              <span>View All Wallpaper Design</span>
          </Link>

          <p className="hero-motto">
            Transforming walls into timeless stories of elegance
          </p>
        </FadeUp>
      </div>
    </section>
  );
}
