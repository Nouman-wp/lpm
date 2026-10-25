// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExternalToast } from "sonner";

const sonner = vi.hoisted(() => ({ custom: vi.fn(), dismiss: vi.fn() }));
vi.mock("sonner", () => ({ toast: sonner }));

const settings = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock("../store/settings", () => ({ getSettings: () => settings.current }));

import { findLiveToast, useLiveToasts } from "./liveToasts";
import { toast } from "./toast";

const presented = (): ExternalToast[] => sonner.custom.mock.calls.map((call) => call[1] as ExternalToast);

describe("toast", () => {
  beforeEach(() => {
    settings.current = {};
    useLiveToasts.setState({ toasts: [] });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("keeps errors up until closed and lets other news time out", () => {
    const error = toast.error("Pull failed: Not possible to fast-forward");
    const success = toast.success("Saved");

    expect(presented().map((t) => t.duration)).toEqual([Infinity, 5000]);
    expect(findLiveToast(error)).toMatchObject({ title: "Pull failed", description: "Not possible to fast-forward" });
    expect(findLiveToast(success)).toMatchObject({ kind: "success", count: 1 });
  });

  it("counts a repeat on the card that's still up instead of stacking another", () => {
    const first = toast.error("AI returned an empty response");
    const second = toast.error("AI returned an empty response");

    expect(second).toBe(first);
    expect(useLiveToasts.getState().toasts).toHaveLength(1);
    expect(findLiveToast(first)?.count).toBe(2);
  });

  it("updates a toast in place when it's shown again under its id", () => {
    const id = toast.loading("Pulling web");
    toast.success("Pulled 3 commits", { id });

    expect(useLiveToasts.getState().toasts).toEqual([expect.objectContaining({ id, kind: "success", count: 1 })]);
  });

  it("keeps news turned off in the app out of the corner", () => {
    settings.current = { notificationChannels: { autoPull: { inApp: false } } };
    toast.success("Pulled 2 projects", { event: "autoPull" });

    expect(sonner.custom).not.toHaveBeenCalled();
  });

  it("holds toasts while the composer is being typed in", () => {
    settings.current = { holdToastsWhileTyping: true };
    vi.useFakeTimers();
    const composer = document.createElement("div");
    composer.setAttribute("data-terminal-composer", "");
    document.body.append(composer);

    composer.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }));
    toast.success("Saved");
    expect(sonner.custom).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1500);
    expect(sonner.custom).toHaveBeenCalledOnce();
    composer.remove();
  });

  it("forgets a toast sonner closed", () => {
    const id = toast.success("Saved");

    presented()[0].onDismiss?.({ id });

    expect(findLiveToast(id)).toBeUndefined();
  });

  it("shows news again under an id that was just closed, whenever the old toast's close lands", () => {
    toast.loading("Creating 3 copies of web", { id: "copies" });
    toast.dismiss("copies");
    toast.success("Created 2 of 3 copies of web", { id: "copies" });

    const [first, second] = presented();
    first.onDismiss?.({ id: first.id! });

    expect(second.id).not.toBe(first.id);
    expect(findLiveToast("copies")).toMatchObject({ kind: "success", title: "Created 2 of 3 copies of web" });
  });

  it("offers the retry on a failed promise only", async () => {
    const retry = vi.fn();
    const id = toast.promise(Promise.reject(new Error("offline")), {
      loading: "Pushing web",
      success: "Pushed",
      error: (err) => `Couldn't push web: ${(err as Error).message}`,
      retry,
    });
    expect(findLiveToast(id)?.retry).toBeUndefined();

    await vi.waitFor(() => expect(findLiveToast(id)?.kind).toBe("error"));
    expect(findLiveToast(id)).toMatchObject({ title: "Couldn't push web", description: "offline", retry });
  });
});
