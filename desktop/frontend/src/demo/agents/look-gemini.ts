import { BOLD, RESET, band, duration, fg, hang, inline, mix, pad, truncate, width } from "../ansi";
import { GEMINI_SPINNER, geminiPhrase } from "./brand";
import { promptRows, type Composer, type Look, type LookContext } from "./look";
import { geminiTool } from "./tools";

const ACCENT = "#847ace";
const GRADIENT = ["#4796e4", "#847ace", "#c3677f"];

const LOGO = [
  " ███         █████████  ",
  "░░░███      ███░░░░░███ ",
  "  ░░░███   ███     ░░░  ",
  "    ░░░███░███          ",
  "     ███░ ░███    █████ ",
  "   ███░   ░░███  ░░███  ",
  " ███░      ░░█████████  ",
  "░░░         ░░░░░░░░░   ",
];

const TIPS = [
  "Tips for getting started:",
  "1. Ask questions, edit files, or run commands.",
  "2. Be specific for the best results.",
  "3. Create GEMINI.md files to customize your interactions with Gemini.",
  "4. /help for more information.",
];

function gradient(line: string): string {
  const chars = [...line];
  return (
    chars
      .map((ch, i) => {
        const t = i / (chars.length - 1);
        const color = t < 0.5 ? mix(GRADIENT[0], GRADIENT[1], t * 2) : mix(GRADIENT[1], GRADIENT[2], (t - 0.5) * 2);
        return ch === " " ? ch : `${fg(color)}${ch}`;
      })
      .join("") + RESET
  );
}

function box(rows: string[], c: LookContext): string[] {
  const inner = c.cols - 4;
  const edge = fg(c.palette.faint);
  return [
    `${edge}╭${"─".repeat(inner + 2)}╮${RESET}`,
    ...rows.map((row) => `${edge}│${RESET} ${pad(row, inner)} ${edge}│${RESET}`),
    `${edge}╰${"─".repeat(inner + 2)}╯${RESET}`,
  ];
}

// Cwd on the left, the sandbox notice in the middle, the model on the right.
function footer(v: Composer, c: LookContext): string {
  const p = c.palette;
  if (v.exiting) return `${fg(p.muted)}Press Ctrl+${v.exiting.toUpperCase()} again to exit.${RESET}`;
  const context = Math.max(52, 100 - v.work * 2);
  const right = `${c.model} (${context}% context left)`;
  const middle = "no sandbox (see /docs)";
  const room = c.cols - 1;
  const left = truncate(c.cwd, Math.max(8, room - width(right) - 2));
  const gaps = room - width(left) - width(middle) - width(right);
  if (gaps < 4) return `${fg(ACCENT)}${left}${RESET}  ${fg(p.muted)}${truncate(right, room - width(left) - 2)}${RESET}`;
  const gap = " ".repeat(Math.floor(gaps / 2));
  return `${fg(ACCENT)}${left}${RESET}${gap}${fg(p.red)}${middle}${RESET}${gap}${fg(p.muted)}${right}${RESET}`;
}

// Gemini CLI: its gradient logo and tips, `✦` for the model's words, each tool
// call in its own rounded box, and the prompt in a box above the footer.
export const geminiLook: Look = {
  banner(c) {
    const p = c.palette;
    const logo = c.cols >= 26 ? LOGO.map(gradient) : [`${fg(ACCENT)}${BOLD}✦ Gemini CLI${RESET}`];
    return [...logo, "", ...TIPS.map((tip) => `${fg(p.muted)}${truncate(tip, c.cols - 1)}${RESET}`)];
  },

  query(text, c) {
    const p = c.palette;
    return ["", ...hang(`${fg(ACCENT)}>${RESET} `, 2, [{ text }], c.cols).map((line) => band(line, c.cols, p.shade))];
  },

  turn(ctx) {
    return {
      reveal(step) {
        const c = ctx();
        const p = c.palette;
        if (step.kind === "thinking") return [];
        if (step.kind === "text") {
          if (!step.text.trim()) return [];
          const tone = step.style === "muted" ? fg(p.muted) : "";
          return ["", ...hang(`${fg(ACCENT)}✦${RESET} `, 2, inline(step.text, tone, fg(ACCENT)), c.cols)];
        }
        const tool = geminiTool(step);
        const room = c.cols - 4;
        const arg = truncate(tool.arg, Math.max(4, room - tool.name.length - 4));
        const rows = [`${fg(p.green)}✓${RESET}  ${BOLD}${tool.name}${RESET} ${fg(p.muted)}${arg}${RESET}`];
        if (tool.result) rows.push(`   ${fg(p.muted)}${truncate(tool.result, room - 3)}${RESET}`);
        return ["", ...box(rows, c)];
      },
      live: () => [],
      end({ interrupted }) {
        const p = ctx().palette;
        return interrupted ? ["", `${fg(p.pick("#f9e2af", "#a16207"))}ℹ${RESET} ${fg(p.muted)}Request cancelled.${RESET}`] : [];
      },
    };
  },

  working(w, c) {
    const p = c.palette;
    const spinner = GEMINI_SPINNER[w.frame % GEMINI_SPINNER.length];
    return [
      "",
      `${fg(ACCENT)}${spinner} ${geminiPhrase(w.seed)}…${RESET} ${fg(p.muted)}(esc to cancel, ${duration(w.elapsedMs)})${RESET}`,
    ];
  },

  queued(text, c) {
    return [`${fg(c.palette.muted)}> ${truncate(text.replace(/\n/g, " "), c.cols - 3)}${RESET}`];
  },

  composer(v, c) {
    const p = c.palette;
    const input = promptRows(v, `${fg(ACCENT)}>${RESET} `, "  ", c.cols - 7, "  Type your message or @path/to/file", p);
    return [...box(input, c), footer(v, c)];
  },

  notice(text, c) {
    return [`${fg(c.palette.muted)}ℹ ${text}${RESET}`];
  },

  farewell: () => ["", `${fg(ACCENT)}Agent powering down. Goodbye!${RESET}`],
};
