// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAutomationOpen } from "../store/automationOpen";
import type { ScheduledJob } from "./useJobs";
import { useAutomationOpenRequest } from "./useAutomationOpenRequest";

const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { error: toastError } }));

const local: ScheduledJob = { id: "nightly", source: "project", targets: ["web"], project: "web" } as ScheduledJob;
const shared: ScheduledJob = { id: "audit", source: "global", targets: ["web", "api"] } as ScheduledJob;

let container: HTMLDivElement;
let root: Root;
const refetch = vi.fn(async () => {});
const onOpen = vi.fn();

function Harness({ enabled = true, rows }: { enabled?: boolean; rows: ScheduledJob[] | null }) {
  useAutomationOpenRequest(enabled, rows, refetch, onOpen);
  return null;
}

function render(rows: ScheduledJob[] | null, enabled = true) {
  act(() => root.render(<Harness enabled={enabled} rows={rows} />));
}

function request(id: string, project: string | null) {
  act(() => useAutomationOpen.getState().open(id, project));
}

beforeEach(() => {
  useAutomationOpen.getState().clear();
  refetch.mockClear();
  onOpen.mockClear();
  toastError.mockClear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("useAutomationOpenRequest", () => {
  it("waits for the list, then opens the automation in the asked project", () => {
    request("audit", "api");
    render(null);
    expect(onOpen).not.toHaveBeenCalled();
    render([local, shared]);
    expect(onOpen).toHaveBeenCalledWith(shared, "api");
    expect(useAutomationOpen.getState().request).toBeNull();
  });

  it("opens a global automation without a project on its own row", () => {
    render([local, shared]);
    request("audit", null);
    expect(onOpen).toHaveBeenCalledWith(shared, null);
  });

  it("refetches once for one the list doesn't have yet", () => {
    const rows = [local];
    render(rows);
    request("audit", "web");
    expect(refetch).toHaveBeenCalledTimes(1);
    render(rows);
    expect(toastError).not.toHaveBeenCalled();
    render([local, shared]);
    expect(onOpen).toHaveBeenCalledWith(shared, "web");
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("gives up with an error when the fresh list still doesn't have it", () => {
    render([local]);
    request("nightly", "api");
    render([local]);
    expect(onOpen).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(useAutomationOpen.getState().request).toBeNull();
  });

  it("leaves the request to the app-wide page", () => {
    render([local], false);
    request("nightly", "web");
    expect(onOpen).not.toHaveBeenCalled();
    expect(useAutomationOpen.getState().request).not.toBeNull();
  });
});
