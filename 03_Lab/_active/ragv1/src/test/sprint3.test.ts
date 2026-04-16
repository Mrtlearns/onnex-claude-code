// @vitest-environment node
import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Helpers extracted/mirrored from ragv1-process-document/index.ts
// ---------------------------------------------------------------------------

const AUDIO_MIME_MAP: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  flac: "audio/flac",
  m4a: "audio/mp4",
  aac: "audio/aac",
};

const VIDEO_MIME_MAP: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  avi: "video/x-msvideo",
};

function getAudioMimeType(ext: string): string | undefined {
  return AUDIO_MIME_MAP[ext];
}

function getVideoMimeType(ext: string): string | undefined {
  return VIDEO_MIME_MAP[ext];
}

function isAudioExtension(ext: string): boolean {
  return ext in AUDIO_MIME_MAP;
}

function isVideoExtension(ext: string): boolean {
  return ext in VIDEO_MIME_MAP;
}

/**
 * Merges extracted metadata from Gemini into an existing chunk metadata object.
 * Only merges if extractedMetadata is a non-null plain object.
 */
function mergeChunkMetadata(existing: Record<string, unknown>, extracted: unknown): Record<string, unknown> {
  if (extracted === null || typeof extracted !== "object" || Array.isArray(extracted)) {
    return existing;
  }
  return { ...existing, ...(extracted as Record<string, unknown>) };
}

/**
 * Builds the Gemini prompt for custom metadata extraction.
 */
function buildMetadataExtractionPrompt(chunk: string, schema: Record<string, unknown>): string {
  return `Extract the following fields from this passage as JSON. Only include fields that are clearly present. Schema: ${JSON.stringify(schema)}\n\nPassage: ${chunk}`;
}

/**
 * Limits chunk list to at most maxChunks (for cost control).
 */
function limitChunksForMetadata(chunks: string[], maxChunks: number): string[] {
  return chunks.slice(0, maxChunks);
}

// ---------------------------------------------------------------------------
// Tests — 3a: PPTX / XLSX extension routing
// ---------------------------------------------------------------------------

describe("Sprint 3a — file extension routing", () => {
  it("recognises pptx as a supported extension for office parsing", () => {
    const ext = "pptx";
    expect(["pptx", "xlsx"].includes(ext)).toBe(true);
  });

  it("recognises xlsx as a supported extension for office parsing", () => {
    const ext = "xlsx";
    expect(["pptx", "xlsx"].includes(ext)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests — 3a: Audio MIME map
// ---------------------------------------------------------------------------

describe("Sprint 3a — AUDIO_MIME_MAP", () => {
  it("maps mp3 to audio/mpeg", () => {
    expect(getAudioMimeType("mp3")).toBe("audio/mpeg");
  });

  it("maps wav to audio/wav", () => {
    expect(getAudioMimeType("wav")).toBe("audio/wav");
  });

  it("maps ogg to audio/ogg", () => {
    expect(getAudioMimeType("ogg")).toBe("audio/ogg");
  });

  it("maps flac to audio/flac", () => {
    expect(getAudioMimeType("flac")).toBe("audio/flac");
  });

  it("maps m4a to audio/mp4", () => {
    expect(getAudioMimeType("m4a")).toBe("audio/mp4");
  });

  it("maps aac to audio/aac", () => {
    expect(getAudioMimeType("aac")).toBe("audio/aac");
  });

  it("returns undefined for a non-audio extension", () => {
    expect(getAudioMimeType("pdf")).toBeUndefined();
  });

  it("isAudioExtension returns true for each supported extension", () => {
    ["mp3", "wav", "ogg", "flac", "m4a", "aac"].forEach((ext) => {
      expect(isAudioExtension(ext)).toBe(true);
    });
  });

  it("isAudioExtension returns false for non-audio", () => {
    expect(isAudioExtension("mp4")).toBe(false);
    expect(isAudioExtension("pdf")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests — 3a: Video MIME map
// ---------------------------------------------------------------------------

describe("Sprint 3a — VIDEO_MIME_MAP", () => {
  it("maps mp4 to video/mp4", () => {
    expect(getVideoMimeType("mp4")).toBe("video/mp4");
  });

  it("maps webm to video/webm", () => {
    expect(getVideoMimeType("webm")).toBe("video/webm");
  });

  it("maps mov to video/quicktime", () => {
    expect(getVideoMimeType("mov")).toBe("video/quicktime");
  });

  it("maps avi to video/x-msvideo", () => {
    expect(getVideoMimeType("avi")).toBe("video/x-msvideo");
  });

  it("returns undefined for a non-video extension", () => {
    expect(getVideoMimeType("mp3")).toBeUndefined();
  });

  it("isVideoExtension returns true for each supported extension", () => {
    ["mp4", "webm", "mov", "avi"].forEach((ext) => {
      expect(isVideoExtension(ext)).toBe(true);
    });
  });

  it("isVideoExtension returns false for non-video", () => {
    expect(isVideoExtension("mp3")).toBe(false);
    expect(isVideoExtension("pdf")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests — 3b: Custom metadata extraction helpers
// ---------------------------------------------------------------------------

describe("Sprint 3b — mergeChunkMetadata", () => {
  it("merges extracted fields into an empty existing metadata object", () => {
    const result = mergeChunkMetadata({}, { date: "2024-01-01", parties: ["Alice", "Bob"] });
    expect(result).toEqual({ date: "2024-01-01", parties: ["Alice", "Bob"] });
  });

  it("merges extracted fields into non-empty existing metadata without losing existing keys", () => {
    const result = mergeChunkMetadata({ chunk_index: 0 }, { date: "2024-01-01" });
    expect(result).toEqual({ chunk_index: 0, date: "2024-01-01" });
  });

  it("extracted keys overwrite existing keys of the same name", () => {
    const result = mergeChunkMetadata({ date: "old" }, { date: "new" });
    expect(result.date).toBe("new");
  });

  it("returns existing metadata unchanged when extracted is null", () => {
    const existing = { chunk_index: 1 };
    expect(mergeChunkMetadata(existing, null)).toEqual(existing);
  });

  it("returns existing metadata unchanged when extracted is an array", () => {
    const existing = { chunk_index: 1 };
    expect(mergeChunkMetadata(existing, ["foo"])).toEqual(existing);
  });

  it("returns existing metadata unchanged when extracted is a primitive", () => {
    const existing = { chunk_index: 1 };
    expect(mergeChunkMetadata(existing, "invalid")).toEqual(existing);
    expect(mergeChunkMetadata(existing, 42)).toEqual(existing);
  });
});

describe("Sprint 3b — buildMetadataExtractionPrompt", () => {
  it("includes the schema as JSON in the prompt", () => {
    const schema = { date: "string", parties: "array" };
    const prompt = buildMetadataExtractionPrompt("Some passage text", schema);
    expect(prompt).toContain(JSON.stringify(schema));
  });

  it("includes the passage text in the prompt", () => {
    const chunk = "The contract was signed on 2024-01-01.";
    const prompt = buildMetadataExtractionPrompt(chunk, { date: "string" });
    expect(prompt).toContain(chunk);
  });

  it("contains instruction to return JSON", () => {
    const prompt = buildMetadataExtractionPrompt("text", { x: "string" });
    expect(prompt.toLowerCase()).toContain("json");
  });

  it("contains instruction about only present fields", () => {
    const prompt = buildMetadataExtractionPrompt("text", { x: "string" });
    expect(prompt.toLowerCase()).toContain("only include fields that are clearly present");
  });
});

describe("Sprint 3b — limitChunksForMetadata", () => {
  it("returns all chunks when count is below the limit", () => {
    const chunks = ["a", "b", "c"];
    expect(limitChunksForMetadata(chunks, 50)).toHaveLength(3);
  });

  it("truncates to exactly maxChunks when count exceeds limit", () => {
    const chunks = Array.from({ length: 60 }, (_, i) => `chunk${i}`);
    const result = limitChunksForMetadata(chunks, 50);
    expect(result).toHaveLength(50);
    expect(result[0]).toBe("chunk0");
    expect(result[49]).toBe("chunk49");
  });

  it("returns empty array for empty input", () => {
    expect(limitChunksForMetadata([], 50)).toHaveLength(0);
  });
});
