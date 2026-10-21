import type { SeedChange } from "../types";

// A changed file and the hunks of its unified diff ("@@" opens one, then "+",
// "-" and " " lines), which put HEAD back together from the working tree. An
// added file needs none.
export interface ChangeSpec {
  path: string;
  status: SeedChange["status"];
  diff?: string;
}

interface Hunk {
  after: string[];
  before: string[];
}

function hunks(diff: string): Hunk[] {
  const out: Hunk[] = [];
  for (const line of diff ? diff.split("\n") : []) {
    if (line.startsWith("@@")) {
      out.push({ after: [], before: [] });
      continue;
    }
    const hunk = out[out.length - 1];
    if (!hunk) throw new Error(`diff line before its hunk: ${line}`);
    const mark = line.charAt(0);
    const text = line.slice(1);
    if (mark !== "-") hunk.after.push(text);
    if (mark !== "+") hunk.before.push(text);
  }
  return out;
}

function indexOfBlock(lines: readonly string[], block: readonly string[]): number {
  for (let i = 0; i + block.length <= lines.length; i++) {
    if (block.every((line, j) => lines[i + j] === line)) return i;
  }
  return -1;
}

/** The file as HEAD has it, by putting each hunk's "-" side back. */
export function atHead(path: string, working: string, diff: string): string {
  const lines = working.split("\n");
  for (const { after, before } of hunks(diff)) {
    const at = indexOfBlock(lines, after);
    if (at < 0) throw new Error(`${path}: a hunk of its diff is not in the working tree`);
    lines.splice(at, after.length, ...before);
  }
  return lines.join("\n");
}

export function buildChanges(files: Record<string, string>, specs: readonly ChangeSpec[]): SeedChange[] {
  return specs.map(({ path, status, diff }) => {
    const working = files[path] ?? "";
    if (!(path in files) && status !== "deleted") throw new Error(`${path}: not in the tree`);
    return {
      path,
      status,
      original: status === "added" ? "" : atHead(path, working, diff ?? ""),
      modified: working,
    };
  });
}
