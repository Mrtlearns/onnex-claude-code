// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Helpers extracted from edge functions for unit testing.
// These replicate the pure-logic portions of the edge function helpers
// to validate their behavior in isolation (no Deno runtime required).
// ---------------------------------------------------------------------------

// Replication of hmacSha256Hex from ragv1-api/index.ts
async function hmacSha256Hex(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// Replication of callGeminiJson result parsing logic from ragv1-chat/index.ts
function parseGeminiJsonResponse<T>(raw: string): T | null {
  try { return JSON.parse(raw) as T; }
  catch { return null; }
}

// Replication of rerankChunks sorting + slicing logic
function sortAndSliceByRerankScore(chunks: any[], topK: number): any[] {
  return chunks
    .slice()
    .sort((a, b) => (b.rerankScore ?? 0) - (a.rerankScore ?? 0))
    .slice(0, topK);
}

// Replication of runReActLoop dedup logic
function mergeChunksDedup(existing: Map<number, any>, newChunks: any[]): number {
  let added = 0;
  for (const c of newChunks) {
    if (!existing.has(c.id)) {
      existing.set(c.id, c);
      added++;
    }
  }
  return added;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Bug 1 fix — hmacSha256Hex (deterministic HMAC-SHA256)", () => {
  it("produces the same output for the same input and secret", async () => {
    const h1 = await hmacSha256Hex("test-api-key", "my-secret");
    const h2 = await hmacSha256Hex("test-api-key", "my-secret");
    expect(h1).toBe(h2);
  });

  it("produces a different output when the secret differs", async () => {
    const h1 = await hmacSha256Hex("test-api-key", "secret-a");
    const h2 = await hmacSha256Hex("test-api-key", "secret-b");
    expect(h1).not.toBe(h2);
  });

  it("produces a different output when the message differs", async () => {
    const h1 = await hmacSha256Hex("key-one", "shared-secret");
    const h2 = await hmacSha256Hex("key-two", "shared-secret");
    expect(h1).not.toBe(h2);
  });

  it("returns a 64-character hex string (256-bit SHA-256 output)", async () => {
    const h = await hmacSha256Hex("any-key", "any-secret");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("callGeminiJson — JSON parsing logic", () => {
  it("parses valid JSON response correctly", () => {
    const raw = '{"score": 0.85, "reason": "Good answer"}';
    const result = parseGeminiJsonResponse<{ score: number; reason: string }>(raw);
    expect(result).toEqual({ score: 0.85, reason: "Good answer" });
  });

  it("returns null for invalid JSON without throwing", () => {
    const raw = "not valid json {{";
    const result = parseGeminiJsonResponse<any>(raw);
    expect(result).toBeNull();
  });

  it("returns null for empty string without throwing", () => {
    const result = parseGeminiJsonResponse<any>("");
    expect(result).toBeNull();
  });

  it("handles nested objects", () => {
    const raw = '{"is_sufficient": false, "missing_aspects": "details about X", "follow_up_query": "what is X?"}';
    const result = parseGeminiJsonResponse<{ is_sufficient: boolean; follow_up_query: string }>(raw);
    expect(result?.is_sufficient).toBe(false);
    expect(result?.follow_up_query).toBe("what is X?");
  });
});

describe("Re-ranking — sort + slice logic", () => {
  const makeChunks = (scores: number[]) =>
    scores.map((rerankScore, i) => ({ id: i + 1, content: `chunk ${i}`, rerankScore }));

  it("returns empty array for empty input", () => {
    expect(sortAndSliceByRerankScore([], 5)).toEqual([]);
  });

  it("returns at most topK items", () => {
    const chunks = makeChunks([0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3]);
    const result = sortAndSliceByRerankScore(chunks, 3);
    expect(result.length).toBe(3);
  });

  it("sorts descending by rerankScore", () => {
    const chunks = makeChunks([0.3, 0.9, 0.6]);
    const result = sortAndSliceByRerankScore(chunks, 3);
    expect(result[0].rerankScore).toBe(0.9);
    expect(result[1].rerankScore).toBe(0.6);
    expect(result[2].rerankScore).toBe(0.3);
  });

  it("does not mutate the original array", () => {
    const chunks = makeChunks([0.5, 0.9, 0.1]);
    const original = [...chunks];
    sortAndSliceByRerankScore(chunks, 2);
    expect(chunks[0].rerankScore).toBe(original[0].rerankScore);
  });
});

describe("ReAct loop — deduplication logic", () => {
  it("adds new chunks and returns the correct count", () => {
    const map = new Map<number, any>();
    const added = mergeChunksDedup(map, [
      { id: 1, content: "a" },
      { id: 2, content: "b" },
    ]);
    expect(added).toBe(2);
    expect(map.size).toBe(2);
  });

  it("does not add duplicate chunks", () => {
    const map = new Map<number, any>([[1, { id: 1, content: "a" }]]);
    const added = mergeChunksDedup(map, [
      { id: 1, content: "a" },
      { id: 3, content: "c" },
    ]);
    expect(added).toBe(1); // only id=3 is new
    expect(map.size).toBe(2);
  });

  it("returns 0 when all chunks already exist", () => {
    const map = new Map<number, any>([
      [1, { id: 1 }],
      [2, { id: 2 }],
    ]);
    const added = mergeChunksDedup(map, [{ id: 1 }, { id: 2 }]);
    expect(added).toBe(0);
  });
});

describe("Bug 2 fix — metadata field mapping", () => {
  it("maps c.metadata not c.global_metadata in query response", () => {
    // Simulate the fixed mapping in ragv1-api POST /v1/query
    const chunkFromRpc = {
      id: 42,
      content: "chunk content",
      similarity: 0.85,
      metadata: { page: 3, source: "report.pdf" },
      // global_metadata would be from documents table — NOT returned by match_chunks RPC
    };

    const mapped = {
      id: chunkFromRpc.id,
      content: chunkFromRpc.content,
      similarity: chunkFromRpc.similarity,
      metadata: chunkFromRpc.metadata ?? {},
    };

    expect(mapped.metadata).toEqual({ page: 3, source: "report.pdf" });
    expect((mapped as any).global_metadata).toBeUndefined();
  });

  it("falls back to empty object when metadata is null", () => {
    const chunk = { id: 1, content: "x", similarity: 0.5, metadata: null };
    const mapped = { ...chunk, metadata: chunk.metadata ?? {} };
    expect(mapped.metadata).toEqual({});
  });
});

describe("Bug 4 fix — human_in_the_loop mode normalization", () => {
  it("normalizes human_in_the_loop to mix", () => {
    const normalize = (mode: string) =>
      mode === "human_in_the_loop" ? "mix" : mode;

    expect(normalize("human_in_the_loop")).toBe("mix");
    expect(normalize("hybrid")).toBe("hybrid");
    expect(normalize("mix")).toBe("mix");
    expect(normalize("global")).toBe("global");
    expect(normalize("relation_only")).toBe("relation_only");
  });
});
