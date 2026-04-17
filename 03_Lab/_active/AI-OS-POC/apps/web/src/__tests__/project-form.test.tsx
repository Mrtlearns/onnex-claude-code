// apps/web/src/__tests__/project-form.test.tsx
// TDD: Tests for ProjectForm component and CreateProjectSchema

import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi, describe, it, expect, beforeEach, beforeAll } from "vitest"
import { CreateProjectSchema } from "@/types/api"

// Mock TanStack Query
vi.mock("@tanstack/react-query", () => ({
  useMutation: vi.fn().mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  }),
  useQueryClient: vi.fn().mockReturnValue({
    invalidateQueries: vi.fn(),
  }),
  useQuery: vi.fn().mockReturnValue({
    data: [],
    isLoading: false,
  }),
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ProjectForm: React.ComponentType<any> | null = null

beforeAll(async () => {
  try {
    const mod = await import("../app/(protected)/projects/components/project-form")
    ProjectForm = mod.ProjectForm
  } catch {
    ProjectForm = null
  }
})

describe("ProjectForm — Zod validation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should exist as a component", () => {
    expect(ProjectForm).not.toBeNull()
  })

  it("shows name required error when name is empty and form is submitted", async () => {
    if (!ProjectForm) {
      expect.fail("ProjectForm component not yet created")
      return
    }
    const user = userEvent.setup()
    render(<ProjectForm onSuccess={vi.fn()} onCancel={vi.fn()} />)
    const submitBtn = screen.getByRole("button", { name: /save|create|submit/i })
    await user.click(submitBtn)
    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument()
    })
  })

  it("form renders all expected fields", () => {
    if (!ProjectForm) {
      expect.fail("ProjectForm component not yet created")
      return
    }
    render(<ProjectForm onSuccess={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: /status/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/budget/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /create project/i })).toBeInTheDocument()
  })
})

// ─── Zod Schema unit tests ────────────────────────────────────────────────────

describe("CreateProjectSchema — Zod validation rules", () => {
  it("rejects empty name", () => {
    const result = CreateProjectSchema.safeParse({ name: "", status: "Active" })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Name is required")
    }
  })

  it("rejects negative budget", () => {
    const result = CreateProjectSchema.safeParse({
      name: "My Project",
      status: "Active",
      budget: -100,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("budget"))).toBe(true)
    }
  })

  it("rejects zero budget", () => {
    const result = CreateProjectSchema.safeParse({
      name: "My Project",
      status: "Active",
      budget: 0,
    })
    expect(result.success).toBe(false)
  })

  it("accepts valid project data with optional budget", () => {
    const result = CreateProjectSchema.safeParse({
      name: "Website Redesign",
      status: "Active",
      budget: 5000,
    })
    expect(result.success).toBe(true)
  })

  it("accepts project without budget", () => {
    const result = CreateProjectSchema.safeParse({
      name: "Website Redesign",
      status: "Active",
    })
    expect(result.success).toBe(true)
  })

  it("defaults status to Active when omitted", () => {
    const result = CreateProjectSchema.safeParse({ name: "New Project" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe("Active")
    }
  })
})
