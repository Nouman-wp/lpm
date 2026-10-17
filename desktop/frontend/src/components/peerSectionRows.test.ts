import { describe, expect, it } from "vitest";
import { peerSectionRows } from "./peerSectionRows";
import { peerRowToken } from "./peerRowOrder";
import { prefixName, prefixRoot } from "../peer/markers";
import type { PendingDuplicate, ProjectInfo } from "../types";

const SLUG = "aaaaaaaa";
const name = (raw: string) => prefixName(SLUG, raw);

function remote(raw: string, parent?: string): ProjectInfo {
  return {
    name: name(raw),
    session: "",
    root: prefixRoot(SLUG, `/Users/other/${raw}`),
    label: raw,
    parentName: parent ? name(parent) : undefined,
    running: false,
    services: [],
    allServices: [],
    actions: [],
    profiles: [],
    activeProfile: "",
    statusEntries: [],
    isRemote: false,
  };
}

type Row = ReturnType<typeof peerSectionRows>["rows"][number];

const shape = (rows: Row[]): unknown[] =>
  rows.map((row) => {
    if (row.kind === "project") return row.project.label;
    if (row.kind === "folder") {
      return { [`${row.group.name}${row.collapsed ? " folded" : ""}`]: shape(row.rows) };
    }
    return `[${row.children.map((c) => c.label).join(",")}${row.pending.length ? ` +${row.pending.length}` : ""}${row.collapsed ? " folded" : ""}]`;
  });

const folders = (order: string[], groups: { id: string; name: string; members: string[] }[]) => ({
  order: order.map((token) => (token.startsWith("group:") ? token : name(token))),
  groups: groups.map((g) => ({ ...g, members: g.members.map(name) })),
});

describe("peerSectionRows", () => {
  it("nests a Mac's copies under their parent, in the order the section keeps", () => {
    const { rows, ids, decks } = peerSectionRows(
      [remote("api"), remote("lpm-3", "lpm"), remote("lpm"), remote("lpm-2", "lpm")],
      [],
      new Set(),
    );

    expect(shape(rows)).toEqual(["api", "lpm", "[lpm-3,lpm-2]"]);
    expect(ids).toEqual(["api", "lpm", "lpm-3", "lpm-2"].map((raw) => peerRowToken(name(raw))));
    expect(decks.get(name("lpm"))?.map((c) => c.label)).toEqual(["lpm-3", "lpm-2"]);
  });

  it("keeps a copy whose parent isn't listed as a row of its own", () => {
    const { rows } = peerSectionRows([remote("lpm-2", "lpm")], [], new Set());
    expect(shape(rows)).toEqual(["lpm-2"]);
  });

  it("hides a folded deck's copies from dragging but keeps them for its rollup", () => {
    const { rows, ids, decks } = peerSectionRows(
      [remote("lpm"), remote("lpm-2", "lpm")],
      [],
      new Set([name("lpm")]),
    );

    expect(shape(rows)).toEqual(["lpm", "[lpm-2 folded]"]);
    expect(ids).toEqual([peerRowToken(name("lpm"))]);
    expect(decks.get(name("lpm"))).toHaveLength(1);
  });

  it("deals a copy on its way under its parent, even before the parent has a deck", () => {
    const pending: PendingDuplicate[] = [
      { id: 1, parent: name("api"), label: "", worktree: false },
      { id: 2, parent: "local-project", label: "", worktree: false },
    ];
    const { rows } = peerSectionRows([remote("api")], pending, new Set([name("api")]));

    // Nothing to fold yet, so a stale collapse can't hide the skeleton.
    expect(shape(rows)).toEqual(["api", "[ +1]"]);
  });

  it("lays a host's rows out in its own folders and order", () => {
    const { rows, ids } = peerSectionRows(
      [remote("api"), remote("web"), remote("web-2", "web"), remote("cli"), remote("new")],
      [],
      new Set(),
      folders(["cli", "group:a", "api"], [{ id: "a", name: "Work", members: ["web"] }]),
    );

    // The project the host hasn't slotted yet goes last, as it does over there.
    expect(shape(rows)).toEqual(["cli", { Work: ["web", "[web-2]"] }, "api", "new"]);
    expect(ids).toEqual(["cli", "web", "web-2", "api", "new"].map((raw) => peerRowToken(name(raw))));
  });

  it("keeps a folded folder's rows for its rollup but out of dragging", () => {
    const { rows, ids } = peerSectionRows(
      [remote("api"), remote("web")],
      [],
      new Set(),
      folders(["group:a", "api"], [{ id: "a", name: "Work", members: ["web", "gone"] }]),
      new Set(["a"]),
    );

    expect(shape(rows)).toEqual([{ "Work folded": ["web"] }, "api"]);
    expect(rows[0]).toMatchObject({ kind: "folder", count: 1 });
    expect(ids).toEqual([peerRowToken(name("api"))]);
  });

  it("shows a copy filed into a folder there, out of its parent's deck", () => {
    const { rows, decks } = peerSectionRows(
      [remote("web"), remote("web-2", "web"), remote("web-3", "web")],
      [],
      new Set(),
      folders(["web", "group:a"], [{ id: "a", name: "Review", members: ["web-3"] }]),
    );

    expect(shape(rows)).toEqual(["web", "[web-2]", { Review: ["web-3"] }]);
    expect(decks.get(name("web"))?.map((c) => c.label)).toEqual(["web-2"]);
  });

  it("shows a folder the order lost, and an empty one", () => {
    const { rows } = peerSectionRows(
      [remote("api")],
      [],
      new Set(),
      folders(["api"], [{ id: "a", name: "Later", members: [] }]),
    );

    expect(shape(rows)).toEqual(["api", { Later: [] }]);
  });
});
