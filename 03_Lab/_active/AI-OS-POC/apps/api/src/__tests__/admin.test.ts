import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("../../plugins/require-role.js", () => ({
  requireRole: () => async () => {},
  mapGroupsToRoleApi: () => "super_admin",
}))

const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFetchOk(body: unknown) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  })
}

function makeFetchFail(status = 500) {
  return Promise.resolve({
    ok: false,
    status,
    text: () => Promise.resolve("error"),
  })
}

function makeReq(o: any = {}) {
  return {
    user: { sub: "u1", name: "Admin User", role: "super_admin" },
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
  const { adminRoutes } = await import("../../routes/admin.js")
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
    log: { warn: vi.fn() },
  }
  await adminRoutes(f)
  return h
}

// ---------------------------------------------------------------------------
// GET /api/v1/admin/users
// ---------------------------------------------------------------------------

describe("GET /api/v1/admin/users", () => {
  beforeEach(() => {
    vi.resetModules()
    mockFetch.mockReset()
  })

  it("returns mapped user list from Authentik", async () => {
    mockFetch.mockReturnValueOnce(
      makeFetchOk({
        results: [
          {
            pk: "pk-1",
            name: "Alice Smith",
            email: "alice@example.com",
            is_active: true,
            attributes: { aios_role: "ops_manager" },
          },
        ],
      }),
    )
    const mockQuery = vi.fn()
    const h = await makeFastify(mockQuery)
    const reply = makeReply()
    await h["GET /api/v1/admin/users"](makeReq(), reply)

    expect(reply.getCode()).toBe(200)
    const users = reply.getPayload() as any[]
    expect(Array.isArray(users)).toBe(true)
    expect(users[0].name).toBe("Alice Smith")
    expect(users[0].email).toBe("alice@example.com")
    expect(users[0].is_active).toBe(true)
  })

  it("maps user.pk as id when present", async () => {
    mockFetch.mockReturnValueOnce(
      makeFetchOk({
        results: [
          {
            pk: "pk-99",
            id: "id-fallback",
            name: "Bob",
            email: "bob@example.com",
            is_active: true,
            attributes: {},
          },
        ],
      }),
    )
    const mockQuery = vi.fn()
    const h = await makeFastify(mockQuery)
    const reply = makeReply()
    await h["GET /api/v1/admin/users"](makeReq(), reply)

    const users = reply.getPayload() as any[]
    expect(users[0].id).toBe("pk-99")
  })

  it("falls back to u.id when pk is absent", async () => {
    mockFetch.mockReturnValueOnce(
      makeFetchOk({
        results: [
          {
            id: "id-only",
            name: "Carol",
            email: "carol@example.com",
            is_active: true,
            attributes: {},
          },
        ],
      }),
    )
    const mockQuery = vi.fn()
    const h = await makeFastify(mockQuery)
    const reply = makeReply()
    await h["GET /api/v1/admin/users"](makeReq(), reply)

    const users = reply.getPayload() as any[]
    expect(users[0].id).toBe("id-only")
  })

  it("maps aios_role from attributes", async () => {
    mockFetch.mockReturnValueOnce(
      makeFetchOk({
        results: [
          {
            pk: "pk-2",
            name: "Dave",
            email: "dave@example.com",
            is_active: true,
            attributes: { aios_role: "sales_rep" },
          },
        ],
      }),
    )
    const mockQuery = vi.fn()
    const h = await makeFastify(mockQuery)
    const reply = makeReply()
    await h["GET /api/v1/admin/users"](makeReq(), reply)

    const users = reply.getPayload() as any[]
    expect(users[0].role).toBe("sales_rep")
  })

  it("rejects when authentikFetch fails (fetch returns ok: false)", async () => {
    mockFetch.mockReturnValueOnce(makeFetchFail(503))
    const mockQuery = vi.fn()
    const h = await makeFastify(mockQuery)
    await expect(h["GET /api/v1/admin/users"](makeReq(), makeReply())).rejects.toThrow(
      /Authentik 503/,
    )
  })
})

// ---------------------------------------------------------------------------
// PATCH /api/v1/admin/users/:id/role
// ---------------------------------------------------------------------------

describe("PATCH /api/v1/admin/users/:id/role", () => {
  beforeEach(() => {
    vi.resetModules()
    mockFetch.mockReset()
  })

  it("calls authentikFetch PATCH with correct path and body", async () => {
    mockFetch.mockReturnValueOnce(makeFetchOk({}))
    const mockQuery = vi.fn().mockResolvedValue({ rows: [] })
    const h = await makeFastify(mockQuery)
    const reply = makeReply()

    await h["PATCH /api/v1/admin/users/:id/role"](
      makeReq({ params: { id: "user-42" }, body: { role: "account_manager" } }),
      reply,
    )

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toContain("/api/v3/core/users/user-42/")
    expect(init.method).toBe("PATCH")
    expect(JSON.parse(init.body)).toMatchObject({ attributes: { aios_role: "account_manager" } })
  })

  it("calls pool.query for audit log insert", async () => {
    mockFetch.mockReturnValueOnce(makeFetchOk({}))
    const mockQuery = vi.fn().mockResolvedValue({ rows: [] })
    const h = await makeFastify(mockQuery)
    const reply = makeReply()

    await h["PATCH /api/v1/admin/users/:id/role"](
      makeReq({ params: { id: "user-42" }, body: { role: "specialist" } }),
      reply,
    )

    expect(mockQuery).toHaveBeenCalledOnce()
    const [sql, params] = mockQuery.mock.calls[0]
    expect(sql).toMatch(/INSERT INTO audit_log/)
    expect(params).toContain("user_role_changed")
  })

  it("returns 200 { updated: true }", async () => {
    mockFetch.mockReturnValueOnce(makeFetchOk({}))
    const mockQuery = vi.fn().mockResolvedValue({ rows: [] })
    const h = await makeFastify(mockQuery)
    const reply = makeReply()

    await h["PATCH /api/v1/admin/users/:id/role"](
      makeReq({ params: { id: "user-42" }, body: { role: "read_only" } }),
      reply,
    )

    expect(reply.getCode()).toBe(200)
    expect((reply.getPayload() as any).updated).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// POST /api/v1/admin/users/:id/suspend
// ---------------------------------------------------------------------------

describe("POST /api/v1/admin/users/:id/suspend", () => {
  beforeEach(() => {
    vi.resetModules()
    mockFetch.mockReset()
  })

  it("calls authentikFetch PATCH with { is_active: false }", async () => {
    mockFetch.mockReturnValueOnce(makeFetchOk({}))
    const mockQuery = vi.fn().mockResolvedValue({ rows: [] })
    const h = await makeFastify(mockQuery)
    const reply = makeReply()

    await h["POST /api/v1/admin/users/:id/suspend"](
      makeReq({ params: { id: "user-55" } }),
      reply,
    )

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toContain("/api/v3/core/users/user-55/")
    expect(init.method).toBe("PATCH")
    expect(JSON.parse(init.body)).toMatchObject({ is_active: false })
  })

  it("calls pool.query for audit log insert", async () => {
    mockFetch.mockReturnValueOnce(makeFetchOk({}))
    const mockQuery = vi.fn().mockResolvedValue({ rows: [] })
    const h = await makeFastify(mockQuery)
    const reply = makeReply()

    await h["POST /api/v1/admin/users/:id/suspend"](
      makeReq({ params: { id: "user-55" } }),
      reply,
    )

    expect(mockQuery).toHaveBeenCalledOnce()
    const [sql, params] = mockQuery.mock.calls[0]
    expect(sql).toMatch(/INSERT INTO audit_log/)
    expect(params).toContain("user_suspended")
  })

  it("returns 200 { suspended: true }", async () => {
    mockFetch.mockReturnValueOnce(makeFetchOk({}))
    const mockQuery = vi.fn().mockResolvedValue({ rows: [] })
    const h = await makeFastify(mockQuery)
    const reply = makeReply()

    await h["POST /api/v1/admin/users/:id/suspend"](
      makeReq({ params: { id: "user-55" } }),
      reply,
    )

    expect(reply.getCode()).toBe(200)
    expect((reply.getPayload() as any).suspended).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// POST /api/v1/admin/invite
// ---------------------------------------------------------------------------

describe("POST /api/v1/admin/invite", () => {
  beforeEach(() => {
    vi.resetModules()
    mockFetch.mockReset()
  })

  it("calls authentikFetch POST to /api/v3/core/invitations/", async () => {
    mockFetch.mockReturnValueOnce(makeFetchOk({ pk: "inv-1" }))
    const mockQuery = vi.fn().mockResolvedValue({ rows: [] })
    const h = await makeFastify(mockQuery)
    const reply = makeReply()

    await h["POST /api/v1/admin/invite"](
      makeReq({ body: { email: "new@example.com", role: "sales_rep" } }),
      reply,
    )

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toContain("/api/v3/core/invitations/")
    expect(init.method).toBe("POST")
    const body = JSON.parse(init.body)
    expect(body.fixed_data).toMatchObject({ email: "new@example.com", aios_role: "sales_rep" })
  })

  it("calls pool.query for audit log", async () => {
    mockFetch.mockReturnValueOnce(makeFetchOk({ pk: "inv-2" }))
    const mockQuery = vi.fn().mockResolvedValue({ rows: [] })
    const h = await makeFastify(mockQuery)
    const reply = makeReply()

    await h["POST /api/v1/admin/invite"](
      makeReq({ body: { email: "new@example.com", role: "recruiter" } }),
      reply,
    )

    expect(mockQuery).toHaveBeenCalledOnce()
    const [sql, params] = mockQuery.mock.calls[0]
    expect(sql).toMatch(/INSERT INTO audit_log/)
    expect(params).toContain("user_invited")
  })

  it("returns 201 { invited: true }", async () => {
    mockFetch.mockReturnValueOnce(makeFetchOk({ pk: "inv-3" }))
    const mockQuery = vi.fn().mockResolvedValue({ rows: [] })
    const h = await makeFastify(mockQuery)
    const reply = makeReply()

    await h["POST /api/v1/admin/invite"](
      makeReq({ body: { email: "new@example.com", role: "client_external" } }),
      reply,
    )

    expect(reply.getCode()).toBe(201)
    expect((reply.getPayload() as any).invited).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// GET /api/v1/admin/audit-log
// ---------------------------------------------------------------------------

describe("GET /api/v1/admin/audit-log", () => {
  beforeEach(() => {
    vi.resetModules()
    mockFetch.mockReset()
  })

  it("calls pool.query with SELECT * FROM audit_log", async () => {
    const rows = [
      { id: "al-1", action: "user_invited", created_at: "2026-04-17T10:00:00Z" },
    ]
    const mockQuery = vi.fn().mockResolvedValueOnce({ rows })
    const h = await makeFastify(mockQuery)
    const reply = makeReply()

    await h["GET /api/v1/admin/audit-log"](makeReq(), reply)

    expect(mockQuery).toHaveBeenCalledOnce()
    const [sql] = mockQuery.mock.calls[0]
    expect(sql).toMatch(/SELECT \* FROM audit_log/)
  })

  it("returns 200 with rows", async () => {
    const rows = [
      { id: "al-1", action: "user_suspended", created_at: "2026-04-17T09:00:00Z" },
      { id: "al-2", action: "user_invited", created_at: "2026-04-17T08:00:00Z" },
    ]
    const mockQuery = vi.fn().mockResolvedValueOnce({ rows })
    const h = await makeFastify(mockQuery)
    const reply = makeReply()

    await h["GET /api/v1/admin/audit-log"](makeReq(), reply)

    expect(reply.getCode()).toBe(200)
    expect(reply.getPayload()).toEqual(rows)
  })

  it("rejects when pool.query fails", async () => {
    const mockQuery = vi.fn().mockRejectedValueOnce(new Error("DB connection lost"))
    const h = await makeFastify(mockQuery)

    await expect(
      h["GET /api/v1/admin/audit-log"](makeReq(), makeReply()),
    ).rejects.toThrow("DB connection lost")
  })
})
