import { statusProvider } from "../../agentStatus";
import { selectedProject } from "../commands/settings";
import { didHappen, project, projects, sshProject } from "../commands/state";
import { statusEntries } from "../commands/status";
import { agentsIn } from "../commands/terminals";
import type { AgentKind } from "../seed/types";
import type { TourAction } from "./protocol";

let initial: string | undefined;

export function setInitialProject(name: string | undefined): void {
  initial = name;
}

const addedAt = (folder: string) => [...projects.values()].find((p) => p.root.endsWith(`/${folder}`));
const latestCopy = (of: string, mode: string) =>
  [...projects.values()].filter((p) => p.parentName === of && p.worktree === (mode === "worktree")).pop();

// The project each step acts on: the one on screen when it runs, which the
// steps before it decide.
export function stepProject(steps: readonly TourAction[], index: number): string {
  let current = initial ?? "";
  for (const s of steps.slice(0, index)) {
    if (s.id === "openProject" || s.id === "openAgent" || s.id === "answer") current = s.project;
    else if (s.id === "addProject" && s.folder) current = addedAt(s.folder)?.name ?? s.folder;
    else if (s.id === "addSshHost") current = sshProject(s.host)?.name ?? s.host;
    else if (s.id === "copy") current = latestCopy(s.project, s.mode)?.name ?? current;
  }
  const step = steps[index];
  return "project" in step ? step.project : current;
}

const hasTurn = (name: string, kind: AgentKind, settled = false) =>
  statusEntries(name).some((e) => statusProvider(e.key) === kind && (!settled || e.value !== "Waiting"));

// What a step leaves behind once it has happened, or null for one that leaves
// nothing to check, which counts once the tour carries it out.
export function doneCheck(steps: readonly TourAction[], index: number): (() => boolean) | null {
  const step = steps[index];
  const name = stepProject(steps, index);
  const p = () => project(name);
  switch (step.id) {
    case "addProject":
      return step.folder ? () => !!addedAt(step.folder!) : null;
    case "addSshHost":
      return () => !!sshProject(step.host)?.remote;
    case "start":
      return () => (p()?.running.size ?? 0) > 0;
    case "agent":
      return () => agentsIn(name).includes("claude");
    case "codex":
      return () => agentsIn(name).includes("codex");
    case "prompt":
      return () => hasTurn(name, "claude");
    case "codexPrompt":
      return () => hasTurn(name, "codex");
    case "openProject":
      return () => selectedProject() === step.project;
    case "answer":
      return () => hasTurn(step.project, step.agent, true);
    case "startProfile":
      return () => p()?.activeProfile === step.profile;
    case "toggleService":
      return () => (p()?.running.size ?? 0) > 0 && (p()?.running.has(step.service) ?? false) === step.on;
    case "restartService":
      return () => didHappen("restart", name, step.service);
    case "shell":
      return () => didHappen("command", name, step.command);
    case "review":
      return () => didHappen("review", name, "changes");
    case "runAction":
      return () => didHappen("action", name, step.action);
    case "commit":
      return () => !!p() && p()!.git.changes.length === 0;
    case "checkout":
      return () => p()?.git.branch === step.branch;
    case "copy":
      return () => !!latestCopy(step.project, step.mode);
    default:
      return null;
  }
}

export const stepDone = (steps: readonly TourAction[], index: number) => doneCheck(steps, index)?.() ?? false;
