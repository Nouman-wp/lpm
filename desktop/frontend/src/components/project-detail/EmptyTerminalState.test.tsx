// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { EmptyTerminalState } from "./EmptyTerminalState";

describe("EmptyTerminalState", () => {
  it("names the project by the label the user sees", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() =>
      root.render(
        <EmptyTerminalState projectLabel="wt-one" onNewTerminal={() => {}} onEditConfig={() => {}} />,
      ),
    );
    expect(container.textContent).toContain("start working on wt-one,");
    act(() => root.unmount());
  });
});
