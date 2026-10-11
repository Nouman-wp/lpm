import { describe, expect, it } from "vitest";
import { minimalEdit } from "./modelText";

function apply(current: string, next: string): string {
  const edit = minimalEdit(current, next);
  if (!edit) return current;
  return current.slice(0, edit.start) + edit.text + current.slice(edit.end);
}

describe("minimalEdit", () => {
  it("is null for equal text", () => {
    expect(minimalEdit("a\nb\n", "a\nb\n")).toBeNull();
  });

  it("replaces only the changed line", () => {
    const edit = minimalEdit("a\nb\nc\n", "a\nB\nc\n");
    expect(edit).toEqual({ start: 2, end: 4, text: "B\n" });
  });

  it.each([
    ["insert in the middle", "a\nc\n", "a\nb\nc\n"],
    ["delete in the middle", "a\nb\nc\n", "a\nc\n"],
    ["append without a final newline", "a", "a\nb"],
    ["append after a final newline", "a\n", "a\nb\n"],
    ["drop the last line", "a\nb", "a"],
    ["drop the final newline", "a\nb\n", "a\nb"],
    ["add a final newline", "a\nb", "a\nb\n"],
    ["prepend", "b\nc\n", "a\nb\nc\n"],
    ["empty to text", "", "a\nb\n"],
    ["text to empty", "a\nb\n", ""],
    ["repeated lines", "x\nx\nx\n", "x\nx\n"],
    ["CRLF lines", "a\r\nb\r\nc\r\n", "a\r\nB\r\nc\r\n"],
  ])("%s", (_, current, next) => {
    expect(apply(current, next)).toBe(next);
  });

  it("keeps the shared lines out of the edit", () => {
    const lines = Array.from({ length: 1000 }, (_, i) => `line ${i}\n`);
    const current = lines.join("");
    const next = [...lines.slice(0, 500), "changed\n", ...lines.slice(501)].join("");
    const edit = minimalEdit(current, next);
    expect(edit?.text).toBe("changed\n");
    expect(apply(current, next)).toBe(next);
  });
});
