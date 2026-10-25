import type { IBufferRange, IDisposable, ILink, ILinkProvider, Terminal } from "@xterm/xterm";
import { isMac } from "../../platform";
import {
  hideCommandChip,
  hoverCommand,
  leaveCommand,
  openCommandChip,
  requestCommandRun,
  type ChipAnchor,
  type CommandChipTarget,
} from "../../store/commandChip";
import { commandRisk } from "./commandDetect";
import { scanCommands } from "./commandScan";

// Viewport pixels of a range, from the screen element xterm sizes to exactly
// cols × rows cells.
function anchorOf(term: Terminal, range: IBufferRange): ChipAnchor | null {
  const screen = term.element?.querySelector(".xterm-screen");
  if (!screen) return null;
  const rect = screen.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  const cellWidth = rect.width / term.cols;
  const rowHeight = rect.height / term.rows;
  const top = term.buffer.active.viewportY;
  return {
    endLeft: rect.left + range.end.x * cellWidth,
    endTop: rect.top + (range.end.y - 1 - top) * rowHeight,
    startLeft: rect.left + (range.start.x - 1) * cellWidth,
    startTop: rect.top + (range.start.y - 1 - top) * rowHeight,
    rowHeight,
    right: rect.right,
  };
}

// Commands in the output get a Run chip on hover; ⌘-click (Ctrl-click off a
// Mac) runs one straight away. A plain click stays a click, for selecting.
export function registerCommandLinkProvider(term: Terminal, terminalId: string): IDisposable {
  const provider: ILinkProvider = {
    provideLinks(bufferLineNumber, callback) {
      const matches = scanCommands(term.buffer.active, bufferLineNumber, term.cols);
      if (matches.length === 0) {
        callback(undefined);
        return;
      }
      callback(
        matches.map(({ command, range }): ILink => {
          const risk = commandRisk(command);
          const target = (armed: boolean): CommandChipTarget | null => {
            const anchor = anchorOf(term, range);
            if (!anchor) return null;
            const key = `${terminalId}:${range.start.y}:${range.start.x}:${command}`;
            return { key, terminalId, command, risk, anchor, armed };
          };
          return {
            range,
            text: command,
            decorations: { pointerCursor: false, underline: true },
            hover: () => {
              const t = target(false);
              if (t) hoverCommand(t);
            },
            leave: leaveCommand,
            activate: (event) => {
              if (!(isMac ? event.metaKey : event.ctrlKey)) return;
              if (!risk) {
                requestCommandRun(terminalId, command);
                return;
              }
              const t = target(true);
              if (t) openCommandChip(t);
            },
          };
        }),
      );
    },
  };
  const subs = [term.registerLinkProvider(provider), term.onScroll(hideCommandChip), term.onResize(hideCommandChip)];
  return { dispose: () => subs.forEach((s) => s.dispose()) };
}
