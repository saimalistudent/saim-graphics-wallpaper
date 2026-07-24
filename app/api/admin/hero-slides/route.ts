import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/client";
import { DEFAULT_HERO_SLIDES } from "@/lib/hero-slides";
import { HeroSlide } from "@/lib/types";

function thumbnailsObjectPath(url: string | null | undefined): string | null {
  if (!url || url.startsWith("/")) return null;
  const marker = "/storage/v1/object/public/thumbnails/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const path = decodeURIComponent(url.slice(idx + marker.length).split("?")[0]);
  return path || null;
}

async function deleteStoredImage(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  imageUrl: string | null | undefined
) {
  const path = thumbnailsObjectPath(imageUrl);
  if (!path) return;
  try {
    await supabase.storage.from("thumbnails").remove([path]);
  } catch {
    // ignore
  }
}

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(DEFAULT_HERO_SLIDES);
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("hero_slides")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({
      slides: DEFAULT_HERO_SLIDES,
      _warning: error.message,
    });
  }

  if (!data?.length) {
    return NextResponse.json(DEFAULT_HERO_SLIDES);
  }

  return NextResponse.json(data as HeroSlide[]);
}

/** Replace one slide image (keeps sort_order); deletes previous storage file */
export async function PUT(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      { error: "Supabase admin is not configured" },
      { status: 500 }
    );
  }

  const body = await request.json();
  const id = body.id ? String(body.id) : null;
  const sort_order = Number(body.sort_order);
  const image_url = body.image_url ? String(body.image_url).trim() : null;
  const enabled = body.enabled === undefined ? true : Boolean(body.enabled);

  if (!image_url) {
    return NextResponse.json({ error: "Image zaroori hai" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  // Ensure 5 seed rows exist
  const { data: existingRows } = await supabase
    .from("hero_slides")
    .select("*")
    .order("sort_order", { ascending: true });

  if (!existingRows?.length) {
    await supabase.from("hero_slides").insert(
      DEFAULT_HERO_SLIDES.map((s) => ({
        image_url: s.image_url,
        sort_order: s.sort_order,
        enabled: true,
      }))
    );
  }

  const { data: rows } = await supabase
    .from("hero_slides")
    .select("*")
    .order("sort_order", { ascending: true });

  const target =
    (id && rows?.find((r) => r.id === id)) ||
    rows?.find((r) => r.sort_order === sort_order) ||
    null;

  if (!target && typeof sort_order === "number" && !Number.isNaN(sort_order)) {
    const inserted = await supabase
      .from("hero_slides")
      .insert({
        image_url,
        sort_order,
        enabled,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (inserted.error) {
      return NextResponse.json({ error: inserted.error.message }, { status: 500 });
    }
    return NextResponse.json(inserted.data as HeroSlide);
  }

  if (!target) {
    return NextResponse.json({ error: "Slide nahi mili" }, { status: 404 });
  }

  const previousUrl = target.image_url as string;
  const updated = await supabase
    .from("hero_slides")
    .update({
      image_url,
      enabled,
      updated_at: new Date().toISOString(),
    })
    .eq("id", target.id)
    .select("*")
    .single();

  if (updated.error) {
    return NextResponse.json(
      {
        error:
          updated.error.message +
          " — pehle Supabase mein 003_hero_slides.sql run karein",
      },
      { status: 500 }
    );
  }

  if (previousUrl && previousUrl !== image_url) {
    await deleteStoredImage(supabase, previousUrl);
  }

  return NextResponse.json(updated.data as HeroSlide);
}
