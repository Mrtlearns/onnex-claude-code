import { describe, it, expect, vi } from "vitest"

vi.mock("../../plugins/require-role.js", () => ({
  requireRole: () => async () => {},
  mapGroupsToRoleApi: () => "admin",
}))

const TENANT_A = "tenant-aaa"
const USER_ID = "user-111"

function makeReq(o: any = {}) {
  return { user: { sub: USER_ID, role: "admin", tenantId: TENANT_A }, query: {}, params: {}, body: {}, ...o }
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
  const { tasksRoutes } = await import("../../routes/tasks.js")
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
  await tasksRoutes(f); return h
}

describe("GET /api/v1/tasks", () => {
  it("returns 200 empty", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({ rows: [] })
    const h = await makeFastify(mockQuery); const reply = makeReply()
    await h["GET /api/v1/tasks"](makeReq({ query: {} }), reply)
    expect(reply.getCode()).toBe(200); expect(Array.isArray((reply.getPayload() as any).tasks)).toBe(true)
  })
  it("resolves assignee_id=me", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({ rows: [{ id: "t1", assignee_id: USER_ID }] })
    const h = await makeFastify(mockQuery); const reply = makeReply()
    await h["GET /api/v1/tasks"](makeReq({ query: { assignee_id: "me" } }), reply)
    expect(reply.getCode()).toBe(200); expect((reply.getPayload() as any).tasks).toHaveLength(1)
  })
  it("filters by project_id", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({ rows: [] })
    const h = await makeFastify(mockQuery); const reply = makeReply()
    await h["GET /api/v1/tasks"](makeReq({ query: { project_id: "p1" } }), reply)
    expect(reply.getCode()).toBe(200)
  })
})
describe("POST /api/v1/tasks", () => {
  it("returns 201", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({ rows: [{ id: "new-task-id", title: "Do it" }] })
    const h = await makeFastify(mockQuery); const reply = makeReply()
    await h["POST /api/v1/tasks"](makeReq({ body: { title: "Do it" } }), reply)
    expect(reply.getCode()).toBe(201); expect((reply.getPayload() as any).task.id).toBe("new-task-id")
  })
})
describe("PATCH /api/v1/tasks/:id", () => {
  it("updates status returns 200", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({ rows: [{ id: "t1", status: "In Progress" }] })
    const h = await makeFastify(mockQuery); const reply = makeReply()
    await h["PATCH /api/v1/tasks/:id"](makeReq({ params: { id: "t1" }, body: { status: "In Progress" } }), reply)
    expect(reply.getCode()).toBe(200); expect((reply.getPayload() as any).task.status).toBe("In Progress")
  })
})
describe("POST /api/v1/tasks/:id/subtasks", () => {
  it("creates subtask returns 201", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({ rows: [{ id: "st1", task_id: "t1", title: "Step", completed: false }] })
    const h = await makeFastify(mockQuery); const reply = makeReply()
    await h["POST /api/v1/tasks/:id/subtasks"](makeReq({ params: { id: "t1" }, body: { title: "Step" } }), reply)
    expect(reply.getCode()).toBe(201); expect((reply.getPayload() as any).subtask.id).toBe("st1")
  })
})
describe("POST /api/v1/tasks/:id/comments", () => {
  it("creates comment returns 201", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({ rows: [{ id: "cm1", task_id: "t1", author_id: USER_ID, body: "Done" }] })
    const h = await makeFastify(mockQuery); const reply = makeReply()
    await h["POST /api/v1/tasks/:id/comments"](makeReq({ params: { id: "t1" }, body: { body: "Done" } }), reply)
    expect(reply.getCode()).toBe(201); expect((reply.getPayload() as any).comment.id).toBe("cm1")
  })
})
describe("Tenant isolation - tasks", () => {
  it("cross-tenant returns empty", async () => {
    const mockQuery = vi.fn().mockResolvedValueOnce({ rows: [] })
    const h = await makeFastify(mockQuery); const reply = makeReply()
    await h["GET /api/v1/tasks"](makeReq({ user: { sub: "other", role: "admin", tenantId: "tenant-zzz" }, query: {} }), reply)
    expect(reply.getCode()).toBe(200); expect((reply.getPayload() as any).tasks).toHaveLength(0)
  })
})
