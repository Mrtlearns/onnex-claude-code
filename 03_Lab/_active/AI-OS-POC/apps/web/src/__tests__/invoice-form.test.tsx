// apps/web/src/__tests__/invoice-form.test.tsx
// TDD: Tests for InvoiceForm component and CreateInvoiceSchema — RED until components are created
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi, describe, it, expect, beforeAll, beforeEach } from "vitest"
import React from "react"
import { CreateInvoiceSchema } from "@/lib/schemas"

vi.mock("@tanstack/react-query", () => ({
  useMutation: vi.fn().mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  }),
  useQuery: vi.fn().mockReturnValue({
    data: [],
    isLoading: false,
  }),
  useQueryClient: vi.fn().mockReturnValue({
    invalidateQueries: vi.fn(),
  }),
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let InvoiceForm: React.ComponentType<any> | null = null

beforeAll(async () => {
  try {
    const mod = await import("../app/(protected)/invoices/components/invoice-form")
    InvoiceForm = mod.InvoiceForm
  } catch {
    InvoiceForm = null
  }
})

// ─── Zod schema unit tests ────────────────────────────────────────────────────

describe("CreateInvoiceSchema — Zod validation rules", () => {
  it("rejects tax_pct > 100", () => {
    const result = CreateInvoiceSchema.safeParse({
      client_id: "550e8400-e29b-41d4-a716-446655440000",
      tax_pct: 150,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("tax_pct"))).toBe(true)
    }
  })

  it("rejects tax_pct < 0", () => {
    const result = CreateInvoiceSchema.safeParse({
      client_id: "550e8400-e29b-41d4-a716-446655440000",
      tax_pct: -5,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("tax_pct"))).toBe(true)
    }
  })

  it("rejects client_id that is not a valid UUID", () => {
    const result = CreateInvoiceSchema.safeParse({
      client_id: "not-uuid",
      tax_pct: 15,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("client_id"))).toBe(true)
    }
  })

  it("rejects missing client_id", () => {
    const result = CreateInvoiceSchema.safeParse({ tax_pct: 10 })
    expect(result.success).toBe(false)
  })

  it("accepts valid input with client_id and tax_pct", () => {
    const result = CreateInvoiceSchema.safeParse({
      client_id: "550e8400-e29b-41d4-a716-446655440000",
      tax_pct: 15,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.tax_pct).toBe(15)
    }
  })

  it("defaults tax_pct to 0 when not provided", () => {
    const result = CreateInvoiceSchema.safeParse({
      client_id: "550e8400-e29b-41d4-a716-446655440000",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.tax_pct).toBe(0)
    }
  })

  it("accepts tax_pct of exactly 0", () => {
    const result = CreateInvoiceSchema.safeParse({
      client_id: "550e8400-e29b-41d4-a716-446655440000",
      tax_pct: 0,
    })
    expect(result.success).toBe(true)
  })

  it("accepts tax_pct of exactly 100", () => {
    const result = CreateInvoiceSchema.safeParse({
      client_id: "550e8400-e29b-41d4-a716-446655440000",
      tax_pct: 100,
    })
    expect(result.success).toBe(true)
  })

  it("notes is optional", () => {
    const result = CreateInvoiceSchema.safeParse({
      client_id: "550e8400-e29b-41d4-a716-446655440000",
      tax_pct: 10,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.notes).toBeUndefined()
    }
  })
})

// ─── InvoiceForm component tests ──────────────────────────────────────────────

describe("InvoiceForm — component render", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should exist as a component", () => {
    expect(InvoiceForm).not.toBeNull()
  })

  it("renders form with required fields", () => {
    if (!InvoiceForm) {
      expect.fail("InvoiceForm component not yet created")
      return
    }
    render(<InvoiceForm onSuccess={vi.fn()} onCancel={vi.fn()} />)
    // Client select should be present
    expect(screen.getByRole("combobox", { name: /client/i })).toBeInTheDocument()
  })

  it("renders tax_pct input field", () => {
    if (!InvoiceForm) {
      expect.fail("InvoiceForm component not yet created")
      return
    }
    render(<InvoiceForm onSuccess={vi.fn()} onCancel={vi.fn()} />)
    // Tax percent field should be present
    const taxInput = screen.getByLabelText(/tax/i)
    expect(taxInput).toBeInTheDocument()
  })

  it("renders submit button", () => {
    if (!InvoiceForm) {
      expect.fail("InvoiceForm component not yet created")
      return
    }
    render(<InvoiceForm onSuccess={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByRole("button", { name: /create|save/i })).toBeInTheDocument()
  })

  it("tax_pct schema rejects > 100 (Zod validates before submit)", async () => {
    // jsdom does not fire HTML5 constraint validation events on type=number max=100
    // Validate via Zod schema directly — this is covered by CreateInvoiceSchema tests above
    // Component test verifies the field renders and accepts numeric input
    if (!InvoiceForm) {
      expect.fail("InvoiceForm component not yet created")
      return
    }
    render(<InvoiceForm onSuccess={vi.fn()} onCancel={vi.fn()} />)
    const taxInput = screen.getByLabelText(/tax/i)
    // Verify the field accepts input (numeric type)
    expect(taxInput).toBeInTheDocument()
    expect(taxInput).toHaveAttribute("type", "number")
    expect(taxInput).toHaveAttribute("max", "100")
  })
})
