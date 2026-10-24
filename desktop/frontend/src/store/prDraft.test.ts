import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prefersDraftPr, rememberDraftPr } from "./prDraft";

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string): string | null {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, String(v));
  }
}

beforeEach(() => {
  vi.stubGlobal("localStorage", new MemoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("draft PR preference", () => {
  it("starts on ready for review", () => {
    expect(prefersDraftPr("web")).toBe(false);
  });

  it("remembers the last choice per project", () => {
    rememberDraftPr("web", true);
    expect(prefersDraftPr("web")).toBe(true);
    expect(prefersDraftPr("api")).toBe(false);
    rememberDraftPr("web", false);
    expect(prefersDraftPr("web")).toBe(false);
  });

  it("ignores unreadable storage", () => {
    localStorage.setItem("lpm.prDraft", "{nope");
    expect(prefersDraftPr("web")).toBe(false);
    rememberDraftPr("web", true);
    expect(prefersDraftPr("web")).toBe(true);
  });

  it("works without localStorage", () => {
    vi.stubGlobal("localStorage", undefined);
    rememberDraftPr("web", true);
    expect(prefersDraftPr("web")).toBe(false);
  });
});
