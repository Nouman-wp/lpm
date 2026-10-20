// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EmojiLabel } from "./EmojiLabel";
import { EmojiMark } from "./EmojiMark";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const render = (node: React.ReactNode) => act(() => root.render(node));

describe("EmojiLabel", () => {
  it("writes a plain emoji in front of the label, as withEmoji does", () => {
    render(<EmojiLabel emoji="🚀" label="Deploy" />);
    expect(host.textContent).toBe("🚀 Deploy");
    expect(host.querySelector("svg")).toBeNull();
  });

  it("draws an agent's glyph as its mark instead of the character", () => {
    render(<EmojiLabel emoji="◆" label="Codex" />);
    expect(host.querySelector("svg")?.getAttribute("data-agent")).toBe("codex");
    expect(host.textContent).toBe("Codex");
  });

  it("shows the label alone without an emoji", () => {
    render(<EmojiLabel emoji={undefined} label="Tests" />);
    expect(host.textContent).toBe("Tests");
  });
});

describe("EmojiMark", () => {
  it("draws an agent's mark, or the emoji itself", () => {
    render(<EmojiMark emoji="✻" />);
    expect(host.querySelector("svg")?.getAttribute("data-agent")).toBe("claude");
    render(<EmojiMark emoji="🧪" />);
    expect(host.querySelector("svg")).toBeNull();
    expect(host.textContent).toBe("🧪");
  });
});
