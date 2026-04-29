import { useEffect, useState } from "react";
import type { OS } from "@/context/OSContext";
import { lessons as defaultLessons, type Lesson, type LessonBody, bodyFor } from "@/content/lessons";

/**
 * Two-layer content store:
 *   - PUBLISHED: what visitors see on /lessons and /lessons/:slug
 *   - DRAFT:     what the admin editor reads/writes; promoted on Publish
 *
 * Both are stored in localStorage as `slug -> partial Lesson` overlays
 * on top of the source-of-truth in src/content/lessons.ts.
 */

const PUB_KEY = "vci.content.published.v1";
const DRAFT_KEY = "vci.content.draft.v1";

export type LessonOverride = Partial<Pick<Lesson, "title" | "summary" | "body">>;
export type Overrides = Record<string, LessonOverride>;

type Listener = () => void;
const listeners = new Set<Listener>();
const notify = () => listeners.forEach((l) => l());

const readKey = (key: string): Overrides => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Overrides) : {};
  } catch {
    return {};
  }
};
const writeKey = (key: string, o: Overrides) => {
  localStorage.setItem(key, JSON.stringify(o));
  notify();
};

// ---------- Published layer ----------
export const getPublished = () => readKey(PUB_KEY);

// ---------- Draft layer ----------
export const getDrafts = () => readKey(DRAFT_KEY);

export const setDraft = (slug: string, patch: LessonOverride) => {
  const o = readKey(DRAFT_KEY);
  o[slug] = { ...o[slug], ...patch };
  writeKey(DRAFT_KEY, o);
};

export const setManyDrafts = (patches: Record<string, LessonOverride>) => {
  const o = readKey(DRAFT_KEY);
  for (const [slug, patch] of Object.entries(patches)) {
    o[slug] = { ...o[slug], ...patch };
  }
  writeKey(DRAFT_KEY, o);
};

export const discardDraft = (slug: string) => {
  const o = readKey(DRAFT_KEY);
  delete o[slug];
  writeKey(DRAFT_KEY, o);
};

export const discardAllDrafts = () => writeKey(DRAFT_KEY, {});

/** Promote one or all drafts to the published layer. */
export const publishDraft = (slug?: string) => {
  const drafts = readKey(DRAFT_KEY);
  const pub = readKey(PUB_KEY);
  if (slug) {
    if (drafts[slug]) {
      pub[slug] = { ...pub[slug], ...drafts[slug] };
      delete drafts[slug];
    }
  } else {
    for (const [s, patch] of Object.entries(drafts)) {
      pub[s] = { ...pub[s], ...patch };
    }
    for (const s of Object.keys(drafts)) delete drafts[s];
  }
  writeKey(PUB_KEY, pub);
  writeKey(DRAFT_KEY, drafts);
};

// ---------- Import / export ----------
export const exportPublished = () => JSON.stringify(readKey(PUB_KEY), null, 2);

export const importPublished = (json: string) => {
  const parsed = JSON.parse(json);
  if (typeof parsed !== "object" || parsed === null) throw new Error("Invalid JSON");
  writeKey(PUB_KEY, parsed as Overrides);
};

// ---------- Merge helpers ----------
const merge = (l: Lesson, o?: LessonOverride): Lesson => {
  if (!o) return l;
  return {
    ...l,
    title: o.title ?? l.title,
    summary: o.summary ?? l.summary,
    body: (o.body ?? l.body) as LessonBody,
  };
};

export const subscribe = (l: Listener) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

const useStoreTick = () => {
  const [, setTick] = useState(0);
  useEffect(() => {
    const unsub = subscribe(() => setTick((t) => t + 1));
    return () => {
      unsub();
    };
  }, []);
};

/** Public-facing: lessons with PUBLISHED overrides applied. */
export const useLessons = (): Lesson[] => {
  useStoreTick();
  const o = readKey(PUB_KEY);
  return defaultLessons.map((l) => merge(l, o[l.slug]));
};

/** Synchronous snapshot of draft-on-published-on-default lessons (no React). */
export const getDraftLessonsSnapshot = (): Lesson[] => {
  const pub = readKey(PUB_KEY);
  const draft = readKey(DRAFT_KEY);
  return defaultLessons.map((l) => merge(merge(l, pub[l.slug]), draft[l.slug]));
};

/** Admin-facing: lessons with DRAFT-on-top-of-PUBLISHED applied. */
export const useDraftLessons = (): Lesson[] => {
  useStoreTick();
  const pub = readKey(PUB_KEY);
  const draft = readKey(DRAFT_KEY);
  return defaultLessons.map((l) => merge(merge(l, pub[l.slug]), draft[l.slug]));
};

export const useLesson = (slug: string): Lesson | undefined =>
  useLessons().find((l) => l.slug === slug);

/** Reactive set of slugs that have pending draft changes. */
export const usePendingSlugs = (): Set<string> => {
  useStoreTick();
  return new Set(Object.keys(readKey(DRAFT_KEY)));
};

export { bodyFor };
