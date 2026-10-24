import { describe, expect, it } from "vitest";
import { main } from "../../bridge/models";
import { branchKeyAction, branchKeyHints } from "./branchKeys";
import { branchSearchRows, createSlug } from "./branchSearchRows";

const b = (name: string, remote?: string) =>
  ({ name, committerDate: 0, ...(remote ? { remote } : {}) }) as main.Branch;

const key = (k: string, mods: { meta?: boolean; ctrl?: boolean; shift?: boolean } = {}) => ({
  key: k,
  metaKey: !!mods.meta,
  ctrlKey: !!mods.ctrl,
  shiftKey: !!mods.shift,
  altKey: false,
});

describe("branch search rows", () => {
  it("offers to create the slug of a query that names no branch", () => {
    expect(createSlug("Fix Login Bug", [b("main")])).toBe("fix-login-bug");
    expect(createSlug("feat/New Thing", [])).toBe("feat/new-thing");
    expect(createSlug("   ", [])).toBeNull();
    expect(createSlug("!!!", [])).toBeNull();
  });

  it("offers nothing when the query is a branch already, local or remote", () => {
    expect(createSlug("main", [b("main")])).toBeNull();
    expect(createSlug("Main", [b("main")])).toBeNull();
    expect(createSlug("feature", [b("feature", "origin")])).toBeNull();
    expect(createSlug("origin/feature", [b("feature", "origin")])).toBeNull();
  });

  it("groups locals before remotes, after the create row", () => {
    const rows = branchSearchRows("fe", [b("feat-a"), b("feat-b", "origin"), b("fe-c")], []);
    expect(rows.local.map((x) => x.name)).toEqual(["feat-a", "fe-c"]);
    expect(rows.remote.map((x) => x.name)).toEqual(["feat-b"]);
    expect(rows.entries.map((e) => (e.kind === "create" ? `+${e.slug}` : e.branch.name))).toEqual([
      "+fe",
      "feat-a",
      "fe-c",
      "feat-b",
    ]);
    expect(rows.initialIndex).toBe(1);
  });

  it("highlights the create row when it is the only one", () => {
    const rows = branchSearchRows("brand new", [], [b("main")]);
    expect(rows.entries).toEqual([{ kind: "create", slug: "brand-new" }]);
    expect(rows.initialIndex).toBe(0);
  });

  it("checks the full branch list, not only the search results", () => {
    expect(branchSearchRows("main", [], [b("main")]).entries).toEqual([]);
    expect(branchSearchRows("", [b("main")], []).entries).toHaveLength(1);
  });
});

describe("branch shortcuts", () => {
  it("uses ⌘ on macOS", () => {
    expect(branchKeyAction(key("r", { meta: true }), true)).toBe("rename");
    expect(branchKeyAction(key("Backspace", { meta: true }), true)).toBe("delete");
    expect(branchKeyAction(key("c", { meta: true }), true)).toBe("copy");
    expect(branchKeyAction(key("r", { ctrl: true, shift: true }), true)).toBeNull();
    expect(branchKeyAction(key("Backspace"), true)).toBeNull();
  });

  it("uses Ctrl+Shift elsewhere, leaving Ctrl+Backspace and Ctrl+C alone", () => {
    expect(branchKeyAction(key("R", { ctrl: true, shift: true }), false)).toBe("rename");
    expect(branchKeyAction(key("Backspace", { ctrl: true, shift: true }), false)).toBe("delete");
    expect(branchKeyAction(key("C", { ctrl: true, shift: true }), false)).toBe("copy");
    expect(branchKeyAction(key("Backspace", { ctrl: true }), false)).toBeNull();
    expect(branchKeyAction(key("c", { ctrl: true }), false)).toBeNull();
  });

  it("labels the hints for the platform", () => {
    const text = (mac: boolean) => branchKeyHints(mac).map((h) => `${h.keys} ${h.label}`).join(" · ");
    expect(text(true)).toBe("↵ switch · ⌘R rename · ⌘⌫ delete · ⌘C copy name");
    expect(text(false)).toBe(
      "Enter switch · Ctrl+Shift+R rename · Ctrl+Shift+Backspace delete · Ctrl+Shift+C copy name",
    );
  });
});
