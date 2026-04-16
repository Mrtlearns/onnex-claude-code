// @vitest-environment node
import { describe, it, expect } from "vitest";

// Cost constants matching edge functions
const EMBED_COST_PER_M = 0.15;
const LLM_INPUT_COST_PER_M = 0.10;
const LLM_OUTPUT_COST_PER_M = 0.40;

function calcEmbedCost(tokens: number): number {
  return (tokens / 1_000_000) * EMBED_COST_PER_M;
}

function calcChatCost(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * LLM_INPUT_COST_PER_M +
         (outputTokens / 1_000_000) * LLM_OUTPUT_COST_PER_M;
}

describe("calcEmbedCost", () => {
  it("returns 0.15 for exactly 1M tokens", () => {
    expect(calcEmbedCost(1_000_000)).toBe(0.15);
  });

  it("returns 0 for 0 tokens", () => {
    expect(calcEmbedCost(0)).toBe(0);
  });

  it("returns 0.075 for 500k tokens", () => {
    expect(calcEmbedCost(500_000)).toBe(0.075);
  });
});

describe("calcChatCost", () => {
  it("returns 0.10 for 1M input tokens, 0 output tokens", () => {
    expect(calcChatCost(1_000_000, 0)).toBe(0.10);
  });

  it("returns 0.40 for 0 input tokens, 1M output tokens", () => {
    expect(calcChatCost(0, 1_000_000)).toBe(0.40);
  });

  it("returns 0.50 for 1M input tokens and 1M output tokens", () => {
    expect(calcChatCost(1_000_000, 1_000_000)).toBe(0.50);
  });

  it("returns a value close to 0 for small token counts", () => {
    const cost = calcChatCost(100, 50);
    expect(cost).toBeGreaterThanOrEqual(0);
    expect(cost).toBeLessThan(0.001);
  });
});
