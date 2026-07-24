import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/client";
import {
  optimizeImageBuffer,
  parseOptimizeKind,
} from "@/lib/image-optimize";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);
/** Accept larger camera uploads; we recompress before storage */
const MAX_BYTES = 12 * 1024 * 1024;

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const kind = parseOptimizeKind(
    typeof formData.get("kind") === "string"
      ? String(formData.get("kind"))
      : request.nextUrl.searchParams.get("kind")
  );

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Sirf JPG, PNG, WEBP photo upload karein" },
      { status: 400 }
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Photo 12MB se chhoti honi chahiye" },
      { status: 400 }
    );
  }

  const input = Buffer.from(await file.arrayBuffer());
  let optimized: { buffer: Buffer; contentType: "image/webp"; ext: "webp" };
  try {
    optimized = await optimizeImageBuffer(input, kind);
  } catch {
    return NextResponse.json(
      { error: "Image optimize fail — dusri photo try karein" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseAdminClient();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${optimized.ext}`;

  const { error: uploadError } = await supabase.storage
    .from("thumbnails")
    .upload(fileName, optimized.buffer, {
      contentType: optimized.contentType,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = supabase.storage
    .from("thumbnails")
    .getPublicUrl(fileName);

  return NextResponse.json({
    url: urlData.publicUrl,
    kind,
    bytes: optimized.buffer.byteLength,
  });
}
