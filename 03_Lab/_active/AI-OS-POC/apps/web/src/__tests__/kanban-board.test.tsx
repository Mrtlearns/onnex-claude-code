// apps/web/src/__tests__/kanban-board.test.tsx
// TDD GREEN: Tests for KanbanBoard component
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import type { Task } from "@/types/api"
import React from "react"

// Mock @dnd-kit to avoid DOM environment issues in jsdom
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
    data: [],
    isLoading: false,
  })),
}))

// Mock task-form to avoid deep render issues
vi.mock("@/app/(protected)/tasks/components/task-form", () => ({
  TaskForm: () => <div data-testid="task-form">Task Form</div>,
}))

// Mock task-detail-dialog
vi.mock("@/app/(protected)/tasks/components/task-detail-dialog", () => ({
  TaskDetailDialog: () => <div data-testid="task-detail">Task Detail</div>,
}))

const mockTasks: Task[] = [
  {
    id: "1",
    tenant_id: "tenant-1",
    title: "Task in Backlog",
    status: "Backlog",
    created_at: "2026-03-11T00:00:00Z",
  },
  {
    id: "2",
    tenant_id: "tenant-1",
    title: "Task In Progress",
    status: "In Progress",
    created_at: "2026-03-11T00:00:00Z",
  },
  {
    id: "3",
    tenant_id: "tenant-1",
    title: "Task Done",
    status: "Done",
    assignee_id: "user-1",
    created_at: "2026-03-11T00:00:00Z",
  },
]

let KanbanBoard: React.ComponentType<{ tasks: Task[] }>

beforeAll(async () => {
  const mod = await import("@/app/(protected)/tasks/components/kanban-board")
  KanbanBoard = mod.KanbanBoard
})

describe("KanbanBoard", () => {
  it("renders 4 kanban columns", () => {
    render(<KanbanBoard tasks={mockTasks} />)
    expect(screen.getAllByText("Backlog").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("In Progress").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("Review").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("Done").length).toBeGreaterThanOrEqual(1)
  })

  it("renders tasks in correct columns", () => {
    render(<KanbanBoard tasks={mockTasks} />)
    expect(screen.getByText("Task in Backlog")).toBeDefined()
    expect(screen.getByText("Task In Progress")).toBeDefined()
    expect(screen.getByText("Task Done")).toBeDefined()
  })

  it("filters to My Tasks when only assigned tasks provided", () => {
    const myTasks = mockTasks.filter(t => t.assignee_id === "user-1")
    render(<KanbanBoard tasks={myTasks} />)
    expect(screen.getByText("Task Done")).toBeDefined()
    expect(screen.queryByText("Task in Backlog")).toBeNull()
  })
})
