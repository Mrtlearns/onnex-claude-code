// apps/web/src/__tests__/task-form.test.tsx
// TDD: Tests for TaskForm component — will be RED until components are created
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import React from "react"
import { CreateTaskSchema } from "@/lib/schemas"

vi.mock("@tanstack/react-query", () => ({
  useMutation: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
  useQuery: vi.fn(() => ({
    data: [],
    isLoading: false,
  })),
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
  })),
}))

describe("CreateTaskSchema", () => {
  it("fails when title is empty", () => {
    const result = CreateTaskSchema.safeParse({ title: "" })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Title is required")
    }
  })

  it("fails when title is missing", () => {
    const result = CreateTaskSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it("passes with valid title and defaults to Backlog status", () => {
    const result = CreateTaskSchema.safeParse({ title: "New task" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe("Backlog")
    }
  })

  it("assignee_id is optional", () => {
    const result = CreateTaskSchema.safeParse({ title: "Test" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.assignee_id).toBeUndefined()
    }
  })

  it("accepts all 4 status values", () => {
    const statuses = ["Backlog", "In Progress", "Review", "Done"] as const
    for (const status of statuses) {
      const result = CreateTaskSchema.safeParse({ title: "T", status })
      expect(result.success).toBe(true)
    }
  })
})

describe("TaskForm", () => {
  it("renders title field with required indicator", async () => {
    // TaskForm not yet created — this test MUST fail (RED)
    const { TaskForm } = await import("@/app/(protected)/tasks/components/task-form")
    render(<TaskForm onSuccess={vi.fn()} />)
    expect(screen.getByLabelText(/title/i)).toBeDefined()
  })

  it("shows error when submitted with empty title", async () => {
    const { TaskForm } = await import("@/app/(protected)/tasks/components/task-form")
    render(<TaskForm onSuccess={vi.fn()} />)
    const submitBtn = screen.getByRole("button", { name: /create|save/i })
    fireEvent.click(submitBtn)
    await waitFor(() => {
      expect(screen.getByText(/title is required/i)).toBeDefined()
    })
  })
})
