import { describe, it, expect } from "vitest";
import { pushSnapshot, getHistory, clearHistory } from "@/lib/draftHistory";

const base = { title: "T", summary: "S", body: "body" as const };

describe("draftHistory", () => {
  it("pushes a snapshot", () => {
    pushSnapshot("slug-a", base);
    expect(getHistory("slug-a")).toHaveLength(1);
  });

  it("dedupes identical consecutive snapshots", () => {
    pushSnapshot("slug-a", base);
    pushSnapshot("slug-a", base);
    pushSnapshot("slug-a", base);
    expect(getHistory("slug-a")).toHaveLength(1);
  });

  it("caps at 20 per slug", () => {
    for (let i = 0; i < 25; i++) {
      pushSnapshot("slug-a", { ...base, body: `body-${i}` });
    }
    const h = getHistory("slug-a");
    expect(h).toHaveLength(20);
    expect(h[0].body).toBe("body-24");
  });

  it("clears history for a slug", () => {
    pushSnapshot("slug-a", base);
    clearHistory("slug-a");
    expect(getHistory("slug-a")).toEqual([]);
  });

  it("isolates slugs", () => {
    pushSnapshot("a", base);
    pushSnapshot("b", { ...base, body: "other" });
    expect(getHistory("a")).toHaveLength(1);
    expect(getHistory("b")).toHaveLength(1);
    expect(getHistory("a")[0].body).toBe("body");
  });
});
