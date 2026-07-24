import type { Metadata, Viewport } from "next";
import {
  Playfair_Display,
  Inter,
  Noto_Sans_Arabic,
  Oswald,
  Cinzel,
} from "next/font/google";
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

export const metadata: Metadata = {
  title: "SAIM GRAPHICS | 3D PANAFLEX WALLPAPER",
  description:
    "Premium 3D panaflex wallpaper designs for homes, offices, salons and more. Browse our catalogs and order via WhatsApp.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
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
