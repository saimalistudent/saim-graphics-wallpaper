type SocialIconLinksProps = {
  facebookUrl?: string | null;
  tiktokUrl?: string | null;
  locationUrl?: string | null;
  className?: string;
};

/**
 * DEV ONLY — placeholder https links so icons render on localhost for design QA
 * when contact_settings social/location URLs are still empty. Never used in production.
 */
const DEV_PREVIEW_URLS = {
  facebook: "https://www.facebook.com/",
  tiktok: "https://www.tiktok.com/",
  location: "https://maps.google.com/",
} as const;

/** Monochrome Facebook “f” — color via currentColor. */
function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M14.25 8.4V6.95c0-.72.15-1.12 1.28-1.12H17V3.2h-2.35C11.7 3.2 10.55 4.75 10.55 7.05v1.35H8.7v3.05h1.85V20.8h3.7v-9.4h2.55l.4-3.05h-2.95z"
      />
    </svg>
  );
}

/** Monochrome TikTok note — color via currentColor. */
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M19.6 8.05c-1.5-.1-2.9-.8-3.9-1.9v7.1c0 3.1-2.5 5.6-5.6 5.6S4.5 16.35 4.5 13.25 7 7.65 10.1 7.65c.3 0 .6 0 .9.1v2.9a2.7 2.7 0 0 0-.9-.2c-1.5 0-2.8 1.2-2.8 2.8s1.2 2.8 2.8 2.8 2.8-1.2 2.8-2.8V2.75h2.8c.2 1.6 1.2 3 2.6 3.7.7.4 1.5.6 2.3.7v2.9z"
      />
    </svg>
  );
}

/** Monochrome location pin — color via currentColor. */
function LocationIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"
      />
    </svg>
  );
}

export function SocialIconLinks({
  facebookUrl,
  tiktokUrl,
  locationUrl,
  className,
}: SocialIconLinksProps) {
  let facebook = (facebookUrl ?? "").trim();
  let tiktok = (tiktokUrl ?? "").trim();
  let location = (locationUrl ?? "").trim();

  // DEV ONLY: fill empty URLs so icons are always visible locally.
  if (process.env.NODE_ENV === "development") {
    if (!facebook) facebook = DEV_PREVIEW_URLS.facebook;
    if (!tiktok) tiktok = DEV_PREVIEW_URLS.tiktok;
    if (!location) location = DEV_PREVIEW_URLS.location;
  }

  if (!facebook && !tiktok && !location) return null;

  return (
    <div className={className ?? "hero-social"} role="group" aria-label="Social links">
      {facebook ? (
        <a
          href={facebook}
          className="hero-social-link"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Facebook"
        >
          <FacebookIcon className="hero-social-icon" />
        </a>
      ) : null}
      {tiktok ? (
        <a
          href={tiktok}
          className="hero-social-link"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="TikTok"
        >
          <TikTokIcon className="hero-social-icon" />
        </a>
      ) : null}
      {location ? (
        <a
          href={location}
          className="hero-social-link"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Location"
        >
          <LocationIcon className="hero-social-icon" />
        </a>
      ) : null}
    </div>
  );
}
