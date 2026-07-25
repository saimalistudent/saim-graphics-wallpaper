import { NextRequest, NextResponse } from "next/server";
import { revalidatePublicSite } from "@/lib/revalidate-site";
import { isAdminAuthenticated } from "@/lib/auth";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/client";
import { DEFAULT_CONTACT_SETTINGS } from "@/lib/contact";
import { ContactSettings } from "@/lib/types";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({
      ...DEFAULT_CONTACT_SETTINGS,
      _warning: "Supabase admin is not configured — using defaults",
    });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("contact_settings")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({
      ...DEFAULT_CONTACT_SETTINGS,
      _warning: error.message + " — run 007_contact_settings.sql in Supabase",
    });
  }

  return NextResponse.json({
    ...DEFAULT_CONTACT_SETTINGS,
    ...((data as ContactSettings) ?? {}),
  });
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

  const body = await request.json().catch(() => ({}));

  const payload = {
    enabled: Boolean(body.enabled),
    call_intro_ur: String(body.call_intro_ur ?? "").trim(),
    call_button_label:
      String(body.call_button_label ?? "").trim() || "CALL ONLY",
    call_phone: String(body.call_phone ?? "").trim(),
    whatsapp_intro_ur: String(body.whatsapp_intro_ur ?? "").trim(),
    whatsapp_button_label:
      String(body.whatsapp_button_label ?? "").trim() || "WHATSAPP ONLY",
    whatsapp_phone: String(body.whatsapp_phone ?? "").trim(),
    updated_at: new Date().toISOString(),
  };

  if (!payload.call_phone && !payload.whatsapp_phone) {
    return NextResponse.json(
      { error: "At least one phone number is required" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseAdminClient();

  const { data: rows } = await supabase
    .from("contact_settings")
    .select("id")
    .order("updated_at", { ascending: false });

  const existing = rows?.[0] ?? null;

  let result;
  if (existing?.id) {
    result = await supabase
      .from("contact_settings")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .single();

    // Keep only one row — clean up any duplicates
    const extraIds = (rows ?? [])
      .slice(1)
      .map((r) => r.id)
      .filter(Boolean);
    if (extraIds.length > 0) {
      await supabase.from("contact_settings").delete().in("id", extraIds);
    }
  } else {
    result = await supabase
      .from("contact_settings")
      .insert(payload)
      .select("*")
      .single();
  }

  if (result.error) {
    return NextResponse.json(
      {
        error:
          result.error.message +
          " — run 007_contact_settings.sql in Supabase first",
      },
      { status: 500 }
    );
  }

  // Site layout + PDF viewer page both read this — invalidate the whole tree
  revalidatePublicSite();
  return NextResponse.json(result.data as ContactSettings);
}
