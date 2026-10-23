import { create } from "zustand";

// How a quick action's last run ended, shown on its button for a while after
// the result card has closed.
export interface ActionRunMark {
  ok: boolean;
  at: number;
}

const ACTION_RUN_MARK_MS = 60_000;

interface ActionRunMarksState {
  marks: Record<string, ActionRunMark>;
}

export const useActionRunMarks = create<ActionRunMarksState>(() => ({ marks: {} }));

// Also the button's data-action-run value, which the result card opens under.
export function actionRunKey(scope: string, name: string): string {
  return `${scope}/${name}`;
}

export function markActionRun(key: string, ok: boolean, at = Date.now()) {
  useActionRunMarks.setState((s) => ({ marks: { ...s.marks, [key]: { ok, at } } }));
  setTimeout(() => {
    if (useActionRunMarks.getState().marks[key]?.at === at) clearActionRun(key);
  }, ACTION_RUN_MARK_MS);
}

export function clearActionRun(key: string) {
  if (!useActionRunMarks.getState().marks[key]) return;
  useActionRunMarks.setState((s) => {
    const marks = { ...s.marks };
    delete marks[key];
    return { marks };
  });
}
