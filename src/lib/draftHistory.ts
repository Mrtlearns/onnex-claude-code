/**
 * Per-lesson draft snapshot store. Keeps the last N autosaves per slug
 * so the editor can show a version history and restore prior states.
 */

import type { LessonBody } from "@/content/lessons";

const KEY = "vci.draft-history.v1";
const MAX_PER_SLUG = 20;

export interface Snapshot {
  id: string;
  at: number;
  title: string;
  summary: string;
  body: LessonBody;
  /** Marker for snapshots taken right after a successful publish. */
  publishedMarker?: boolean;
}

type HistoryMap = Record<string, Snapshot[]>;

type Listener = () => void;
const listeners = new Set<Listener>();
const notify = () => listeners.forEach((l) => l());

const read = (): HistoryMap => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as HistoryMap) : {};
  } catch {
    return {};
  }
};
const write = (m: HistoryMap) => {
  localStorage.setItem(KEY, JSON.stringify(m));
  notify();
};

const newId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const sameBody = (a: LessonBody, b: LessonBody): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

export const pushSnapshot = (
  slug: string,
  data: { title: string; summary: string; body: LessonBody; publishedMarker?: boolean },
) => {
  const m = read();
  const list = m[slug] ?? [];
  const last = list[0];
  if (
    last &&
    last.title === data.title &&
    last.summary === data.summary &&
    sameBody(last.body, data.body) &&
    !!last.publishedMarker === !!data.publishedMarker
  ) {
    return; // dedupe identical
  }
  const snap: Snapshot = {
    id: newId(),
    at: Date.now(),
    title: data.title,
    summary: data.summary,
    body: data.body,
    publishedMarker: data.publishedMarker,
  };
  m[slug] = [snap, ...list].slice(0, MAX_PER_SLUG);
  write(m);
};

export const getHistory = (slug: string): Snapshot[] => read()[slug] ?? [];

export const clearHistory = (slug: string) => {
  const m = read();
  delete m[slug];
  write(m);
};

export const subscribeDraftHistory = (l: Listener) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
