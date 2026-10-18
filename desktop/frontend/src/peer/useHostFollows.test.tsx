// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listProjectTerminals = vi.hoisted(() => vi.fn());
vi.mock("../../bridge/commands", () => ({ ListProjectTerminals: listProjectTerminals }));

import { noteHostFollows } from "./hostFollows";
import { prefixName } from "./markers";
import { useHostFollows } from "./useHostFollows";

let root: Root;
let follows: boolean | undefined;

function Harness({ project }: { project: string }) {
  follows = useHostFollows(project);
  return null;
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  root = createRoot(document.createElement("div"));
});

afterEach(() => {
  act(() => root.unmount());
});

describe("useHostFollows", () => {
  it("asks the host, then goes by what its listings say", async () => {
    listProjectTerminals.mockResolvedValueOnce({ follow: false, terminals: [] });
    const project = prefixName("aaaaaaaa", "api");
    await act(async () => root.render(<Harness project={project} />));
    expect(listProjectTerminals).toHaveBeenCalledWith(project, true);
    expect(follows).toBe(false);

    act(() => noteHostFollows(prefixName("aaaaaaaa", "web"), true));
    expect(follows).toBe(true);
  });

  it("has nothing to say about this Mac's own projects", async () => {
    await act(async () => root.render(<Harness project="api" />));
    expect(follows).toBeUndefined();
  });
});
