import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../bridge/commands", () =>
  new Proxy({}, {
    has: () => true,
    get: (_t, prop) => (prop === "then" ? undefined : vi.fn()),
  }));
vi.mock("../../bridge/runtime", () =>
  new Proxy({}, {
    has: () => true,
    get: (_t, prop) =>
      prop === "then" ? undefined : prop === "EventsOn" ? () => () => {} : vi.fn(),
  }));

import { useAppStore } from "./app";
import type { ProjectInfo } from "../types";

const project = (name: string) => ({ name, root: `/src/${name}` }) as ProjectInfo;

describe("deleteGroup", () => {
  const applySidebarLayout = vi.fn(async () => {});
  const removeProjectsBatch = vi.fn(async (names: string[]) => names);

  beforeEach(() => {
    applySidebarLayout.mockClear();
    removeProjectsBatch.mockClear();
    useAppStore.setState({
      projects: [project("web"), project("api"), project("docs")],
      groups: [{ id: "g1", name: "Backend", members: ["api", "docs"] }],
      sidebarOrder: ["web", "group:g1"],
      applySidebarLayout,
      removeProjectsBatch,
    });
  });

  it("keeps the projects in the folder's place when asked to", async () => {
    await useAppStore.getState().deleteGroup("g1", true);
    expect(removeProjectsBatch).not.toHaveBeenCalled();
    expect(applySidebarLayout).toHaveBeenCalledWith({
      order: ["web", "api", "docs"],
      groups: [],
    });
  });

  it("deletes everything inside by default", async () => {
    await useAppStore.getState().deleteGroup("g1");
    expect(removeProjectsBatch).toHaveBeenCalledWith(["api", "docs"]);
    expect(applySidebarLayout).toHaveBeenCalled();
  });
});
