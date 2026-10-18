// @vitest-environment happy-dom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JobScopeRow } from "./JobScopeRow";

let telegramChats: { key: string; name: string; kind: string }[] = [];
const onConnect = vi.fn();
const opened = vi.fn();
vi.mock("../../../../bridge/runtime", () => ({ BrowserOpenURL: (url: string) => opened(url) }));
vi.mock("../../../../bridge/commands", () => ({
  TelegramStatus: () =>
    Promise.resolve({
      connected: telegramChats.length > 0,
      hasToken: telegramChats.length > 0,
      bot: "lpm_bot",
      chats: telegramChats,
    }),
}));
import { defaultJobDraft, type JobDraft } from "../../../jobsFormat";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let latest: JobDraft;

const OPTIONS = [
  { value: "web", label: "Web" },
  { value: "api", label: "API" },
];

function Harness({ initial, lockedScope }: { initial: JobDraft; lockedScope?: string }) {
  const [draft, setDraft] = useState<JobDraft>(initial);
  latest = draft;
  return (
    <JobScopeRow
      host={null}
      draft={draft}
      patch={(values) => setDraft((d) => ({ ...d, ...values }))}
      onScope={(targets) => setDraft((d) => ({ ...d, targets }))}
      options={OPTIONS}
      lockedScope={lockedScope}
      canDuplicate={draft.targets.length > 0 || draft.everyProject}
      skippedCopies={[]}
      problem={false}
      onConnect={onConnect}
    />
  );
}

let renders = 0;
const render = (initial: JobDraft = defaultJobDraft(), lockedScope?: string) =>
  act(() =>
    root.render(<Harness key={++renders} initial={initial} lockedScope={lockedScope} />),
  );

const trigger = (name: string) =>
  host.querySelector<HTMLButtonElement>(`button[aria-label^='${name}']`);

const menuButton = (label: string) => {
  const found = [...document.body.querySelectorAll("button")].find(
    (b) => !host.contains(b) && b.textContent?.trim() === label,
  );
  if (!found) throw new Error(`no menu button "${label}"`);
  return found;
};

const open = (name: string) => act(() => trigger(name)!.click());
const pick = (label: string) => act(() => menuButton(label).click());

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("JobScopeRow", () => {
  it("starts standalone and says where that runs", () => {
    render();
    expect(trigger("Runs in")!.textContent).toBe("Standalone");
    open("Runs in");
    expect(document.body.textContent).toContain("runs standalone, in your home folder");
    expect(document.body.textContent).not.toContain("Works on");
  });

  it("picks projects and then what each run works on", () => {
    render();
    open("Runs in");
    pick("Web");
    expect(latest.targets).toEqual(["web"]);
    expect(trigger("Runs in")!.textContent).toBe("Web");

    pick("A fresh copy of it");
    expect(latest.duplicateMode).toBe("copy");
    expect(trigger("Runs in")!.textContent).toBe("Web · copy");
    expect(host.textContent).toContain("Each run works in a new copy");
  });

  it("shows a locked scope without offering to change it", () => {
    render({ ...defaultJobDraft(), everyProject: true }, "Every project");
    open("Runs in");
    expect(() => menuButton("Web")).toThrow();
    expect(document.body.textContent).toContain("Every project");
    expect(document.body.textContent).toContain("Works on");
  });

  it("offers access only to an AI prompt", () => {
    render();
    expect(trigger("Access")!.textContent).toBe("Full access");
    open("Access");
    pick("Read only");
    expect(latest.access).toBe("read");

    render({ ...defaultJobDraft(), runMode: "cmd" });
    expect(trigger("Access")).toBeNull();
  });

  it("connects Telegram from the menu, picking it for the job", async () => {
    telegramChats = [];
    onConnect.mockClear();
    render();
    await act(async () => {});
    expect(trigger("Send to")!.textContent).toBe("lpm");
    open("Send to");
    pick("Connect");
    expect(onConnect).toHaveBeenCalledWith("telegram", "connect");
    expect(latest.sendTo).toEqual(["lpm", "telegram"]);
    expect(host.textContent).toContain("Telegram isn't connected yet.");
    expect(host.textContent).toContain("Connect Telegram");
  });

  it("picks among Telegram's chats per job, and adds another from the menu", async () => {
    telegramChats = [
      { key: "ada", name: "Ada", kind: "private" },
      { key: "releases", name: "Releases", kind: "channel" },
    ];
    onConnect.mockClear();
    render({ ...defaultJobDraft(), sendTo: ["lpm", "telegram"] });
    await act(async () => {});
    expect(trigger("Send to")!.textContent).toBe("lpm + Ada");
    open("Send to");
    pick("Releases");
    pick("Ada");
    pick("lpm");
    expect(latest.sendTo).toEqual(["telegram:releases"]);
    expect(trigger("Send to")!.textContent).toBe("Releases");
    expect(host.textContent).toContain("lpm won't notify you about this job's runs");
    pick("Add a chat");
    expect(onConnect).toHaveBeenCalledWith("telegram", "add");
  });

  it("asks for another place on GitHub from the menu", async () => {
    telegramChats = [];
    render();
    await act(async () => {});
    open("Send to");
    pick("Request another place");
    expect(opened).toHaveBeenCalledTimes(1);
    expect(opened.mock.calls[0][0]).toMatch(/^https:\/\/github\.com\/gug007\/lpm\/issues\/new\?title=Send%20to%3A%20/);
  });

  it("offers to stop sending to a chat that was removed", async () => {
    telegramChats = [{ key: "ada", name: "Ada", kind: "private" }];
    render({ ...defaultJobDraft(), sendTo: ["lpm", "telegram:ops"] });
    await act(async () => {});
    expect(host.textContent).toContain("“ops” isn't one of your Telegram chats any more.");
    act(() => [...host.querySelectorAll("button")].find((b) => b.textContent === "Stop sending there")!.click());
    expect(latest.sendTo).toEqual(["lpm"]);
  });

  it("lets an AI prompt report only the runs that found something", () => {
    render();
    expect(trigger("Which runs to report")!.textContent).toBe("Report every run");
    expect(host.textContent).not.toContain("leaves no trace");
    open("Which runs to report");
    pick("Only report findings");
    expect(latest.quiet).toBe(true);
    expect(trigger("Which runs to report")!.textContent).toBe("Only report findings");
    expect(host.textContent).toContain("A run that finds nothing leaves no trace");

    render({ ...defaultJobDraft(), runMode: "cmd", quiet: true });
    expect(trigger("Which runs to report")).toBeNull();
    expect(host.textContent).not.toContain("leaves no trace");
  });
});
