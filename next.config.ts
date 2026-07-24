import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "192.168.100.100",
    "192.168.100.155",
    "127.0.0.1",
    "localhost",
  ],
  transpilePackages: ["pdfjs-dist"],
  images: {
    localPatterns: [
      { pathname: "/logo.png" },
      { pathname: "/catalog-previews/**" },
      { pathname: "/promo-popup-sample.png" },
      { pathname: "/hero-slides/**" },
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
      {
        protocol: "https",
        hostname: "**.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "drive.google.com",
      },
    ],
  },
};

export default nextConfig;
