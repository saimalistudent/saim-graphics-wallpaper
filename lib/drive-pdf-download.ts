/** Download a public Google Drive PDF into a Buffer (server-only). */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function driveDownloadUrls(fileId: string, confirm?: string) {
  const c = confirm ? `&confirm=${encodeURIComponent(confirm)}` : "&confirm=t";
  return [
    `https://drive.usercontent.google.com/download?id=${fileId}&export=download${c}`,
    `https://drive.google.com/uc?export=download&id=${fileId}${c}`,
  ];
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
  return null;
}

function isPdfBuffer(buf: Buffer) {
  if (buf.byteLength < 5000) return false;
  if (buf.subarray(0, 5).toString("ascii") !== "%PDF-") return false;
  return buf.includes(Buffer.from("%%EOF"));
}

export async function downloadDrivePdfBuffer(fileId: string): Promise<Buffer> {
  const id = fileId.trim();
  if (!id || id.length < 10) {
    throw new Error("Invalid Drive file id");
  }

  let lastError = "PDF fetch failed";
  let confirm: string | undefined;

  for (let attempt = 0; attempt < 4; attempt++) {
    for (const url of driveDownloadUrls(id, confirm)) {
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": UA },
          redirect: "follow",
        });
        if (!res.ok || !res.body) {
          lastError = `Drive status ${res.status}`;
          continue;
        }

        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("text/html")) {
          const html = await res.text();
          lastError = "Drive returned HTML (check sharing)";
          const token = extractConfirmToken(html);
          if (token) {
            confirm = token;
            break;
          }
          continue;
        }

        const ab = await res.arrayBuffer();
        const buf = Buffer.from(ab);
        if (!isPdfBuffer(buf)) {
          lastError = "Incomplete PDF download";
          continue;
        }
        return buf;
      } catch (e) {
        lastError = e instanceof Error ? e.message : "Network error";
      }
    }
  }

  throw new Error(lastError);
}
