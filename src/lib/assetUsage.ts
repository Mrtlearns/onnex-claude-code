/**
 * Scan all draft + published lesson bodies for `lov-img://<id>` references
 * to determine which uploaded assets are actually referenced.
 */

import { lessons as defaultLessons, bodyFor, type LessonBody } from "@/content/lessons";
import { getDrafts, getPublished } from "@/content/contentStore";

const RE = /lov-img:\/\/([a-z0-9-]+)/gi;

const collectFromBody = (body: LessonBody, into: Map<string, Set<string>>, lessonTitle: string) => {
  const texts: string[] = [];
  if (typeof body === "string") texts.push(body);
  else for (const v of Object.values(body)) if (typeof v === "string") texts.push(v);
  for (const t of texts) {
    for (const m of t.matchAll(RE)) {
      const id = m[1];
      if (!into.has(id)) into.set(id, new Set());
      into.get(id)!.add(lessonTitle);
    }
  }
};

/**
 * Returns a map of assetId → set of lesson titles that reference it
 * (in either the draft or published layer).
 */
export const computeAssetUsage = (): Map<string, Set<string>> => {
  const drafts = getDrafts();
  const pub = getPublished();
  const usage = new Map<string, Set<string>>();
  for (const l of defaultLessons) {
    const overlay = drafts[l.slug] ?? pub[l.slug];
    const body = (overlay?.body as LessonBody | undefined) ?? l.body;
    const title = overlay?.title ?? l.title;
    collectFromBody(body, usage, title);
  }
  return usage;
};

/** Convenience: just a Set of referenced ids. */
export const computeReferencedIds = (): Set<string> =>
  new Set(computeAssetUsage().keys());

/** Lightweight body scan helper used by previews. */
export const bodyTextSample = (body: LessonBody, os: "mac" | "windows" | "linux" = "mac") =>
  bodyFor(body, os);
