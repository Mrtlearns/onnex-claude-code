// apps/web/src/__tests__/reports-client.test.tsx
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import React from "react"
import type { Session } from "next-auth"

// ── shadcn/ui tab mocks ────────────────────────────────────────────────────────
vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children, value }: any) => <div data-value={value}>{children}</div>,
  TabsList: ({ children }: any) => <div role="tablist">{children}</div>,
  TabsTrigger: ({ children, value }: any) => (
    <button role="tab" data-value={value}>{children}</button>
  ),
  TabsContent: ({ children, value }: any) => (
    <div data-tab={value}>{children}</div>
  ),
}))

// ── Report sub-component mocks ─────────────────────────────────────────────────
vi.mock("@/app/(protected)/reports/components/report-toolbar", () => ({
  ReportToolbar: () => <div data-testid="report-toolbar" />,
}))
vi.mock("@/app/(protected)/reports/components/utilization-report", () => ({
  UtilizationReport: () => <div data-testid="utilization-report" />,
}))
vi.mock("@/app/(protected)/reports/components/revenue-report", () => ({
  RevenueReport: () => <div data-testid="revenue-report" />,
}))
vi.mock("@/app/(protected)/reports/components/profitability-report", () => ({
  ProfitabilityReport: () => <div data-testid="profitability-report" />,
}))
vi.mock("@/app/(protected)/reports/components/client-activity-report", () => ({
  ClientActivityReport: () => <div data-testid="client-activity-report" />,
}))

// ── report-utils mock ──────────────────────────────────────────────────────────
vi.mock("@/lib/report-utils", () => ({
  buildCsvDownloadUrl: vi.fn(() => "#"),
}))

// ── Session fixtures ───────────────────────────────────────────────────────────
const financeSession = { user: { role: "finance", token: "tok" } } as unknown as Session
const adminSession   = { user: { role: "admin",   token: "tok" } } as unknown as Session
const superAdminSession = { user: { role: "super_admin", token: "tok" } } as unknown as Session
const managerSession = { user: { role: "manager", token: "tok" } } as unknown as Session
const nullSession    = null

describe("ReportsClient", () => {
  it("renders 'Reports' heading", async () => {
    const { ReportsClient } = await import(
      "@/app/(protected)/reports/components/reports-client"
    )
    render(<ReportsClient session={managerSession} />)
    expect(screen.getByText("Reports")).toBeDefined()
  })

  it("shows Utilization tab for all roles", async () => {
    const { ReportsClient } = await import(
      "@/app/(protected)/reports/components/reports-client"
    )
    render(<ReportsClient session={managerSession} />)
    expect(screen.getByRole("tab", { name: /utilization/i })).toBeDefined()
  })

  it("shows Revenue tab for finance role", async () => {
    const { ReportsClient } = await import(
      "@/app/(protected)/reports/components/reports-client"
    )
    render(<ReportsClient session={financeSession} />)
    expect(screen.getByRole("tab", { name: /revenue/i })).toBeDefined()
  })

  it("shows Revenue tab for admin role", async () => {
    const { ReportsClient } = await import(
      "@/app/(protected)/reports/components/reports-client"
    )
    render(<ReportsClient session={adminSession} />)
    expect(screen.getByRole("tab", { name: /revenue/i })).toBeDefined()
  })

  it("shows Revenue tab for super_admin role", async () => {
    const { ReportsClient } = await import(
      "@/app/(protected)/reports/components/reports-client"
    )
    render(<ReportsClient session={superAdminSession} />)
    expect(screen.getByRole("tab", { name: /revenue/i })).toBeDefined()
  })

  it("does NOT show Revenue tab for manager role", async () => {
    const { ReportsClient } = await import(
      "@/app/(protected)/reports/components/reports-client"
    )
    render(<ReportsClient session={managerSession} />)
    expect(screen.queryByRole("tab", { name: /revenue/i })).toBeNull()
  })

  it("does NOT show Revenue tab when session is null", async () => {
    const { ReportsClient } = await import(
      "@/app/(protected)/reports/components/reports-client"
    )
    render(<ReportsClient session={nullSession} />)
    expect(screen.queryByRole("tab", { name: /revenue/i })).toBeNull()
  })

  it("shows Project Profitability tab for all roles", async () => {
    const { ReportsClient } = await import(
      "@/app/(protected)/reports/components/reports-client"
    )
    render(<ReportsClient session={managerSession} />)
    expect(screen.getByRole("tab", { name: /project profitability/i })).toBeDefined()
  })

  it("shows Client Activity tab for all roles", async () => {
    const { ReportsClient } = await import(
      "@/app/(protected)/reports/components/reports-client"
    )
    render(<ReportsClient session={managerSession} />)
    expect(screen.getByRole("tab", { name: /client activity/i })).toBeDefined()
  })

  it("renders report toolbar", async () => {
    const { ReportsClient } = await import(
      "@/app/(protected)/reports/components/reports-client"
    )
    render(<ReportsClient session={managerSession} />)
    expect(screen.getByTestId("report-toolbar")).toBeDefined()
  })
})
