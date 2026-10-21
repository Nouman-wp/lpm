import type { AgentTask, SeedAction } from "../types";

const withTask = (task?: AgentTask) => (task ? { task } : {});

export const claudeAction = (task?: AgentTask): SeedAction => ({
  name: "claude",
  label: "Claude",
  emoji: "✻",
  color: "#de8a68",
  cmd: "claude",
  display: "",
  type: "terminal",
  ...withTask(task),
});

export const codexAction = (task?: AgentTask): SeedAction => ({
  name: "codex",
  label: "Codex",
  emoji: "◆",
  color: "#22d3ee",
  cmd: "codex",
  display: "",
  type: "terminal",
  ...withTask(task),
});
