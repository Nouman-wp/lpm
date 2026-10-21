export type KeyName =
  | "enter"
  | "newline"
  | "backspace"
  | "delete"
  | "left"
  | "right"
  | "up"
  | "down"
  | "home"
  | "end"
  | "wordLeft"
  | "wordRight"
  | "killStart"
  | "killEnd"
  | "killWord"
  | "interrupt"
  | "eof"
  | "escape";

export type Key = { name: KeyName } | { name: "text"; text: string } | { name: "paste"; text: string };

const SEQUENCES: Record<string, KeyName> = {
  "[A": "up",
  "[B": "down",
  "[C": "right",
  "[D": "left",
  OA: "up",
  OB: "down",
  OC: "right",
  OD: "left",
  "[H": "home",
  "[F": "end",
  OH: "home",
  OF: "end",
  "[1~": "home",
  "[4~": "end",
  "[7~": "home",
  "[8~": "end",
  "[3~": "delete",
  "[1;3D": "wordLeft",
  "[1;3C": "wordRight",
  "[1;5D": "wordLeft",
  "[1;5C": "wordRight",
  b: "wordLeft",
  f: "wordRight",
  "\x7f": "killWord",
  "\r": "newline",
};

const CONTROLS: Record<string, KeyName> = {
  "\r": "enter",
  "\x7f": "backspace",
  "\b": "backspace",
  "\x03": "interrupt",
  "\x04": "eof",
  "\x01": "home",
  "\x05": "end",
  "\x02": "left",
  "\x06": "right",
  "\x10": "up",
  "\x0e": "down",
  "\x15": "killStart",
  "\x0b": "killEnd",
  "\x17": "killWord",
};

const PASTE_START = "\x1b[200~";
const PASTE_END = "\x1b[201~";
const ESCAPE = /^\x1b(\[[0-9;?]*[ -/]*[@-~]|O.|[\s\S])?/;

// Turns raw terminal input into keys. A bracketed paste can arrive over several
// writes, so its text is held until the closing marker; inside it a CR is a
// line break, not a submit.
export function createKeyReader(): (data: string) => Key[] {
  let paste: string | null = null;

  return (data) => {
    const keys: Key[] = [];
    let text = "";
    const flush = () => {
      if (text) keys.push({ name: "text", text });
      text = "";
    };
    let i = 0;
    while (i < data.length) {
      if (paste !== null) {
        const end = data.indexOf(PASTE_END, i);
        if (end === -1) {
          paste += data.slice(i);
          break;
        }
        paste += data.slice(i, end);
        keys.push({ name: "paste", text: paste.replace(/\r\n?/g, "\n").replace(/\t/g, "    ") });
        paste = null;
        i = end + PASTE_END.length;
        continue;
      }
      const ch = data[i];
      if (ch === "\x1b") {
        flush();
        if (data.startsWith(PASTE_START, i)) {
          paste = "";
          i += PASTE_START.length;
          continue;
        }
        const seq = ESCAPE.exec(data.slice(i))?.[1];
        if (!seq) keys.push({ name: "escape" });
        else if (SEQUENCES[seq]) keys.push({ name: SEQUENCES[seq] });
        i += 1 + (seq?.length ?? 0);
        continue;
      }
      if (ch === "\n") {
        flush();
        if (data[i - 1] !== "\r") keys.push({ name: "enter" });
      } else if (CONTROLS[ch]) {
        flush();
        keys.push({ name: CONTROLS[ch] });
      } else if (ch >= " ") text += ch;
      i++;
    }
    flush();
    return keys;
  };
}
