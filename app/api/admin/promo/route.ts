import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/client";
import { DEFAULT_PROMO_POPUP } from "@/lib/promo-popup";
import { PromoPopup } from "@/lib/types";

/** Extract storage object path from a public thumbnails URL */
function thumbnailsObjectPath(url: string | null | undefined): string | null {
  if (!url) return null;
  // Local sample — never delete from disk/storage
  if (url.startsWith("/")) return null;

  const marker = "/storage/v1/object/public/thumbnails/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const path = decodeURIComponent(url.slice(idx + marker.length).split("?")[0]);
  return path || null;
}

async function deleteStoredPromoImage(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  imageUrl: string | null | undefined
) {
  const path = thumbnailsObjectPath(imageUrl);
  if (!path) return;
  try {
    await supabase.storage.from("thumbnails").remove([path]);
  } catch {
    // ignore — old file may already be gone
  }
}

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(DEFAULT_PROMO_POPUP);
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("promo_popup")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({
      ...DEFAULT_PROMO_POPUP,
      _warning: error.message,
    });
  }

  return NextResponse.json((data as PromoPopup) ?? DEFAULT_PROMO_POPUP);
}

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
  const image_url = body.image_url ? String(body.image_url).trim() : null;
  const enabled = Boolean(body.enabled);

  if (!image_url) {
    return NextResponse.json(
      { error: "Popup image zaroori hai" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseAdminClient();

  const { data: rows } = await supabase
    .from("promo_popup")
    .select("id, image_url")
    .order("updated_at", { ascending: false });

  const existing = rows?.[0] ?? null;
  const previousImageUrl = existing?.image_url ?? null;

  const payload = {
    enabled,
    title: String(body.title ?? "").trim() || "Offer",
    body: String(body.body ?? "").trim(),
    image_url,
    cta_label: null as string | null,
    cta_url: null as string | null,
    updated_at: new Date().toISOString(),
  };

  let result;
  if (existing?.id) {
    result = await supabase
      .from("promo_popup")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .single();

    // Keep only one row — delete any extras
    const extraIds = (rows ?? [])
      .slice(1)
      .map((r) => r.id)
      .filter(Boolean);
    if (extraIds.length > 0) {
      await supabase.from("promo_popup").delete().in("id", extraIds);
    }
  } else {
    result = await supabase
      .from("promo_popup")
      .insert(payload)
      .select("*")
      .single();
  }

  if (result.error) {
    return NextResponse.json(
      {
        error:
          result.error.message +
          " — pehle Supabase mein 002_promo_popup.sql migration run karein",
      },
      { status: 500 }
    );
  }

  // Purani storage image hatao jab naya URL alag ho
  if (previousImageUrl && previousImageUrl !== image_url) {
    await deleteStoredPromoImage(supabase, previousImageUrl);
  }

  return NextResponse.json(result.data as PromoPopup);
}
