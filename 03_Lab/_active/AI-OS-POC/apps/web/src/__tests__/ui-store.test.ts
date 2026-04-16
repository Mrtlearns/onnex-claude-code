import { describe, it, expect, beforeEach } from "vitest"
import { useUIStore } from "@/stores/ui-store"

// Reset store between tests
beforeEach(() => {
  useUIStore.setState({ sidebarCollapsed: false })
})

describe("useUIStore", () => {
  it("has sidebarCollapsed = false as initial state", () => {
    expect(useUIStore.getState().sidebarCollapsed).toBe(false)
  })

  it("toggleSidebar flips sidebarCollapsed to true", () => {
    useUIStore.getState().toggleSidebar()
    expect(useUIStore.getState().sidebarCollapsed).toBe(true)
  })

  it("toggleSidebar called twice returns to false", () => {
    useUIStore.getState().toggleSidebar()
    useUIStore.getState().toggleSidebar()
    expect(useUIStore.getState().sidebarCollapsed).toBe(false)
  })

  it("setSidebarCollapsed(true) directly sets state", () => {
    useUIStore.getState().setSidebarCollapsed(true)
    expect(useUIStore.getState().sidebarCollapsed).toBe(true)
  })
})
