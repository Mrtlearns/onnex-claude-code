// apps/web/src/__tests__/admin-users.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

// ── TanStack Query mock ────────────────────────────────────────────────────────
vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}))

// ── InviteUserDialog mock ──────────────────────────────────────────────────────
vi.mock("@/app/(protected)/admin/components/invite-user-dialog", () => ({
  InviteUserDialog: ({ onSuccess }: any) => (
    <button onClick={onSuccess} data-testid="invite-btn">Invite User</button>
  ),
}))

// ── shadcn/ui mocks ────────────────────────────────────────────────────────────
vi.mock("@/components/ui/table", () => ({
  Table: ({ children }: any) => <table>{children}</table>,
  TableBody: ({ children }: any) => <tbody>{children}</tbody>,
  TableCell: ({ children, colSpan }: any) => <td colSpan={colSpan}>{children}</td>,
  TableHead: ({ children }: any) => <th>{children}</th>,
  TableHeader: ({ children }: any) => <thead>{children}</thead>,
  TableRow: ({ children }: any) => <tr>{children}</tr>,
}))

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

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, variant }: any) => <span data-variant={variant}>{children}</span>,
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled}>{children}</button>
  ),
}))

vi.mock("@/components/ui/select", () => ({
  Select: ({ children, onValueChange, value, disabled }: any) => (
    <div data-value={value} data-disabled={disabled}>
      <select
        defaultValue={value}
        disabled={disabled}
        onChange={(e) => onValueChange?.(e.target.value)}
      >
        {children}
      </select>
    </div>
  ),
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ children, value }: any) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: any) => <>{children}</>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
}))

// ── Sample data ────────────────────────────────────────────────────────────────
const mockUsers = [
  { id: "u1", name: "Alice Smith", email: "alice@test.com", is_active: true,  role: "manager"     },
  { id: "u2", name: "Bob Jones",   email: "bob@test.com",   is_active: false, role: "team_member" },
]

describe("UsersTab", () => {
  beforeEach(() => {
    vi.mocked(useQuery).mockReturnValue({
      data: mockUsers,
      isLoading: false,
    } as any)
  })

  it("shows loading skeleton when isLoading is true", async () => {
    vi.mocked(useQuery).mockReturnValue({ data: undefined, isLoading: true } as any)
    const { UsersTab } = await import(
      "@/app/(protected)/admin/components/users-tab"
    )
    const { container } = render(<UsersTab />)
    // Loading state renders divs with animate-pulse, no table
    expect(container.querySelector("table")).toBeNull()
    expect(container.querySelector(".animate-pulse")).toBeDefined()
  })

  it("renders user rows with name and email", async () => {
    const { UsersTab } = await import(
      "@/app/(protected)/admin/components/users-tab"
    )
    render(<UsersTab />)
    expect(screen.getByText("Alice Smith")).toBeDefined()
    expect(screen.getByText("alice@test.com")).toBeDefined()
    expect(screen.getByText("Bob Jones")).toBeDefined()
    expect(screen.getByText("bob@test.com")).toBeDefined()
  })

  it("renders active/suspended badge for each user", async () => {
    const { UsersTab } = await import(
      "@/app/(protected)/admin/components/users-tab"
    )
    render(<UsersTab />)
    expect(screen.getByText("Active")).toBeDefined()
    expect(screen.getByText("Suspended")).toBeDefined()
  })

  it("renders Suspend button for each user row", async () => {
    const { UsersTab } = await import(
      "@/app/(protected)/admin/components/users-tab"
    )
    render(<UsersTab />)
    const suspendButtons = screen.getAllByRole("button", { name: /suspend/i })
    expect(suspendButtons.length).toBe(2)
  })

  it("Suspend button is disabled for suspended users", async () => {
    const { UsersTab } = await import(
      "@/app/(protected)/admin/components/users-tab"
    )
    render(<UsersTab />)
    const suspendButtons = screen.getAllByRole("button", { name: /suspend/i })
    // Alice is active → enabled; Bob is suspended → disabled
    const aliceBtn = suspendButtons[0]
    const bobBtn   = suspendButtons[1]
    expect((aliceBtn as HTMLButtonElement).disabled).toBe(false)
    expect((bobBtn as HTMLButtonElement).disabled).toBe(true)
  })

  it("renders Invite User button", async () => {
    const { UsersTab } = await import(
      "@/app/(protected)/admin/components/users-tab"
    )
    render(<UsersTab />)
    expect(screen.getByTestId("invite-btn")).toBeDefined()
  })

  it("renders role select with current role value for each user", async () => {
    const { UsersTab } = await import(
      "@/app/(protected)/admin/components/users-tab"
    )
    render(<UsersTab />)
    const selects = screen.getAllByRole("combobox") as HTMLSelectElement[]
    const values = selects.map((s) => s.value)
    expect(values).toContain("manager")
    expect(values).toContain("team_member")
  })

  it("shows 'No users found' when data is empty", async () => {
    vi.mocked(useQuery).mockReturnValue({ data: [], isLoading: false } as any)
    const { UsersTab } = await import(
      "@/app/(protected)/admin/components/users-tab"
    )
    render(<UsersTab />)
    expect(screen.getByText(/no users found/i)).toBeDefined()
  })

  it("calls suspendMutation.mutate when Suspend is clicked (after confirm)", async () => {
    const mockSuspendMutate = vi.fn()
    // Return different mutation objects per call order: roleMutation first, then suspendMutation
    vi.mocked(useMutation)
      .mockReturnValueOnce({ mutate: vi.fn(),            isPending: false } as any)
      .mockReturnValueOnce({ mutate: mockSuspendMutate,  isPending: false } as any)

    // Stub window.confirm to return true
    vi.stubGlobal("confirm", vi.fn(() => true))

    const { UsersTab } = await import(
      "@/app/(protected)/admin/components/users-tab"
    )
    render(<UsersTab />)

    // Alice is active — first Suspend button is enabled
    const suspendButtons = screen.getAllByRole("button", { name: /suspend/i })
    suspendButtons[0].click()

    expect(mockSuspendMutate).toHaveBeenCalledWith("u1")

    vi.unstubAllGlobals()
  })
})
