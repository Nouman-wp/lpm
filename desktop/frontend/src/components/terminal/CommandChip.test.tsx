// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CommandChipTarget } from "../../store/commandChip";

vi.mock("../../../bridge/commands", () => ({ SetClipboardText: vi.fn(() => Promise.resolve()) }));

const { CommandChip } = await import("./CommandChip");

let host: HTMLDivElement;
let root: Root;
let onRun: ReturnType<typeof vi.fn<(t: CommandChipTarget) => void>>;
let onRunInNewTab: ReturnType<typeof vi.fn<(t: CommandChipTarget) => void>>;

const anchor = { endLeft: 300, endTop: 400, startLeft: 120, startTop: 400, rowHeight: 18, right: 1200 };

function target(command: string, risk: string | null = null, armed = false): CommandChipTarget {
  return { key: command, terminalId: "t1", command, risk, anchor, armed };
}

function mount(t: CommandChipTarget) {
  act(() => root.render(<CommandChip target={t} onRun={onRun} onRunInNewTab={onRunInNewTab} />));
}

const chip = () => document.querySelector<HTMLElement>("[data-command-chip]")!;
const button = (label: string) => [...chip().querySelectorAll("button")].find((b) => b.textContent === label)!;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  onRun = vi.fn();
  onRunInNewTab = vi.fn();
});

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = "";
});

describe("CommandChip", () => {
  it("runs a command here or in a new tab", () => {
    const t = target("npm install");
    mount(t);
    act(() => button("Run").click());
    expect(onRun).toHaveBeenCalledWith(t);
    act(() => button("Run in new tab").click());
    expect(onRunInNewTab).toHaveBeenCalledWith(t);
  });

  it("asks once more before running a risky command", () => {
    mount(target("rm -rf dist", "Deletes files"));
    act(() => button("Run").click());
    expect(onRun).not.toHaveBeenCalled();
    expect(chip().textContent).toContain("Deletes files");
    act(() => button("Cancel").click());
    expect(button("Run")).toBeTruthy();

    act(() => button("Run in new tab").click());
    act(() => button("Run in new tab anyway").click());
    expect(onRunInNewTab).toHaveBeenCalledTimes(1);
    expect(onRun).not.toHaveBeenCalled();
  });

  it("opens already asking when a risky command was ⌘-clicked", () => {
    mount(target("git reset --hard", "Discards changes", true));
    act(() => button("Run anyway").click());
    expect(onRun).toHaveBeenCalledTimes(1);
  });
});
