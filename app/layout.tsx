import type { Metadata, Viewport } from "next";
import {
  Playfair_Display,
  Inter,
  Noto_Sans_Arabic,
  Oswald,
  Cinzel,
} from "next/font/google";
import { getSiteUrl } from "@/lib/site-url";
import {
  SEO_DESCRIPTION,
  SEO_OG_DESCRIPTION,
  SEO_TITLE,
} from "@/lib/seo";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const oswald = Oswald({
  subsets: ["latin"],
  variable: "--font-oswald",
  display: "swap",
});

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-cinzel",
  display: "swap",
});

const urdu = Noto_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-urdu",
  display: "swap",
});

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: SEO_TITLE,
    template: "%s | Saim Graphics",
  },
  description: SEO_DESCRIPTION,
  applicationName: "Saim Graphics",
  authors: [{ name: "Saim Graphics" }],
  creator: "Saim Graphics",
  publisher: "Saim Graphics",
  category: "business",
  keywords: [
    "3D wallpaper Gujranwala",
    "flex printing Gujranwala",
    "panaflex wallpaper Pakistan",
    "flex wallpaper printing near me",
    "print on demand Pakistan",
    "custom wallpaper printing Gujranwala",
    "3D flex wallpaper price in Pakistan",
    "Saim Graphics",
  ],
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_PK",
    url: siteUrl,
    siteName: "Saim Graphics",
    title: SEO_TITLE,
    description: SEO_OG_DESCRIPTION,
    images: [
      {
        url: "/logo.webp",
        width: 512,
        height: 512,
        alt: "Saim Graphics — 3D panaflex wallpaper Gujranwala",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: SEO_TITLE,
    description: SEO_OG_DESCRIPTION,
    images: ["/logo.webp"],
  },
  appleWebApp: {
    title: "Saim Graphics",
    capable: true,
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: "#4A0404",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${playfair.variable} ${inter.variable} ${oswald.variable} ${cinzel.variable} ${urdu.variable} antialiased min-h-screen flex flex-col`}
      >
        {children}
      </body>
    </html>
  );
}
