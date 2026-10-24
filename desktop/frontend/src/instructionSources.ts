import type { InstructionKind } from "./components/settings/machineCommands";
import {
  DEFAULT_BRANCH_NAME_INSTRUCTIONS,
  DEFAULT_COMMIT_INSTRUCTIONS,
  DEFAULT_PR_DESCRIPTION_INSTRUCTIONS,
  DEFAULT_PR_TITLE_INSTRUCTIONS,
} from "./aiInstructions";

export type InstructionsTarget = "commit" | "pr" | "branch";

export type InstructionsSource = "project" | "global" | "default";

export interface InstructionsPart {
  // The per-project file key (INSTRUCTION_KEYS in templates.rs).
  key: string;
  machineKind: InstructionKind;
  label: string;
  fallback: string;
}

export const INSTRUCTION_PARTS: Record<InstructionsTarget, InstructionsPart[]> = {
  commit: [
    { key: "commit", machineKind: "commit", label: "Commit message", fallback: DEFAULT_COMMIT_INSTRUCTIONS },
  ],
  pr: [
    { key: "pr-title", machineKind: "prTitle", label: "Title", fallback: DEFAULT_PR_TITLE_INSTRUCTIONS },
    {
      key: "pr-description",
      machineKind: "prDescription",
      label: "Description",
      fallback: DEFAULT_PR_DESCRIPTION_INSTRUCTIONS,
    },
  ],
  branch: [
    {
      key: "branch-name",
      machineKind: "branchName",
      label: "Branch name",
      fallback: DEFAULT_BRANCH_NAME_INSTRUCTIONS,
    },
  ],
};

export const SOURCE_LABEL: Record<InstructionsSource, string> = {
  project: "Project (custom)",
  global: "Global",
  default: "Default",
};

export interface PartInEffect {
  label: string;
  text: string;
  source: InstructionsSource;
}

export interface InstructionsInEffect {
  source: InstructionsSource;
  parts: PartInEffect[];
}

const isBlank = (text: string) => text.trim() === "";

// resolve_instructions in templates.rs: the project's text when it isn't blank,
// else the machine's, else the built-in rules. The global editor starts out
// holding the default text, so a global text that is still just that counts as
// the default.
export function partInEffect(part: InstructionsPart, own: string, global: string): PartInEffect {
  if (!isBlank(own)) return { label: part.label, text: own.trim(), source: "project" };
  if (!isBlank(global) && global.trim() !== part.fallback.trim()) {
    return { label: part.label, text: global.trim(), source: "global" };
  }
  return { label: part.label, text: part.fallback, source: "default" };
}

export function instructionsInEffect(parts: PartInEffect[]): InstructionsInEffect {
  const source = parts.some((p) => p.source === "project")
    ? "project"
    : parts.some((p) => p.source === "global")
      ? "global"
      : "default";
  return { source, parts };
}

export function insertDefault(content: string, fallback: string): string {
  if (isBlank(content)) return fallback;
  return `${content.trimEnd()}\n${fallback}`;
}

// Saving the default text itself stores nothing, so the built-in rules keep
// applying (and keep up with lpm's own updates to them).
export function globalTextToSave(content: string, fallback: string): string {
  return content.trim() === fallback.trim() ? "" : content;
}
