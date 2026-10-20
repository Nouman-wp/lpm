// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { loadRememberedChild, rememberChild } from "./components/splitPrimary";
import {
  agentActionEntries,
  launchpadActionTabs,
  launchpadPick,
  runAsGroupChild,
} from "./launchpadAgentActions";
import type { ActionInfo } from "./types";

const action = (name: string, cmd: string, extra: Partial<ActionInfo> = {}): ActionInfo =>
  ({ name, label: name.split(":").pop(), cmd, confirm: false, display: "header", type: "terminal", ...extra }) as ActionInfo;

const claudeMax = action("claude-max", "", {
  primary: "last-used",
  color: "claude-deep",
  children: [
    action("claude-max:claude", "claude --permission-mode auto"),
    action("claude-max:ultracode", "claude --model opus"),
    action("claude-max:notes", "open notes.md"),
  ],
});
const codex = action("codex", "codex -c 'model_reasoning_effort=\"ultra\"'");
const dev = action("dev", "npm run dev");

describe("launchpad agent actions", () => {
  beforeEach(() => window.localStorage.clear());

  it("keeps split buttons and menus whole, with only their agent items", () => {
    const entries = agentActionEntries([claudeMax, codex, dev]);
    expect(entries.map((e) => [e.action.name, e.own?.agent ?? null, e.children.map((c) => c.action.name)])).toEqual([
      ["claude-max", null, ["claude-max:claude", "claude-max:ultracode"]],
      ["codex", "codex", []],
    ]);
  });

  it("skips agents run outside a terminal tab", () => {
    expect(agentActionEntries([action("review", "claude -p 'review'", { type: "background" })])).toEqual([]);
  });

  it("leads a split button with the item it last ran", () => {
    rememberChild("web", "claude-max", "ultracode");
    const [group, single] = launchpadActionTabs(agentActionEntries([claudeMax, codex]), "web");
    expect(group.primary?.id).toBe("claude-max:ultracode");
    expect(group.options.map((o) => o.label)).toEqual(["claude", "ultracode"]);
    expect(single.primary?.id).toBe("codex");
  });

  it("gives a plain menu no main part", () => {
    const menu = { ...claudeMax, primary: undefined };
    const [tab] = launchpadActionTabs(agentActionEntries([menu]), "web");
    expect(tab.primary).toBeNull();
  });

  it("starts on Terminal until a pick it still offers was saved", () => {
    expect(launchpadPick(["codex"], null)).toBe("terminal");
    expect(launchpadPick(["codex"], "gone")).toBe("terminal");
    expect(launchpadPick(["codex"], "codex")).toBe("codex");
  });

  it("runs a group's item in the group's color and remembers it as last used", () => {
    const run = runAsGroupChild("web", claudeMax, claudeMax.children![1]);
    expect(run.color).toBe("claude-deep");
    expect(loadRememberedChild("web", "claude-max")).toBe("ultracode");
  });
});
