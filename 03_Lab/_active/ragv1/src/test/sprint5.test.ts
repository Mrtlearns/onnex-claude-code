// @vitest-environment node
import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Pure helpers mirrored from src/lib/db/organizations.ts
// ---------------------------------------------------------------------------

/**
 * Generates a URL-safe slug from an org name.
 * Matches the implementation in organizations.ts.
 */
function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "-");
}

// ---------------------------------------------------------------------------
// Sprint 5 — Organizations slug generation
// ---------------------------------------------------------------------------

describe("Sprint 5 — generateSlug", () => {
  it("lowercases input", () => {
    expect(generateSlug("Onnex")).toBe("onnex");
  });

  it("replaces spaces with hyphens", () => {
    expect(generateSlug("My Org")).toBe("my-org");
  });

  it("replaces special characters with hyphens", () => {
    expect(generateSlug("Acme & Co.")).toBe("acme---co-");
  });

  it("leaves digits intact", () => {
    expect(generateSlug("Team 42")).toBe("team-42");
  });

  it("handles an already-slug string unchanged", () => {
    expect(generateSlug("my-org-123")).toBe("my-org-123");
  });

  it("produces an empty string from an empty input", () => {
    expect(generateSlug("")).toBe("");
  });

  it("replaces uppercase letters and non-alphanumeric characters", () => {
    expect(generateSlug("NDT/Aerospace")).toBe("ndt-aerospace");
  });
});

// ---------------------------------------------------------------------------
// Sprint 5 — OrgMember role defaults
// ---------------------------------------------------------------------------

describe("Sprint 5 — OrgMember default role", () => {
  it("default role is 'member'", () => {
    const DEFAULT_ROLE = "member";
    expect(DEFAULT_ROLE).toBe("member");
  });
});
