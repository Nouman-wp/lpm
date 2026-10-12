import { describe, expect, it } from "vitest";
import {
  autoPullExceptions,
  autoPullState,
  followLabel,
  normalizeAutoPullMode,
  wantsAutoPull,
} from "./autoPull";
import type { OriginStatus } from "./originStatus";

const web = { name: "web", parentName: "" };
const web2 = { name: "web-2", parentName: "web" };
const web3 = { name: "web-3", parentName: "web", autoPull: false };
const api = { name: "api", parentName: "", autoPull: true };
const projects = [web, web2, web3, api];

const behind = (patch: Partial<OriginStatus> = {}): OriginStatus => ({
  branch: "main",
  hasUpstream: true,
  ahead: 0,
  behind: 3,
  base: "",
  baseBehind: 0,
  conflicted: false,
  changes: 0,
  fetched: true,
  ...patch,
});

describe("normalizeAutoPullMode", () => {
  it("keeps the known modes and turns anything else off", () => {
    expect(normalizeAutoPullMode("all")).toBe("all");
    expect(normalizeAutoPullMode("chosen")).toBe("chosen");
    expect(normalizeAutoPullMode(undefined)).toBe("off");
    expect(normalizeAutoPullMode(true)).toBe("off");
  });
});

describe("autoPullState", () => {
  it("is off everywhere while Settings has it off", () => {
    expect(autoPullState(api, projects, "off")).toEqual({ on: false, source: "settings" });
  });

  it("follows the mode when nothing is set", () => {
    expect(autoPullState(web, projects, "all")).toEqual({ on: true, source: "default" });
    expect(autoPullState(web, projects, "chosen")).toEqual({ on: false, source: "default" });
  });

  it("lets a project's own choice win over the mode", () => {
    expect(autoPullState(api, projects, "chosen")).toEqual({ on: true, source: "project" });
    expect(autoPullState(web3, projects, "all")).toEqual({ on: false, source: "project" });
  });

  it("gives a copy its parent's choice before the mode", () => {
    const parentOff = [{ ...web, autoPull: false }, web2];
    expect(autoPullState(web2, parentOff, "all")).toEqual({ on: false, source: "parent" });
    expect(autoPullState(web2, projects, "all")).toEqual({ on: true, source: "default" });
  });
});

describe("followLabel", () => {
  it("names what following resolves to", () => {
    expect(followLabel(web, projects, "all")).toBe("Default (On)");
    expect(followLabel(web3, projects, "all", "web")).toBe("Same as web (On)");
    expect(followLabel(web3, projects, "chosen", "web")).toBe("Same as web (Off)");
  });
});

describe("wantsAutoPull", () => {
  it("wants only a clean fast-forward", () => {
    expect(wantsAutoPull(behind())).toBe(true);
    expect(wantsAutoPull(behind({ ahead: 1 }))).toBe(false);
    expect(wantsAutoPull(behind({ changes: 2 }))).toBe(false);
    expect(wantsAutoPull(behind({ conflicted: true }))).toBe(false);
    expect(wantsAutoPull(behind({ behind: 0 }))).toBe(false);
    expect(wantsAutoPull(behind({ hasUpstream: false, base: "main", baseBehind: 3 }))).toBe(false);
  });
});

describe("autoPullExceptions", () => {
  it("lists only choices that differ from what the project would get", () => {
    const list = [...projects, { name: "docs", parentName: "", autoPull: true }];
    expect(autoPullExceptions(list, "all")).toEqual({ on: [], off: ["web-3"] });
    expect(autoPullExceptions(list, "chosen")).toEqual({ on: ["api", "docs"], off: [] });
    expect(autoPullExceptions(list, "off")).toEqual({ on: [], off: [] });
  });
});
