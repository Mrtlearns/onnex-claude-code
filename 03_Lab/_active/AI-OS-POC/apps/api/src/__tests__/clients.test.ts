import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("../../plugins/require-role.js", () => ({
  requireRole: () => async () => {},
  mapGroupsToRoleApi: () => "admin",
}))

const TENANT_A = "tenant-aaa"
const TENANT_B = "tenant-bbb"

function makeReq(o: any = {}) {
  return { user: { sub: "u1", role: "admin", tenantId: TENANT_A }, query: {}, params: {}, body: {}, ...o }
}
function makeReply() {
  let code = 200; let payload: unknown = null
  const r = {
    code: (n: number) => { code = n; return r },
    send: (p: unknown) => { payload = p; return r },
    getCode: () => code, getPayload: () => payload
  }
  return r
}

async function makeFastify(mockQuery: any) {
  const { clientsRoutes } = await import("../../routes/clients.js")
  const h: Record<string, Function> = {}
  const reg = (method: string) => (p: string, optsOrFn: any, fn?: Function) => {
    const handler = typeof optsOrFn === "function" ? optsOrFn : (fn ?? optsOrFn?.handler)
    if (handler) h[method + " " + p] = handler
  }
  const f: any = {
    get: reg("GET"), post: reg("POST"), patch: reg("PATCH"), delete: reg("DELETE"),
    authenticate: async () => {},
    pool: { query: mockQuery },
  }
  await clientsRoutes(f); return h
}

describe("GET /api/v1/clients", () => {
  it("returns 200 empty", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({ rows: [] })
    const h = await makeFastify(mockQuery); const reply = makeReply()
    await h["GET /api/v1/clients"](makeReq({ query: {} }), reply)
    expect(reply.getCode()).toBe(200); expect(Array.isArray((reply.getPayload() as any).clients)).toBe(true)
  })
  it("returns list", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({ rows: [{ id: "c1", name: "Acme" }] })
    const h = await makeFastify(mockQuery); const reply = makeReply()
    await h["GET /api/v1/clients"](makeReq({ query: {} }), reply)
    expect(reply.getCode()).toBe(200); expect((reply.getPayload() as any).clients).toHaveLength(1)
  })
})
describe("POST /api/v1/clients", () => {
  it("returns 201", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({ rows: [{ id: "new-id", name: "New" }] })
    const h = await makeFastify(mockQuery); const reply = makeReply()
    await h["POST /api/v1/clients"](makeReq({ body: { name: "New", type: "Agency" } }), reply)
    expect(reply.getCode()).toBe(201); expect((reply.getPayload() as any).client.id).toBe("new-id")
  })
})
describe("GET /api/v1/clients/:id", () => {
  it("returns 200 detail", async () => {
    const mockQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [{ id: "c1" }] })
      .mockResolvedValueOnce({ rows: [] })
    const h = await makeFastify(mockQuery); const reply = makeReply()
    await h["GET /api/v1/clients/:id"](makeReq({ params: { id: "c1" } }), reply)
    expect(reply.getCode()).toBe(200)
  })
  it("returns 404", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({ rows: [] })
    const h = await makeFastify(mockQuery); const reply = makeReply()
    await h["GET /api/v1/clients/:id"](makeReq({ params: { id: "nope" } }), reply)
    expect(reply.getCode()).toBe(404)
  })
})
describe("PATCH /api/v1/clients/:id/archive", () => {
  it("archives returns 200", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({ rows: [{ id: "c1", archived_at: new Date() }] })
    const h = await makeFastify(mockQuery); const reply = makeReply()
    await h["PATCH /api/v1/clients/:id/archive"](makeReq({ params: { id: "c1" } }), reply)
    expect(reply.getCode()).toBe(200); expect((reply.getPayload() as any).client.archived_at).toBeTruthy()
  })
})
describe("Tenant isolation", () => {
  it("cross-tenant returns empty", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({ rows: [] })
    const h = await makeFastify(mockQuery); const reply = makeReply()
    await h["GET /api/v1/clients"](makeReq({ user: { sub: "u2", role: "admin", tenantId: TENANT_B }, query: {} }), reply)
    expect(reply.getCode()).toBe(200); expect((reply.getPayload() as any).clients).toHaveLength(0)
  })
})
