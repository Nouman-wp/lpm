// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserServiceList } from "./BrowserServiceList";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("BrowserServiceList", () => {
  it("opens a running service at its local address", () => {
    const onOpen = vi.fn();
    act(() => {
      root.render(
        <BrowserServiceList
          projectName="saas-app"
          services={[
            { name: "web", port: 3000 },
            { name: "api", port: 3001 },
          ]}
          onOpen={onOpen}
        />,
      );
    });
    expect(container.textContent).toContain("saas-app has 2 services serving pages right now");
    const rows = [...container.querySelectorAll("button")];
    expect(rows.map((r) => r.textContent?.replace(/(↵|Enter)$/, ""))).toEqual([
      "weblocalhost:3000",
      "apilocalhost:3001",
    ]);
    act(() => rows[1].click());
    expect(onOpen).toHaveBeenCalledWith("localhost:3001");
  });
});
