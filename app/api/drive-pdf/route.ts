import { NextRequest } from "next/server";
import { headDrivePdf, serveDrivePdf } from "@/lib/drive-pdf-serve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Legacy `?id=` URL — still supported */
export async function GET(request: NextRequest) {
  const fileId = request.nextUrl.searchParams.get("id")?.trim() ?? "";
  return serveDrivePdf(fileId, request.headers.get("range"));
}

export async function HEAD(request: NextRequest) {
  const fileId = request.nextUrl.searchParams.get("id")?.trim() ?? "";
  return headDrivePdf(fileId);
}
