import { DIFF_META_PREFIXES } from "../highlight";

export type DiffLineType = "add" | "del" | "ctx";

export type DiffRow =
  | { kind: "hunk"; line: number; section: string }
  | { kind: "note"; text: string }
  | { kind: "code"; type: DiffLineType; text: string; oldNo: number | null; newNo: number | null };

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@ ?(.*)$/;

// A unified diff as rows with both sides' line numbers. A hunk is read for as
// many lines as its header counts, so a context line that lost its leading
// space to trimmed output still lands on the right numbers.
export function parseDiffRows(diff: string): DiffRow[] {
  const rows: DiffRow[] = [];
  let oldNo = 0;
  let newNo = 0;
  let oldLeft = 0;
  let newLeft = 0;
  for (const line of diff.split("\n")) {
    const header = HUNK_HEADER.exec(line);
    if (header) {
      oldNo = Number(header[1]);
      oldLeft = header[2] === undefined ? 1 : Number(header[2]);
      newNo = Number(header[3]);
      newLeft = header[4] === undefined ? 1 : Number(header[4]);
      rows.push({ kind: "hunk", line: newNo || oldNo, section: header[5].trim() });
      continue;
    }
    if (oldLeft <= 0 && newLeft <= 0) {
      if (line && !DIFF_META_PREFIXES.some((p) => line.startsWith(p))) {
        rows.push({ kind: "note", text: line });
      }
      continue;
    }
    if (line.startsWith("\\")) continue;
    if (line.startsWith("+")) {
      rows.push({ kind: "code", type: "add", text: line.slice(1), oldNo: null, newNo: newNo++ });
      newLeft--;
    } else if (line.startsWith("-")) {
      rows.push({ kind: "code", type: "del", text: line.slice(1), oldNo: oldNo++, newNo: null });
      oldLeft--;
    } else {
      rows.push({ kind: "code", type: "ctx", text: line.slice(1), oldNo: oldNo++, newNo: newNo++ });
      oldLeft--;
      newLeft--;
    }
  }
  return rows;
}

export function hunkLabel(row: { line: number; section: string }): string {
  return row.section ? `⋯ line ${row.line} · ${row.section}` : `⋯ line ${row.line}`;
}

// Digits the widest line number needs, for a gutter that doesn't jump.
export function gutterDigits(rows: DiffRow[]): number {
  let max = 0;
  for (const r of rows) {
    if (r.kind === "code") max = Math.max(max, r.oldNo ?? 0, r.newNo ?? 0);
  }
  return Math.max(String(max).length, 2);
}
