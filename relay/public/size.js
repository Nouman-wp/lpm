// The size a shared tab's host reports, kept within what a real screen shows: a
// 6K display at lpm's smallest font is about 1250×340. Matches reported_size in
// desktop/frontend/src-tauri/src/peerclient/share.rs.
export const MAX_COLS = 2000;
export const MAX_ROWS = 1000;

// null for a size no host sends.
export function hostSize(cols, rows) {
  if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 1 || rows < 1) return null;
  return { cols: Math.min(cols, MAX_COLS), rows: Math.min(rows, MAX_ROWS) };
}
