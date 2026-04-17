import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("../../plugins/require-role.js", () => ({
  requireRole: () => async () => {},
  mapGroupsToRoleApi: () => "admin",
}))

const TENANT_A = "tenant-aaa"
const TENANT_B = "tenant-bbb"

const CLIENT_ID = "11111111-1111-1111-1111-111111111111"
const DEAL_ID = "22222222-2222-2222-2222-222222222222"

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
  const r = {
    code: (n: number) => { code = n; return r },
    send: (p: unknown) => { payload = p; return r },
    getCode: () => code,
    getPayload: () => payload,
  }
  return r
}

async function makeFastify(mockQuery: any) {
  const { dealsRoutes } = await import("../../routes/deals.js")
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
  await dealsRoutes(f)
  return h
}

describe("GET /api/v1/deals", () => {
  it("returns 200 with tenant-filtered list", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({
      rows: [{ id: DEAL_ID, tenant_id: TENANT_A, title: "Big Deal", status: "lead" }],
    })
    const h = await makeFastify(mockQuery)
    const reply = makeReply()
    await h["GET /api/v1/deals"](makeReq({ query: {} }), reply)
    expect(reply.getCode()).toBe(200)
    expect(Array.isArray((reply.getPayload() as any).deals)).toBe(true)
  })

  it("filters by status query param", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({ rows: [] })
    const h = await makeFastify(mockQuery)
    const reply = makeReply()
    await h["GET /api/v1/deals"](makeReq({ query: { status: "won" } }), reply)
    expect(reply.getCode()).toBe(200)
    const call = mockQuery.mock.calls[0]
    expect(call[0]).toMatch(/status/)
  })

  it("tenant isolation — query includes tenant_id", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({ rows: [] })
    const h = await makeFastify(mockQuery)
    const reply = makeReply()
    await h["GET /api/v1/deals"](makeReq({ query: {} }), reply)
    const call = mockQuery.mock.calls[0]
    expect(call[1]).toContain(TENANT_A)
  })
})

describe("POST /api/v1/deals", () => {
  it("returns 201 with created deal", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({
      rows: [{ id: DEAL_ID, tenant_id: TENANT_A, title: "New Deal", status: "lead" }],
    })
    const h = await makeFastify(mockQuery)
    const reply = makeReply()
    await h["POST /api/v1/deals"](
      makeReq({ body: { title: "New Deal", client_id: CLIENT_ID, value: 5000, probability: 20 } }),
      reply,
    )
    expect(reply.getCode()).toBe(201)
    expect((reply.getPayload() as any).deal.id).toBe(DEAL_ID)
  })
})

describe("GET /api/v1/deals/:id", () => {
  it("returns 200 with deal detail", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({
      rows: [{ id: DEAL_ID, tenant_id: TENANT_A, title: "Big Deal" }],
    })
    const h = await makeFastify(mockQuery)
    const reply = makeReply()
    await h["GET /api/v1/deals/:id"](makeReq({ params: { id: DEAL_ID } }), reply)
    expect(reply.getCode()).toBe(200)
    expect((reply.getPayload() as any).deal.id).toBe(DEAL_ID)
  })

  it("returns 404 when deal not found", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({ rows: [] })
    const h = await makeFastify(mockQuery)
    const reply = makeReply()
    await h["GET /api/v1/deals/:id"](makeReq({ params: { id: DEAL_ID } }), reply)
    expect(reply.getCode()).toBe(404)
  })
})

describe("PATCH /api/v1/deals/:id/stage", () => {
  it("returns 200 with updated deal", async () => {
    const mockQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [{ id: DEAL_ID, tenant_id: TENANT_A, owner_id: "u1" }] })  // existing check
      .mockResolvedValueOnce({ rows: [{ id: DEAL_ID, tenant_id: TENANT_A, status: "qualified", stage: "qualified" }] })  // UPDATE
      .mockResolvedValue({ rows: [] })  // optional NOTIF-02 insert
    const h = await makeFastify(mockQuery)
    const reply = makeReply()
    await h["PATCH /api/v1/deals/:id/stage"](
      makeReq({ params: { id: DEAL_ID }, body: { status: "qualified", stage: "qualified" } }),
      reply,
    )
    expect(reply.getCode()).toBe(200)
    expect((reply.getPayload() as any).deal.status).toBe("qualified")
  })
})

describe("POST /api/v1/deals/:id/convert", () => {
  it("returns 201 with draft invoice", async () => {
    // First query: fetch deal; Second query: insert invoice
    const mockQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [{ id: DEAL_ID, client_id: CLIENT_ID, tenant_id: TENANT_A }] })
      .mockResolvedValueOnce({ rows: [{ id: "inv-1", status: "draft", deal_id: DEAL_ID }] })
    const h = await makeFastify(mockQuery)
    const reply = makeReply()
    await h["POST /api/v1/deals/:id/convert"](makeReq({ params: { id: DEAL_ID } }), reply)
    expect(reply.getCode()).toBe(201)
    expect((reply.getPayload() as any).invoice.status).toBe("draft")
  })
})

describe("RBAC — deals", () => {
  it("all authenticated users can create deals (no finance gate)", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({
      rows: [{ id: DEAL_ID, title: "Deal" }],
    })
    const h = await makeFastify(mockQuery)
    const reply = makeReply()
    await h["POST /api/v1/deals"](
      makeReq({
        user: { sub: "u2", role: "team_member", tenantId: TENANT_A },
        body: { title: "Deal", client_id: CLIENT_ID, value: 0, probability: 10 },
      }),
      reply,
    )
    expect(reply.getCode()).toBe(201)
  })
})
