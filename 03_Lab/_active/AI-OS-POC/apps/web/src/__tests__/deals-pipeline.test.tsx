// apps/web/src/__tests__/deals-pipeline.test.tsx
// TDD RED: Tests for DealsPipeline component — will fail until component is created
import { describe, it, expect, vi, beforeAll } from "vitest"
import { render, screen } from "@testing-library/react"
import type { Deal, DealStatus } from "@/types/api"
import React from "react"

// Mock @dnd-kit — same factory pattern as kanban-board.test.tsx
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div data-testid="dnd-context">{children}</div>,
  DragOverlay: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PointerSensor: class {},
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
  closestCenter: vi.fn(),
  useDroppable: vi.fn(() => ({ setNodeRef: vi.fn(), isOver: false })),
}))

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  verticalListSortingStrategy: vi.fn(),
  useSortable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  })),
}))

vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: vi.fn(() => "") } },
}))

vi.mock("@tanstack/react-query", () => ({
  useMutation: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
  })),
  useQuery: vi.fn(() => ({
    data: mockDeals,
    isLoading: false,
  })),
}))

// Mock sub-components to avoid deep render
vi.mock("@/app/(protected)/deals/components/deal-column", () => ({
  DealColumn: ({ status, deals }: { status: DealStatus; deals: Deal[] }) => (
    <div data-testid={`column-${status}`}>
      <h3>{status}</h3>
      {deals.map(d => <div key={d.id} data-testid="deal-card">{d.title}</div>)}
    </div>
  ),
}))

vi.mock("@/app/(protected)/deals/components/deal-form", () => ({
  DealForm: () => <div data-testid="deal-form">Deal Form</div>,
}))

vi.mock("@/app/(protected)/deals/components/deal-detail-sheet", () => ({
  DealDetailSheet: () => <div data-testid="deal-detail">Deal Detail</div>,
}))

const PIPELINE_STAGES: DealStatus[] = ['lead', 'qualified', 'proposal', 'negotiation']

const mockDeals: Deal[] = [
  {
    id: "deal-1", tenant_id: "t1", client_id: "c1",
    title: "Lead Deal", value: 10000, probability: 20,
    status: "lead", stage: "lead", expected_close: null, owner_id: null,
    created_at: "2026-03-11T00:00:00Z",
  },
  {
    id: "deal-2", tenant_id: "t1", client_id: "c2",
    title: "Qualified Deal", value: 20000, probability: 50,
    status: "qualified", stage: "qualified", expected_close: null, owner_id: null,
    created_at: "2026-03-11T00:00:00Z",
  },
  {
    id: "deal-3", tenant_id: "t1", client_id: "c3",
    title: "Won Deal", value: 5000, probability: 100,
    status: "won", stage: "won", expected_close: null, owner_id: null,
    created_at: "2026-03-11T00:00:00Z",
  },
  {
    id: "deal-4", tenant_id: "t1", client_id: "c4",
    title: "Lost Deal", value: 3000, probability: 0,
    status: "lost", stage: "lost", expected_close: null, owner_id: null,
    created_at: "2026-03-11T00:00:00Z",
  },
]

describe("DealsPipeline", () => {
  it("renders 4 pipeline columns by stage label", async () => {
    const { DealsPipeline } = await import("@/app/(protected)/deals/components/deals-pipeline")
    render(<DealsPipeline />)
    expect(screen.getByTestId("column-lead")).toBeDefined()
    expect(screen.getByTestId("column-qualified")).toBeDefined()
    expect(screen.getByTestId("column-proposal")).toBeDefined()
    expect(screen.getByTestId("column-negotiation")).toBeDefined()
  })

  it("shows weighted total in header for open pipeline deals", async () => {
    const { DealsPipeline } = await import("@/app/(protected)/deals/components/deals-pipeline")
    render(<DealsPipeline />)
    // Lead: 10000 * 20/100 = 2000; Qualified: 20000 * 50/100 = 10000 => 12000 weighted
    // Won/Lost excluded from pipeline weighted total
    expect(screen.getByText(/weighted/i)).toBeDefined()
  })

  it("does NOT render won or lost deals in kanban columns", async () => {
    const { DealsPipeline } = await import("@/app/(protected)/deals/components/deals-pipeline")
    render(<DealsPipeline />)
    // Won/Lost should not appear in pipeline columns
    expect(screen.queryByTestId("column-won")).toBeNull()
    expect(screen.queryByTestId("column-lost")).toBeNull()
  })

  it("renders New Deal button", async () => {
    const { DealsPipeline } = await import("@/app/(protected)/deals/components/deals-pipeline")
    render(<DealsPipeline />)
    expect(screen.getByRole("button", { name: /new deal/i })).toBeDefined()
  })
})
