import { NextRequest, NextResponse } from "next/server";
import { revalidatePublicSite } from "@/lib/revalidate-site";
import { isAdminAuthenticated } from "@/lib/auth";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/client";
import {
  DEFAULT_CONTACT_SETTINGS,
  normalizeSocialUrl,
} from "@/lib/contact";
import { ContactSettings } from "@/lib/types";

function isMissingSocialColumnError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("facebook_url") ||
    m.includes("tiktok_url") ||
    (m.includes("column") &&
      m.includes("does not exist") &&
      !m.includes("location_url"))
  );
}

function isMissingLocationColumnError(message: string): boolean {
  return message.toLowerCase().includes("location_url");
}

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

  const row = (data as Record<string, unknown> | null) ?? null;
  const missingSocial =
    row != null &&
    (!("facebook_url" in row) || !("tiktok_url" in row));
  const missingLocation = row != null && !("location_url" in row);

  let warning: string | undefined;
  if (missingSocial && missingLocation) {
    warning =
      "Run 013_contact_social_urls.sql and 014_contact_location_url.sql in Supabase to enable social / location links";
  } else if (missingSocial) {
    warning =
      "Run 013_contact_social_urls.sql in Supabase to enable Facebook / TikTok links";
  } else if (missingLocation) {
    warning =
      "Run 014_contact_location_url.sql in Supabase to enable the Location link";
  }

  return NextResponse.json({
    ...DEFAULT_CONTACT_SETTINGS,
    ...((row as ContactSettings | null) ?? {}),
    ...(warning ? { _warning: warning } : {}),
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

  const facebook = normalizeSocialUrl(body.facebook_url, "facebook");
  if (!facebook.ok) {
    return NextResponse.json({ error: facebook.error }, { status: 400 });
  }
  const tiktok = normalizeSocialUrl(body.tiktok_url, "tiktok");
  if (!tiktok.ok) {
    return NextResponse.json({ error: tiktok.error }, { status: 400 });
  }
  const location = normalizeSocialUrl(body.location_url, "location");
  if (!location.ok) {
    return NextResponse.json({ error: location.error }, { status: 400 });
  }

  const basePayload = {
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

  if (!basePayload.call_phone && !basePayload.whatsapp_phone) {
    return NextResponse.json(
      { error: "At least one phone number is required" },
      { status: 400 }
    );
  }

  const socialPayload = {
    ...basePayload,
    facebook_url: facebook.url,
    tiktok_url: tiktok.url,
  };

  const fullPayload = {
    ...socialPayload,
    location_url: location.url,
  };

  const supabase = createSupabaseAdminClient();

  const { data: rows } = await supabase
    .from("contact_settings")
    .select("id")
    .order("updated_at", { ascending: false });

  const existing = rows?.[0] ?? null;

  async function write(payload: Record<string, unknown>) {
    if (existing?.id) {
      const result = await supabase
        .from("contact_settings")
        .update(payload)
        .eq("id", existing.id)
        .select("*")
        .single();

      const extraIds = (rows ?? [])
        .slice(1)
        .map((r) => r.id)
        .filter(Boolean);
      if (extraIds.length > 0) {
        await supabase.from("contact_settings").delete().in("id", extraIds);
      }
      return result;
    }
    return supabase.from("contact_settings").insert(payload).select("*").single();
  }

  let result = await write(fullPayload);
  let socialSkipped = false;
  let locationSkipped = false;

  if (result.error && isMissingLocationColumnError(result.error.message)) {
    result = await write(socialPayload);
    locationSkipped = true;
  }

  if (result.error && isMissingSocialColumnError(result.error.message)) {
    // Keep location_url when that column exists (014 without 013).
    const withoutSocial = {
      ...basePayload,
      ...(locationSkipped ? {} : { location_url: location.url }),
    };
    result = await write(withoutSocial);
    if (result.error && isMissingLocationColumnError(result.error.message)) {
      result = await write(basePayload);
      locationSkipped = true;
    }
    socialSkipped = true;
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

  const warnings: string[] = [];
  if (socialSkipped) {
    warnings.push(
      "social links need 013_contact_social_urls.sql in Supabase"
    );
  }
  if (locationSkipped) {
    warnings.push(
      "location link needs 014_contact_location_url.sql in Supabase"
    );
  }

  revalidatePublicSite();
  return NextResponse.json({
    ...DEFAULT_CONTACT_SETTINGS,
    ...(result.data as ContactSettings),
    ...(socialSkipped
      ? {
          facebook_url: "",
          tiktok_url: "",
        }
      : {}),
    ...(locationSkipped ? { location_url: "" } : {}),
    ...(warnings.length > 0
      ? {
          _warning: `Contact saved, but ${warnings.join("; ")}`,
        }
      : {}),
  });
}
