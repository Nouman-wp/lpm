import { describe, expect, it } from "vitest";
import { strip, width, wrap } from "../ansi";
import { createScreen } from "./screen";

function screen(cols: number) {
  let out = "";
  const s = createScreen((data) => (out += data), () => cols);
  return { s, take: () => [out, (out = "")][0] };
}

describe("the live frame", () => {
  it("is redrawn from its first row, under what was committed", () => {
    const { s, take } = screen(20);
    s.paint(["committed"], ["working", "", "> prompt"]);
    expect(strip(take())).toBe("committed\r\nworking\r\n\r\n> prompt\r");
    s.paint(["more"], ["", "> prompt"]);
    const out = take();
    expect(out.startsWith("\x1b[0m\x1b[2A\r\x1b[J")).toBe(true);
    expect(strip(out)).toContain("more\r\n\r\n> prompt");
  });

  it("counts the rows a wide line wraps onto", () => {
    const { s, take } = screen(20);
    s.paint([], ["x".repeat(30), "status"]);
    take();
    s.paint([], ["status"]);
    expect(take()).toContain("\x1b[2A");
  });

  it("never lets its last row wrap", () => {
    const { s, take } = screen(20);
    s.paint([], ["> ", "a status line far wider than the pane"]);
    const last = strip(take()).split("\r\n").pop()!;
    expect(width(last)).toBeLessThan(20);
    expect(last).toContain("…");
  });

  it("is cleared for good when the agent exits", () => {
    const { s, take } = screen(20);
    s.paint([], ["a", "b"]);
    take();
    s.paint(["bye"], null);
    expect(take()).toBe("\x1b[0m\x1b[1A\r\x1b[Jbye\x1b[0m\r\n");
  });
});

describe("wrap", () => {
  it("breaks at spaces and hard-breaks only a word wider than the line", () => {
    expect(wrap([{ text: "one two three" }], 8)).toEqual(["one two", "three"]);
    expect(wrap([{ text: "abcdefghij" }], 4)).toEqual(["abcd", "efgh", "ij"]);
    expect(wrap([{ text: "a\nb" }], 10)).toEqual(["a", "b"]);
  });
});
