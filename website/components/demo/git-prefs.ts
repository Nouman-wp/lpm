// Ports the app's gitOptions: what Pull, Push and Fetch run on click.
export type PullStrategy = "ff" | "ff-only" | "rebase";
export type PushMode = "default" | "force-with-lease";

export const PULL_STRATEGY_LABELS: Record<PullStrategy, string> = {
  ff: "Pull (ff if possible)",
  "ff-only": "Pull (ff-only)",
  rebase: "Pull (rebase)",
};

export const PUSH_MODE_LABELS: Record<PushMode, string> = {
  default: "Push",
  "force-with-lease": "Push (force-with-lease)",
};

export type GitPrefs = {
  pull: { strategy: PullStrategy; autostash: boolean; noVerify: boolean };
  push: { mode: PushMode; noVerify: boolean; tags: boolean };
  fetch: { all: boolean; prune: boolean; pruneTags: boolean; tags: boolean };
};

export const DEFAULT_GIT_PREFS: GitPrefs = {
  pull: { strategy: "ff", autostash: false, noVerify: false },
  push: { mode: "default", noVerify: false, tags: false },
  fetch: { all: true, prune: true, pruneTags: false, tags: false },
};
