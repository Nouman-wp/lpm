import { useEffect, useRef, type RefObject } from "react";

// One undo step: the field's serialized text, the attachments in it, and where
// the caret was (an offset into the text).
export interface UndoSnapshot {
  text: string;
  images: Record<string, string>;
  caret: number | null;
}

export interface ComposerUndo {
  // Close the current step now (before and after a programmatic edit).
  commit: () => void;
  // Fold a typed edit into the current step, closing it at word boundaries.
  noteEdit: (input: InputEvent) => void;
  // Start a fresh history at the field's current state.
  reset: () => void;
  undo: () => boolean;
  redo: () => boolean;
}

interface ComposerUndoOptions {
  editorRef: RefObject<HTMLDivElement | null>;
  // The field's live state, or null without a field.
  read: () => UndoSnapshot | null;
  // Rebuild the field from a step.
  apply: (snap: UndoSnapshot) => void;
  // While true (an AI rewrite in flight) undo and redo are swallowed.
  locked?: () => boolean;
}

const COALESCE_MS = 350;
const LIMIT = 200;

function sameState(a: UndoSnapshot, b: UndoSnapshot): boolean {
  if (a.text !== b.text) return false;
  const keys = Object.keys(a.images);
  return keys.length === Object.keys(b.images).length && keys.every((k) => a.images[k] === b.images[k]);
}

// Snapshot undo for a composer field. WebKit's native undo is unreliable there —
// chips, caret anchors and line breaks are edited through the DOM, outside its
// history — so ⌘Z walks these stacks instead. `base` is the state the live edits
// diverge from; the stacks hold the committed steps on either side of it.
//
// ⌘Z / ⌘⇧Z reach the field through the Edit menu (menuEdit.ts) or, where a native
// history step still exists, as historyUndo / historyRedo beforeinput events;
// both are claimed while the field has focus.
export function useComposerUndo({ editorRef, read, apply, locked }: ComposerUndoOptions): ComposerUndo {
  const latest = useRef({ read, apply, locked });
  latest.current = { read, apply, locked };
  const timer = useRef<number | null>(null);
  const control = useRef<ComposerUndo | null>(null);

  if (!control.current) {
    const undoStack: UndoSnapshot[] = [];
    const redoStack: UndoSnapshot[] = [];
    let base: UndoSnapshot | null = null;
    const stopTimer = () => {
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = null;
    };
    const commit = () => {
      stopTimer();
      const live = latest.current.read();
      if (!live) return;
      if (base) {
        if (sameState(live, base)) return;
        undoStack.push(base);
        if (undoStack.length > LIMIT) undoStack.shift();
      }
      base = live;
      redoStack.length = 0;
    };
    const step = (from: UndoSnapshot[], to: UndoSnapshot[]): UndoSnapshot | null => {
      commit(); // finalize a pending burst so it stays redoable (or, for redo, branches)
      const next = from.pop();
      if (!next) return null;
      if (base) to.push(base);
      base = next;
      latest.current.apply(next);
      return next;
    };
    control.current = {
      commit,
      // Closing a step at each word boundary (a typed space or line break) is
      // what makes ⌘Z walk back word by word rather than a whole burst at once.
      noteEdit: (input) => {
        if (input.isComposing) return; // a settled IME word is captured on the next edit
        const type = input.inputType || "";
        const boundary =
          type === "insertLineBreak" ||
          type === "insertParagraph" ||
          type === "insertFromPaste" ||
          type === "insertFromDrop" ||
          (type === "insertText" && input.data !== null && /\s/.test(input.data));
        if (boundary) {
          commit();
          return;
        }
        stopTimer();
        timer.current = window.setTimeout(commit, COALESCE_MS);
      },
      reset: () => {
        stopTimer();
        undoStack.length = 0;
        redoStack.length = 0;
        base = latest.current.read();
      },
      undo: () => step(undoStack, redoStack) !== null,
      redo: () => step(redoStack, undoStack) !== null,
    };
  }

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const run = (redoing: boolean) => {
      if (latest.current.locked?.()) return;
      if (redoing) control.current?.redo();
      else control.current?.undo();
    };
    const claim = (redoing: boolean) => (e: Event) => {
      if (document.activeElement !== editor) return;
      e.preventDefault();
      run(redoing);
    };
    const onMenuUndo = claim(false);
    const onMenuRedo = claim(true);
    const onBeforeInput = (e: InputEvent) => {
      if (e.inputType !== "historyUndo" && e.inputType !== "historyRedo") return;
      e.preventDefault();
      run(e.inputType === "historyRedo");
    };
    window.addEventListener("lpm-menu-undo", onMenuUndo);
    window.addEventListener("lpm-menu-redo", onMenuRedo);
    editor.addEventListener("beforeinput", onBeforeInput);
    return () => {
      window.removeEventListener("lpm-menu-undo", onMenuUndo);
      window.removeEventListener("lpm-menu-redo", onMenuRedo);
      editor.removeEventListener("beforeinput", onBeforeInput);
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, [editorRef]);

  return control.current;
}
