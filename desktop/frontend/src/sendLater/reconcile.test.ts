import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./closeout", () => ({ onTerminalsClosed: vi.fn() }));
vi.mock("../pendingClose", () => ({ pendingClosesForProject: () => [] }));
vi.mock("../terminals", () => ({
  getProjectTerminals: () => ({ detailView: "terminal" }),
  collectPersistedTabs: () => [],
}));

import { onTerminalsClosed } from "./closeout";
import { createClosedTabReconciler } from "./reconcile";
import type { ScheduledPrompt } from "../store/sendLater";
import { useTerminalTargets } from "../store/terminalTargets";

const prompt = (projectName: string, historyKey: string): ScheduledPrompt => ({
  id: `${projectName}:${historyKey}`,
  projectName,
  historyKey,
  terminalLabel: "Claude",
  agent: "claude",
  text: "carry on",
  images: {},
  dueAt: 0,
  createdAt: 0,
  state: "scheduled",
  kind: "time",
  force: false,
});

const tab = (historyKey: string) => ({ id: `pty-${historyKey}`, label: "Claude", emoji: "", historyKey });

describe("createClosedTabReconciler", () => {
  beforeEach(() => {
    vi.mocked(onTerminalsClosed).mockClear();
    useTerminalTargets.setState({ byProject: {} });
  });

  it("files a prompt as a draft once its tab has stayed gone, on a paired machine too", () => {
    const project = "peer-studio-api";
    useTerminalTargets.setState({ byProject: { [project]: [tab("kept")] } });
    const reconcile = createClosedTabReconciler();
    const items = [prompt(project, "kept"), prompt(project, "closed")];

    expect(reconcile(items, 0)).toBe(3_000);
    expect(reconcile(items, 2_999)).toBe(3_000);
    expect(onTerminalsClosed).not.toHaveBeenCalled();
    expect(reconcile(items, 3_000)).toBe(Infinity);
    expect(onTerminalsClosed).toHaveBeenCalledExactlyOnceWith(project, ["closed"]);
  });

  it("leaves a project that isn't showing alone", () => {
    const reconcile = createClosedTabReconciler();
    expect(reconcile([prompt("peer-studio-api", "gone")], 0)).toBe(Infinity);
    expect(reconcile([prompt("peer-studio-api", "gone")], 10_000)).toBe(Infinity);
    expect(onTerminalsClosed).not.toHaveBeenCalled();
  });

  it("forgets a tab that came back before the wait ran out", () => {
    const project = "peer-studio-api";
    useTerminalTargets.setState({ byProject: { [project]: [] } });
    const reconcile = createClosedTabReconciler();
    const items = [prompt(project, "moving")];
    reconcile(items, 0);
    useTerminalTargets.setState({ byProject: { [project]: [tab("moving")] } });
    expect(reconcile(items, 1_000)).toBe(Infinity);
    useTerminalTargets.setState({ byProject: { [project]: [] } });
    expect(reconcile(items, 3_500)).toBe(6_500);
    expect(onTerminalsClosed).not.toHaveBeenCalled();
  });
});
