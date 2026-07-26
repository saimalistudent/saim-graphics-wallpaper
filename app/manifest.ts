import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Saim Graphics — 3D Panaflex Wallpaper",
    short_name: "Saim Graphics",
    description:
      "3D panaflex wallpaper and flex printing in Gujranwala, Punjab, Pakistan.",
    start_url: "/",
    display: "standalone",
    background_color: "#4A0404",
    theme_color: "#4A0404",
    lang: "en",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
