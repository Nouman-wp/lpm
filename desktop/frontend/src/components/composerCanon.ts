// Keeps the composer's DOM in one canonical shape so WebKit's caret, deletion
// and selection behave around atomic contenteditable=false chips:
//
// - Flat: the field holds only text nodes, chips and the inline data-cmd
//   highlight spans; line breaks are "\n" characters (the field is pre-wrap).
//   WebKit's block wrappers and <br>s are what made a Backspace at a line start
//   swallow a whole line, so they are folded back into text.
// - Anchored: a ZWSP sits right before every chip, and right after a chip that
//   ends its line (or the field), and after a final "\n" so the empty last line
//   renders. Each gives the caret a real text position beside the chip — without
//   one WebKit strands or mispaints the caret, can't place it before a chip that
//   starts a line, and paints a selection that starts at a chip over the word
//   before it. serializeEditor strips the anchors, so the value never sees them.
//
// Caret positions are tracked as offsets into the serialized value, which the
// anchors don't change, and seated back at the canonical DOM point for that
// offset: never between an anchor and its chip, never inside a chip.

import {
  ZWSP,
  chipToken,
  isChip,
  isCmdSpan,
  isStrayChar,
  pointOffset,
  readParts,
  stripStray,
} from "./composerDom";

type Leaf = Text | HTMLElement;

function isFlat(root: HTMLElement): boolean {
  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE || isChip(node)) continue;
    if (isCmdSpan(node) && Array.from(node.childNodes).every((n) => n.nodeType === Node.TEXT_NODE)) continue;
    return false;
  }
  return true;
}

// Text nodes (root-level or inside a highlight span) and chips, in order.
function leaves(root: HTMLElement): Leaf[] {
  const out: Leaf[] = [];
  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE || isChip(node)) out.push(node as Leaf);
    else if (isCmdSpan(node)) {
      for (const inner of Array.from(node.childNodes)) {
        if (inner.nodeType === Node.TEXT_NODE) out.push(inner as Text);
      }
    }
  }
  return out;
}

export interface DomPoint {
  node: Node;
  offset: number;
}

// The DOM index in `text` for `k` visible characters into it, choosing among the
// equivalent indices around anchors the one that isn't flush against a chip:
// past the anchor after a chip, before the anchor in front of one.
function indexInText(text: Text, k: number, prevChip: boolean, nextChip: boolean): number {
  const data = text.data;
  let lo = -1;
  let hi = -1;
  let count = 0;
  for (let d = 0; d <= data.length; d++) {
    if (count === k) {
      if (lo < 0) lo = d;
      hi = d;
    } else if (count > k) break;
    if (d < data.length && !isStrayChar(data[d])) count++;
  }
  if (lo < 0) return data.length;
  let a = lo;
  let b = hi;
  if (prevChip && a === 0 && b > a) a++;
  if (nextChip && b === data.length && b > a) b--;
  return prevChip && !nextChip ? b : a;
}

function boundary(node: Node, after: boolean): DomPoint {
  const parent = node.parentNode as Node;
  const idx = Array.prototype.indexOf.call(parent.childNodes, node) as number;
  return { node: parent, offset: after ? idx + 1 : idx };
}

// The canonical DOM point for a serialized offset in a flat field. An offset
// inside a chip's token resolves to after the chip.
export function canonicalPoint(root: HTMLElement, offset: number): DomPoint {
  const lv = leaves(root);
  let acc = 0;
  for (let i = 0; i < lv.length; i++) {
    const leaf = lv[i];
    if (isChip(leaf)) {
      const len = chipToken(leaf).length;
      if (offset <= acc) return boundary(leaf, false);
      if (offset < acc + len) return afterChip(lv, i);
      acc += len;
      continue;
    }
    const real = stripStray(leaf.data).length;
    if (offset <= acc + real) {
      return {
        node: leaf,
        offset: indexInText(leaf, Math.max(0, offset - acc), isChip(lv[i - 1]), isChip(lv[i + 1])),
      };
    }
    acc += real;
  }
  const last = lv[lv.length - 1];
  if (!last) return { node: root, offset: root.childNodes.length };
  return isChip(last) ? boundary(last, true) : { node: last, offset: (last as Text).data.length };
}

function afterChip(lv: Leaf[], i: number): DomPoint {
  const next = lv[i + 1];
  if (next && !isChip(next)) return { node: next, offset: indexInText(next, 0, true, isChip(lv[i + 2])) };
  return boundary(lv[i], true);
}

// Rebuild a field that holds anything but text, chips and highlight spans
// (WebKit's <div>/<br> line structure) as flat text + chips, reusing the chips.
function flatten(root: HTMLElement): boolean {
  if (isFlat(root)) return false;
  const parts = readParts(root);
  root.replaceChildren(
    ...parts.map((p) => ("chip" in p ? p.chip : document.createTextNode(p.text))),
  );
  return true;
}

// Rewrite `text` to `desired` with the smallest delete/insert, so live ranges
// (the selection) inside it shift instead of resetting.
function setTextMinimal(text: Text, desired: string): boolean {
  const cur = text.data;
  if (cur === desired) return false;
  let p = 0;
  while (p < cur.length && p < desired.length && cur[p] === desired[p]) p++;
  let s = 0;
  while (s < cur.length - p && s < desired.length - p && cur[cur.length - 1 - s] === desired[desired.length - 1 - s]) s++;
  const del = cur.length - p - s;
  if (del > 0) text.deleteData(p, del);
  const ins = desired.slice(p, desired.length - s);
  if (ins) text.insertData(p, ins);
  return true;
}

// Put the anchors where the rules above want them and strip every other stray
// character. Assumes a flat field.
function fixAnchors(root: HTMLElement): boolean {
  let changed = false;
  root.normalize();
  const lv = leaves(root);
  let run: Text[] = [];
  let prev: HTMLElement | null = null;
  const settle = (next: HTMLElement | null) => {
    const real = run.map((t) => stripStray(t.data)).join("");
    const lead = prev !== null && (real === "" || real.startsWith("\n"));
    const trail = next !== null || real.endsWith("\n");
    if (run.length === 0) {
      if (lead || trail) {
        const anchor = document.createTextNode(lead && trail && next ? ZWSP + ZWSP : ZWSP);
        if (next) next.before(anchor);
        else root.appendChild(anchor);
        changed = true;
      }
    } else {
      run.forEach((t, i) => {
        let desired = stripStray(t.data);
        if (i === 0 && lead) desired = ZWSP + desired;
        if (i === run.length - 1 && trail) desired += ZWSP;
        if (setTextMinimal(t, desired)) changed = true;
      });
    }
    run = [];
    prev = next;
  };
  for (const leaf of lv) {
    if (isChip(leaf)) settle(leaf);
    else run.push(leaf);
  }
  settle(null);
  return changed;
}

interface SelectionOffsets {
  anchor: number;
  focus: number;
}

function selectionOffsets(root: HTMLElement): SelectionOffsets | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.anchorNode || !sel.focusNode) return null;
  if (!root.contains(sel.anchorNode) || !root.contains(sel.focusNode)) return null;
  return {
    anchor: pointOffset(root, sel.anchorNode, sel.anchorOffset),
    focus: pointOffset(root, sel.focusNode, sel.focusOffset),
  };
}

function setSelectionPoints(anchor: DomPoint, focus: DomPoint): void {
  const sel = window.getSelection();
  if (!sel) return;
  try {
    sel.setBaseAndExtent(anchor.node, anchor.offset, focus.node, focus.offset);
  } catch {}
}

function restoreSelection(root: HTMLElement, offs: SelectionOffsets): void {
  const a = canonicalPoint(root, offs.anchor);
  const f = offs.focus === offs.anchor ? a : canonicalPoint(root, offs.focus);
  setSelectionPoints(a, f);
}

// Whether (node, offset) should move to `canonical`, the point for the same
// serialized offset: it's a container boundary, inside a chip, or the same text
// node at a different index (only anchors lie between, so it hugs a chip).
function needsMove(node: Node, offset: number, canonical: DomPoint): boolean {
  if (node === canonical.node && offset === canonical.offset) return false;
  if (node.nodeType !== Node.TEXT_NODE) return true;
  if (node.parentElement?.closest("[data-img]")) return true;
  return node === canonical.node;
}

// Seat the selection's ends at canonical points. A collapsed caret always; a
// range only when `ranges` is set (after a selection gesture finishes), so a
// drag in progress is never fought. Returns whether it moved anything.
export function canonicalizeSelection(root: HTMLElement, ranges = false): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.anchorNode || !sel.focusNode) return false;
  if (!root.contains(sel.anchorNode) || !root.contains(sel.focusNode)) return false;
  if (!sel.isCollapsed && !ranges) return false;
  if (!isFlat(root)) return false;
  const fix = (node: Node, offset: number): DomPoint | null => {
    const c = canonicalPoint(root, pointOffset(root, node, offset));
    return needsMove(node, offset, c) ? c : null;
  };
  const anchorNode = sel.anchorNode;
  const anchorOffset = sel.anchorOffset;
  const focusNode = sel.focusNode;
  const focusOffset = sel.focusOffset;
  const a = fix(anchorNode, anchorOffset);
  const f = sel.isCollapsed ? a : fix(focusNode, focusOffset);
  if (!a && !f) return false;
  setSelectionPoints(
    a ?? { node: anchorNode, offset: anchorOffset },
    f ?? { node: focusNode, offset: focusOffset },
  );
  return true;
}

// Bring the field to the canonical shape, keeping the selection on the same
// serialized offsets. Returns whether the DOM or the selection changed.
export function canonicalizeEditor(root: HTMLElement): boolean {
  const offs = selectionOffsets(root);
  const flattened = flatten(root);
  const anchored = fixAnchors(root);
  if ((flattened || anchored) && offs) {
    restoreSelection(root, offs);
    return true;
  }
  return canonicalizeSelection(root) || flattened || anchored;
}

// Anchor a freshly built field (no selection to keep).
export function anchorEditor(root: HTMLElement): void {
  flatten(root);
  fixAnchors(root);
}

// Seat a collapsed caret at a serialized offset, anchoring the field first.
export function setCaretAtOffset(root: HTMLElement, offset: number): void {
  anchorEditor(root);
  const p = canonicalPoint(root, offset);
  setSelectionPoints(p, p);
}

// Select the serialized range [from, to).
export function selectOffsets(root: HTMLElement, from: number, to: number): void {
  anchorEditor(root);
  setSelectionPoints(canonicalPoint(root, from), canonicalPoint(root, to));
}

// A live Range over the serialized range [from, to) of a canonical field.
export function rangeForOffsets(root: HTMLElement, from: number, to: number): Range {
  const a = canonicalPoint(root, from);
  const b = canonicalPoint(root, to);
  const range = document.createRange();
  range.setStart(a.node, a.offset);
  range.setEnd(b.node, b.offset);
  return range;
}
