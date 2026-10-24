const STORAGE_KEY = "lpm.prDraft";

// Whether each project last opened its pull requests as drafts, so the Create
// PR button starts on the same choice next time.
function load(): Record<string, boolean> {
  try {
    if (typeof localStorage === "undefined") return {};
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function prefersDraftPr(project: string): boolean {
  return load()[project] === true;
}

export function rememberDraftPr(project: string, draft: boolean): void {
  try {
    if (typeof localStorage === "undefined") return;
    const prefs = load();
    if (draft) prefs[project] = true;
    else delete prefs[project];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore storage failures (private mode, quota)
  }
}
