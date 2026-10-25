import type { ReactNode } from "react";
import { toast as sonner } from "sonner";
import { allowsChannel } from "./channels";
import { findLiveToast, useLiveToasts } from "./liveToasts";
import { ToastCard } from "./ToastCard";
import { plainText, splitErrorMessage } from "./toastText";
import { holdsToasts, whenToastsReleased } from "./typingHold";
import type { ToastId, ToastKind, ToastModel, ToastOptions } from "./types";

const DEFAULT_DURATION = 5000;

/** The work's toast: `loading` with `description` while it runs, then `success`
 *  or `error`, the failure alone offering `retry`. */
interface PromiseMessages<T> extends Omit<ToastOptions, "id"> {
  loading: ReactNode;
  success: ReactNode | ((data: T) => ReactNode);
  error: ReactNode | ((error: unknown) => ReactNode);
}

let seq = 0;
let held: ToastModel[] = [];
// sonner keeps a closed toast's id until it has animated out, and reports the
// close then, so news shown again under that id goes to sonner under a key of
// its own: the old toast's late close can't take the new one with it.
const keys = new Map<ToastId, string>();

function durationFor(kind: ToastKind, explicit: number | undefined): number {
  if (explicit !== undefined) return explicit;
  // Failures and warnings wait to be read; work in progress ends on its own.
  return kind === "error" || kind === "warning" || kind === "loading" ? Infinity : DEFAULT_DURATION;
}

function buildModel(kind: ToastKind, message: ReactNode, options: ToastOptions): ToastModel {
  const text =
    kind === "error" && typeof message === "string" && options.description === undefined
      ? splitErrorMessage(message)
      : null;
  return {
    id: options.id ?? `toast-${++seq}`,
    kind,
    title: text?.title ?? message,
    description: text?.description ?? options.description,
    details: text?.details,
    quote: options.quote,
    tag: options.tag,
    progress: options.progress,
    content: options.content,
    actions: [options.action, ...(options.actions ?? [])].filter((a) => a !== undefined),
    cancel: options.cancel,
    retry: options.retry,
    event: options.event,
    count: 1,
    duration: durationFor(kind, options.duration),
    shownAt: Date.now(),
  };
}

const repeatKey = (m: ToastModel) => `${m.kind}\n${plainText(m.title)}\n${plainText(m.description)}`;

/** The same news while its toast is still up: count it on that card. */
function asRepeat(model: ToastModel): ToastModel {
  if (model.kind === "loading") return model;
  const key = repeatKey(model);
  const earlier = useLiveToasts.getState().toasts.find((t) => repeatKey(t) === key);
  return earlier
    ? { ...model, id: earlier.id, count: earlier.count + 1, detailsOpen: earlier.detailsOpen }
    : model;
}

function forget(id: ToastId) {
  keys.delete(id);
  useLiveToasts.getState().drop(id);
  held = held.filter((m) => m.id !== id);
}

function present(model: ToastModel) {
  useLiveToasts.getState().put(model);
  const { id } = model;
  const key = keys.get(id) ?? `${id}#${++seq}`;
  keys.set(id, key);
  const closed = () => {
    if (keys.get(id) === key) forget(id);
  };
  sonner.custom(() => <ToastCard id={id} onToggleDetails={() => toggleDetails(id)} onClose={() => dismiss(id)} />, {
    id: key,
    duration: model.duration,
    onDismiss: closed,
    onAutoClose: closed,
  });
}

// Shown again like any other update, which is also when sonner measures a
// toast's new height.
function toggleDetails(id: ToastId) {
  const model = findLiveToast(id);
  if (model) present({ ...model, detailsOpen: !model.detailsOpen });
}

function show(kind: ToastKind, message: ReactNode, options: ToastOptions = {}): ToastId {
  const built = buildModel(kind, message, options);
  const model = options.id === undefined ? asRepeat(built) : built;

  if (!allowsChannel(model.event, "inApp")) return model.id;
  const updating = findLiveToast(model.id) !== undefined;
  if (!updating && kind !== "loading" && holdsToasts()) {
    held = [...held.filter((m) => m.id !== model.id), model];
    return model.id;
  }
  present(model);
  return model.id;
}

whenToastsReleased(() => {
  const waiting = held;
  held = [];
  waiting.forEach(present);
});

function dismiss(id?: ToastId): void {
  if (id === undefined) {
    [...keys.keys()].forEach(dismiss);
    held = [];
    sonner.dismiss();
    return;
  }
  // A hand-built toast (`toast.custom`) is known to sonner by its own id.
  const key = keys.get(id) ?? id;
  forget(id);
  sonner.dismiss(key);
}

function promise<T>(work: Promise<T>, messages: PromiseMessages<T>): ToastId {
  const { loading, success, error, retry, description, ...options } = messages;
  const id = show("loading", loading, { ...options, description });
  work.then(
    (data) => show("success", typeof success === "function" ? success(data) : success, { ...options, id }),
    (err: unknown) =>
      show("error", typeof error === "function" ? error(err) : error, { ...options, id, retry }),
  );
  return id;
}

/** lpm's toasts: sonner draws and stacks them; this decides what they say
 *  and how long they stay. */
export const toast = Object.assign((message: ReactNode, options?: ToastOptions) => show("default", message, options), {
  success: (message: ReactNode, options?: ToastOptions) => show("success", message, options),
  info: (message: ReactNode, options?: ToastOptions) => show("info", message, options),
  warning: (message: ReactNode, options?: ToastOptions) => show("warning", message, options),
  error: (message: ReactNode, options?: ToastOptions) => show("error", message, options),
  loading: (message: ReactNode, options?: ToastOptions) => show("loading", message, options),
  promise,
  dismiss,
  custom: sonner.custom,
});

/** Closes every card this module shows, leaving hand-built toasts be. */
export function dismissCards(): void {
  held = [];
  [...keys.keys()].forEach(dismiss);
}
