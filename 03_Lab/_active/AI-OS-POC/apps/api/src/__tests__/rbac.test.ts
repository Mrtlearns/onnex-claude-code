import { describe, it, expect } from "vitest"
import { mapGroupsToRoleApi } from "../plugins/require-role.js"

// Unit tests for mapGroupsToRoleApi (no server needed)
describe("mapGroupsToRoleApi", () => {
  it("maps aios-admins to admin", () => {
    expect(mapGroupsToRoleApi(["aios-admins"])).toBe("admin")
  })
  it("maps empty groups to team_member default", () => {
    expect(mapGroupsToRoleApi([])).toBe("team_member")
  })
  it("maps super_admin as highest priority", () => {
    expect(mapGroupsToRoleApi(["aios-super-admins", "aios-team"])).toBe("super_admin")
  })
})

// requireRole preHandler behavior tests (inline — no running server needed)
describe("requireRole preHandler", () => {
  it("returns 403 when role is team_member and admin is required", async () => {
    const { requireRole } = await import("../plugins/require-role.js")
    const preHandler = requireRole(["admin"])

    let statusCode = 200
    const mockRequest = { user: { role: "team_member" } }
    const mockReply = {
      code: (n: number) => { statusCode = n; return mockReply },
      send: () => mockReply,
    }

    await preHandler(mockRequest as never, mockReply as never)
    expect(statusCode).toBe(403)
  })

  it("returns 200 (no early exit) when role is admin and admin is required", async () => {
    const { requireRole } = await import("../plugins/require-role.js")
    const preHandler = requireRole(["admin"])

    let statusCode = 200
    const mockRequest = { user: { role: "admin" } }
    const mockReply = {
      code: (n: number) => { statusCode = n; return mockReply },
      send: () => mockReply,
    }

    await preHandler(mockRequest as never, mockReply as never)
    expect(statusCode).toBe(200)
  })

  it("super_admin bypasses role check (returns without 403)", async () => {
    const { requireRole } = await import("../plugins/require-role.js")
    const preHandler = requireRole(["admin"])

    let statusCode = 200
    const mockRequest = { user: { role: "super_admin" } }
    const mockReply = {
      code: (n: number) => { statusCode = n; return mockReply },
      send: () => mockReply,
    }

    await preHandler(mockRequest as never, mockReply as never)
    expect(statusCode).toBe(200)
  })

  it("returns 403 when user has no role claim", async () => {
    const { requireRole } = await import("../plugins/require-role.js")
    const preHandler = requireRole(["admin"])

    let statusCode = 200
    const mockRequest = { user: {} }
    const mockReply = {
      code: (n: number) => { statusCode = n; return mockReply },
      send: () => mockReply,
    }

    await preHandler(mockRequest as never, mockReply as never)
    expect(statusCode).toBe(403)
  })
})
