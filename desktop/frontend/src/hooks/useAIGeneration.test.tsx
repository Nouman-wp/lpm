// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cancelAIGenerate = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../../bridge/commands", () => ({ CancelAIGenerate: cancelAIGenerate }));

import { useAIGeneration, type AIGeneration } from "./useAIGeneration";

let container: HTMLDivElement;
let root: Root;
let generation: AIGeneration;

function Harness({ scope }: { scope?: string }) {
  generation = useAIGeneration(scope);
  return null;
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  root = createRoot(container);
  cancelAIGenerate.mockClear();
});

afterEach(() => {
  act(() => root.unmount());
});

// Starts a run that stays in flight, and hands back the id it was given.
function start(): string {
  let id = "";
  void act(() => {
    void generation.run((genId) => {
      id = genId;
      return new Promise<string>(() => {});
    });
  });
  return id;
}

describe("useAIGeneration", () => {
  it("gives a run on this Mac a plain id", () => {
    act(() => root.render(<Harness scope="web" />));
    expect(start()).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("marks a paired machine's run, so stopping it reaches that machine", () => {
    act(() => root.render(<Harness scope="peer-0123abcd-web" />));
    const id = start();
    expect(id).toMatch(/^peer-0123abcd-[0-9a-f-]{36}$/);
    act(() => generation.cancel());
    expect(cancelAIGenerate).toHaveBeenCalledWith(id);
  });
});
