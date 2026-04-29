import { useEffect, useState } from "react";
import type { OS } from "@/context/OSContext";
import { lessons as defaultLessons, type Lesson, type LessonBody, bodyFor } from "@/content/lessons";

/**
 * Content overlay store.
 *
 * Lessons defined in `src/content/lessons.ts` are the baseline. Admin edits
 * are stored as a per-slug overlay in localStorage so the source file stays
 * clean and easy to edit by hand.
 */

const KEY = "vci.content.overrides.v1";

export type LessonOverride = Partial<Pick<Lesson, "title" | "summary" | "body">>;
export type Overrides = Record<string, LessonOverride>;

type Listener = () => void;
const listeners = new Set<Listener>();

const read = (): Overrides => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Overrides) : {};
  } catch {
    return {};
  }
};

const write = (o: Overrides) => {
  localStorage.setItem(KEY, JSON.stringify(o));
  listeners.forEach((l) => l());
};

export const getOverrides = read;

export const setLessonOverride = (slug: string, patch: LessonOverride) => {
  const o = read();
  o[slug] = { ...o[slug], ...patch };
  write(o);
};

export const clearLessonOverride = (slug: string) => {
  const o = read();
  delete o[slug];
  write(o);
};

export const clearAllOverrides = () => write({});

export const exportOverrides = () => JSON.stringify(read(), null, 2);

export const importOverrides = (json: string) => {
  const parsed = JSON.parse(json);
  if (typeof parsed !== "object" || parsed === null) throw new Error("Invalid JSON");
  write(parsed as Overrides);
};

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
  return () => listeners.delete(l);
};

/** Hook returning lessons with overrides applied; re-renders on edits. */
export const useLessons = (): Lesson[] => {
  const [, setTick] = useState(0);
  useEffect(() => subscribe(() => setTick((t) => t + 1)), []);
  const o = read();
  return defaultLessons.map((l) => merge(l, o[l.slug]));
};

export const useLesson = (slug: string): Lesson | undefined => {
  const all = useLessons();
  return all.find((l) => l.slug === slug);
};

export { bodyFor };
