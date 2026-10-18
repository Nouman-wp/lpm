// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectInfo } from "../types";

const mocks = vi.hoisted(() => ({
  projects: [] as ProjectInfo[],
  setProjectAutoPull: vi.fn(async () => true),
}));

vi.mock("../../bridge/runtime", () => ({ EventsOn: vi.fn(() => () => {}) }));
vi.mock("../store/app", () => ({
  useAppStore: (select: (state: unknown) => unknown) => select({ projects: mocks.projects }),
}));
vi.mock("../autoPullRun", () => ({ setProjectAutoPull: mocks.setProjectAutoPull }));

import type { AutoPullMode } from "../autoPull";
import { AutoPullMenuItems } from "./AutoPullMenuItems";

const project = (over: Partial<ProjectInfo>): ProjectInfo => ({ name: "web", root: "/p/web", ...over }) as ProjectInfo;

let container: HTMLDivElement;
let root: Root;
const onClose = vi.fn();

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  mocks.projects = [project({}), project({ name: "web-2", root: "/p/web-2", parentName: "web" })];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = (name: string, mode: AutoPullMode = "all") =>
  act(() => root.render(<AutoPullMenuItems projectName={name} mode={mode} onClose={onClose} />));
const items = () => [...container.querySelectorAll("button")];
const item = (label: string) => items().find((b) => b.textContent === label)!;
const checked = () => items().filter((b) => b.querySelector("svg")).map((b) => b.textContent);

describe("AutoPullMenuItems", () => {
  it("lists follow, On and Off in place, checking the project's own choice", () => {
    render("web-2");
    expect(items().map((b) => b.textContent)).toEqual(["Same as web (On)", "On", "Off"]);
    expect(checked()).toEqual(["Same as web (On)"]);
    expect(container.textContent).toContain("Auto pull");
  });

  it("sets this project alone and closes the menu", () => {
    render("web-2");
    act(() => item("Off").click());
    expect(onClose).toHaveBeenCalled();
    expect(mocks.setProjectAutoPull).toHaveBeenCalledWith("web-2", false);
  });

  it("clears the project's own choice to follow again", () => {
    mocks.projects = [project({ autoPull: false })];
    render("web");
    expect(checked()).toEqual(["Off"]);
    act(() => item("Default (On)").click());
    expect(mocks.setProjectAutoPull).toHaveBeenCalledWith("web", null);
  });

  it("writes nothing when the choice is already the current one", () => {
    render("web");
    act(() => item("Default (On)").click());
    expect(mocks.setProjectAutoPull).not.toHaveBeenCalled();
  });

  it("is greyed out while Settings has auto pull off everywhere", () => {
    render("web", "off");
    expect(items().every((b) => b.disabled)).toBe(true);
  });
});
