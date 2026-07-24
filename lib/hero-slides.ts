import { HeroSlide } from "@/lib/types";
import {
  createSupabaseServerClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

export const DEFAULT_HERO_SLIDES: HeroSlide[] = [
  {
    id: "local-1",
    image_url: "/hero-slides/1.webp",
    sort_order: 1,
    enabled: true,
    updated_at: new Date(0).toISOString(),
  },
  {
    id: "local-2",
    image_url: "/hero-slides/2.webp",
    sort_order: 2,
    enabled: true,
    updated_at: new Date(0).toISOString(),
  },
  {
    id: "local-3",
    image_url: "/hero-slides/3.webp",
    sort_order: 3,
    enabled: true,
    updated_at: new Date(0).toISOString(),
  },
  {
    id: "local-4",
    image_url: "/hero-slides/4.webp",
    sort_order: 4,
    enabled: true,
    updated_at: new Date(0).toISOString(),
  },
  {
    id: "local-5",
    image_url: "/hero-slides/5.webp",
    sort_order: 5,
    enabled: true,
    updated_at: new Date(0).toISOString(),
  },
];

export async function getHeroSlides(): Promise<HeroSlide[]> {
  if (!isSupabaseConfigured()) return DEFAULT_HERO_SLIDES;

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("hero_slides")
      .select("*")
      .eq("enabled", true)
      .order("sort_order", { ascending: true });

    if (error || !data?.length) return DEFAULT_HERO_SLIDES;
    return (data as HeroSlide[]).map((slide) => ({
      ...slide,
      image_url: slide.image_url.replace(
        /\/hero-slides\/(\d+)\.png$/i,
        "/hero-slides/$1.webp"
      ),
    }));
  } catch {
    return DEFAULT_HERO_SLIDES;
  }
}
