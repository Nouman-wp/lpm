// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildSearchEntries, matchSettings } from "../settings-registry";
import { groupSearchResults } from "../settingsSearchHits";
import { SettingsSearch } from "./SettingsSearch";

const entries = buildSearchEntries({ experimentalTTS: true, mac: true });

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

function render(query: string, onActivate = vi.fn(), onQueryChange = vi.fn()) {
  act(() =>
    root.render(
      <SettingsSearch
        query={query}
        onQueryChange={onQueryChange}
        results={matchSettings(entries, query)}
        hints={["sound", "port"]}
        onActivate={onActivate}
      />,
    ),
  );
  return { onActivate, onQueryChange };
}

function press(key: string) {
  const input = container.querySelector("input")!;
  act(() => {
    input.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
}

describe("SettingsSearch", () => {
  it("shows results under their pages and says why a keyword matched", () => {
    render("caffeinate");
    const text = container.textContent ?? "";
    expect(text).toContain("Mobile devices");
    expect(text).toContain("Connections");
    expect(text).toContain("Matched “caffeinate” in: caffeinate");
    expect(text).toContain("Settings › Connections");
    expect([...container.querySelectorAll("mark")].map((m) => m.textContent)).toContain("caffeinate");
  });

  it("walks the results in the order they're shown", () => {
    const { onActivate } = render("caffeinate");
    const shown = groupSearchResults(matchSettings(entries, "caffeinate"), "caffeinate").flatMap((g) =>
      g.hits.map((h) => h.entry.id),
    );
    press("ArrowDown");
    press("Enter");
    expect(onActivate).toHaveBeenCalledWith(expect.objectContaining({ id: shown[1] }));
  });

  it("marks the matched part of a label", () => {
    render("them");
    expect([...container.querySelectorAll("mark")].map((m) => m.textContent)).toContain("Them");
  });

  it("suggests other searches when nothing matches", () => {
    const { onQueryChange } = render("zzzz");
    expect(container.textContent).toContain("No matches for “zzzz”.");
    const hint = [...container.querySelectorAll("button")].find((b) => b.textContent === "“port”")!;
    act(() => hint.click());
    expect(onQueryChange).toHaveBeenCalledWith("port");
  });
});
