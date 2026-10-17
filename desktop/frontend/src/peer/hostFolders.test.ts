import { describe, expect, it } from "vitest";
import { dropMove, hostOp, slotAfterFolder, slotOf, translateHostFolders } from "./hostFolders";
import { prefixName } from "./markers";

const SLUG = "aaaaaaaa";
const name = (raw: string) => prefixName(SLUG, raw);

const layout = translateHostFolders(SLUG, {
  order: ["web", "group:a", "cli"],
  groups: [{ id: "a", name: "Work", collapsed: true, members: ["api", "db"] }],
});

describe("translateHostFolders", () => {
  it("marks the host's project names and leaves folder tokens and collapse out", () => {
    expect(layout).toEqual({
      order: [name("web"), "group:a", name("cli")],
      groups: [{ id: "a", name: "Work", members: [name("api"), name("db")] }],
    });
  });

  it("drops what isn't a folder", () => {
    expect(
      translateHostFolders(SLUG, { order: ["web", 3], groups: [{ name: "no id" }, null] }),
    ).toEqual({ order: [name("web")], groups: [] });
    expect(translateHostFolders(SLUG, null)).toEqual({ order: [], groups: [] });
  });
});

describe("hostOp", () => {
  it("sends the host its own names", () => {
    expect(hostOp({ op: "move", item: name("web"), folder: "a", before: name("db") })).toEqual({
      op: "move",
      item: "web",
      folder: "a",
      before: "db",
    });
    expect(
      hostOp({ op: "create", name: "New", members: [name("web")], before: "group:a" }),
    ).toEqual({ op: "create", name: "New", members: ["web"], before: "group:a" });
    expect(hostOp({ op: "copies", order: [name("web-2"), name("web-1")] })).toEqual({
      op: "copies",
      order: ["web-2", "web-1"],
    });
  });
});

describe("slots", () => {
  it("finds where a project sits and what follows a folder", () => {
    expect(slotOf(layout, name("web"))).toBe(name("web"));
    expect(slotOf(layout, name("db"))).toBe("group:a");
    expect(slotOf(layout, name("gone"))).toBeNull();
    expect(slotAfterFolder(layout, "a")).toBe(name("cli"));
  });
});

describe("dropMove", () => {
  const rows = ["web", "api", "db", "cli"].map(name);

  it("drops above a row when dragged up, below it when dragged down", () => {
    expect(dropMove(layout, rows, name("cli"), name("web"))).toEqual({
      op: "move",
      item: name("cli"),
      folder: null,
      before: name("web"),
    });
    expect(dropMove(layout, rows, name("api"), name("db"))).toEqual({
      op: "move",
      item: name("api"),
      folder: "a",
      before: null,
    });
  });

  it("files a project into the folder of the row it lands on", () => {
    expect(dropMove(layout, rows, name("web"), name("api"))).toEqual({
      op: "move",
      item: name("web"),
      folder: "a",
      before: name("db"),
    });
    expect(dropMove(layout, rows, name("cli"), name("db"))).toEqual({
      op: "move",
      item: name("cli"),
      folder: "a",
      before: name("db"),
    });
  });

  it("takes a project out of its folder onto a top-level row", () => {
    expect(dropMove(layout, rows, name("db"), name("cli"))).toEqual({
      op: "move",
      item: name("db"),
      folder: null,
      before: null,
    });
  });

  it("does nothing for a row that isn't on screen", () => {
    expect(dropMove(layout, rows, name("web"), name("web"))).toBeNull();
    expect(dropMove(layout, rows, name("gone"), name("web"))).toBeNull();
  });
});
