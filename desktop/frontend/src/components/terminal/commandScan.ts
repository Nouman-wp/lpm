import type { IBuffer, IBufferCell, IBufferRange } from "@xterm/xterm";
import { readCommand } from "./commandDetect";
import { readLineWindow, type LineWindow } from "./lineWindow";

export interface CommandMatch {
  command: string;
  range: IBufferRange;
}

// A line's indent, a list or reply bullet, and a `$ ` prompt in front of it.
const GUTTER = /^\s*(?:[⏺•●◦▪*-]\s+)?(\$\s+)?/;
const BACKTICKS = /`([^`]+)`/g;
const MAX_CONTINUED = 20;
// How far a colored span is followed onto the rows an agent wrapped it to.
const MAX_SPAN_ROWS = 4;

interface Cell {
  x: number;
  width: number;
  chars: string;
  fg: string;
}

interface Span {
  y: number;
  cells: Cell[];
}

function fgKey(cell: IBufferCell): string {
  if (cell.isFgDefault()) return "";
  return `${cell.isFgRGB() ? "r" : "p"}${cell.getFgColor()}`;
}

function rowCells(buffer: IBuffer, y: number, scratch: IBufferCell): Cell[] {
  const line = buffer.getLine(y);
  if (!line) return [];
  const cells: Cell[] = [];
  for (let x = 0; x < line.length; x++) {
    const cell = line.getCell(x, scratch);
    if (!cell || cell.getWidth() === 0) continue;
    cells.push({ x, width: cell.getWidth(), chars: cell.getChars() || " ", fg: fgKey(cell) });
  }
  return cells;
}

const blank = (c: Cell) => c.chars.trim() === "";

// Runs of one foreground color, trimmed of blanks: how agents show inline code.
function coloredSpans(cells: Cell[], y: number): Span[] {
  const spans: Span[] = [];
  let i = 0;
  while (i < cells.length) {
    const fg = cells[i].fg;
    let j = i;
    while (j < cells.length && cells[j].fg === fg) j++;
    if (fg) {
      let a = i;
      let b = j - 1;
      while (a <= b && blank(cells[a])) a++;
      while (b >= a && blank(cells[b])) b--;
      if (a <= b) spans.push({ y, cells: cells.slice(a, b + 1) });
    }
    i = j;
  }
  return spans;
}

function contentBounds(cells: Cell[]): [Cell, Cell] | null {
  const first = cells.find((c) => !blank(c));
  const last = cells.findLast((c) => !blank(c));
  return first && last ? [first, last] : null;
}

const spanText = (s: Span) => s.cells.map((c) => c.chars).join("");

// The colored spans touching row `y`, each followed across the rows an agent
// broke it over: a span that ends its row continues in the next row's span of
// the same color when that one opens the row.
function colorChains(buffer: IBuffer, y: number): Span[][] {
  const scratch = buffer.getNullCell();
  const rows = new Map<number, Cell[]>();
  const cellsAt = (row: number) => {
    let cells = rows.get(row);
    if (!cells) {
      cells = rowCells(buffer, row, scratch);
      rows.set(row, cells);
    }
    return cells;
  };
  const continues = (a: Span, b: Span) => {
    const ab = contentBounds(cellsAt(a.y));
    const bb = contentBounds(cellsAt(b.y));
    return (
      !!ab &&
      !!bb &&
      ab[1] === a.cells[a.cells.length - 1] &&
      bb[0] === b.cells[0] &&
      a.cells[0].fg === b.cells[0].fg
    );
  };
  const spansAt = (row: number) => (row < 0 || !buffer.getLine(row) ? [] : coloredSpans(cellsAt(row), row));

  return spansAt(y).map((span) => {
    const chain = [span];
    for (let row = y - 1; row >= y - MAX_SPAN_ROWS; row--) {
      const prev = spansAt(row).at(-1);
      if (!prev || !continues(prev, chain[0])) break;
      chain.unshift(prev);
    }
    for (let row = y + 1; row <= y + MAX_SPAN_ROWS; row++) {
      const next = spansAt(row)[0];
      if (!next || !continues(chain[chain.length - 1], next)) break;
      chain.push(next);
    }
    return chain;
  });
}

function chainText(chain: Span[], cols: number, buffer: IBuffer): string {
  let text = "";
  chain.forEach((span, i) => {
    if (i > 0) {
      const prev = chain[i - 1].cells[chain[i - 1].cells.length - 1];
      const tight = prev.x + prev.width >= cols || !!buffer.getLine(span.y)?.isWrapped;
      if (!tight) text += " ";
    }
    text += spanText(span);
  });
  return text;
}

function chainRange(chain: Span[]): IBufferRange {
  const first = chain[0].cells[0];
  const lastSpan = chain[chain.length - 1];
  const last = lastSpan.cells[lastSpan.cells.length - 1];
  return {
    start: { x: first.x + 1, y: chain[0].y + 1 },
    end: { x: last.x + last.width, y: lastSpan.y + 1 },
  };
}

function windowRange(win: LineWindow, from: number, to: number): IBufferRange {
  return {
    start: { x: win.x[from] + 1, y: win.y[from] + 1 },
    end: { x: win.x[to] + win.width[to], y: win.y[to] + 1 },
  };
}

function body(text: string): { from: number; prompted: boolean } {
  const gutter = GUTTER.exec(text);
  return { from: gutter?.[0].length ?? 0, prompted: !!gutter?.[1] };
}

const lineCommand = (text: string) => readCommand(text.slice(body(text).from), true);

// Whether a command line can start below row `y`: nothing above it, a blank,
// a label like "Then run:", or another command of the same block.
function opensBlock(buffer: IBuffer, y: number): boolean {
  if (y < 0) return true;
  const text = readLineWindow(buffer, y).text.trim();
  return text === "" || text.endsWith(":") || lineCommand(text) !== null;
}

// A line that reads as a command on its own, with its `\` continuations.
function wholeLine(buffer: IBuffer, index: number): CommandMatch | null {
  const win = readLineWindow(buffer, index);
  const { from, prompted } = body(win.text);
  if (from >= win.text.length) return null;
  let command = readCommand(win.text.slice(from), true);
  if (!command) return null;
  const top = win.y[0];
  const above = top > 0 ? readLineWindow(buffer, top - 1).text : "";
  if (above.trimEnd().endsWith("\\")) return null;
  if (!prompted && !opensBlock(buffer, top - 1)) return null;
  let to = from + command.length - 1;
  if (command.endsWith("\\")) {
    to = win.text.length - 1;
    const parts = [command.slice(0, -1).trim()];
    let next = win.y[win.y.length - 1] + 1;
    for (let n = 0; n < MAX_CONTINUED && buffer.getLine(next); n++) {
      const row = readLineWindow(buffer, next);
      const text = row.text.trim();
      parts.push(text.replace(/\\$/, "").trim());
      if (!text.endsWith("\\")) break;
      next = row.y[row.y.length - 1] + 1;
    }
    command = parts.filter(Boolean).join(" ");
  }
  return { command, range: windowRange(win, from, to) };
}

const atOrBefore = (a: IBufferRange["start"], b: IBufferRange["start"]) => a.y < b.y || (a.y === b.y && a.x <= b.x);
const overlaps = (a: IBufferRange, b: IBufferRange) => atOrBefore(a.start, b.end) && atOrBefore(b.start, a.end);
const touchesRow = (r: IBufferRange, y: number) => r.start.y <= y && r.end.y >= y;

/** The commands on row `bufferLineNumber` (1-based, as ILinkProvider passes
 *  it): a line that is one, inline code an agent colored, and text in
 *  backticks. */
export function scanCommands(buffer: IBuffer, bufferLineNumber: number, cols: number): CommandMatch[] {
  const index = bufferLineNumber - 1;
  if (!buffer.getLine(index)) return [];
  const found: CommandMatch[] = [];
  const add = (m: CommandMatch) => {
    if (touchesRow(m.range, bufferLineNumber) && !found.some((f) => overlaps(f.range, m.range))) found.push(m);
  };

  const line = wholeLine(buffer, index);
  if (line) add(line);

  for (const chain of colorChains(buffer, index)) {
    const command = readCommand(chainText(chain, cols, buffer));
    if (command) add({ command, range: chainRange(chain) });
  }

  const win = readLineWindow(buffer, index);
  for (const m of win.text.matchAll(BACKTICKS)) {
    const command = readCommand(m[1]);
    if (!command) continue;
    const from = m.index + 1 + (m[1].length - m[1].trimStart().length);
    add({ command, range: windowRange(win, from, from + command.length - 1) });
  }
  return found;
}
