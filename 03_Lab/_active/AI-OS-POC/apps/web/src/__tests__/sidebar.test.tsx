import { describe, it, expect } from "vitest"
import { NAV_ITEMS } from "@/components/layout/sidebar"

describe("Sidebar nav items", () => {
  it("contains exactly 15 nav items (14 original + BRAIN cognitive module)", () => {
    expect(NAV_ITEMS.length).toBe(15)
  })

  it("includes all expected routes", () => {
    const routes = NAV_ITEMS.map((item) => item.href)
    const expected = [
      "/dashboard", "/clients", "/projects", "/tasks",
      "/deals", "/invoices", "/time-tracking", "/documents",
      "/reports", "/admin", "/notifications", "/ai",
      "/settings", "/portal", "/brain-cognitive",
    ]
    expected.forEach((route) => {
      expect(routes).toContain(route)
    })
  })

  it("every nav item has a label, href, and permission", () => {
    NAV_ITEMS.forEach((item) => {
      expect(item.label).toBeTruthy()
      expect(item.href).toMatch(/^\//)
      expect(item.permission).toBeTruthy()
    })
  })
})
