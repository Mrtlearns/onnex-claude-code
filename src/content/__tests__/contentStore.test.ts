import { describe, it, expect } from "vitest";
import {
  setDraft,
  getDrafts,
  discardDraft,
  publishDraft,
  getPublished,
  exportPublished,
  importPublished,
  getDraftLessonsSnapshot,
} from "@/content/contentStore";
import { lessons } from "@/content/lessons";

const slug = lessons[0].slug;

describe("contentStore", () => {
  it("setDraft stores partial overrides", () => {
    setDraft(slug, { title: "New Title" });
    expect(getDrafts()[slug]).toEqual({ title: "New Title" });
  });

  it("discardDraft removes the override", () => {
    setDraft(slug, { title: "X" });
    discardDraft(slug);
    expect(getDrafts()[slug]).toBeUndefined();
  });

  it("publishDraft promotes a single slug", () => {
    setDraft(slug, { title: "Promoted" });
    publishDraft(slug);
    expect(getDrafts()[slug]).toBeUndefined();
    expect(getPublished()[slug]).toEqual({ title: "Promoted" });
  });

  it("publishDraft() with no slug promotes all drafts", () => {
    const second = lessons[1].slug;
    setDraft(slug, { title: "A" });
    setDraft(second, { title: "B" });
    publishDraft();
    expect(getDrafts()).toEqual({});
    expect(getPublished()[slug]?.title).toBe("A");
    expect(getPublished()[second]?.title).toBe("B");
  });

  it("snapshot merges draft on top of published on top of default", () => {
    setDraft(slug, { title: "Pub" });
    publishDraft(slug);
    setDraft(slug, { title: "Draft" });
    const snap = getDraftLessonsSnapshot();
    expect(snap.find((l) => l.slug === slug)?.title).toBe("Draft");
  });

  it("export/import round-trip", () => {
    setDraft(slug, { title: "RoundTrip" });
    publishDraft(slug);
    const json = exportPublished();
    importPublished(JSON.stringify({}));
    expect(getPublished()[slug]).toBeUndefined();
    importPublished(json);
    expect(getPublished()[slug]?.title).toBe("RoundTrip");
  });
});
