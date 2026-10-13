// @vitest-environment happy-dom
import { act, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useComposerUndo, type ComposerUndo } from "./useComposerUndo";

let container: HTMLDivElement;
let root: Root;
let edits: ComposerUndo;
let field: HTMLDivElement;

// The field's state is just its textContent; a step restores it.
function Harness() {
  const editorRef = useRef<HTMLDivElement>(null);
  edits = useComposerUndo({
    editorRef,
    read: () => (editorRef.current ? { text: editorRef.current.textContent ?? "", images: {}, caret: null } : null),
    apply: (snap) => {
      if (editorRef.current) editorRef.current.textContent = snap.text;
    },
  });
  return <div ref={editorRef} tabIndex={0} />;
}

function type(text: string, data: string | null = text) {
  field.textContent += text;
  edits.noteEdit(new InputEvent("input", { inputType: "insertText", data }));
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<Harness />));
  field = container.querySelector("div")!;
  edits.reset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("useComposerUndo", () => {
  it("undoes word by word and redoes back", () => {
    type("aa");
    type(" ");
    type("bb");
    expect(edits.undo()).toBe(true);
    expect(field.textContent).toBe("aa ");
    expect(edits.undo()).toBe(true);
    expect(field.textContent).toBe("");
    expect(edits.undo()).toBe(false);
    expect(edits.redo()).toBe(true);
    expect(edits.redo()).toBe(true);
    expect(field.textContent).toBe("aa bb");
  });

  it("makes a line break its own step", () => {
    type("first");
    field.textContent += "\n";
    edits.noteEdit(new InputEvent("input", { inputType: "insertLineBreak" }));
    type("second");
    edits.undo();
    expect(field.textContent).toBe("first\n");
    edits.undo();
    expect(field.textContent).toBe("");
  });

  it("drops the redo history once a new edit branches off", () => {
    type("one ");
    edits.undo();
    type("two");
    expect(edits.redo()).toBe(false);
    expect(field.textContent).toBe("two");
  });

  it("claims the Edit menu's Undo only while the field has focus", () => {
    type("x ");
    const menuUndo = () => window.dispatchEvent(new CustomEvent("lpm-menu-undo", { cancelable: true }));
    expect(menuUndo()).toBe(true);
    expect(field.textContent).toBe("x ");
    field.focus();
    expect(menuUndo()).toBe(false);
    expect(field.textContent).toBe("");
  });
});
