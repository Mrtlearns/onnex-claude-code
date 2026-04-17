import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("../../plugins/require-role.js", () => ({
  requireRole: () => async () => {},
  mapGroupsToRoleApi: () => "admin",
}))

const TENANT_A = "tenant-aaa"
const USER_ID = "22222222-2222-2222-2222-222222222222"
const CLIENT_ID = "11111111-1111-1111-1111-111111111111"
const PROJECT_ID = "44444444-4444-4444-4444-444444444444"

function makeReq(o: any = {}) {
  return {
    user: { sub: "u1", role: "admin", tenantId: TENANT_A },
    query: {},
    params: {},
    body: {},
    ...o,
  }
}

function makeReply() {
  let code = 200
  let payload: unknown = null
  const headers: Record<string, string> = {}
  const r = {
    code: (n: number) => { code = n; return r },
    send: (p: unknown) => { payload = p; return r },
    header: (k: string, v: string) => { headers[k] = v; return r },
    getCode: () => code,
    getPayload: () => payload,
    getHeaders: () => headers,
  }
  return r
}

async function makeFastify(mockQuery: any) {
  const { reportsRoutes } = await import("../../routes/reports.js")
  const h: Record<string, Function> = {}
  const reg = (method: string) => (p: string, optsOrFn: any, fn?: Function) => {
    const handler = typeof optsOrFn === "function" ? optsOrFn : (fn ?? optsOrFn?.handler)
    if (handler) h[method + " " + p] = handler
  }
  const f: any = {
    get: reg("GET"),
    post: reg("POST"),
    authenticate: async () => {},
    pool: { query: mockQuery },
  }
  await reportsRoutes(f)
  return h
}

// ---------------------------------------------------------------------------
// Unit: getPeriodRange
// ---------------------------------------------------------------------------
describe("getPeriodRange", () => {
  it("this_month → startDate is 1st of current UTC month", async () => {
    const { getPeriodRange } = await import("../../routes/reports.js")
    const { startDate } = getPeriodRange("this_month")
    const now = new Date()
    expect(startDate.getUTCFullYear()).toBe(now.getUTCFullYear())
    expect(startDate.getUTCMonth()).toBe(now.getUTCMonth())
    expect(startDate.getUTCDate()).toBe(1)
  })

  it("last_month → startDate is 1st of previous UTC month", async () => {
    const { getPeriodRange } = await import("../../routes/reports.js")
    const { startDate } = getPeriodRange("last_month")
    const now = new Date()
    const expectedMonth = now.getUTCMonth() === 0 ? 11 : now.getUTCMonth() - 1
    expect(startDate.getUTCDate()).toBe(1)
    expect(startDate.getUTCMonth()).toBe(expectedMonth)
  })

  it("custom with start/end → returns those exact dates", async () => {
    const { getPeriodRange } = await import("../../routes/reports.js")
    const { startDate, endDate } = getPeriodRange(
      "custom",
      "2026-01-01T00:00:00.000Z",
      "2026-01-31T23:59:59.000Z",
    )
    expect(startDate.toISOString()).toBe("2026-01-01T00:00:00.000Z")
    expect(endDate.toISOString()).toBe("2026-01-31T23:59:59.000Z")
  })

  it("custom without start/end → throws Error", async () => {
    const { getPeriodRange } = await import("../../routes/reports.js")
    expect(() => getPeriodRange("custom")).toThrow(
      "custom period requires start and end ISO strings",
    )
  })
})

// ---------------------------------------------------------------------------
// Unit: rowsToCsv
// ---------------------------------------------------------------------------
describe("rowsToCsv", () => {
  it("produces correct header row from provided headers array", async () => {
    const { rowsToCsv } = await import("../../routes/reports.js")
    const csv = rowsToCsv(["id", "name", "total"], [{ id: "1", name: "Alice", total: 100 }])
    const lines = csv.split("\n")
    expect(lines[0]).toBe("id,name,total")
  })

  it("wraps values containing commas in double quotes", async () => {
    const { rowsToCsv } = await import("../../routes/reports.js")
    const csv = rowsToCsv(
      ["name"],
      [{ name: "Smith, John" }],
    )
    const lines = csv.split("\n")
    expect(lines[1]).toBe('"Smith, John"')
  })

  it("handles null as empty string", async () => {
    const { rowsToCsv } = await import("../../routes/reports.js")
    const csv = rowsToCsv(["name", "value"], [{ name: "Alice", value: null }])
    const lines = csv.split("\n")
    expect(lines[1]).toBe("Alice,")
  })

  it("handles undefined as empty string", async () => {
    const { rowsToCsv } = await import("../../routes/reports.js")
    const csv = rowsToCsv(["name", "value"], [{ name: "Bob" } as any])
    const lines = csv.split("\n")
    expect(lines[1]).toBe("Bob,")
  })
})

// ---------------------------------------------------------------------------
// GET /api/v1/reports/utilization
// ---------------------------------------------------------------------------
describe("GET /api/v1/reports/utilization", () => {
  beforeEach(() => { vi.resetModules() })

  it("returns 200 with mapped rows (total_minutes as int, utilization_pct calculated)", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({
      rows: [
        { user_id: USER_ID, user_name: "Alice", total_minutes: "2400" },
      ],
    })
    const h = await makeFastify(mockQuery)
    const reply = makeReply()
    await h["GET /api/v1/reports/utilization"](
      makeReq({ query: { period: "this_month" } }),
      reply,
    )
    expect(reply.getCode()).toBe(200)
    const rows = reply.getPayload() as any[]
    expect(Array.isArray(rows)).toBe(true)
    expect(rows[0].total_minutes).toBe(2400)
    expect(typeof rows[0].utilization_pct).toBe("number")
    expect(typeof rows[0].capacity_minutes).toBe("number")
  })

  it("tenant isolation: pool.query called with tenantId as $1", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({ rows: [] })
    const h = await makeFastify(mockQuery)
    const reply = makeReply()
    await h["GET /api/v1/reports/utilization"](
      makeReq({ query: { period: "this_month" } }),
      reply,
    )
    const [, params] = mockQuery.mock.calls[0]
    expect(params[0]).toBe(TENANT_A)
  })

  it("?format=csv returns Content-Type: text/csv header", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({
      rows: [
        { user_id: USER_ID, user_name: "Alice", total_minutes: "600" },
      ],
    })
    const h = await makeFastify(mockQuery)
    const reply = makeReply()
    await h["GET /api/v1/reports/utilization"](
      makeReq({ query: { period: "this_month", format: "csv" } }),
      reply,
    )
    expect(reply.getHeaders()["Content-Type"]).toBe("text/csv")
    expect(typeof reply.getPayload()).toBe("string")
  })

  it("empty result returns 200 with empty array", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({ rows: [] })
    const h = await makeFastify(mockQuery)
    const reply = makeReply()
    await h["GET /api/v1/reports/utilization"](
      makeReq({ query: {} }),
      reply,
    )
    expect(reply.getCode()).toBe(200)
    expect(reply.getPayload()).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// GET /api/v1/reports/revenue
// ---------------------------------------------------------------------------
describe("GET /api/v1/reports/revenue", () => {
  beforeEach(() => { vi.resetModules() })

  it("returns 200 with rows (invoiced_total + received_total as floats)", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({
      rows: [
        {
          client_id: CLIENT_ID,
          client_name: "Acme Corp",
          invoiced_total: "12000.50",
          received_total: "8000.00",
        },
      ],
    })
    const h = await makeFastify(mockQuery)
    const reply = makeReply()
    await h["GET /api/v1/reports/revenue"](
      makeReq({ query: { period: "this_month" } }),
      reply,
    )
    expect(reply.getCode()).toBe(200)
    const rows = reply.getPayload() as any[]
    expect(rows[0].invoiced_total).toBe(12000.5)
    expect(rows[0].received_total).toBe(8000.0)
    expect(rows[0].client_name).toBe("Acme Corp")
  })

  it("tenant isolation: pool.query called with tenantId as $1", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({ rows: [] })
    const h = await makeFastify(mockQuery)
    const reply = makeReply()
    await h["GET /api/v1/reports/revenue"](
      makeReq({ query: {} }),
      reply,
    )
    const [, params] = mockQuery.mock.calls[0]
    expect(params[0]).toBe(TENANT_A)
  })

  it("?format=csv returns Content-Type: text/csv header", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({
      rows: [
        {
          client_id: CLIENT_ID,
          client_name: "Acme",
          invoiced_total: "500",
          received_total: "500",
        },
      ],
    })
    const h = await makeFastify(mockQuery)
    const reply = makeReply()
    await h["GET /api/v1/reports/revenue"](
      makeReq({ query: { format: "csv" } }),
      reply,
    )
    expect(reply.getHeaders()["Content-Type"]).toBe("text/csv")
    const csv = reply.getPayload() as string
    expect(csv).toContain("client_id,client_name,invoiced_total,received_total")
  })
})

// ---------------------------------------------------------------------------
// GET /api/v1/reports/profitability
// ---------------------------------------------------------------------------
describe("GET /api/v1/reports/profitability", () => {
  beforeEach(() => { vi.resetModules() })

  it("returns 200 with rows including margin and margin_pct", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({
      rows: [
        {
          project_id: PROJECT_ID,
          project_name: "Build CRM",
          revenue: "10000",
          cost: "4000",
        },
      ],
    })
    const h = await makeFastify(mockQuery)
    const reply = makeReply()
    await h["GET /api/v1/reports/profitability"](
      makeReq({ query: {} }),
      reply,
    )
    expect(reply.getCode()).toBe(200)
    const rows = reply.getPayload() as any[]
    expect(rows[0].revenue).toBe(10000)
    expect(rows[0].cost).toBe(4000)
    expect(rows[0].margin).toBe(6000)
    expect(rows[0].margin_pct).toBe(60)
  })

  it("margin_pct is 0 when revenue is 0 (no division by zero)", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({
      rows: [
        {
          project_id: PROJECT_ID,
          project_name: "New Project",
          revenue: "0",
          cost: "0",
        },
      ],
    })
    const h = await makeFastify(mockQuery)
    const reply = makeReply()
    await h["GET /api/v1/reports/profitability"](
      makeReq({ query: {} }),
      reply,
    )
    const rows = reply.getPayload() as any[]
    expect(rows[0].margin_pct).toBe(0)
  })

  it("tenant isolation: pool.query called with tenantId as $1", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({ rows: [] })
    const h = await makeFastify(mockQuery)
    const reply = makeReply()
    await h["GET /api/v1/reports/profitability"](
      makeReq({ query: {} }),
      reply,
    )
    const [, params] = mockQuery.mock.calls[0]
    expect(params[0]).toBe(TENANT_A)
  })
})

// ---------------------------------------------------------------------------
// GET /api/v1/reports/client-activity
// ---------------------------------------------------------------------------
describe("GET /api/v1/reports/client-activity", () => {
  beforeEach(() => { vi.resetModules() })

  it("returns 200 with event_count as int", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({
      rows: [
        {
          client_id: CLIENT_ID,
          client_name: "Globex",
          event_count: "42",
          last_active_at: "2026-04-10T09:00:00.000Z",
        },
      ],
    })
    const h = await makeFastify(mockQuery)
    const reply = makeReply()
    await h["GET /api/v1/reports/client-activity"](
      makeReq({ query: {} }),
      reply,
    )
    expect(reply.getCode()).toBe(200)
    const rows = reply.getPayload() as any[]
    expect(rows[0].event_count).toBe(42)
    expect(rows[0].client_name).toBe("Globex")
  })

  it("last_active_at null is preserved as null", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({
      rows: [
        {
          client_id: CLIENT_ID,
          client_name: "Inactive Client",
          event_count: "0",
          last_active_at: null,
        },
      ],
    })
    const h = await makeFastify(mockQuery)
    const reply = makeReply()
    await h["GET /api/v1/reports/client-activity"](
      makeReq({ query: {} }),
      reply,
    )
    const rows = reply.getPayload() as any[]
    expect(rows[0].last_active_at).toBeNull()
  })

  it("tenant isolation: pool.query called with tenantId as $1", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({ rows: [] })
    const h = await makeFastify(mockQuery)
    const reply = makeReply()
    await h["GET /api/v1/reports/client-activity"](
      makeReq({ query: {} }),
      reply,
    )
    const [, params] = mockQuery.mock.calls[0]
    expect(params[0]).toBe(TENANT_A)
  })

  it("?format=csv returns Content-Type: text/csv header with correct columns", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({
      rows: [
        {
          client_id: CLIENT_ID,
          client_name: "Globex",
          event_count: "5",
          last_active_at: "2026-04-10T09:00:00.000Z",
        },
      ],
    })
    const h = await makeFastify(mockQuery)
    const reply = makeReply()
    await h["GET /api/v1/reports/client-activity"](
      makeReq({ query: { format: "csv" } }),
      reply,
    )
    expect(reply.getHeaders()["Content-Type"]).toBe("text/csv")
    const csv = reply.getPayload() as string
    expect(csv).toContain("client_id,client_name,event_count,last_active_at")
  })
})
