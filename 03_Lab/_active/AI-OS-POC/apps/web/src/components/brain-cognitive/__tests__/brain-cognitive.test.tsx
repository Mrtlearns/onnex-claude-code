// ─────────────────────────────────────────────────────────────────────────────
// brain-cognitive — unit tests
// DEV NOTE: Delete this file alongside the brain-cognitive feature module.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MetricsPanel }   from "../MetricsPanel"
import { MemorySectors }  from "../MemorySectors"
import { SynapticStream } from "../SynapticStream"
import { EntityInspector } from "../EntityInspector"
import { NeuralPathwaysGraph } from "../NeuralPathwaysGraph"
import type { BrainMetrics, BrainJobRun, BrainEntity, BrainLink, BrainGraphData } from "../types"

// ── jsdom polyfills ───────────────────────────────────────────────────────────
// ResizeObserver is not implemented in jsdom — stub it out globally.
beforeAll(() => {
  vi.stubGlobal("ResizeObserver", class {
    observe()    {}
    unobserve()  {}
    disconnect() {}
  })
})

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockEntity: BrainEntity = {
  id: "abc-123",
  entity_type: "Person",
  name: "Alice Smith",
  aliases: ["Alice"],
  properties: { role: "Engineer" },
  source_count: 3,
}

const mockEntity2: BrainEntity = {
  id: "def-456",
  entity_type: "Organization",
  name: "Acme Corp",
  source_count: 1,
}

const mockLink: BrainLink = {
  source: "abc-123",
  target: "def-456",
  rel_type: "WORKS_AT",
  weight: 1,
}

const mockGraphData: BrainGraphData = {
  entities: [mockEntity, mockEntity2],
  links: [mockLink],
}

const mockJob: BrainJobRun = {
  id: "job-1",
  sop_slug: "weekly-report",
  sop_title: "Weekly Report",
  status: "completed",
  started_at: new Date(Date.now() - 120_000).toISOString(),
  completed_at: new Date(Date.now() - 90_000).toISOString(),
}

const mockFailedJob: BrainJobRun = {
  id: "job-2",
  sop_slug: "data-sync",
  sop_title: "Data Sync",
  status: "failed",
  started_at: new Date(Date.now() - 3600_000).toISOString(),
  error: "Connection timeout",
}

const mockMetrics: BrainMetrics = {
  totalEntities: 2,
  totalLinks: 1,
  entityTypes: { Person: 1, Organization: 1 },
  recentJobs: [mockJob],
  embedStatus: { status: "ok", model: "gemini-embedding-001", dimensions: 768 },
}

// ── MetricsPanel ──────────────────────────────────────────────────────────────

describe("MetricsPanel", () => {
  it("renders skeleton cards while loading", () => {
    const { container } = render(<MetricsPanel metrics={null} loading={true} />)
    const skeletons = container.querySelectorAll(".animate-pulse")
    expect(skeletons.length).toBe(4)
  })

  it("renders metric values from data", () => {
    render(<MetricsPanel metrics={mockMetrics} />)
    expect(screen.getByText("2")).toBeInTheDocument()   // entities
    // "1" appears twice (links + job count) — verify at least one exists
    expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText("768")).toBeInTheDocument() // embed dimensions
    expect(screen.getByText("gemini-embedding-001")).toBeInTheDocument()
  })

  it("shows job count", () => {
    render(<MetricsPanel metrics={mockMetrics} />)
    // recentJobs.length = 1
    const jobCount = screen.getAllByText("1")
    expect(jobCount.length).toBeGreaterThanOrEqual(1)
  })

  it("shows running accent when jobs are running", () => {
    const runningMetrics: BrainMetrics = {
      ...mockMetrics,
      recentJobs: [{ ...mockJob, status: "running" }],
    }
    render(<MetricsPanel metrics={runningMetrics} />)
    // "1 running" text should appear
    expect(screen.getByText("1 running")).toBeInTheDocument()
  })
})

// ── MemorySectors ─────────────────────────────────────────────────────────────

describe("MemorySectors", () => {
  it("shows 'No data' when entity types are empty", () => {
    render(<MemorySectors entityTypes={{}} total={0} />)
    expect(screen.getByText("No data")).toBeInTheDocument()
  })

  it("renders bars and legend rows for each type", () => {
    render(
      <MemorySectors
        entityTypes={{ Person: 3, Organization: 2, Concept: 1 }}
        total={6}
      />,
    )
    expect(screen.getByText("Person")).toBeInTheDocument()
    expect(screen.getByText("Organization")).toBeInTheDocument()
    expect(screen.getByText("Concept")).toBeInTheDocument()
    expect(screen.getByText("3")).toBeInTheDocument()
    expect(screen.getByText("2")).toBeInTheDocument()
  })

  it("shows correct percentages", () => {
    render(
      <MemorySectors
        entityTypes={{ Person: 1, Organization: 1 }}
        total={2}
      />,
    )
    const pcts = screen.getAllByText("(50.0%)")
    expect(pcts.length).toBe(2)
  })
})

// ── SynapticStream ────────────────────────────────────────────────────────────

describe("SynapticStream", () => {
  it("shows loading state", () => {
    render(<SynapticStream jobs={[]} loading={true} />)
    expect(screen.getByText("Loading stream…")).toBeInTheDocument()
  })

  it("shows empty state when no jobs", () => {
    render(<SynapticStream jobs={[]} />)
    expect(screen.getByText("No activity yet")).toBeInTheDocument()
  })

  it("renders job titles and statuses", () => {
    render(<SynapticStream jobs={[mockJob, mockFailedJob]} />)
    expect(screen.getByText("Weekly Report")).toBeInTheDocument()
    expect(screen.getByText("Data Sync")).toBeInTheDocument()
    expect(screen.getByText("completed")).toBeInTheDocument()
    expect(screen.getByText("failed")).toBeInTheDocument()
  })

  it("shows error message for failed jobs", () => {
    render(<SynapticStream jobs={[mockFailedJob]} />)
    expect(screen.getByText("Connection timeout")).toBeInTheDocument()
  })
})

// ── EntityInspector ───────────────────────────────────────────────────────────

describe("EntityInspector", () => {
  it("shows prompt when no entity selected", () => {
    render(<EntityInspector entity={null} links={[]} entities={[]} />)
    expect(screen.getByText("Click a node to inspect")).toBeInTheDocument()
  })

  it("renders entity name and type", () => {
    render(
      <EntityInspector
        entity={mockEntity}
        links={[mockLink]}
        entities={[mockEntity, mockEntity2]}
      />,
    )
    expect(screen.getByText("Alice Smith")).toBeInTheDocument()
    expect(screen.getByText("Person")).toBeInTheDocument()
  })

  it("shows aliases", () => {
    render(
      <EntityInspector entity={mockEntity} links={[]} entities={[mockEntity]} />,
    )
    expect(screen.getByText("a.k.a. Alice")).toBeInTheDocument()
  })

  it("renders properties", () => {
    render(
      <EntityInspector entity={mockEntity} links={[]} entities={[mockEntity]} />,
    )
    expect(screen.getByText("role")).toBeInTheDocument()
    expect(screen.getByText("Engineer")).toBeInTheDocument()
  })

  it("renders outgoing connections", () => {
    render(
      <EntityInspector
        entity={mockEntity}
        links={[mockLink]}
        entities={[mockEntity, mockEntity2]}
      />,
    )
    expect(screen.getByText("WORKS_AT")).toBeInTheDocument()
    expect(screen.getByText("Acme Corp")).toBeInTheDocument()
  })

  it("shows source count", () => {
    render(
      <EntityInspector entity={mockEntity} links={[]} entities={[mockEntity]} />,
    )
    expect(screen.getByText("3 source documents")).toBeInTheDocument()
  })
})

// ── NeuralPathwaysGraph ───────────────────────────────────────────────────────

describe("NeuralPathwaysGraph", () => {
  const onSelectEntity = vi.fn()

  beforeEach(() => { onSelectEntity.mockClear() })

  it("shows empty state when no data", () => {
    render(
      <NeuralPathwaysGraph
        data={null}
        selectedEntityId={null}
        onSelectEntity={onSelectEntity}
      />,
    )
    expect(screen.getByText(/No entity graph data/)).toBeInTheDocument()
  })

  it("renders SVG with entities", () => {
    const { container } = render(
      <NeuralPathwaysGraph
        data={mockGraphData}
        selectedEntityId={null}
        onSelectEntity={onSelectEntity}
      />,
    )
    const svg = container.querySelector("svg")
    expect(svg).toBeTruthy()
    // Two node groups (g[role=button])
    const nodes = container.querySelectorAll('[role="button"]')
    expect(nodes.length).toBe(2)
  })

  it("calls onSelectEntity when a node is clicked", async () => {
    const user = userEvent.setup()
    const { container } = render(
      <NeuralPathwaysGraph
        data={mockGraphData}
        selectedEntityId={null}
        onSelectEntity={onSelectEntity}
      />,
    )
    const nodes = container.querySelectorAll('[role="button"]')
    await user.click(nodes[0] as HTMLElement)
    expect(onSelectEntity).toHaveBeenCalledTimes(1)
    expect(onSelectEntity).toHaveBeenCalledWith(mockEntity)
  })

  it("deselects when clicking selected entity", async () => {
    const user = userEvent.setup()
    const { container } = render(
      <NeuralPathwaysGraph
        data={mockGraphData}
        selectedEntityId={mockEntity.id}
        onSelectEntity={onSelectEntity}
      />,
    )
    const nodes = container.querySelectorAll('[role="button"]')
    await user.click(nodes[0] as HTMLElement)
    expect(onSelectEntity).toHaveBeenCalledWith(null)
  })

  it("deselects on svg background click", async () => {
    const user = userEvent.setup()
    const { container } = render(
      <NeuralPathwaysGraph
        data={mockGraphData}
        selectedEntityId={mockEntity.id}
        onSelectEntity={onSelectEntity}
      />,
    )
    const svg = container.querySelector("svg")!
    await user.click(svg)
    expect(onSelectEntity).toHaveBeenCalledWith(null)
  })
})

// ── Sidebar nav count ─────────────────────────────────────────────────────────

describe("Sidebar nav items (with BRAIN)", () => {
  it("now contains 15 nav items (14 original + BRAIN)", async () => {
    const { NAV_ITEMS } = await import("@/components/layout/sidebar")
    expect(NAV_ITEMS.length).toBe(15)
  })

  it("includes /brain-cognitive route", async () => {
    const { NAV_ITEMS } = await import("@/components/layout/sidebar")
    const routes = NAV_ITEMS.map((item) => item.href)
    expect(routes).toContain("/brain-cognitive")
  })
})
