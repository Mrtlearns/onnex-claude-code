// apps/web/src/__tests__/notification-bell.test.tsx
// TDD: Tests for NotificationBell component

import { render, screen, fireEvent } from "@testing-library/react"
import { vi, describe, it, expect, beforeAll } from "vitest"
import React from "react"

// ---------------------------------------------------------------------------
// Mock @tanstack/react-query — useQuery + useMutation return data we control
// ---------------------------------------------------------------------------
vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>()
  return {
    ...actual,
    useQuery: vi.fn(),
    useMutation: vi.fn(),
    useQueryClient: vi.fn(),
  }
})

// Mock next/navigation (router used for notification clicks)
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}))

const SAMPLE_UNREAD = [
  {
    id: "notif-1",
    tenant_id: "t1",
    user_id: "u1",
    type: "task_assigned",
    title: "Task assigned",
    body: "You were assigned a new task",
    entity_type: "task",
    entity_id: "task-42",
    read_at: null,
    created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
]

const SAMPLE_FEED = [
  ...SAMPLE_UNREAD,
  {
    id: "notif-2",
    tenant_id: "t1",
    user_id: "u1",
    type: "deal_updated",
    title: "Deal stage changed",
    body: "Acme Corp moved to Proposal",
    entity_type: "deal",
    entity_id: "deal-7",
    read_at: new Date().toISOString(), // already read
    created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let NotificationBell: React.ComponentType<any> | null = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let useQueryMock: any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let useMutationMock: any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let useQueryClientMock: any

beforeAll(async () => {
  const tq = await import("@tanstack/react-query")
  useQueryMock = tq.useQuery
  useMutationMock = tq.useMutation
  useQueryClientMock = tq.useQueryClient

  // Default useQueryClient mock
  ;(useQueryClientMock as ReturnType<typeof vi.fn>).mockReturnValue({
    invalidateQueries: vi.fn(),
  })

  // Default useMutation mock
  ;(useMutationMock as ReturnType<typeof vi.fn>).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  })

  try {
    const mod = await import("../components/layout/notification-bell")
    NotificationBell = mod.NotificationBell ?? mod.default
  } catch {
    NotificationBell = null
  }
})

describe("NotificationBell — badge and feed", () => {
  it("renders Bell icon with data-testid='notification-bell'", () => {
    if (!NotificationBell) {
      expect.fail("NotificationBell not yet created — expected RED")
      return
    }
    // Mock unread query returning 1 unread notification
    ;(useQueryMock as ReturnType<typeof vi.fn>).mockImplementation(
      ({ queryKey }: { queryKey: string[] }) => {
        if (queryKey[0] === "notifications-unread") {
          return { data: SAMPLE_UNREAD, isLoading: false }
        }
        return { data: [], isLoading: false }
      }
    )
    render(<NotificationBell />)
    const bell = screen.getByTestId("notification-bell")
    expect(bell).toBeDefined()
  })

  it("shows unread badge count when unread notifications exist", () => {
    if (!NotificationBell) {
      expect.fail("NotificationBell not yet created — expected RED")
      return
    }
    ;(useQueryMock as ReturnType<typeof vi.fn>).mockImplementation(
      ({ queryKey }: { queryKey: string[] }) => {
        if (queryKey[0] === "notifications-unread") {
          return { data: SAMPLE_UNREAD, isLoading: false }
        }
        return { data: [], isLoading: false }
      }
    )
    render(<NotificationBell />)
    // Badge showing unread count "1"
    expect(screen.getByText("1")).toBeDefined()
  })

  it("does NOT show badge when all notifications are read (empty unread list)", () => {
    if (!NotificationBell) {
      expect.fail("NotificationBell not yet created — expected RED")
      return
    }
    ;(useQueryMock as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [],
      isLoading: false,
    })
    render(<NotificationBell />)
    // Badge should not be present when count is 0
    expect(screen.queryByText("0")).toBeNull()
  })

  it("clicking bell opens popover with notification feed items", () => {
    if (!NotificationBell) {
      expect.fail("NotificationBell not yet created — expected RED")
      return
    }
    ;(useQueryMock as ReturnType<typeof vi.fn>).mockImplementation(
      ({ queryKey }: { queryKey: string[] }) => {
        if (queryKey[0] === "notifications-unread") {
          return { data: SAMPLE_UNREAD, isLoading: false }
        }
        if (queryKey[0] === "notifications-feed") {
          return { data: SAMPLE_FEED, isLoading: false }
        }
        return { data: [], isLoading: false }
      }
    )
    render(<NotificationBell />)
    const bell = screen.getByTestId("notification-bell")
    fireEvent.click(bell)
    // Feed items should appear
    expect(screen.getByText("Task assigned")).toBeDefined()
    expect(screen.getByText("Deal stage changed")).toBeDefined()
  })

  it("'Mark all read' button calls mutate when clicked", () => {
    if (!NotificationBell) {
      expect.fail("NotificationBell not yet created — expected RED")
      return
    }
    const mutateFn = vi.fn()
    ;(useMutationMock as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: mutateFn,
      isPending: false,
    })
    ;(useQueryMock as ReturnType<typeof vi.fn>).mockImplementation(
      ({ queryKey }: { queryKey: string[] }) => {
        if (queryKey[0] === "notifications-unread") {
          return { data: SAMPLE_UNREAD, isLoading: false }
        }
        if (queryKey[0] === "notifications-feed") {
          return { data: SAMPLE_FEED, isLoading: false }
        }
        return { data: [], isLoading: false }
      }
    )
    render(<NotificationBell />)
    // Open popover first
    const bell = screen.getByTestId("notification-bell")
    fireEvent.click(bell)
    // Click "Mark all read"
    const markAllBtn = screen.getByText(/mark all read/i)
    fireEvent.click(markAllBtn)
    expect(mutateFn).toHaveBeenCalled()
  })
})
