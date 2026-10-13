// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./terminal-utils", () => ({
  ansiColors: { brightBlue: "#5c9dff" },
}));

import { canonicalizeEditor, setCaretAtOffset } from "./composerCanon";
import { pointOffset } from "./composerDom";
import { deleteBeside, insertLineBreak, killToLineEnd, moveToLineEdge, stepCaret } from "./composerEditKeys";
import {
  caretOffsetInSerialized,
  chipAfterCaret,
  chipBeforeCaret,
  insertItemsAtCaret,
  relabelImageChips,
  serializeEditor,
} from "./composerEditor";

const Z = "​";

function editor(): HTMLElement {
  const root = document.createElement("div");
  root.contentEditable = "true";
  document.body.appendChild(root);
  return root;
}

function chip(n: number): HTMLElement {
  const el = document.createElement("span");
  el.dataset.img = String(n);
  el.contentEditable = "false";
  el.innerHTML = `<span data-img-label>Image ${n}</span>`;
  return el;
}

function caretAt(node: Node, offset: number): void {
  const range = document.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  const sel = window.getSelection()!;
  sel.removeAllRanges();
  sel.addRange(range);
}

// The field as text with chips as [N] and anchors as Z.
function shape(root: HTMLElement): string {
  return Array.from(root.childNodes)
    .map((n) => (n instanceof HTMLElement && n.dataset.img ? `[${n.dataset.img}]` : (n.textContent ?? "").replaceAll(Z, "Z")))
    .join("|");
}

beforeEach(() => {
  document.body.replaceChildren();
});

describe("canonicalizeEditor", () => {
  it("anchors before every chip, after a chip that ends its line, and after a final break", () => {
    const root = editor();
    root.append(document.createTextNode("abc "), chip(1), document.createTextNode("\ndef\n"), chip(2));
    canonicalizeEditor(root);
    expect(shape(root)).toBe("abc Z|[1]|Z\ndef\nZ|[2]|Z");
    expect(serializeEditor(root)).toBe("abc [Image #1]\ndef\n[Image #2]");
  });

  it("puts two anchors between adjacent chips and one before a leading chip", () => {
    const root = editor();
    root.append(chip(1), chip(2), document.createTextNode(" x"));
    canonicalizeEditor(root);
    expect(shape(root)).toBe("Z|[1]|ZZ|[2]| x");
  });

  it("strips stray characters and anchors no rule asks for", () => {
    const root = editor();
    root.append(document.createTextNode(`a${Z}b${Z}`), chip(1), document.createTextNode(`${Z} tail`));
    canonicalizeEditor(root);
    expect(shape(root)).toBe("abZ|[1]| tail");
  });

  it("folds WebKit's <div>/<br> lines into flat text, keeping the chips", () => {
    const root = editor();
    const c = chip(1);
    const line2 = document.createElement("div");
    line2.append(c, document.createTextNode(" xyz"));
    root.append(document.createTextNode("abc"), line2);
    canonicalizeEditor(root);
    expect(shape(root)).toBe("abc\nZ|[1]| xyz");
    expect(root.querySelector("[data-img]")).toBe(c);
  });

  it("keeps the caret on the same serialized offset while re-anchoring", () => {
    const root = editor();
    const after = document.createTextNode("\ndef");
    root.append(document.createTextNode("abc "), chip(1), after);
    caretAt(after, 0);
    canonicalizeEditor(root);
    expect(caretOffsetInSerialized(root)).toBe("abc [Image #1]".length);
    const sel = window.getSelection()!;
    // Past the anchor, not flush against the chip.
    expect(sel.anchorNode?.textContent).toBe(`${Z}\ndef`);
    expect(sel.anchorOffset).toBe(1);
  });
});

describe("setCaretAtOffset", () => {
  it("seats the caret before a chip that starts a line on the line, not after the chip", () => {
    const root = editor();
    root.append(document.createTextNode("first\n"), chip(1), document.createTextNode(" second"));
    setCaretAtOffset(root, "first\n".length);
    const sel = window.getSelection()!;
    expect(sel.anchorNode?.textContent).toBe(`first\n${Z}`);
    expect(sel.anchorOffset).toBe("first\n".length);
    expect(pointOffset(root, sel.anchorNode!, sel.anchorOffset)).toBe(6);
  });
});

describe("deleteBeside", () => {
  it("joins the lines on Backspace before a line-leading chip, keeping the chip and its line", () => {
    const root = editor();
    root.append(document.createTextNode("first\n"), chip(1), document.createTextNode(" second"));
    setCaretAtOffset(root, "first\n".length);
    expect(deleteBeside(root, "backward")).toBe(true);
    expect(serializeEditor(root)).toBe("first[Image #1] second");
    expect(caretOffsetInSerialized(root)).toBe("first".length);
  });

  it("joins the lines on Backspace after a line-ending chip without removing the chip", () => {
    const root = editor();
    root.append(document.createTextNode("look at "), chip(1), document.createTextNode("\nand fix"));
    setCaretAtOffset(root, "look at [Image #1]\n".length);
    expect(deleteBeside(root, "backward")).toBe(true);
    expect(serializeEditor(root)).toBe("look at [Image #1]and fix");
  });

  it("joins the lines on forward Delete at the end of the line before a chip", () => {
    const root = editor();
    root.append(document.createTextNode("first\n"), chip(1), document.createTextNode(" x"));
    setCaretAtOffset(root, "first".length);
    expect(deleteBeside(root, "forward")).toBe(true);
    expect(serializeEditor(root)).toBe("first[Image #1] x");
  });

  it("leaves plain characters to native deletion and chips to the caller", () => {
    const root = editor();
    root.append(document.createTextNode("ab "), chip(1));
    setCaretAtOffset(root, 2);
    expect(deleteBeside(root, "backward")).toBe(false);
    setCaretAtOffset(root, serializeEditor(root).length);
    expect(deleteBeside(root, "backward")).toBe(false);
    expect(chipBeforeCaret(root)?.dataset.img).toBe("1");
  });
});

describe("chip lookups", () => {
  it("find the chip across its anchors in both directions", () => {
    const root = editor();
    root.append(document.createTextNode("a "), chip(1), document.createTextNode(" b"));
    setCaretAtOffset(root, 2);
    expect(chipAfterCaret(root)?.dataset.img).toBe("1");
    setCaretAtOffset(root, 2 + "[Image #1]".length);
    expect(chipBeforeCaret(root)?.dataset.img).toBe("1");
  });
});

describe("stepCaret", () => {
  it("hops over a chip in one step", () => {
    const root = editor();
    root.append(document.createTextNode("a\n"), chip(1), document.createTextNode(" b"));
    setCaretAtOffset(root, 2);
    expect(stepCaret(root, "forward")).toBe(true);
    expect(caretOffsetInSerialized(root)).toBe(2 + "[Image #1]".length);
    expect(stepCaret(root, "backward")).toBe(true);
    expect(caretOffsetInSerialized(root)).toBe(2);
  });
});

describe("insertLineBreak", () => {
  it("inserts a flat \\n and anchors the empty last line", () => {
    const root = editor();
    root.append(document.createTextNode("abc"));
    setCaretAtOffset(root, 3);
    const inputs: string[] = [];
    root.addEventListener("input", (e) => inputs.push((e as InputEvent).inputType));
    insertLineBreak(root);
    expect(shape(root)).toBe("abc\nZ");
    expect(serializeEditor(root)).toBe("abc\n");
    expect(caretOffsetInSerialized(root)).toBe(4);
    expect(inputs).toEqual(["insertLineBreak"]);
  });
});

describe("logical line edits", () => {
  it("moves to the line's start and end across a chip", () => {
    const root = editor();
    root.append(document.createTextNode("top\naa "), chip(1), document.createTextNode(" bb\nlast"));
    const lineEnd = "top\naa [Image #1] bb".length;
    setCaretAtOffset(root, lineEnd);
    moveToLineEdge(root, "backward");
    expect(caretOffsetInSerialized(root)).toBe(4);
    moveToLineEdge(root, "forward");
    expect(caretOffsetInSerialized(root)).toBe(lineEnd);
  });

  it("kills to the line end through a chip, keeping the killed piece", () => {
    const root = editor();
    root.append(document.createTextNode("top\naa "), chip(1), document.createTextNode(" bb\nlast"));
    setCaretAtOffset(root, 4);
    let killedText = "";
    killToLineEnd(root, (frag) => {
      killedText = serializeEditor(frag);
      return { text: killedText, images: {} };
    });
    expect(killedText).toBe("aa [Image #1] bb");
    expect(serializeEditor(root)).toBe("top\n\nlast");
  });
});

describe("insertItemsAtCaret", () => {
  it("spaces a dropped chip off the words on both sides", () => {
    const root = editor();
    root.append(document.createTextNode("helloworld"));
    root.focus();
    setCaretAtOffset(root, 5);
    insertItemsAtCaret(root, [chip(1)]);
    expect(serializeEditor(root)).toBe("hello [Image #1] world");
  });

  it("adds no space at a line end or next to existing whitespace", () => {
    const root = editor();
    root.append(document.createTextNode("compare with "));
    root.focus();
    setCaretAtOffset(root, "compare with ".length);
    insertItemsAtCaret(root, [chip(1), chip(2)]);
    expect(serializeEditor(root)).toBe("compare with [Image #1] [Image #2]");
  });
});

describe("relabelImageChips", () => {
  it("numbers image chips by position, skipping file chips", () => {
    const root = editor();
    const file = chip(2);
    file.dataset.file = "1";
    root.append(chip(5), file, chip(9));
    relabelImageChips(root, () => true);
    const labels = Array.from(root.querySelectorAll("[data-img-label]")).map((l) => l.textContent);
    expect(labels).toEqual(["Image 1", "Image 2", "Image 2"]);
  });
});
