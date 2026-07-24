import { NextResponse } from "next/server";
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
import { PassThrough, Readable } from "stream";
import { pipeline } from "stream/promises";
import path from "path";

/** Netlify/Lambda only allow writes under /tmp; local uses project .pdf-cache */
const CACHE_DIR = path.join(
  process.env.NETLIFY === "true" || process.env.AWS_LAMBDA_FUNCTION_NAME
    ? "/tmp"
    : process.cwd(),
  ".pdf-cache"
);

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const FILE_ID_RE = /^[a-zA-Z0-9_-]{10,}$/;

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

function pdfHeaders(fileId: string, extra: Record<string, string> = {}) {
  return {
    "Content-Type": "application/pdf",
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    "Netlify-Vary": "query",
    "CDN-Cache-Control": "public, max-age=86400",
    "X-Drive-File-Id": fileId,
    ...extra,
  };
}

/** Cold stream: no Accept-Ranges so pdf.js uses progressive full download */
function coldStreamHeaders(fileId: string, contentLength: string | null) {
  const extra: Record<string, string> = {
    "Accept-Ranges": "none",
    "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
    "CDN-Cache-Control": "public, max-age=300",
  };
  if (contentLength) extra["Content-Length"] = contentLength;
  return pdfHeaders(fileId, extra);
}

function fileResponse(
  fileId: string,
  filePath: string,
  rangeHeader: string | null
) {
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
        headers: pdfHeaders(fileId, {
          "Content-Length": String(chunkSize),
          "Content-Range": `bytes ${start}-${end}/${total}`,
        }),
      });
    }
  }

  const nodeStream = createReadStream(filePath);
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;
  return new NextResponse(webStream, {
    status: 200,
    headers: pdfHeaders(fileId, {
      "Content-Length": String(total),
    }),
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

/**
 * Stream Drive PDF to the client immediately while writing /tmp cache.
 * First byte reaches the phone without waiting for the full Drive download.
 */
function streamAndCache(
  fileId: string,
  filePath: string,
  driveRes: Response
): NextResponse {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  if (!driveRes.body) throw new Error("Empty Drive body");

  const tmpPath = `${filePath}.part`;
  try {
    if (existsSync(tmpPath)) unlinkSync(tmpPath);
  } catch {
    // ignore
  }

  const nodeIn = Readable.fromWeb(
    driveRes.body as unknown as import("stream/web").ReadableStream
  );
  const forClient = new PassThrough();
  const forDisk = new PassThrough();

  nodeIn.on("data", (chunk: Buffer) => {
    forClient.write(chunk);
    forDisk.write(chunk);
  });
  nodeIn.on("end", () => {
    forClient.end();
    forDisk.end();
  });
  nodeIn.on("error", (err) => {
    forClient.destroy(err);
    forDisk.destroy(err);
  });

  void pipeline(forDisk, createWriteStream(tmpPath))
    .then(() => {
      if (!isValidCachedPdf(tmpPath)) {
        try {
          unlinkSync(tmpPath);
        } catch {
          // ignore
        }
        return;
      }
      try {
        if (existsSync(filePath)) unlinkSync(filePath);
      } catch {
        // ignore
      }
      try {
        renameSync(tmpPath, filePath);
      } catch {
        // ignore
      }
    })
    .catch(() => {
      try {
        unlinkSync(tmpPath);
      } catch {
        // ignore
      }
    });

  const contentLength = driveRes.headers.get("content-length");
  const webStream = Readable.toWeb(forClient) as unknown as ReadableStream;

  return new NextResponse(webStream, {
    status: 200,
    headers: coldStreamHeaders(fileId, contentLength),
  });
}

export async function headDrivePdf(fileId: string) {
  if (!fileId || !FILE_ID_RE.test(fileId)) {
    return NextResponse.json({ error: "Invalid file id" }, { status: 400 });
  }

  try {
    const filePath = cachePath(fileId);
    if (existsSync(filePath) && isValidCachedPdf(filePath)) {
      const total = statSync(filePath).size;
      return new NextResponse(null, {
        status: 200,
        headers: pdfHeaders(fileId, {
          "Content-Length": String(total),
        }),
      });
    }

    // Unknown size until cached — signal "small enough to prefetch" conservatively
    return new NextResponse(null, {
      status: 200,
      headers: pdfHeaders(fileId, {
        "Content-Length": "0",
        "Cache-Control": "no-store",
        "CDN-Cache-Control": "no-store",
      }),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "HEAD failed" },
      { status: 502 }
    );
  }
}

export async function serveDrivePdf(
  fileId: string,
  rangeHeader: string | null
) {
  if (!fileId || !FILE_ID_RE.test(fileId)) {
    return NextResponse.json({ error: "Invalid file id" }, { status: 400 });
  }

  try {
    const filePath = cachePath(fileId);
    if (existsSync(filePath)) {
      if (isValidCachedPdf(filePath)) {
        return fileResponse(fileId, filePath, rangeHeader);
      }
      try {
        unlinkSync(filePath);
      } catch {
        // ignore
      }
    }

    // Cold open: stream to client while caching.
    // Ignore Range so first bytes aren't blocked by a full Drive download.
    const driveRes = await fetchFromDrive(fileId);
    return streamAndCache(fileId, filePath, driveRes);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "PDF fetch failed" },
      { status: 502 }
    );
  }
}
