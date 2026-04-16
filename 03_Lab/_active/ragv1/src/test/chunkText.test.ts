// @vitest-environment node
import { describe, it, expect } from "vitest";

// Copied verbatim from supabase/functions/ragv1-process-document/index.ts
function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    let chunk = text.slice(start, end);
    if (end < text.length) {
      const lastPeriod = chunk.lastIndexOf(". ");
      const lastNewline = chunk.lastIndexOf("\n");
      const breakPoint = Math.max(lastPeriod, lastNewline);
      if (breakPoint > chunkSize * 0.5) {
        chunk = chunk.slice(0, breakPoint + 1);
      }
    }
    chunks.push(chunk.trim());
    if (end >= text.length) break;
    start += Math.max(chunk.length - overlap, 1);
  }
  return chunks.filter((c) => c.length > 0);
}

describe("chunkText", () => {
  it("returns an empty array for an empty string", () => {
    expect(chunkText("", 100, 10)).toEqual([]);
  });

  it("returns a single chunk when text is shorter than chunkSize", () => {
    const text = "Hello world.";
    const result = chunkText(text, 100, 10);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(text.trim());
  });

  it("respects period sentence boundaries when breaking chunks", () => {
    // Build text that is longer than chunkSize and has a sentence boundary well past the 50% mark
    const sentence1 = "A".repeat(60) + ". ";
    const sentence2 = "B".repeat(60) + ". ";
    const sentence3 = "C".repeat(60) + ". ";
    const text = sentence1 + sentence2 + sentence3;
    // chunkSize of 100 — the period at index ~61 is past 50 (0.5 * 100)
    const result = chunkText(text, 100, 0);
    // First chunk should end at the period boundary, not mid-word
    expect(result[0].endsWith(".")).toBe(true);
  });

  it("respects newline boundaries when breaking chunks", () => {
    const line1 = "A".repeat(60) + "\n";
    const line2 = "B".repeat(60) + "\n";
    const line3 = "C".repeat(60) + "\n";
    const text = line1 + line2 + line3;
    const result = chunkText(text, 100, 0);
    // The first chunk should not cut into a line mid-way when a newline is available
    expect(result.length).toBeGreaterThan(1);
    result.forEach((chunk) => {
      expect(chunk.length).toBeGreaterThan(0);
    });
  });

  it("produces overlapping content between consecutive chunks when overlap > 0", () => {
    // 200 chars, chunkSize 100, overlap 20
    const text = "X".repeat(200);
    const result = chunkText(text, 100, 20);
    expect(result.length).toBeGreaterThanOrEqual(2);
    // The tail of chunk[0] should equal the head of chunk[1] for the overlap region
    const tail = result[0].slice(-20);
    const head = result[1].slice(0, 20);
    expect(tail).toBe(head);
  });

  it("returns only non-empty strings", () => {
    const text = "Hello world. This is a test sentence. Another one here.";
    const result = chunkText(text, 20, 5);
    result.forEach((chunk) => {
      expect(typeof chunk).toBe("string");
      expect(chunk.length).toBeGreaterThan(0);
    });
  });

  it("covers all characters across chunks (no content is dropped)", () => {
    // Use a simple text with no boundary characters so chunking is positional
    const text = "A".repeat(300);
    const result = chunkText(text, 100, 0);
    // Concatenating all chunks should contain every character (allowing for trim)
    const combined = result.join("");
    expect(combined.length).toBeGreaterThanOrEqual(text.length);
  });
});
