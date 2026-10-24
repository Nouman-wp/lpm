import { describe, expect, it } from "vitest";
import type { TokenUsage } from "../../types";
import { cacheShare, providerMeta, reasoningShare, tokenTypeSegments } from "./statsDerive";

const claudeTotals: TokenUsage = {
  inputTokens: 152,
  cachedInputTokens: 150,
  cacheCreationInputTokens: 100,
  cacheReadInputTokens: 50,
  outputTokens: 120,
  reasoningTokens: 0,
  totalTokens: 272,
};

const codexTotals: TokenUsage = {
  inputTokens: 1_000,
  cachedInputTokens: 400,
  cacheCreationInputTokens: 0,
  cacheReadInputTokens: 400,
  outputTokens: 300,
  reasoningTokens: 90,
  totalTokens: 1_300,
};

describe("providerMeta", () => {
  it("welds the fixed brand color to each provider entity", () => {
    expect(providerMeta("claude").color).toBe("#D97757");
    expect(providerMeta("codex").color).toBe("#10A37F");
  });

  it("falls back to a neutral token for unknown providers", () => {
    expect(providerMeta("mystery").color).toBe("var(--text-muted)");
  });
});

describe("cacheShare", () => {
  it("treats cached as a subset of input (never input + cached)", () => {
    expect(cacheShare(claudeTotals)).toBeCloseTo(150 / 152, 6);
  });

  it("guards a zero input denominator", () => {
    expect(
      cacheShare({
        inputTokens: 0,
        cachedInputTokens: 0,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
        outputTokens: 0,
        reasoningTokens: 0,
        totalTokens: 0,
      }),
    ).toBe(0);
  });
});

describe("reasoningShare", () => {
  it("divides reasoning by output", () => {
    expect(reasoningShare(codexTotals)).toBeCloseTo(90 / 300, 6);
  });
});

describe("tokenTypeSegments", () => {
  it("produces mutually exclusive segments summing to input + output", () => {
    const segments = tokenTypeSegments(codexTotals);
    const byKey = Object.fromEntries(segments.map((segment) => [segment.key, segment.value]));
    expect(byKey.input).toBe(600);
    expect(byKey.cached).toBe(400);
    expect(byKey.output).toBe(210);
    expect(byKey.reasoning).toBe(90);
    const sum = segments.reduce((acc, segment) => acc + segment.value, 0);
    expect(sum).toBe(codexTotals.inputTokens + codexTotals.outputTokens);
    expect(segments.reduce((acc, segment) => acc + segment.pct, 0)).toBeCloseTo(1, 6);
  });

  it("never emits negative segments when cache or reasoning exceed their bucket", () => {
    const segments = tokenTypeSegments({
      inputTokens: 50,
      cachedInputTokens: 80,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 80,
      outputTokens: 10,
      reasoningTokens: 40,
      totalTokens: 60,
    });
    for (const segment of segments) {
      expect(segment.value).toBeGreaterThanOrEqual(0);
    }
  });
});
