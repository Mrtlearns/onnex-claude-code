import { describe, it, expect, vi } from "vitest"

// React cache() is a server-only API -- not available in jsdom.
// Mock it to return an identity function (same behavior: memoizes the factory)
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    cache: fn => fn,
  }
})

const mod = await import("@/lib/query-client")
const getQueryClient = mod.getQueryClient

describe("getQueryClient", () => {
  it("returns a QueryClient instance", () => {
    const client = getQueryClient()
    expect(client).toBeDefined()
    expect(typeof client.getQueryData).toBe("function")
  })

  it("staleTime default is 60_000ms", () => {
    const client = getQueryClient()
    const staleTime = client.getDefaultOptions().queries?.staleTime
    expect(staleTime).toBe(60_000)
  })

  it("getQueryClient returns a QueryClient with getDefaultOptions", () => {
    const client = getQueryClient()
    expect(client.getDefaultOptions()).toBeDefined()
  })
})
