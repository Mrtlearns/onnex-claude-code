// apps/web/src/__tests__/auth.test.ts
// GREEN phase — real tests after lib/rbac.ts implementation

import { describe, it, expect } from "vitest"
import { mapGroupsToRole, canAccess } from "@/lib/rbac"

describe("mapGroupsToRole", () => {
  it("maps aios-super-admins to super_admin", () => {
    expect(mapGroupsToRole(["aios-super-admins"])).toBe("super_admin")
  })
  it("maps aios-admins to admin", () => {
    expect(mapGroupsToRole(["aios-admins"])).toBe("admin")
  })
  it("maps aios-managers to manager", () => {
    expect(mapGroupsToRole(["aios-managers"])).toBe("manager")
  })
  it("maps aios-finance to finance", () => {
    expect(mapGroupsToRole(["aios-finance"])).toBe("finance")
  })
  it("maps aios-team to team_member", () => {
    expect(mapGroupsToRole(["aios-team"])).toBe("team_member")
  })
  it("maps aios-contractors to contractor", () => {
    expect(mapGroupsToRole(["aios-contractors"])).toBe("contractor")
  })
  it("maps aios-clients to client_viewer", () => {
    expect(mapGroupsToRole(["aios-clients"])).toBe("client_viewer")
  })
  it("returns team_member as safe default for empty groups", () => {
    expect(mapGroupsToRole([])).toBe("team_member")
  })
  it("returns highest-privilege role when user is in multiple groups", () => {
    expect(mapGroupsToRole(["aios-super-admins", "aios-team"])).toBe("super_admin")
  })
})

describe("canAccess", () => {
  it("super_admin can access everything via wildcard", () => {
    expect(canAccess("super_admin", "write:invoices")).toBe(true)
    expect(canAccess("super_admin", "read:own_portal")).toBe(true)
  })
  it("team_member cannot write invoices", () => {
    expect(canAccess("team_member", "write:invoices")).toBe(false)
  })
  it("finance can write invoices", () => {
    expect(canAccess("finance", "write:invoices")).toBe(true)
  })
  it("undefined role returns false", () => {
    expect(canAccess(undefined, "read:all")).toBe(false)
  })
})

describe("CVE-2025-29927 patch", () => {
  it("next version in package.json is >= 14.2.25", async () => {
    const pkg = await import("../../package.json")
    const version = (pkg.dependencies?.next ?? pkg.devDependencies?.next ?? "") as string
    const semver = version.replace(/[\^~>=]/g, "").trim()
    const [major, minor, patch] = semver.split(".").map(Number)
    const isPatched =
      major > 14 ||
      (major === 14 && minor > 2) ||
      (major === 14 && minor === 2 && patch >= 25)
    expect(isPatched).toBe(true)
  })
})
