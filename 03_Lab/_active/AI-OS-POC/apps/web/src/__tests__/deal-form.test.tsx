// apps/web/src/__tests__/deal-form.test.tsx
// TDD RED: Tests for DealForm component and CreateDealSchema validation
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import React from "react"
import { CreateDealSchema } from "@/lib/schemas"

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

// ─── Schema tests (don't require component render) ────────────────────────────

describe("CreateDealSchema", () => {
  it("fails when title is empty", () => {
    const result = CreateDealSchema.safeParse({
      title: "",
      client_id: "00000000-0000-0000-0000-000000000001",
      value: 5000,
      probability: 50,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Title is required")
    }
  })

  it("fails when client_id is not a UUID", () => {
    const result = CreateDealSchema.safeParse({
      title: "My Deal",
      client_id: "not-a-uuid",
      value: 5000,
      probability: 50,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some(i => i.path.includes("client_id"))).toBe(true)
    }
  })

  it("fails when probability < 0", () => {
    const result = CreateDealSchema.safeParse({
      title: "My Deal",
      client_id: "00000000-0000-0000-0000-000000000001",
      value: 5000,
      probability: -1,
    })
    expect(result.success).toBe(false)
  })

  it("fails when probability > 100", () => {
    const result = CreateDealSchema.safeParse({
      title: "My Deal",
      client_id: "00000000-0000-0000-0000-000000000001",
      value: 5000,
      probability: 101,
    })
    expect(result.success).toBe(false)
  })

  it("passes with valid required fields", () => {
    const result = CreateDealSchema.safeParse({
      title: "Enterprise Deal",
      client_id: "00000000-0000-0000-0000-000000000001",
      value: 50000,
      probability: 75,
    })
    expect(result.success).toBe(true)
  })

  it("expected_close and owner_id are optional", () => {
    const result = CreateDealSchema.safeParse({
      title: "Deal",
      client_id: "00000000-0000-0000-0000-000000000001",
      value: 1000,
      probability: 25,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.expected_close).toBeUndefined()
      expect(result.data.owner_id).toBeUndefined()
    }
  })
})

// ─── Component tests ──────────────────────────────────────────────────────────

describe("DealForm", () => {
  it("renders title field", async () => {
    const { DealForm } = await import("@/app/(protected)/deals/components/deal-form")
    render(<DealForm onSuccess={vi.fn()} />)
    expect(screen.getByLabelText(/title/i)).toBeDefined()
  })

  it("shows error when submitted with empty title", async () => {
    const { DealForm } = await import("@/app/(protected)/deals/components/deal-form")
    render(<DealForm onSuccess={vi.fn()} />)
    const submitBtn = screen.getByRole("button", { name: /create deal|save/i })
    fireEvent.click(submitBtn)
    await waitFor(() => {
      expect(screen.getByText(/title is required/i)).toBeDefined()
    })
  })
})
