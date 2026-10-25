import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createProject: vi.fn(),
  browseFolder: vi.fn(),
  toastError: vi.fn(),
}));

// vi.mock hoists above any const, so the factories are inlined. `then` must
// stay undefined: a function there makes the mocked module thenable and
// vitest awaits it forever.
vi.mock("../../bridge/commands", () =>
  new Proxy({}, {
    has: () => true,
    get: (_t, prop) =>
      prop === "then"
        ? undefined
        : prop === "CreateProject"
          ? mocks.createProject
          : prop === "BrowseFolder"
            ? mocks.browseFolder
            : vi.fn(),
  }));
vi.mock("../../bridge/runtime", () =>
  new Proxy({}, {
    has: () => true,
    get: (_t, prop) => (prop === "then" ? undefined : vi.fn()),
  }));
vi.mock("../notifications/toast", () => ({
  toast: Object.assign(vi.fn(), { error: mocks.toastError, info: vi.fn(), success: vi.fn() }),
}));

import { useAppStore } from "./app";

beforeEach(() => {
  vi.clearAllMocks();
  useAppStore.setState({
    projects: [],
    selected: null,
    view: "terminals",
    addProjectTarget: null,
    refreshProjects: vi.fn(async () => {}),
  });
});

describe("addLocalFolder", () => {
  it("adopts the folder under its own name without opening it", async () => {
    mocks.createProject.mockResolvedValue({ name: "storefront", existing: false, services: [] });

    const adopted = await useAppStore.getState().addLocalFolder("/code/storefront");

    expect(mocks.createProject).toHaveBeenCalledWith("storefront", "/code/storefront");
    expect(adopted).toEqual({ name: "storefront", existing: false, services: [] });
    expect(useAppStore.getState().refreshProjects).toHaveBeenCalled();
    expect(useAppStore.getState().selected).toBeNull();
  });

  it("reports a failure and answers null", async () => {
    mocks.createProject.mockRejectedValue("permission denied");

    expect(await useAppStore.getState().addLocalFolder("/code/locked")).toBeNull();
    expect(mocks.toastError).toHaveBeenCalledWith("Failed to add project: permission denied");
  });

  it("is the path the picker's Local folder takes, which then opens the project", async () => {
    mocks.browseFolder.mockResolvedValue("/code/api");
    mocks.createProject.mockResolvedValue({ name: "api", existing: false, services: [] });

    await useAppStore.getState().pickAddProjectKind("local");

    expect(mocks.createProject).toHaveBeenCalledWith("api", "/code/api");
    expect(useAppStore.getState().selected).toBe("api");
    expect(useAppStore.getState().view).toBe("projects");
  });
});
