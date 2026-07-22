import { NextRequest, NextResponse } from "next/server";
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  openSync,
  readSync,
  closeSync,
  statSync,
  unlinkSync,
  renameSync,
} from "fs";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Netlify/Lambda only allow writes under /tmp; local uses project .pdf-cache */
const CACHE_DIR = path.join(
  process.env.NETLIFY === "true" || process.env.AWS_LAMBDA_FUNCTION_NAME
    ? "/tmp"
    : process.cwd(),
  ".pdf-cache"
);

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function driveDownloadUrls(fileId: string, confirm?: string) {
  const c = confirm ? `&confirm=${encodeURIComponent(confirm)}` : "&confirm=t";
  return [
    `https://drive.usercontent.google.com/download?id=${fileId}&export=download${c}`,
    `https://drive.google.com/uc?export=download&id=${fileId}${c}`,
  ];
}

function cachePath(fileId: string) {
  return path.join(CACHE_DIR, `${fileId}.pdf`);
}

/** Complete PDF: starts with %PDF- and ends with %%EOF (not a truncated download). */
function isValidCachedPdf(filePath: string): boolean {
  try {
    const st = statSync(filePath);
    if (st.size < 5000) return false;
    const fd = openSync(filePath, "r");
    try {
      const head = Buffer.alloc(5);
      readSync(fd, head, 0, 5, 0);
      if (head.toString("ascii") !== "%PDF-") return false;

      const tailLen = Math.min(8192, st.size);
      const tail = Buffer.alloc(tailLen);
      readSync(fd, tail, 0, tailLen, st.size - tailLen);
      return tail.includes(Buffer.from("%%EOF"));
    } finally {
      closeSync(fd);
    }
  } catch {
    return false;
  }
}

function extractConfirmToken(html: string): string | null {
  const patterns = [
    /confirm=([0-9A-Za-z_-]+)/,
    /name="confirm"\s+value="([^"]+)"/,
    /&amp;confirm=([0-9A-Za-z_-]+)/,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1] && m[1] !== "t") return m[1];
  }
  const uuid = html.match(
    /\/uc\?export=download[^"']*confirm=([0-9A-Za-z_-]{8,})/
  );
  return uuid?.[1] ?? null;
}

function fileResponse(filePath: string, rangeHeader: string | null) {
  const stat = statSync(filePath);
  const total = stat.size;

  if (rangeHeader) {
    const match = /bytes=(\d+)-(\d*)/.exec(rangeHeader);
    if (match) {
      const start = Number(match[1]);
      const end = match[2]
        ? Number(match[2])
        : Math.min(start + 1024 * 1024 - 1, total - 1);
      const chunkSize = end - start + 1;
      const nodeStream = createReadStream(filePath, { start, end });
      const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;

      return new NextResponse(webStream, {
        status: 206,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Length": String(chunkSize),
          "Content-Range": `bytes ${start}-${end}/${total}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=604800, immutable",
        },
      });
    }
  }

  const nodeStream = createReadStream(filePath);
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;
  return new NextResponse(webStream, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(total),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=604800, immutable",
    },
  });
}

async function fetchDriveOnce(url: string) {
  return fetch(url, {
    headers: { "User-Agent": UA },
    redirect: "follow",
  });
}

async function fetchFromDrive(fileId: string) {
  let lastError = "PDF fetch failed";

  async function tryUrls(confirm?: string) {
    for (const url of driveDownloadUrls(fileId, confirm)) {
      try {
        const res = await fetchDriveOnce(url);
        if (!res.ok || !res.body) {
          lastError = `Drive status ${res.status}`;
          continue;
        }

        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("text/html")) {
          const html = await res.text();
          lastError = "Drive returned HTML (check sharing)";
          const token = extractConfirmToken(html);
          if (token && !confirm) {
            return tryUrls(token);
          }
          if (
            html.includes("Sign in") ||
            html.includes("Accounts") ||
            html.includes("denied")
          ) {
            lastError = "Drive file not public (set Anyone with the link)";
          }
          continue;
        }

        return res;
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Network error";
      }
    }
    return null;
  }

  const res = await tryUrls();
  if (!res) throw new Error(lastError);
  return res;
}

/** Download fully to disk, validate %%EOF, then serve from cache. */
async function downloadAndCache(fileId: string, filePath: string) {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

  const res = await fetchFromDrive(fileId);
  if (!res.body) throw new Error("Empty Drive body");

  const tmpPath = `${filePath}.part`;
  try {
    if (existsSync(tmpPath)) unlinkSync(tmpPath);
  } catch {
    // ignore
  }

  const nodeIn = Readable.fromWeb(
    res.body as unknown as import("stream/web").ReadableStream
  );
  await pipeline(nodeIn, createWriteStream(tmpPath));

  if (!isValidCachedPdf(tmpPath)) {
    try {
      unlinkSync(tmpPath);
    } catch {
      // ignore
    }
    throw new Error("Incomplete PDF download (retry)");
  }

  try {
    if (existsSync(filePath)) unlinkSync(filePath);
  } catch {
    // ignore
  }
  renameSync(tmpPath, filePath);
}

export async function GET(request: NextRequest) {
  const fileId = request.nextUrl.searchParams.get("id")?.trim();
  if (!fileId || !/^[a-zA-Z0-9_-]{10,}$/.test(fileId)) {
    return NextResponse.json({ error: "Invalid file id" }, { status: 400 });
  }

  try {
    const filePath = cachePath(fileId);
    if (existsSync(filePath)) {
      if (isValidCachedPdf(filePath)) {
        return fileResponse(filePath, request.headers.get("range"));
      }
      try {
        unlinkSync(filePath);
      } catch {
        // ignore
      }
    }

    await downloadAndCache(fileId, filePath);
    return fileResponse(filePath, request.headers.get("range"));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "PDF fetch failed" },
      { status: 502 }
    );
  }
}
