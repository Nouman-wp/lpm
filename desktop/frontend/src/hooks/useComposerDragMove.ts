import { useEffect, useId, type RefObject } from "react";
import { registerFileDropHandler } from "../fileDrop";
import { notifyEdit, pointOffset } from "../components/composerDom";
import { rangeForOffsets, selectOffsets, setCaretAtOffset } from "../components/composerCanon";

// A selection drag that started in a composer, as serialized offsets, until its
// drop is reported (or it ends anywhere else).
let pending: { root: HTMLElement; from: number; to: number } | null = null;
let clearTimer: number | undefined;

// Whether a text drag from a composer is in flight — the "Drop files to add"
// overlays stay down for it.
export function composerDragActive(): boolean {
  return pending !== null;
}

// Drag-to-move a selection within the composer. The native drag-drop handler
// that brings Finder files in also swallows in-page drops before the DOM sees
// them, so WebKit never moves the text; the bridge still reports the drop point
// (with no paths), and the move is done here: the selection — chips included,
// as the same elements — is lifted out and reinserted at the point, selected.
export function useComposerDragMove(
  editorRef: RefObject<HTMLDivElement | null>,
  boxRef: RefObject<HTMLDivElement | null>,
): void {
  const id = useId();
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const onStart = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
      const r = sel.getRangeAt(0);
      if (!editor.contains(r.startContainer) || !editor.contains(r.endContainer)) return;
      window.clearTimeout(clearTimer);
      pending = {
        root: editor,
        from: pointOffset(editor, r.startContainer, r.startOffset),
        to: pointOffset(editor, r.endContainer, r.endOffset),
      };
    };
    // dragend fires before the bridge reports the drop, so keep the drag for it.
    const onEnd = () => {
      clearTimer = window.setTimeout(() => {
        pending = null;
      }, 1000);
    };
    editor.addEventListener("dragstart", onStart);
    editor.addEventListener("dragend", onEnd);
    const unregister = registerFileDropHandler(`composer-drag-move-${id}`, (x, y, paths) => {
      if (paths.length > 0 || pending?.root !== editor) return false;
      const box = boxRef.current?.getBoundingClientRect();
      if (!box || x < box.left || x >= box.right || y < box.top || y >= box.bottom) return false;
      const { from, to } = pending;
      pending = null;
      const hit = document.caretRangeFromPoint(x, y);
      if (!hit || !editor.contains(hit.startContainer)) return true;
      const at = pointOffset(editor, hit.startContainer, hit.startOffset);
      if (at >= from && at <= to) return true;
      const moved = rangeForOffsets(editor, from, to).extractContents();
      const target = at > to ? at - (to - from) : at;
      editor.focus();
      setCaretAtOffset(editor, target);
      window.getSelection()?.getRangeAt(0).insertNode(moved);
      selectOffsets(editor, target, target + (to - from));
      notifyEdit(editor, "insertFromDrop");
      return true;
    });
    return () => {
      editor.removeEventListener("dragstart", onStart);
      editor.removeEventListener("dragend", onEnd);
      unregister();
    };
  }, [editorRef, boxRef, id]);
}
