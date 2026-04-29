/**
 * Append-only publish activity log, persisted in localStorage.
 * Capped at MAX entries (FIFO). Reactive subscribers are notified on writes.
 */

const KEY = "vci.activity.v1";
const MAX = 200;

export type ActivityScope = "single" | "all" | "batch-item";

export interface ActivityEntry {
  id: string;
  at: number;
  slug: string;
  title: string;
  summary: string;
  bodyPreview: string;
  scope: ActivityScope;
  /** For "all" entries: number of lessons promoted in the batch. */
  count?: number;
}

type Listener = () => void;
const listeners = new Set<Listener>();
const notify = () => listeners.forEach((l) => l());

const read = (): ActivityEntry[] => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ActivityEntry[]) : [];
  } catch {
    return [];
  }
};
const write = (rows: ActivityEntry[]) => {
  localStorage.setItem(KEY, JSON.stringify(rows));
  notify();
};

const newId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const previewOf = (body: unknown): string => {
  if (typeof body === "string") return body.slice(0, 240);
  if (body && typeof body === "object") {
    const v = Object.values(body as Record<string, unknown>).find(
      (x) => typeof x === "string",
    );
    return typeof v === "string" ? v.slice(0, 240) : "";
  }
  return "";
};

export const logActivity = (
  e: Omit<ActivityEntry, "id" | "at" | "bodyPreview"> & { body?: unknown; bodyPreview?: string },
) => {
  const rows = read();
  const entry: ActivityEntry = {
    id: newId(),
    at: Date.now(),
    slug: e.slug,
    title: e.title,
    summary: e.summary,
    bodyPreview: e.bodyPreview ?? previewOf(e.body),
    scope: e.scope,
    count: e.count,
  };
  rows.unshift(entry);
  write(rows.slice(0, MAX));
};

export const getActivity = () => read();

export const clearActivity = () => write([]);

export const subscribeActivity = (l: Listener) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
