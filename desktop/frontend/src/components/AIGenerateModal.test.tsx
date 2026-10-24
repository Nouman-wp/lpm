// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  diff: vi.fn((_props: { original: string; value: string }) => null),
}));

vi.mock("../../bridge/commands", () => ({
  CancelAIGenerate: vi.fn(() => Promise.resolve()),
  CheckAICLIs: vi.fn(() => Promise.resolve({ claude: true, codex: false, gemini: false, opencode: false })),
  PeerInvoke: vi.fn(),
}));
vi.mock("../../bridge/runtime", () => ({ EventsOn: () => () => {} }));
vi.mock("./files/FilesDiffEditor", () => ({
  FilesDiffEditor: (props: { original: string; value: string }) => mocks.diff(props),
}));

import { AIGenerateModal } from "./AIGenerateModal";

const CURRENT = "name: shop\nactions:\n  deploy-staging: ./deploy.sh\n  seed: npm run seed\n  test: npm test\n";
const GENERATED = "name: shop\nactions:\n  test: npm test\n  lint: npm run lint\n";

let container: HTMLDivElement;
let root: Root;

function button(label: string): HTMLButtonElement {
  const el = [...document.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === label);
  if (!el) throw new Error(`no ${label} button`);
  return el;
}

async function flush() {
  for (let i = 0; i < 3; i++) await act(async () => {});
}

async function show(onGenerate: () => Promise<string>) {
  const onApply = vi.fn();
  await act(async () =>
    root.render(
      <AIGenerateModal
        open
        scope="shop"
        current={CURRENT}
        onCancel={vi.fn()}
        onGenerate={onGenerate}
        onApply={onApply}
      />,
    ),
  );
  await flush();
  return { onApply };
}

beforeEach(() => {
  mocks.diff.mockClear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("AIGenerateModal", () => {
  it("offers Stop outright while the config is being generated", async () => {
    let finish: (yaml: string) => void = () => {};
    await show(() => new Promise<string>((resolve) => (finish = resolve)));
    await act(async () => button("Generate").click());
    expect(button("Stop")).toBeTruthy();
    await act(async () => finish(GENERATED));
    await flush();
    expect(document.body.textContent).toContain("Review generated config");
  });

  it("reviews the result against the current config before applying it", async () => {
    const { onApply } = await show(() => Promise.resolve(GENERATED));
    await act(async () => button("Generate").click());
    await flush();
    expect(document.body.textContent).toContain(
      "Replaces your current config: 2 actions you wrote aren't in the new one (deploy-staging, seed).",
    );
    expect(document.body.textContent).toContain("+1−2");
    expect(mocks.diff).toHaveBeenLastCalledWith(expect.objectContaining({ original: CURRENT, value: GENERATED }));
    await act(async () => button("Apply").click());
    expect(onApply).toHaveBeenCalledWith(GENERATED, false);
  });

  it("puts the user's actions back on request, then saves", async () => {
    const { onApply } = await show(() => Promise.resolve(GENERATED));
    await act(async () => button("Generate").click());
    await flush();
    const keep = document.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    await act(async () => keep.click());
    const merged = mocks.diff.mock.calls.at(-1)![0].value;
    expect(merged).toContain("deploy-staging: ./deploy.sh");
    expect(merged).toContain("lint: npm run lint");
    expect(document.body.textContent).toContain("Replaces your current config.");
    await act(async () => button("Apply & Save").click());
    expect(onApply).toHaveBeenCalledWith(merged, true);
  });
});
