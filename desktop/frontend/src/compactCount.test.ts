import { describe, expect, it } from "vitest";
import { compactCount } from "./compactCount";

describe("compactCount", () => {
  it("keeps counts under ten thousand exact", () => {
    expect(compactCount(0)).toBe("0");
    expect(compactCount(656)).toBe("656");
    expect(compactCount(9_999)).toBe("9999");
  });

  it("shortens thousands to one decimal, dropping a trailing zero", () => {
    expect(compactCount(10_000)).toBe("10k");
    expect(compactCount(12_449)).toBe("12.4k");
    expect(compactCount(12_450)).toBe("12.5k");
    expect(compactCount(99_960)).toBe("100k");
    expect(compactCount(214_000)).toBe("214k");
  });

  it("shortens millions the same way", () => {
    expect(compactCount(1_200_000)).toBe("1.2M");
    expect(compactCount(150_000_000)).toBe("150M");
  });
});
