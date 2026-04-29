/**
 * IndexedDB-backed image store.
 *
 * Images are saved as Blobs under a stable id and referenced in markdown via
 * the custom URL scheme `lov-img://<id>`. At render time, we resolve those ids
 * to short-lived blob URLs (object URLs) using `useResolvedMarkdown`.
 */

const DB_NAME = "vci-assets";
const STORE = "images";
const VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;
const getDB = () => {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
};

type StoredImage = { id: string; name: string; type: string; blob: Blob; createdAt: number };

export type AssetMeta = {
  id: string;
  name: string;
  type: string;
  size: number;
  createdAt: number;
};

type AssetListener = () => void;
const assetListeners = new Set<AssetListener>();
const notifyAssets = () => assetListeners.forEach((l) => l());
export const subscribeAssets = (l: AssetListener) => {
  assetListeners.add(l);
  return () => {
    assetListeners.delete(l);
  };
};

const tx = async <T,>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

const newId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const saveImage = async (file: File): Promise<string> => {
  const id = newId();
  const record: StoredImage = {
    id,
    name: file.name,
    type: file.type || "application/octet-stream",
    blob: file,
    createdAt: Date.now(),
  };
  await tx("readwrite", (s) => s.put(record));
  return `lov-img://${id}`;
};

export const getImage = async (id: string): Promise<StoredImage | undefined> => {
  return (await tx("readonly", (s) => s.get(id))) as StoredImage | undefined;
};

// Cache so we don't recreate object URLs every render.
const urlCache = new Map<string, string>();

export const resolveImageUrl = async (id: string): Promise<string | null> => {
  if (urlCache.has(id)) return urlCache.get(id)!;
  const rec = await getImage(id);
  if (!rec) return null;
  const url = URL.createObjectURL(rec.blob);
  urlCache.set(id, url);
  return url;
};

/** Replace `lov-img://<id>` occurrences with resolved blob URLs in a markdown string. */
export const resolveMarkdownImages = async (md: string): Promise<string> => {
  const ids = Array.from(md.matchAll(/lov-img:\/\/([a-z0-9-]+)/gi)).map((m) => m[1]);
  if (ids.length === 0) return md;
  const unique = Array.from(new Set(ids));
  const map = new Map<string, string>();
  await Promise.all(
    unique.map(async (id) => {
      const url = await resolveImageUrl(id);
      if (url) map.set(id, url);
    }),
  );
  return md.replace(/lov-img:\/\/([a-z0-9-]+)/gi, (full, id) => map.get(id) ?? full);
};
