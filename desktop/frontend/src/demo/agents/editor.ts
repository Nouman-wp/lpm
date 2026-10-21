import { charWidth } from "../ansi";

// The prompt line a CLI edits in place: the text, the cursor inside it, and the
// prompts sent before, for ↑ to bring back.
export interface LineEditor {
  readonly text: string;
  readonly cursor: number;
  insert: (s: string) => void;
  set: (s: string) => void;
  backspace: () => void;
  del: () => void;
  left: () => void;
  right: () => void;
  home: () => void;
  end: () => void;
  wordLeft: () => void;
  wordRight: () => void;
  killStart: () => void;
  killEnd: () => void;
  killWord: () => void;
  up: () => void;
  down: () => void;
  // Empties the line and remembers what it held.
  take: () => string;
}

const isLow = (s: string, i: number) => {
  const c = s.charCodeAt(i);
  return c >= 0xdc00 && c <= 0xdfff;
};

export function createEditor(): LineEditor {
  let text = "";
  let cursor = 0;
  const history: string[] = [];
  let browsing = -1;
  let draft = "";

  const prev = (i: number) => (i > 1 && isLow(text, i - 1) ? i - 2 : Math.max(0, i - 1));
  const next = (i: number) => (i < text.length - 1 && isLow(text, i + 1) ? i + 2 : Math.min(text.length, i + 1));
  const lineStart = () => text.lastIndexOf("\n", cursor - 1) + 1;
  const lineEnd = () => {
    const nl = text.indexOf("\n", cursor);
    return nl === -1 ? text.length : nl;
  };
  const wordStart = () => {
    let i = cursor;
    while (i > 0 && /\s/.test(text[i - 1])) i--;
    while (i > 0 && !/\s/.test(text[i - 1])) i--;
    return i;
  };
  const splice = (from: number, to: number, s = "") => {
    text = text.slice(0, from) + s + text.slice(to);
    cursor = from + s.length;
    browsing = -1;
  };
  const recall = (s: string) => {
    text = s;
    cursor = s.length;
  };

  return {
    get text() {
      return text;
    },
    get cursor() {
      return cursor;
    },
    insert: (s) => splice(cursor, cursor, s),
    set: (s) => splice(0, text.length, s),
    backspace: () => splice(prev(cursor), cursor),
    del: () => splice(cursor, next(cursor)),
    left: () => (cursor = prev(cursor)),
    right: () => (cursor = next(cursor)),
    home: () => (cursor = lineStart()),
    end: () => (cursor = lineEnd()),
    wordLeft: () => (cursor = wordStart()),
    wordRight: () => {
      let i = cursor;
      while (i < text.length && /\s/.test(text[i])) i++;
      while (i < text.length && !/\s/.test(text[i])) i++;
      cursor = i;
    },
    killStart: () => splice(lineStart(), cursor),
    killEnd: () => splice(cursor, lineEnd()),
    killWord: () => splice(wordStart(), cursor),
    up: () => {
      if (browsing === -1) {
        if (!history.length || text.includes("\n")) return;
        draft = text;
        browsing = history.length;
      }
      if (browsing === 0) return;
      browsing--;
      recall(history[browsing]);
    },
    down: () => {
      if (browsing === -1) return;
      browsing++;
      if (browsing >= history.length) {
        browsing = -1;
        recall(draft);
      } else recall(history[browsing]);
    },
    take: () => {
      const taken = text;
      if (taken.trim() && history[history.length - 1] !== taken) history.push(taken);
      splice(0, text.length);
      return taken;
    },
  };
}

export interface EditRows {
  rows: string[];
  row: number;
  col: number;
  // Where in its row's text the cursor sits.
  at: number;
}

// The prompt text cut into rows of `avail` cells, and the row, column and
// offset the cursor sits at — always a cell that exists, so a full row moves it
// down.
export function editRows(text: string, cursor: number, avail: number): EditRows {
  const limit = Math.max(1, avail);
  const rows = [""];
  let w = 0;
  let at: { row: number; col: number; at: number } | null = null;
  let i = 0;
  for (const ch of text) {
    if (ch === "\n") {
      if (i === cursor) at = { row: rows.length - 1, col: w, at: rows[rows.length - 1].length };
      rows.push("");
      w = 0;
      i += 1;
      continue;
    }
    const cw = charWidth(ch.codePointAt(0)!);
    if (w + cw > limit) {
      rows.push("");
      w = 0;
    }
    if (i === cursor) at = { row: rows.length - 1, col: w, at: rows[rows.length - 1].length };
    rows[rows.length - 1] += ch;
    w += cw;
    i += ch.length;
  }
  if (!at) {
    if (w >= limit) {
      rows.push("");
      w = 0;
    }
    at = { row: rows.length - 1, col: w, at: rows[rows.length - 1].length };
  }
  return { rows, ...at };
}
