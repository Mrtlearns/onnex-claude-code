import { describe, it, expect } from "vitest"
import { cn } from "@/lib/utils"

describe("cn utility", () => {
  it("merges conflicting Tailwind classes correctly (last wins)", () => {
    expect(cn("p-4", "p-2")).toBe("p-2")
  })
  it("handles undefined and null values", () => {
    expect(cn("text-red-500", undefined, "font-bold")).toBe("text-red-500 font-bold")
  })
  it("merges conditional classes", () => {
    expect(cn("base", false && "skipped", "added")).toBe("base added")
  })
})
