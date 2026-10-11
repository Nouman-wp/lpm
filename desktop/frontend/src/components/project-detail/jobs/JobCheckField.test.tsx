// @vitest-environment happy-dom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JobCheckField } from "./JobCheckField";

const testJobCheck = vi.fn();
vi.mock("../../../../bridge/commands", () => ({
  TestJobCheck: (...args: unknown[]) => testJobCheck(...args),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let latest: string;

function Harness({ initial, onGenerate }: { initial: string; onGenerate?: () => void }) {
  const [check, setCheck] = useState(initial);
  latest = check;
  return (
    <JobCheckField value={check} project="app" onChange={setCheck} onGenerate={onGenerate} />
  );
}

const render = (initial = "", onGenerate?: () => void) =>
  act(() => root.render(<Harness initial={initial} onGenerate={onGenerate} />));

const buttonNamed = (label: string) =>
  [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === label);

const click = (label: string) => act(() => buttonNamed(label)!.click());

const checkInput = () => {
  const label = [...host.querySelectorAll("label")].find((l) => l.textContent === "Only if");
  return label ? (host.querySelector(`[id="${label.htmlFor}"]`) as HTMLInputElement) : null;
};

beforeEach(() => {
  testJobCheck.mockReset();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("JobCheckField", () => {
  it("stays a link until the check is added", () => {
    render();
    expect(checkInput()).toBeNull();
    click("Only run when there's work");
    expect(checkInput()).not.toBeNull();
    expect(document.activeElement).toBe(checkInput());
    expect(buttonNamed("Only run when there's work")).toBeUndefined();
  });

  it("shows a check the job already has, and Remove clears it", () => {
    render("git status --porcelain | grep .");
    expect(checkInput()?.value).toBe("git status --porcelain | grep .");
    click("Remove");
    expect(latest).toBe("");
    expect(checkInput()).toBeNull();
    expect(buttonNamed("Only run when there's work")).toBeDefined();
  });

  it("tests the check in the job's project and shows what it found", async () => {
    testJobCheck.mockResolvedValue({ work: true, output: "a41c9e2 Fix login" });
    render("git log HEAD..@{u} --oneline | grep .");
    await act(async () => buttonNamed("Test")!.click());
    expect(testJobCheck).toHaveBeenCalledWith("app", "git log HEAD..@{u} --oneline | grep .");
    expect(host.textContent).toContain("Would run — there's work to do.");
    expect(host.querySelector("pre")?.textContent).toBe("a41c9e2 Fix login");
  });

  it("asks for the AI modal from Generate with AI", () => {
    const onGenerate = vi.fn();
    render("", onGenerate);
    click("Only run when there's work");
    click("Generate with AI");
    expect(onGenerate).toHaveBeenCalledOnce();
  });
});
