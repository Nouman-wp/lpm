// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CheckAIModal } from "./CheckAIModal";

const transformText = vi.fn();
vi.mock("../../../../bridge/commands", () => ({
  TestJobCheck: () => Promise.resolve({ work: true }),
  TransformText: (...args: unknown[]) => transformText(...args),
  CancelAIGenerate: () => Promise.resolve(),
  CheckAICLIs: () =>
    Promise.resolve({ claude: true, codex: false, gemini: false, opencode: false }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
const onUse = vi.fn();
const onClose = vi.fn();

const render = async (task = "Upgrade outdated dependencies") => {
  await act(async () =>
    root.render(
      <CheckAIModal
        open
        project="app"
        task={task}
        aiProject="app"
        aiCwd="/work/app"
        onClose={onClose}
        onUse={onUse}
      />,
    ),
  );
};

const buttonNamed = (label: string) =>
  [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === label);

const textarea = () => document.querySelector("textarea")!;

beforeEach(() => {
  transformText.mockReset();
  onUse.mockReset();
  onClose.mockReset();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("CheckAIModal", () => {
  it("fills the description from an idea", async () => {
    await render();
    expect(buttonNamed("Generate")?.disabled).toBe(true);
    act(() => buttonNamed("Uncommitted changes")!.click());
    expect(textarea().value).toBe("When the project has uncommitted changes");
    expect(buttonNamed("Uncommitted changes")).toBeUndefined();
  });

  it("generates a command from the description and the job, then uses it", async () => {
    transformText.mockResolvedValue("```sh\n$ git status --porcelain | grep .\n```");
    await render();
    act(() => buttonNamed("Uncommitted changes")!.click());
    await act(async () => buttonNamed("Generate")!.click());

    const args = transformText.mock.calls[0];
    expect(args.slice(0, 2)).toEqual(["app", "/work/app"]);
    expect(args[7]).toBe(
      "When it should run: When the project has uncommitted changes\n\nWhat the job does: Upgrade outdated dependencies",
    );
    const command = [...document.querySelectorAll("input")].find(
      (i) => i.value === "git status --porcelain | grep .",
    );
    expect(command).toBeDefined();
    expect(buttonNamed("Regenerate")).toBeDefined();

    act(() => buttonNamed("Use command")!.click());
    expect(onUse).toHaveBeenCalledWith("git status --porcelain | grep .");
    expect(onClose).toHaveBeenCalled();
  });
});
