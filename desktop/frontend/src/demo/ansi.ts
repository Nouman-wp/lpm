import type { LineColor, SeedLine } from "./seed/types";

export const RESET = "\x1b[0m";
export const BOLD = "\x1b[1m";
export const INVERSE = "\x1b[7m";
export const NO_INVERSE = "\x1b[27m";
export const RED = "\x1b[31m";
export const GREEN = "\x1b[32m";
export const CYAN = "\x1b[36m";
export const GRAY = "\x1b[90m";
export const BLUE = "\x1b[38;5;75m";
export const CLEAR = "\x1b[2J\x1b[3J\x1b[H";

export const lines = (...rows: string[]) => rows.map((r) => `${r}\r\n`).join("");

const LINE_COLOR: Record<LineColor, string> = {
  default: "",
  muted: GRAY,
  green: GREEN,
  cyan: CYAN,
  yellow: "\x1b[33m",
  red: RED,
  magenta: "\x1b[35m",
};

export function lineText(line: Pick<SeedLine, "text" | "color">): string {
  const color = LINE_COLOR[line.color ?? "default"];
  return color ? `${color}${line.text}${RESET}` : line.text;
}

const SGR = /\x1b\[[0-9;?]*[ -/]*[@-~]/g;
const SGR_AT = /\x1b\[[0-9;?]*[ -/]*[@-~]/y;

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const fg = (hex: string) => `\x1b[38;2;${rgb(hex).join(";")}m`;
export const bg = (hex: string) => `\x1b[48;2;${rgb(hex).join(";")}m`;

export function mix(a: string, b: string, t: number): string {
  const [x, y] = [rgb(a), rgb(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

export const strip = (s: string) => s.replace(SGR, "");

export function charWidth(cp: number): number {
  if (cp < 0x20 || (cp >= 0x300 && cp <= 0x36f) || (cp >= 0x200b && cp <= 0x200f) || (cp >= 0xfe00 && cp <= 0xfe0f)) return 0;
  if (cp < 0x1100) return 1;
  if (
    cp <= 0x115f ||
    (cp >= 0x2e80 && cp <= 0xa4cf && cp !== 0x303f) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe4f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x1f300 && cp <= 0x1f64f) ||
    (cp >= 0x1f900 && cp <= 0x1f9ff) ||
    (cp >= 0x20000 && cp <= 0x3fffd)
  ) {
    return 2;
  }
  return 1;
}

export function width(s: string): number {
  let w = 0;
  for (const ch of strip(s)) w += charWidth(ch.codePointAt(0)!);
  return w;
}

export function truncate(s: string, max: number): string {
  if (width(s) <= max) return s;
  let out = "";
  let w = 0;
  for (const ch of s) {
    const cw = charWidth(ch.codePointAt(0)!);
    if (w + cw > max - 1) break;
    out += ch;
    w += cw;
  }
  return `${out}…`;
}

// Cuts a styled line to `max` cells, keeping its escape sequences.
export function clip(s: string, max: number): string {
  if (width(s) <= max) return s;
  let out = "";
  let w = 0;
  let i = 0;
  while (i < s.length) {
    SGR_AT.lastIndex = i;
    const seq = SGR_AT.exec(s);
    if (seq) {
      out += seq[0];
      i += seq[0].length;
      continue;
    }
    const cp = s.codePointAt(i)!;
    const cw = charWidth(cp);
    if (w + cw > max - 1) break;
    const ch = String.fromCodePoint(cp);
    out += ch;
    w += cw;
    i += ch.length;
  }
  return `${out}…${RESET}`;
}

export const pad = (s: string, w: number) => s + " ".repeat(Math.max(0, w - width(s)));

export interface Span {
  text: string;
  style?: string;
}

interface Cell {
  ch: string;
  w: number;
  style: string;
}

function render(cells: Cell[]): string {
  let out = "";
  let style = "";
  for (const cell of cells) {
    if (cell.style !== style) {
      if (style) out += RESET;
      out += cell.style;
      style = cell.style;
    }
    out += cell.ch;
  }
  return style ? out + RESET : out;
}

// Word-wraps styled text into lines of at most `max` cells, breaking a word
// only when it is wider than a whole line.
export function wrap(spans: Span[], max: number): string[] {
  const limit = Math.max(1, max);
  const paragraphs: Cell[][] = [[]];
  for (const span of spans) {
    for (const ch of span.text) {
      if (ch === "\n") paragraphs.push([]);
      else paragraphs[paragraphs.length - 1].push({ ch, w: charWidth(ch.codePointAt(0)!), style: span.style ?? "" });
    }
  }
  const out: string[] = [];
  for (const cells of paragraphs) {
    const words: Cell[][] = [];
    for (const cell of cells) {
      const last = words[words.length - 1];
      if (last && (last[0].ch === " ") === (cell.ch === " ")) last.push(cell);
      else words.push([cell]);
    }
    let line: Cell[] = [];
    let w = 0;
    let wrapped = false;
    const breakLine = () => {
      while (line.length && line[line.length - 1].ch === " ") line.pop();
      out.push(render(line));
      line = [];
      w = 0;
      wrapped = true;
    };
    for (const word of words) {
      const ww = word.reduce((n, c) => n + c.w, 0);
      if (word[0].ch === " ") {
        if (w === 0 && wrapped) continue;
        if (w + ww <= limit) {
          line.push(...word);
          w += ww;
        } else breakLine();
        continue;
      }
      if (w + ww <= limit) {
        line.push(...word);
        w += ww;
        continue;
      }
      if (w > 0) breakLine();
      for (const cell of word) {
        if (w + cell.w > limit) breakLine();
        line.push(cell);
        w += cell.w;
      }
    }
    while (line.length && line[line.length - 1].ch === " ") line.pop();
    out.push(render(line));
  }
  return out;
}

// `first` before the opening line and `indent` spaces before the rest, the way
// both CLIs hang a bullet's text.
export function hang(first: string, indent: number, spans: Span[], cols: number): string[] {
  return wrap(spans, cols - indent - 1).map((line, i) => (i === 0 ? first : " ".repeat(indent)) + line);
}

// `code` spans and **bold** in an agent's prose, as the CLIs render markdown.
export function inline(text: string, base: string, code: string): Span[] {
  return text
    .split(/(`[^`\n]+`|\*\*[^*\n]+\*\*)/)
    .filter(Boolean)
    .map((part) => {
      if (part.startsWith("`") && part.endsWith("`") && part.length > 1) return { text: part.slice(1, -1), style: code };
      if (part.startsWith("**") && part.endsWith("**") && part.length > 3) return { text: part.slice(2, -2), style: base + BOLD };
      return { text: part, style: base };
    });
}

// A full-width row on a shaded background. Resets inside the content would
// drop the shade, so each one re-opens it.
export function band(line: string, cols: number, shade: string): string {
  const open = bg(shade);
  return `${open}${line.split(RESET).join(RESET + open)}${" ".repeat(Math.max(0, cols - width(line)))}${RESET}`;
}

export function duration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
