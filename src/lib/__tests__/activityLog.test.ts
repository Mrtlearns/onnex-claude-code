import { describe, it, expect } from "vitest";
import { logActivity, getActivity, clearActivity } from "@/lib/activityLog";

describe("activityLog", () => {
  it("logs and retrieves entries newest-first", () => {
    logActivity({ slug: "a", title: "A", summary: "", scope: "single", body: "first" });
    logActivity({ slug: "b", title: "B", summary: "", scope: "single", body: "second" });
    const rows = getActivity();
    expect(rows).toHaveLength(2);
    expect(rows[0].slug).toBe("b");
    expect(rows[1].slug).toBe("a");
  });

  it("derives bodyPreview from string body", () => {
    logActivity({ slug: "x", title: "X", summary: "", scope: "single", body: "hello world" });
    expect(getActivity()[0].bodyPreview).toBe("hello world");
  });

  it("caps at 200 entries", () => {
    for (let i = 0; i < 250; i++) {
      logActivity({ slug: `s${i}`, title: `T${i}`, summary: "", scope: "single", body: "" });
    }
    const rows = getActivity();
    expect(rows).toHaveLength(200);
    expect(rows[0].slug).toBe("s249");
  });

  it("clears", () => {
    logActivity({ slug: "a", title: "A", summary: "", scope: "single", body: "" });
    clearActivity();
    expect(getActivity()).toEqual([]);
  });
});
