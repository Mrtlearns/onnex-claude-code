import { describe, it, expect } from "vitest";
import { setDraft, publishDraft, discardAllDrafts } from "@/content/contentStore";
import { computeAssetUsage, computeReferencedIds } from "@/lib/assetUsage";
import { lessons } from "@/content/lessons";

describe("assetUsage", () => {
  it("returns empty when no overrides reference any assets", () => {
    expect(computeReferencedIds().size).toBe(0);
  });

  it("detects asset references in a draft", () => {
    const slug = lessons[0].slug;
    setDraft(slug, { body: "see ![](lov-img://abc-123) here" });
    const ids = computeReferencedIds();
    expect(ids.has("abc-123")).toBe(true);
  });

  it("detects references from the published layer", () => {
    const slug = lessons[0].slug;
    setDraft(slug, { body: "ref lov-img://pub-9 inline" });
    publishDraft(slug);
    const usage = computeAssetUsage();
    expect(usage.has("pub-9")).toBe(true);
  });

  it("draft body shadows published body for usage scan", () => {
    const slug = lessons[0].slug;
    setDraft(slug, { body: "lov-img://OLD" });
    publishDraft(slug);
    setDraft(slug, { body: "lov-img://NEW" });
    const ids = computeReferencedIds();
    expect(ids.has("NEW")).toBe(true);
    expect(ids.has("OLD")).toBe(false);
    discardAllDrafts();
  });
});
