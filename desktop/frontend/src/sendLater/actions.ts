import { toast } from "../notifications/toast";
import { useAppStore } from "../store/app";
import { deliverPromptDraft } from "../store/composerDrafts";
import { deleteMessage } from "../store/messageHistory";
import {
  rememberEditedTime,
  removePrompt,
  schedulePrompt,
  sendPromptNow,
  useSendLater,
  type ScheduledPrompt,
} from "../store/sendLater";
import { useTerminalTargets } from "../store/terminalTargets";
import { keepAsDraft } from "./closeout";
import { promptPreview } from "./preview";

// What a mounted composer lends to the actions below: putting a prompt back in
// its input, opening its Send later picker for a prompt already scheduled, and
// opening its History on Drafts, which says whether the input is on screen.
export interface ComposerSendLaterHost {
  restore: (text: string, images: Record<string, string>) => void;
  openPicker: (item: ScheduledPrompt) => void;
  openDrafts: () => boolean;
}

// The terminal input a prompt belongs to.
interface PromptHome {
  projectName: string;
  historyKey: string;
}

interface HomedPrompt extends PromptHome {
  text: string;
  images: Record<string, string>;
}

// A prompt just filed with the drafts. `id` is empty when the draft can't be
// named (the demo keeps none).
export interface SavedDraft extends HomedPrompt {
  id: string;
}

// How long Drafts waits for an input brought into view to show up.
const DRAFTS_WAIT_MS = 2_000;

const hosts = new Map<string, ComposerSendLaterHost>();
const draftsWanted = new Map<string, number>();

export function registerComposerHost(historyKey: string, host: ComposerSendLaterHost): () => void {
  hosts.set(historyKey, host);
  const wantedUntil = draftsWanted.get(historyKey);
  if (wantedUntil !== undefined) {
    draftsWanted.delete(historyKey);
    if (Date.now() <= wantedUntil) host.openDrafts();
  }
  return () => {
    if (hosts.get(historyKey) === host) hosts.delete(historyKey);
  };
}

function liveTarget(home: PromptHome) {
  return (
    useTerminalTargets
      .getState()
      .byProject[home.projectName]?.find((t) => t.historyKey === home.historyKey) ?? null
  );
}

// Where a prompt taken off the schedule goes back to: the terminal's own input
// when it is on screen, else parked in that terminal's input and brought into
// view. False when its terminal isn't open in this window at all.
function canPutBack(home: PromptHome): boolean {
  return hosts.has(home.historyKey) || liveTarget(home) !== null;
}

function putBack(prompt: HomedPrompt): void {
  const host = hosts.get(prompt.historyKey);
  if (host) {
    host.restore(prompt.text, prompt.images);
    return;
  }
  const target = liveTarget(prompt);
  if (!target) return;
  deliverPromptDraft(target.id, prompt.historyKey, prompt.text, prompt.images);
  useAppStore.getState().focusProjectTerminal(prompt.projectName, target.id);
}

// History › Drafts in the prompt's own input: at once when it is on screen,
// else as soon as its terminal, brought into view, shows it.
function openDrafts(home: PromptHome): void {
  const host = hosts.get(home.historyKey);
  if (host?.openDrafts()) return;
  const target = liveTarget(home);
  if (!target) return;
  if (!host) draftsWanted.set(home.historyKey, Date.now() + DRAFTS_WAIT_MS);
  useAppStore.getState().focusProjectTerminal(home.projectName, target.id);
}

// Undo takes the draft back out of History into its input. With that input not
// open here, the prompt stays a draft rather than going nowhere.
function undoSavedDraft(draft: SavedDraft): void {
  if (!canPutBack(draft)) {
    toast("Kept as a draft", {
      description: "Its terminal isn't open here, so the prompt is in History › Drafts.",
    });
    return;
  }
  if (draft.id) deleteMessage(draft.id);
  putBack(draft);
}

export function announceSavedDraft(draft: SavedDraft): void {
  toast.success("Saved to Drafts", {
    description: `“${promptPreview(draft.text, 60)}”`,
    cancel: { label: "Open Drafts", onClick: () => openDrafts(draft) },
    action: { label: "Undo", onClick: () => undoSavedDraft(draft) },
  });
}

// With nowhere to put it back, the prompt goes to the drafts instead.
async function toDrafts(item: ScheduledPrompt): Promise<void> {
  try {
    await keepAsDraft(item);
    toast("Kept as a draft", {
      description: "Its terminal isn't open here, so the prompt is in History › Drafts.",
    });
  } catch (err) {
    toast.error(`Couldn't keep it as a draft: ${String(err)}`);
  }
}

// Send now skips the wait for the agent to finish, but never types into a
// question, which would take the prompt as its answer: that wait is the user's
// to end, so they are shown the question.
export function sendScheduledNow(item: ScheduledPrompt): void {
  sendPromptNow(item.id).catch((err) => toast.error(`Couldn't send it: ${String(err)}`));
  if (useSendLater.getState().holds[item.id] !== "asking") return;
  toast(`${item.terminalLabel || "The agent"} is waiting for your answer`, {
    description: "Answer it, and the prompt goes in right after.",
  });
  const target = liveTarget(item);
  if (target) useAppStore.getState().focusProjectTerminal(item.projectName, target.id);
}

// Take a prompt off the schedule into the input to change it. The time is kept,
// so Send later opens on it again.
export async function editScheduled(item: ScheduledPrompt): Promise<void> {
  if (!canPutBack(item)) return toDrafts(item);
  const removed = await removePrompt(item.id).catch(() => null);
  if (!removed) return;
  rememberEditedTime(removed.historyKey, removed.dueAt);
  putBack(removed);
}

export async function cancelScheduled(item: ScheduledPrompt): Promise<void> {
  const removed = await removePrompt(item.id).catch(() => null);
  if (!removed) return;
  toast("Scheduled prompt canceled", {
    description: `“${promptPreview(removed.text, 60)}”`,
    action: {
      label: "Undo",
      onClick: () => {
        void schedulePrompt({
          projectName: removed.projectName,
          historyKey: removed.historyKey,
          terminalLabel: removed.terminalLabel,
          agent: removed.agent,
          text: removed.text,
          images: removed.images,
          dueAt: Math.max(removed.dueAt, Date.now() + 60_000),
          kind: removed.kind,
        });
      },
    },
  });
}

export async function keepScheduledAsDraft(item: ScheduledPrompt): Promise<void> {
  try {
    const id = await keepAsDraft(item);
    announceSavedDraft({
      id,
      projectName: item.projectName,
      historyKey: item.historyKey,
      text: item.text,
      images: item.images,
    });
  } catch (err) {
    toast.error(`Couldn't keep it as a draft: ${String(err)}`);
  }
}

// Undo right after scheduling: off the schedule and back into the input.
export async function unschedule(item: ScheduledPrompt): Promise<void> {
  if (!canPutBack(item)) return toDrafts(item);
  const removed = await removePrompt(item.id).catch(() => null);
  if (removed) putBack(removed);
}

// Pick a new time for a waiting prompt, in the picker of the input it was
// chosen from (the History popover's composer), else the prompt's own.
export function newTimeFor(item: ScheduledPrompt, fromHistoryKey?: string): void {
  const host = (fromHistoryKey && hosts.get(fromHistoryKey)) || hosts.get(item.historyKey);
  if (host) host.openPicker(item);
}
