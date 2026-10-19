import { Terminal } from "./vendor/xterm.mjs";
import { Unicode11Addon } from "./vendor/addon-unicode11.mjs";

// The shared tab, drawn at the host's columns and rows (the host's own view keeps
// its size) and fitted to the window by font size.

const PREFERRED_FONT = 13;
const MIN_FONT = 7;
const PASTE_SETTLE_MS = 150;

export function createTerminal(host, onInput) {
  const term = new Terminal({
    cols: 80,
    rows: 24,
    fontSize: PREFERRED_FONT,
    fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
    scrollback: 5000,
    cursorBlink: false,
    disableStdin: true,
    allowProposedApi: true,
    theme: { background: "#0d1117", foreground: "#e6edf3", cursor: "#e6edf3", selectionBackground: "#264f78" },
  });
  term.loadAddon(new Unicode11Addon());
  term.unicode.activeVersion = "11";
  term.open(host);
  term.onData(onInput);
  term.onBinary(onInput);

  const frame = host.parentElement;
  let pending = 0;
  const fit = (tries = 3) => {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => {
      const screen = term.element?.querySelector(".xterm-screen");
      if (!screen?.offsetWidth || !screen.offsetHeight) return;
      const ratio = Math.min(frame.clientWidth / screen.offsetWidth, frame.clientHeight / screen.offsetHeight);
      const current = term.options.fontSize;
      const next = Math.max(MIN_FONT, Math.min(PREFERRED_FONT, Math.floor(current * ratio * 2) / 2));
      if (next !== current) {
        term.options.fontSize = next;
        if (tries > 0) fit(tries - 1);
      }
    });
  };
  new ResizeObserver(() => fit()).observe(frame);

  return {
    term,
    resize(cols, rows) {
      if (!cols || !rows || (cols === term.cols && rows === term.rows)) return;
      term.resize(cols, rows);
      term.options.fontSize = PREFERRED_FONT;
      fit();
    },
    setCanType(canType) {
      term.options.disableStdin = !canType;
    },
    // A key from the on-screen row, as the terminal's current mode spells it.
    key(name) {
      const app = term.modes.applicationCursorKeysMode;
      const keys = {
        esc: "\x1b",
        up: app ? "\x1bOA" : "\x1b[A",
        down: app ? "\x1bOB" : "\x1b[B",
        tab: "\t",
        enter: "\r",
        interrupt: "\x03",
      };
      return keys[name] ?? "";
    },
    // A composed prompt: pasted (so its newlines don't run it early) and then
    // submitted with a return of its own, which agents like Claude Code need.
    deliver(text, send) {
      const body = text.replace(/\r?\n/g, "\r");
      if (!term.modes.bracketedPasteMode) {
        send(body + "\r");
        return;
      }
      send(`\x1b[200~${body.replace(/\x1b/g, "␛")}\x1b[201~`);
      setTimeout(() => send("\r"), PASTE_SETTLE_MS);
    },
  };
}
