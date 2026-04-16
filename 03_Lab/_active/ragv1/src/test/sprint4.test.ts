// @vitest-environment node
import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// 4a/4b: AES-256 helpers mirrored from ragv1-api/index.ts
// These run in Node (Web Crypto is available globally in Node 18+/Vitest node env)
// ---------------------------------------------------------------------------

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function encryptApiKey(plaintext: string, keyHex: string): Promise<string> {
  const keyBytes = hexToBytes(keyHex);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    "AES-GCM",
    false,
    ["encrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipherBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, encoded);
  return `${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(cipherBuf))}`;
}

async function decryptApiKey(ciphertext: string, keyHex: string): Promise<string> {
  const [ivB64, ctB64] = ciphertext.split(":");
  const iv = base64ToBytes(ivB64);
  const ct = base64ToBytes(ctB64);
  const keyBytes = hexToBytes(keyHex);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    "AES-GCM",
    false,
    ["decrypt"]
  );
  const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, ct);
  return new TextDecoder().decode(plainBuf);
}

const TEST_KEY_HEX = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"; // 32 bytes

describe("Sprint 4b — AES-256 encrypt/decrypt helpers", () => {
  it("encrypts and decrypts roundtrip", async () => {
    const original = "mrag_sk_supersecrettoken123";
    const encrypted = await encryptApiKey(original, TEST_KEY_HEX);
    const decrypted = await decryptApiKey(encrypted, TEST_KEY_HEX);
    expect(decrypted).toBe(original);
  });

  it("produces different ciphertext each call (random IV)", async () => {
    const original = "mrag_sk_test";
    const enc1 = await encryptApiKey(original, TEST_KEY_HEX);
    const enc2 = await encryptApiKey(original, TEST_KEY_HEX);
    expect(enc1).not.toBe(enc2);
  });

  it("ciphertext format is iv_b64:ct_b64", async () => {
    const encrypted = await encryptApiKey("testkey", TEST_KEY_HEX);
    expect(encrypted).toMatch(/^[A-Za-z0-9+/]+=*:[A-Za-z0-9+/]+=*$/);
    const parts = encrypted.split(":");
    expect(parts).toHaveLength(2);
  });

  it("decrypts to correct value after encrypt", async () => {
    const secret = "very-secret-api-key-value";
    const enc = await encryptApiKey(secret, TEST_KEY_HEX);
    const dec = await decryptApiKey(enc, TEST_KEY_HEX);
    expect(dec).toBe(secret);
  });
});

// ---------------------------------------------------------------------------
// 4a: Route parsing logic mirrored from ragv1-api/index.ts
// ---------------------------------------------------------------------------

type RouteResult =
  | { route: "health" }
  | { route: "query" }
  | { route: "documents_list" }
  | { route: "documents_process" }
  | { route: "not_found" };

function parseRoute(method: string, pathname: string): RouteResult {
  const suffix = pathname.replace(/^\/functions\/v1\/ragv1-api/, "");
  if (suffix === "/v1/health" && method === "GET") return { route: "health" };
  if (suffix === "/v1/query" && method === "POST") return { route: "query" };
  if (suffix === "/v1/documents" && method === "GET") return { route: "documents_list" };
  if (suffix === "/v1/documents" && method === "POST") return { route: "documents_process" };
  return { route: "not_found" };
}

describe("Sprint 4a — ragv1-api route parsing", () => {
  it("GET /v1/health → health", () => {
    expect(parseRoute("GET", "/functions/v1/ragv1-api/v1/health")).toEqual({ route: "health" });
  });

  it("POST /v1/query → query", () => {
    expect(parseRoute("POST", "/functions/v1/ragv1-api/v1/query")).toEqual({ route: "query" });
  });

  it("GET /v1/documents → documents_list", () => {
    expect(parseRoute("GET", "/functions/v1/ragv1-api/v1/documents")).toEqual({ route: "documents_list" });
  });

  it("POST /v1/documents → documents_process", () => {
    expect(parseRoute("POST", "/functions/v1/ragv1-api/v1/documents")).toEqual({ route: "documents_process" });
  });

  it("unknown path → not_found", () => {
    expect(parseRoute("GET", "/functions/v1/ragv1-api/v1/unknown")).toEqual({ route: "not_found" });
  });

  it("wrong method → not_found", () => {
    expect(parseRoute("DELETE", "/functions/v1/ragv1-api/v1/health")).toEqual({ route: "not_found" });
  });
});

// ---------------------------------------------------------------------------
// 4c: Processing mode preset logic mirrored from Settings.tsx
// ---------------------------------------------------------------------------

interface RagPreset {
  chunking_strategy: string;
  enable_deep_extract: boolean;
  enable_chunk_context: boolean;
  enable_entity_extraction: boolean;
}

const PROCESSING_PRESETS: Record<string, RagPreset | null> = {
  budget: {
    chunking_strategy: "standard",
    enable_deep_extract: false,
    enable_chunk_context: false,
    enable_entity_extraction: false,
  },
  standard: {
    chunking_strategy: "semantic",
    enable_deep_extract: true,
    enable_chunk_context: false,
    enable_entity_extraction: false,
  },
  full: {
    chunking_strategy: "page_based",
    enable_deep_extract: true,
    enable_chunk_context: true,
    enable_entity_extraction: true,
  },
  custom: null,
};

function applyPreset(
  currentSettings: Record<string, unknown>,
  presetName: string
): Record<string, unknown> {
  const preset = PROCESSING_PRESETS[presetName];
  if (!preset) return currentSettings;
  return { ...currentSettings, ...preset };
}

describe("Sprint 4c — processing mode presets", () => {
  const baseSettings = {
    chunking_strategy: "contextual",
    enable_deep_extract: false,
    enable_chunk_context: false,
    enable_entity_extraction: true,
    chunk_token_size: 512,
  };

  it("budget preset sets correct fields", () => {
    const result = applyPreset(baseSettings, "budget");
    expect(result.chunking_strategy).toBe("standard");
    expect(result.enable_deep_extract).toBe(false);
    expect(result.enable_chunk_context).toBe(false);
    expect(result.enable_entity_extraction).toBe(false);
  });

  it("standard preset sets correct fields", () => {
    const result = applyPreset(baseSettings, "standard");
    expect(result.chunking_strategy).toBe("semantic");
    expect(result.enable_deep_extract).toBe(true);
    expect(result.enable_chunk_context).toBe(false);
    expect(result.enable_entity_extraction).toBe(false);
  });

  it("full preset sets correct fields", () => {
    const result = applyPreset(baseSettings, "full");
    expect(result.chunking_strategy).toBe("page_based");
    expect(result.enable_deep_extract).toBe(true);
    expect(result.enable_chunk_context).toBe(true);
    expect(result.enable_entity_extraction).toBe(true);
  });

  it("custom preset leaves settings unchanged", () => {
    const result = applyPreset(baseSettings, "custom");
    expect(result).toEqual(baseSettings);
  });

  it("preset preserves unrelated fields", () => {
    const result = applyPreset(baseSettings, "budget");
    expect(result.chunk_token_size).toBe(512);
  });

  it("all named presets exist in PROCESSING_PRESETS", () => {
    expect(Object.keys(PROCESSING_PRESETS)).toEqual(
      expect.arrayContaining(["budget", "standard", "full", "custom"])
    );
  });
});

// ---------------------------------------------------------------------------
// 4d: Retry failed chunks — URL construction logic
// ---------------------------------------------------------------------------

function buildRetryUrl(supabaseUrl: string): string {
  return `${supabaseUrl}/functions/v1/ragv1-process-document`;
}

describe("Sprint 4d — retry failed chunks URL", () => {
  it("builds correct edge function URL", () => {
    const url = buildRetryUrl("https://cnpwjnmopjotgvthgenx.supabase.co");
    expect(url).toBe(
      "https://cnpwjnmopjotgvthgenx.supabase.co/functions/v1/ragv1-process-document"
    );
  });
});
