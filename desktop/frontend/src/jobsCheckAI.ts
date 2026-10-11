import type { ActionInfo } from "./types";
import type { JobDraft } from "./jobsFormat";

export const CHECK_INSTRUCTION = `Write one shell command that a scheduled job runs before each run to decide whether there is any work to do. The text below says when the job should run and, if given, what the job does.

The command must exit 0 only when the job has something to do right now, and exit non-zero when it doesn't. A command that prints nothing must still fail, so end a listing with \`| grep .\`. It runs non-interactively in bash from the project folder, so keep it quick and read-only: no prompts, no edits, no installs. Look around the project if that helps you pick the right tools.

Reply with the command alone, on one line.`;

// Starting points for the description, each a plain-language "when".
export const CHECK_IDEAS: { label: string; want: string }[] = [
  { label: "New upstream commits", want: "When the upstream branch has commits I haven't pulled" },
  { label: "Uncommitted changes", want: "When the project has uncommitted changes" },
  { label: "PRs to review", want: "When a pull request is waiting for my review" },
  { label: "Outdated dependencies", want: "When a dependency has a newer version available" },
];

// What the job does, in words the check generator can work from; empty when
// there is nothing to go on yet.
export function checkTask(draft: JobDraft, action: ActionInfo | null): string {
  const prompt = draft.prompt.text.trim();
  if (draft.runMode === "cmd") {
    const cmd = draft.cmd.trim();
    return cmd ? `Runs this shell command: ${cmd}` : "";
  }
  if (draft.runMode === "action") {
    if (!action) return "";
    const runs = `Runs the "${action.label}" action: ${action.cmd}`;
    return prompt ? `${runs}\nWith this prompt: ${prompt}` : runs;
  }
  return prompt;
}

export function checkRequest(want: string, task: string): string {
  const when = `When it should run: ${want.trim()}`;
  return task ? `${when}\n\nWhat the job does: ${task}` : when;
}

// The command alone, whatever fences, backticks or prompt sign came with it.
export function cleanCheckCommand(raw: string): string {
  const line = raw
    .replace(/```[a-z]*/gi, "")
    .split("\n")
    .map((l) => l.trim())
    .find(Boolean);
  return (line ?? "").replace(/^`+|`+$/g, "").replace(/^\$\s+/, "").trim();
}
