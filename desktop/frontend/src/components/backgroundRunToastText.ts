export type BackgroundRunStatus = "running" | "success" | "error" | "cancelled";

const DONE_MS = 4000;
// Long enough to read the failure, short enough not to park over the header's
// action row; hovering pauses it and opening the output keeps it.
const FAILED_MS = 10000;

export function backgroundRunDuration(status: BackgroundRunStatus, pinned: boolean): number {
  if (status === "running" || pinned) return Infinity;
  return status === "error" ? FAILED_MS : DONE_MS;
}

export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// A failure reads "exit status 2: <output tail>". Once the output is on screen
// the tail would show twice, so only the exit status is kept.
export function failureText(error: string, outputShown: boolean): string {
  if (!outputShown) return error;
  const status = /^(exit status -?\d+|signal: \d+): /.exec(error);
  return status ? status[1] : error;
}
