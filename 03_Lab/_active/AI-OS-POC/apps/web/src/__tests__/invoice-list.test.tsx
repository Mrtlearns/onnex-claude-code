// apps/web/src/__tests__/invoice-list.test.tsx
// TDD: Tests for InvoiceList component and isOverdue helper — RED until components are created
import { render, screen } from "@testing-library/react"
import { vi, describe, it, expect, beforeAll } from "vitest"
import React from "react"
import { Invoice } from "@/types/api"

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn().mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
  }),
  useMutation: vi.fn().mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  }),
  useQueryClient: vi.fn().mockReturnValue({
    invalidateQueries: vi.fn(),
  }),
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let InvoiceList: React.ComponentType<any> | null = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let isOverdue: ((invoice: Invoice) => boolean) | null = null

beforeAll(async () => {
  try {
    const mod = await import("../app/(protected)/invoices/components/invoice-list")
    InvoiceList = mod.InvoiceList
    isOverdue = mod.isOverdue
  } catch {
    InvoiceList = null
    isOverdue = null
  }
})

// ─── isOverdue unit tests ─────────────────────────────────────────────────────

describe("isOverdue — overdue logic (no DB flag, computed)", () => {
  const baseInvoice: Invoice = {
    id: "inv-1",
    tenant_id: "t-1",
    client_id: "c-1",
    deal_id: null,
    status: "sent",
    due_date: null,
    sent_at: null,
    paid_at: null,
    tax_pct: 0,
    notes: null,
    created_at: new Date().toISOString(),
  }

  it("should export isOverdue helper", () => {
    expect(isOverdue).not.toBeNull()
  })

  it("returns false when due_date is null", () => {
    if (!isOverdue) {
      expect.fail("isOverdue not yet exported from invoice-list")
      return
    }
    const result = isOverdue({ ...baseInvoice, due_date: null, status: "sent" })
    expect(result).toBe(false)
  })

  it("returns true when due_date is yesterday and status is sent", () => {
    if (!isOverdue) {
      expect.fail("isOverdue not yet exported from invoice-list")
      return
    }
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const result = isOverdue({
      ...baseInvoice,
      due_date: yesterday.toISOString().split("T")[0],
      status: "sent",
    })
    expect(result).toBe(true)
  })

  it("returns true when due_date is past and status is partial", () => {
    if (!isOverdue) {
      expect.fail("isOverdue not yet exported from invoice-list")
      return
    }
    const past = new Date()
    past.setDate(past.getDate() - 30)
    const result = isOverdue({
      ...baseInvoice,
      due_date: past.toISOString().split("T")[0],
      status: "partial",
    })
    expect(result).toBe(true)
  })

  it("returns false when status is paid (regardless of due_date)", () => {
    if (!isOverdue) {
      expect.fail("isOverdue not yet exported from invoice-list")
      return
    }
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const result = isOverdue({
      ...baseInvoice,
      due_date: yesterday.toISOString().split("T")[0],
      status: "paid",
    })
    expect(result).toBe(false)
  })

  it("returns false when status is void (regardless of due_date)", () => {
    if (!isOverdue) {
      expect.fail("isOverdue not yet exported from invoice-list")
      return
    }
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const result = isOverdue({
      ...baseInvoice,
      due_date: yesterday.toISOString().split("T")[0],
      status: "void",
    })
    expect(result).toBe(false)
  })

  it("returns false when due_date is in the future and status is draft", () => {
    if (!isOverdue) {
      expect.fail("isOverdue not yet exported from invoice-list")
      return
    }
    const future = new Date()
    future.setDate(future.getDate() + 30)
    const result = isOverdue({
      ...baseInvoice,
      due_date: future.toISOString().split("T")[0],
      status: "draft",
    })
    expect(result).toBe(false)
  })
})

// ─── InvoiceList render tests ─────────────────────────────────────────────────

describe("InvoiceList — component render", () => {
  it("renders the invoice list component", async () => {
    if (!InvoiceList) {
      expect.fail("InvoiceList component not yet created")
      return
    }
    render(<InvoiceList />)
    // Component should render without crashing
    expect(document.body).toBeDefined()
  })

  it("overdue invoice row has red highlight class", async () => {
    const { useQuery } = await import("@tanstack/react-query")
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const overdueInvoice: Invoice = {
      id: "inv-overdue",
      tenant_id: "t-1",
      client_id: "c-1",
      deal_id: null,
      status: "sent",
      due_date: yesterday.toISOString().split("T")[0],
      sent_at: null,
      paid_at: null,
      tax_pct: 0,
      notes: null,
      created_at: new Date().toISOString(),
    }
    vi.mocked(useQuery).mockReturnValue({
      data: [overdueInvoice],
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useQuery>)

    if (!InvoiceList) {
      expect.fail("InvoiceList component not yet created")
      return
    }
    render(<InvoiceList />)
    const rows = document.querySelectorAll("tr, [data-overdue]")
    // Find a row that has the overdue classes applied
    const overdueRow = Array.from(rows).find(
      (el) =>
        el.className.includes("border-red-500") || el.getAttribute("data-overdue") === "true"
    )
    expect(overdueRow).toBeDefined()
  })

  it("paid invoice row does NOT have red highlight class", async () => {
    const { useQuery } = await import("@tanstack/react-query")
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const paidInvoice: Invoice = {
      id: "inv-paid",
      tenant_id: "t-1",
      client_id: "c-1",
      deal_id: null,
      status: "paid",
      due_date: yesterday.toISOString().split("T")[0],
      sent_at: null,
      paid_at: new Date().toISOString(),
      tax_pct: 0,
      notes: null,
      created_at: new Date().toISOString(),
    }
    vi.mocked(useQuery).mockReturnValue({
      data: [paidInvoice],
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useQuery>)

    if (!InvoiceList) {
      expect.fail("InvoiceList component not yet created")
      return
    }
    render(<InvoiceList />)
    const rows = document.querySelectorAll("tr")
    const anyRedRow = Array.from(rows).some((el) =>
      el.className.includes("border-red-500")
    )
    expect(anyRedRow).toBe(false)
  })
})
