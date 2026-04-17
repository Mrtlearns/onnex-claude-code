// apps/web/src/__tests__/client-form.test.tsx
// TDD: Tests for ClientForm component and CreateClientSchema

import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi, describe, it, expect, beforeEach, beforeAll } from "vitest"
import { CreateClientSchema } from "@/types/api"

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
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ClientForm: React.ComponentType<any> | null = null

beforeAll(async () => {
  try {
    const mod = await import("../app/(protected)/clients/components/client-form")
    ClientForm = mod.ClientForm
  } catch {
    ClientForm = null
  }
})

describe("ClientForm — Zod validation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should exist as a component", () => {
    expect(ClientForm).not.toBeNull()
  })

  it("shows name required error when name is empty and form is submitted", async () => {
    if (!ClientForm) {
      expect.fail("ClientForm component not yet created")
      return
    }
    const user = userEvent.setup()
    render(<ClientForm onSuccess={vi.fn()} onCancel={vi.fn()} />)
    const submitBtn = screen.getByRole("button", { name: /save|create|submit/i })
    await user.click(submitBtn)
    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument()
    })
  })

  it("shows type required error when type is not selected", async () => {
    if (!ClientForm) {
      expect.fail("ClientForm component not yet created")
      return
    }
    const user = userEvent.setup()
    render(<ClientForm onSuccess={vi.fn()} onCancel={vi.fn()} />)
    const nameInput = screen.getByLabelText(/name/i)
    await user.type(nameInput, "Acme Corp")
    const submitBtn = screen.getByRole("button", { name: /save|create|submit/i })
    await user.click(submitBtn)
    await waitFor(() => {
      expect(screen.getByText(/type is required/i)).toBeInTheDocument()
    })
  })

  it("form renders with all required fields", () => {
    // Note: Radix UI Select requires pointer events not available in jsdom
    // This test verifies the form structure renders correctly
    if (!ClientForm) {
      expect.fail("ClientForm component not yet created")
      return
    }
    render(<ClientForm onSuccess={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: /type/i })).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: /status/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /create client/i })).toBeInTheDocument()
  })
})

// ─── Zod Schema unit tests ────────────────────────────────────────────────────

describe("CreateClientSchema — Zod validation rules", () => {
  it("rejects empty name", () => {
    const result = CreateClientSchema.safeParse({ name: "", type: "Agency" })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Name is required")
    }
  })

  it("rejects missing type", () => {
    const result = CreateClientSchema.safeParse({ name: "Acme" })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("type"))).toBe(true)
    }
  })

  it("accepts valid client data", () => {
    const result = CreateClientSchema.safeParse({
      name: "Acme Corp",
      type: "Agency",
      status: "Active",
    })
    expect(result.success).toBe(true)
  })

  it("defaults status to Prospect when omitted", () => {
    const result = CreateClientSchema.safeParse({ name: "Acme", type: "Direct" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe("Prospect")
    }
  })
})
