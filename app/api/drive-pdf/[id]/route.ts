import { NextRequest } from "next/server";
import { headDrivePdf, serveDrivePdf } from "@/lib/drive-pdf-serve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Path-based URL — unique path per Drive file so CDN cannot mix PDFs */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return serveDrivePdf(id.trim(), request.headers.get("range"));
}

export async function HEAD(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return headDrivePdf(id.trim());
}
