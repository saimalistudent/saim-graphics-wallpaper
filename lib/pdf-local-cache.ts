/** Client-side IndexedDB cache so reopened PDFs open instantly on the same device. */

const DB_NAME = "saim-pdf-cache-v3";
const STORE = "pdfs";
const DB_VERSION = 1;
/** Keep recent catalogs; allow a couple of large (~35MB) files like crown room */
const MAX_BYTES = 280 * 1024 * 1024;
const MAX_ENTRIES = 16;

type PdfCacheRecord = {
  id: string;
  data: ArrayBuffer;
  size: number;
  updatedAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IDB open failed"));
  });
}

function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IDB request failed"));
  });
}

/** True if buffer starts with %PDF- (enough to open; server validates full file). */
export function isPdfBuffer(data: ArrayBuffer): boolean {
  if (!data || data.byteLength < 1000) return false;
  const head = new Uint8Array(data, 0, Math.min(5, data.byteLength));
  return (
    head[0] === 0x25 &&
    head[1] === 0x50 &&
    head[2] === 0x44 &&
    head[3] === 0x46 &&
    head[4] === 0x2d
  );
}

async function listRecords(db: IDBDatabase): Promise<PdfCacheRecord[]> {
  const tx = db.transaction(STORE, "readonly");
  const store = tx.objectStore(STORE);
  const all = await idbReq(store.getAll() as IDBRequest<PdfCacheRecord[]>);
  return all ?? [];
}

async function evictIfNeeded(db: IDBDatabase, incomingSize: number) {
  const records = await listRecords(db);
  let total = records.reduce((sum, r) => sum + (r.size || 0), 0) + incomingSize;

  records.sort((a, b) => a.updatedAt - b.updatedAt);

  while (
    (total > MAX_BYTES || records.length >= MAX_ENTRIES) &&
    records.length > 0
  ) {
    const oldest = records.shift();
    if (!oldest) break;
    total -= oldest.size || 0;
    const tx = db.transaction(STORE, "readwrite");
    await idbReq(tx.objectStore(STORE).delete(oldest.id));
  }
}

export async function getCachedPdf(
  fileId: string
): Promise<ArrayBuffer | null> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const row = await idbReq(
      store.get(fileId) as IDBRequest<PdfCacheRecord | undefined>
    );
    if (!row?.data) return null;

    if (!isPdfBuffer(row.data)) {
      await idbReq(store.delete(fileId));
      return null;
    }

    row.updatedAt = Date.now();
    await idbReq(store.put(row));
    return row.data;
  } catch {
    return null;
  }
}

export async function removeCachedPdf(fileId: string): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, "readwrite");
    await idbReq(tx.objectStore(STORE).delete(fileId));
  } catch {
    // ignore
  }
}

export async function setCachedPdf(
  fileId: string,
  data: ArrayBuffer
): Promise<void> {
  try {
    if (!fileId || !isPdfBuffer(data)) return;
    const db = await openDb();
    await evictIfNeeded(db, data.byteLength);
    const record: PdfCacheRecord = {
      id: fileId,
      data,
      size: data.byteLength,
      updatedAt: Date.now(),
    };
    const tx = db.transaction(STORE, "readwrite");
    await idbReq(tx.objectStore(STORE).put(record));
  } catch {
    // Quota / private mode — ignore; network path still works
  }
}

export async function fetchPdfWithProgress(
  url: string,
  onProgress: (loaded: number, total: number) => void,
  signal?: AbortSignal
): Promise<ArrayBuffer> {
  const res = await fetch(url, {
    signal,
    // Prefer cache when warm, but allow network if missing
    cache: "default",
  });
  if (!res.ok) {
    throw new Error(`PDF fetch failed (${res.status})`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("text/html") || contentType.includes("application/json")) {
    throw new Error("Invalid PDF response");
  }

  const total = Number(res.headers.get("content-length") || 0);
  if (!res.body) {
    const buf = await res.arrayBuffer();
    if (!isPdfBuffer(buf)) throw new Error("Not a PDF");
    onProgress(buf.byteLength, buf.byteLength);
    return buf;
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loaded += value.byteLength;
      onProgress(loaded, total || loaded);
    }
  }

  const out = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }

  // Exact slice — out.buffer alone can be wrong on some engines
  const exact = out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
  if (!isPdfBuffer(exact)) {
    throw new Error("Not a PDF");
  }

  return exact;
}
