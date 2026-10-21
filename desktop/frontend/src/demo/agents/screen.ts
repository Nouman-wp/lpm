import { RESET, clip, width } from "../ansi";

export interface Screen {
  // Prints `commit` above the live frame for good, then redraws the frame — the
  // working line, the prompt and the status line under it — or just clears it,
  // for null.
  paint: (commit: string[], frame: string[] | null) => void;
  // Forgets the frame on screen, after something else cleared it.
  reset: () => void;
}

const rowsOf = (w: number, cols: number) => Math.max(1, Math.ceil(w / cols));

// Like Ink's log-update: the frame is redrawn by moving up to its first row and
// clearing down, so lines committed above it scroll into the scrollback like
// any other output. The cursor rests at the start of the frame's last row,
// which never wraps: xterm reflows a resize correctly for every line above the
// cursor but not for one below it, and counting the rows above at the new width
// finds the frame again. The prompt draws a cursor of its own.
export function createScreen(write: (data: string) => void, cols: () => number): Screen {
  let shown: number[] | null = null;

  return {
    paint(commit, frame) {
      const c = Math.max(1, cols());
      let out = "";
      if (shown) {
        let up = 0;
        for (let i = 0; i < shown.length - 1; i++) up += rowsOf(shown[i], c);
        out += `${RESET}${up ? `\x1b[${up}A` : ""}\r\x1b[J`;
      }
      for (const line of commit) out += `${line}${RESET}\r\n`;
      if (frame?.length) {
        const lines = [...frame.slice(0, -1), clip(frame[frame.length - 1], c - 1)];
        out += `${lines.join(`${RESET}\r\n`)}${RESET}\r`;
        shown = lines.map(width);
      } else shown = null;
      write(out);
    },
    reset() {
      shown = null;
    },
  };
}
