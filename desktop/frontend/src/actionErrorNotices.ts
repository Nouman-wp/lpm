import type { ProjectInfo } from "./types";

export interface ActionErrorNotice {
  error: string;
  project: ProjectInfo;
}

// Each problem once, under the first project it shows up in: a copy repeats
// its parent's, and a template's appears in every project extending it. Keyed
// without the line number, so an edit elsewhere in the file doesn't repeat it.
export function actionErrorNotices(projects: ProjectInfo[]): Map<string, ActionErrorNotice> {
  const notices = new Map<string, ActionErrorNotice>();
  for (const project of projects) {
    for (const error of project.actionErrors ?? []) {
      const key = error.replace(/ \(line \d+\)/, "");
      if (!notices.has(key)) notices.set(key, { error, project });
    }
  }
  return notices;
}
