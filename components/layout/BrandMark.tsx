import Image from "next/image";
import Link from "next/link";
import { BRAND_NAME, BRAND_SUBTITLE } from "@/styles/tokens";
import { cn } from "@/lib/utils";

type BrandMarkProps = {
  href?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  light?: boolean;
  /** Text under brand name (defaults to product subtitle) */
  subtitle?: string;
  /** Show subtitle on all screen sizes (navbar uses this) */
  alwaysShowSubtitle?: boolean;
};

const sizeMap = {
  sm: {
    logo: 40,
    logoClass: "h-9 w-9 sm:h-10 sm:w-10",
    title: "text-sm sm:text-base",
    sub: "text-[10px] sm:text-xs",
  },
  md: {
    logo: 52,
    logoClass: "h-9 w-9 sm:h-[52px] sm:w-[52px]",
    title: "text-sm sm:text-lg",
    sub: "text-xs sm:text-sm",
  },
  lg: {
    logo: 72,
    logoClass: "h-[72px] w-[72px]",
    title: "text-xl sm:text-2xl",
    sub: "text-sm sm:text-base",
  },
};

export function BrandMark({
  href = "/",
  className,
  size = "md",
  light = true,
  subtitle = BRAND_SUBTITLE,
  alwaysShowSubtitle = false,
}: BrandMarkProps) {
  const s = sizeMap[size];

  const content = (
    <span className={cn("inline-flex items-center gap-2 sm:gap-3 min-w-0 max-w-full", className)}>
      <Image
        src="/logo.webp"
        alt="SAIM Graphics logo"
        width={s.logo}
        height={s.logo}
        className={cn("rounded-full object-contain shrink-0", s.logoClass)}
        priority
      />
      <span className="flex flex-col leading-tight min-w-0 overflow-hidden">
        <span
          className={cn(
            "font-heading font-bold tracking-wide truncate",
            s.title,
            light ? "text-gold-light" : "text-burgundy"
          )}
        >
          {BRAND_NAME}
        </span>
        <span
          className={cn(
            "font-medium truncate",
            alwaysShowSubtitle
              ? "text-[9px] sm:text-[11px] tracking-[0.08em] uppercase opacity-90"
              : cn("hidden sm:inline tracking-wider uppercase", s.sub),
            light ? "text-white/80" : "text-navy/80"
          )}
        >
          {subtitle}
        </span>
      </span>
    </span>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block min-w-0 max-w-full hover:opacity-95 transition-opacity"
      >
        {content}
      </Link>
    );
  }

  return content;
}
