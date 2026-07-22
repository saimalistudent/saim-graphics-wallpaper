const https = require("https");
const fs = require("fs");
const path = require("path");

const folderId = "1VbtoWPZldVhzjexxZ5uGsscjAYraxSH4";
const outJson = path.join(__dirname, "seed-data.json");
const outHtml = path.join(__dirname, "drive-folder-raw.html");

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept: "text/html,application/xhtml+xml",
            "Accept-Language": "en-US,en;q=0.9",
          },
        },
        (res) => {
          let data = "";
          res.on("data", (c) => (data += c));
          res.on("end", () =>
            resolve({ status: res.statusCode, headers: res.headers, body: data })
          );
        }
      )
      .on("error", reject);
  });
}

function cleanTitle(name) {
  return name
    .replace(/\.pdf$/i, "")
    .replace(/\s+ok$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchBody(url, redirects = 0) {
  const res = await get(url);
  if (
    redirects < 5 &&
    [301, 302, 303, 307, 308].includes(res.status) &&
    res.headers.location
  ) {
    const next = res.headers.location.startsWith("http")
      ? res.headers.location
      : `https://drive.google.com${res.headers.location}`;
    return fetchBody(next, redirects + 1);
  }
  return res;
}

function extractFiles(html) {
  const map = new Map();

  // Prefer precise pairs: "Something.pdf" ... "FILE_ID"
  const pairRe =
    /"([^"]+\.pdf)"[\s\S]{0,800}?"([a-zA-Z0-9_-]{25,80})"/gi;
  let m;
  while ((m = pairRe.exec(html))) {
    const title = m[1];
    const id = m[2];
    if (id === folderId) continue;
    if (!map.has(id)) map.set(id, title);
  }

  // Fallback for escaped JSON blobs: \x22name.pdf\x22 ... \x22id\x22
  const escRe =
    /\\x22([^\\]+?\.pdf)\\x22[\s\S]{0,800}?\\x22([a-zA-Z0-9_-]{25,80})\\x22/gi;
  while ((m = escRe.exec(html))) {
    const title = m[1];
    const id = m[2];
    if (id === folderId) continue;
    if (!map.has(id)) map.set(id, title);
  }

  // Another common pattern in Drive HTML: null,"filename.pdf" ... ,"FILEID"
  const altRe =
    /,"([^"]+\.pdf)",\d+,\d+[\s\S]{0,200}?,\"([a-zA-Z0-9_-]{25,80})\"/gi;
  while ((m = altRe.exec(html))) {
    const title = m[1];
    const id = m[2];
    if (id === folderId) continue;
    if (!map.has(id)) map.set(id, title);
  }

  return [...map.entries()].map(([drive_file_id, title]) => ({
    title: cleanTitle(title),
    drive_file_id,
    thumbnail_url: `https://lh3.googleusercontent.com/d/${drive_file_id}=w1200`,
  }));
}

(async () => {
  const url = `https://drive.google.com/drive/folders/${folderId}?usp=sharing`;
  const { status, body } = await fetchBody(url);
  fs.writeFileSync(outHtml, body);
  console.log("HTTP", status, "bytes", body.length);

  let files = extractFiles(body);
  console.log("parsed", files.length);

  if (files.length < 10) {
    // Try keyless Drive API for public folders
    const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
    const api =
      `https://www.googleapis.com/drive/v3/files?q=${q}` +
      `&fields=files(id,name,mimeType)&pageSize=100`;
    try {
      const apiRes = await fetchBody(api);
      console.log("API status", apiRes.status);
      const json = JSON.parse(apiRes.body);
      if (json.files) {
        files = json.files
          .filter((f) => /pdf/i.test(f.name) || f.mimeType === "application/pdf")
          .map((f) => ({
            title: cleanTitle(f.name),
            drive_file_id: f.id,
            thumbnail_url: `https://lh3.googleusercontent.com/d/${f.id}=w1200`,
          }));
        console.log("API files", files.length);
      } else {
        console.log("API body sample", apiRes.body.slice(0, 300));
      }
    } catch (e) {
      console.log("API failed", e.message);
    }
  }

  files.sort((a, b) => a.title.localeCompare(b.title));
  fs.writeFileSync(outJson, JSON.stringify(files, null, 2));
  console.log("Wrote", outJson);
  console.log(files.slice(0, 3));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
