import { describe, it, expect, vi } from "vitest"

vi.mock("../../plugins/require-role.js", () => ({
  requireRole: () => async () => {},
  mapGroupsToRoleApi: () => "admin",
}))

const TENANT_A = "tenant-aaa"

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
  const { projectsRoutes } = await import("../../routes/projects.js")
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
  await projectsRoutes(f); return h
}

describe("GET /api/v1/projects", () => {
  it("returns 200 empty", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({ rows: [] })
    const h = await makeFastify(mockQuery); const reply = makeReply()
    await h["GET /api/v1/projects"](makeReq({ query: {} }), reply)
    expect(reply.getCode()).toBe(200); expect(Array.isArray((reply.getPayload() as any).projects)).toBe(true)
  })
  it("returns list", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({ rows: [{ id: "p1", name: "Alpha" }] })
    const h = await makeFastify(mockQuery); const reply = makeReply()
    await h["GET /api/v1/projects"](makeReq({ query: {} }), reply)
    expect(reply.getCode()).toBe(200); expect((reply.getPayload() as any).projects).toHaveLength(1)
  })
})
describe("POST /api/v1/projects", () => {
  it("returns 201", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({ rows: [{ id: "new-proj-id", name: "New" }] })
    const h = await makeFastify(mockQuery); const reply = makeReply()
    await h["POST /api/v1/projects"](makeReq({ body: { name: "New" } }), reply)
    expect(reply.getCode()).toBe(201); expect((reply.getPayload() as any).project.id).toBe("new-proj-id")
  })
})
describe("GET /api/v1/projects/:id", () => {
  it("returns 200 detail", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({ rows: [{ id: "p1", name: "Alpha", task_count: 3 }] })
    const h = await makeFastify(mockQuery); const reply = makeReply()
    await h["GET /api/v1/projects/:id"](makeReq({ params: { id: "p1" } }), reply)
    expect(reply.getCode()).toBe(200)
  })
  it("returns 404", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({ rows: [] })
    const h = await makeFastify(mockQuery); const reply = makeReply()
    await h["GET /api/v1/projects/:id"](makeReq({ params: { id: "nope" } }), reply)
    expect(reply.getCode()).toBe(404)
  })
})
describe("PATCH /api/v1/projects/:id/archive", () => {
  it("archives returns 200", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({ rows: [{ id: "p1", archived_at: new Date() }] })
    const h = await makeFastify(mockQuery); const reply = makeReply()
    await h["PATCH /api/v1/projects/:id/archive"](makeReq({ params: { id: "p1" } }), reply)
    expect(reply.getCode()).toBe(200); expect((reply.getPayload() as any).project.archived_at).toBeTruthy()
  })
})
