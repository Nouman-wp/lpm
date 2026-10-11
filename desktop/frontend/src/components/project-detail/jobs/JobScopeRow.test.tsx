// @vitest-environment happy-dom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { JobScopeRow } from "./JobScopeRow";
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
      draft={draft}
      patch={(values) => setDraft((d) => ({ ...d, ...values }))}
      onScope={(targets) => setDraft((d) => ({ ...d, targets }))}
      options={OPTIONS}
      lockedScope={lockedScope}
      canDuplicate={draft.targets.length > 0 || draft.everyProject}
      skippedCopies={[]}
      problem={false}
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
});
