import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("../../plugins/require-role.js", () => ({
  requireRole: () => async () => {},
  mapGroupsToRoleApi: () => "admin",
}))

const TENANT_A = "tenant-aaa"
const TENANT_B = "tenant-bbb"
const PROJECT_ID = "44444444-4444-4444-4444-444444444444"
const ENTRY_ID = "55555555-5555-5555-5555-555555555555"
const USER_ID = "u1"

function makeReq(o: any = {}) {
  return {
    user: { sub: USER_ID, role: "admin", tenantId: TENANT_A },
    query: {},
    params: {},
    body: {},
    ...o,
  }
}

function makeReply() {
  let code = 200
  let payload: unknown = null
  const r = {
    code: (n: number) => { code = n; return r },
    send: (p: unknown) => { payload = p; return r },
    getCode: () => code,
    getPayload: () => payload,
  }
  return r
}

async function makeFastify(mockQuery: any) {
  const { timeEntriesRoutes } = await import("../../routes/time-entries.js")
  const h: Record<string, Function> = {}
  const reg = (method: string) => (p: string, optsOrFn: any, fn?: Function) => {
    const handler = typeof optsOrFn === "function" ? optsOrFn : (fn ?? optsOrFn?.handler)
    if (handler) h[method + " " + p] = handler
  }
  const f: any = {
    get: reg("GET"),
    post: reg("POST"),
    patch: reg("PATCH"),
    delete: reg("DELETE"),
    authenticate: async () => {},
    pool: { query: mockQuery },
  }
  await timeEntriesRoutes(f)
  return h
}

describe("GET /api/v1/time-entries", () => {
  it("returns 200 with tenant-filtered list", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({
      rows: [
        { id: ENTRY_ID, tenant_id: TENANT_A, project_id: PROJECT_ID, duration_minutes: 60 },
      ],
    })
    const h = await makeFastify(mockQuery)
    const reply = makeReply()
    await h["GET /api/v1/time-entries"](makeReq({ query: {} }), reply)
    expect(reply.getCode()).toBe(200)
    expect(Array.isArray((reply.getPayload() as any).timeEntries)).toBe(true)
  })

  it("filters by project_id", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({ rows: [] })
    const h = await makeFastify(mockQuery)
    const reply = makeReply()
    await h["GET /api/v1/time-entries"](makeReq({ query: { project_id: PROJECT_ID } }), reply)
    expect(reply.getCode()).toBe(200)
    const call = mockQuery.mock.calls[0]
    expect(call[0]).toMatch(/project_id/)
  })

  it("tenant isolation — query binds tenant_id from JWT", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({ rows: [] })
    const h = await makeFastify(mockQuery)
    const reply = makeReply()
    await h["GET /api/v1/time-entries"](makeReq({ query: {} }), reply)
    const call = mockQuery.mock.calls[0]
    expect(call[1]).toContain(TENANT_A)
  })

  it("cross-tenant query returns empty (isolation)", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({ rows: [] })
    const h = await makeFastify(mockQuery)
    const reply = makeReply()
    await h["GET /api/v1/time-entries"](
      makeReq({ user: { sub: "u2", role: "admin", tenantId: TENANT_B }, query: {} }),
      reply,
    )
    expect(reply.getCode()).toBe(200)
    expect((reply.getPayload() as any).timeEntries).toHaveLength(0)
  })
})

describe("POST /api/v1/time-entries", () => {
  it("returns 201 with created entry; user_id from JWT", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({
      rows: [
        {
          id: ENTRY_ID,
          user_id: USER_ID,
          project_id: PROJECT_ID,
          duration_minutes: 90,
          billable: true,
        },
      ],
    })
    const h = await makeFastify(mockQuery)
    const reply = makeReply()
    await h["POST /api/v1/time-entries"](
      makeReq({
        body: {
          project_id: PROJECT_ID,
          description: "Research",
          duration_minutes: 90,
          date: "2026-03-11",
          billable: true,
        },
      }),
      reply,
    )
    expect(reply.getCode()).toBe(201)
    const entry = (reply.getPayload() as any).timeEntry
    expect(entry.id).toBe(ENTRY_ID)
    // user_id must come from JWT, not body — verify query params include JWT sub
    const call = mockQuery.mock.calls[0]
    expect(call[1]).toContain(USER_ID)
  })

  it("validates duration_minutes > 0", async () => {
    const mockQuery = vi.fn()
    const h = await makeFastify(mockQuery)
    const reply = makeReply()
    await h["POST /api/v1/time-entries"](
      makeReq({
        body: {
          project_id: PROJECT_ID,
          description: "Nothing",
          duration_minutes: 0,
          date: "2026-03-11",
        },
      }),
      reply,
    )
    expect(reply.getCode()).toBe(400)
  })
})

describe("PATCH /api/v1/time-entries/:id", () => {
  it("owner can patch their own entry", async () => {
    const mockQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [{ id: ENTRY_ID, user_id: USER_ID, tenant_id: TENANT_A }] })
      .mockResolvedValueOnce({ rows: [{ id: ENTRY_ID, duration_minutes: 120 }] })
    const h = await makeFastify(mockQuery)
    const reply = makeReply()
    await h["PATCH /api/v1/time-entries/:id"](
      makeReq({ params: { id: ENTRY_ID }, body: { duration_minutes: 120 } }),
      reply,
    )
    expect(reply.getCode()).toBe(200)
    expect((reply.getPayload() as any).timeEntry.duration_minutes).toBe(120)
  })

  it("returns 404 when entry not found or wrong tenant", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({ rows: [] })
    const h = await makeFastify(mockQuery)
    const reply = makeReply()
    await h["PATCH /api/v1/time-entries/:id"](
      makeReq({ params: { id: ENTRY_ID }, body: { duration_minutes: 60 } }),
      reply,
    )
    expect(reply.getCode()).toBe(404)
  })
})

describe("DELETE /api/v1/time-entries/:id", () => {
  it("owner can delete their own entry", async () => {
    const mockQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [{ id: ENTRY_ID, user_id: USER_ID, tenant_id: TENANT_A }] })
      .mockResolvedValueOnce({ rows: [] })
    const h = await makeFastify(mockQuery)
    const reply = makeReply()
    await h["DELETE /api/v1/time-entries/:id"](
      makeReq({ params: { id: ENTRY_ID } }),
      reply,
    )
    expect(reply.getCode()).toBe(204)
  })

  it("returns 404 when entry not found", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({ rows: [] })
    const h = await makeFastify(mockQuery)
    const reply = makeReply()
    await h["DELETE /api/v1/time-entries/:id"](
      makeReq({ params: { id: ENTRY_ID } }),
      reply,
    )
    expect(reply.getCode()).toBe(404)
  })
})

describe("GET /api/v1/time-entries/weekly-summary", () => {
  it("returns 7-day summary for user", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({
      rows: [
        { date: "2026-03-11", total_minutes: "480", billable_minutes: "360" },
        { date: "2026-03-12", total_minutes: "0", billable_minutes: "0" },
      ],
    })
    const h = await makeFastify(mockQuery)
    const reply = makeReply()
    await h["GET /api/v1/time-entries/weekly-summary"](
      makeReq({ query: { user_id: USER_ID, week_start: "2026-03-11" } }),
      reply,
    )
    expect(reply.getCode()).toBe(200)
    expect(Array.isArray((reply.getPayload() as any).summary)).toBe(true)
  })

  it("resolves user_id=me to JWT sub", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({ rows: [] })
    const h = await makeFastify(mockQuery)
    const reply = makeReply()
    await h["GET /api/v1/time-entries/weekly-summary"](
      makeReq({ query: { user_id: "me", week_start: "2026-03-11" } }),
      reply,
    )
    const call = mockQuery.mock.calls[0]
    // Should bind USER_ID from JWT sub, not "me" literal
    expect(call[1]).toContain(USER_ID)
  })
})
