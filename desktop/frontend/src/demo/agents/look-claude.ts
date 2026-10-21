import { BOLD, RESET, band, duration, fg, hang, inline, truncate, type Span } from "../ansi";
import { BRAND, CLAUDE_STARS, settledVerb, workingVerb } from "./brand";
import { dot, promptRows, type Composer, type Look, type LookContext } from "./look";
import type { Palette } from "./theme";
import { claudeTool } from "./tools";

const ORANGE = "#d97757";
const LOGO = [" ▐▛███▜▌", "▝▜█████▛▘", "  ▘▘ ▝▝"];

const code = (p: Palette) => fg(p.pick("#b1b9f9", "#5769f7"));

// Claude Code bolds the counts inside a `⎿` result line.
function emphasize(result: string, p: Palette): Span[] {
  return result
    .split(/(\d[\d,]*(?:\.\d+)?)/)
    .filter(Boolean)
    .map((part) => ({ text: part, style: /^\d/.test(part) ? BOLD : fg(p.muted) }));
}

function statusLine(v: Composer, c: LookContext): string {
  const p = c.palette;
  if (v.exiting) return `  ${fg(p.muted)}Press Ctrl-${v.exiting.toUpperCase()} again to exit${RESET}`;
  const context = Math.max(38, 92 - v.work * 2);
  const cost = (0.01 + v.work * 0.008).toFixed(2);
  return [
    `  ${c.project}`,
    `${fg(p.pick("#d78787", "#b04a4a"))}${c.model}${RESET}`,
    `${fg(p.muted)}ctx ${RESET}${context}%`,
    `${fg(p.pick("#c7c400", "#8a7a00"))}$${cost}${RESET}`,
  ].join(dot(p));
}

// Claude Code: the block logo beside name, model and directory; a shaded `❯`
// band for each prompt; a green `⏺` per tool with its `⎿` result underneath and
// a plain `⏺` for anything the model says; the prompt between two rules with
// lpm's status line under it.
export const claudeLook: Look = {
  banner(c) {
    const p = c.palette;
    const room = c.cols - 13;
    const effort = c.effort && c.effort !== "auto" ? ` with ${c.effort} effort` : "";
    const info = [
      `${BOLD}${BRAND.claude.name}${RESET} ${fg(p.muted)}${BRAND.claude.version}${RESET}`,
      `${fg(p.muted)}${truncate(`${c.model}${effort} · Claude Max`, room)}${RESET}`,
      `${fg(p.muted)}${truncate(c.cwd, room)}${RESET}`,
    ];
    return [
      ...LOGO.map((mark, i) => `${fg(ORANGE)}${mark.padEnd(9)}${RESET}  ${info[i]}`),
      "",
      ...hang("", 0, [{ text: "※ Tip:", style: fg(p.muted) + BOLD }, { text: ` lpm launched ${BRAND.claude.short} in this project's root`, style: fg(p.muted) }], c.cols),
    ];
  },

  query(text, c) {
    const p = c.palette;
    return ["", ...hang(`${fg(p.muted)}❯${RESET} `, 2, [{ text }], c.cols).map((line) => band(line, c.cols, p.shade))];
  },

  turn(ctx) {
    return {
      reveal(step) {
        const c = ctx();
        const p = c.palette;
        if (step.kind === "thinking") return [];
        if (step.kind === "text") {
          // Scripts use an empty line as a paragraph break, and Claude never
          // prints a bullet with nothing after it.
          if (!step.text.trim()) return [];
          const tone = step.style === "muted" ? fg(p.muted) : "";
          return ["", ...hang(`${tone}⏺${RESET} `, 2, inline(step.text, tone, code(p)), c.cols)];
        }
        const tool = claudeTool(step);
        return [
          "",
          ...hang(`${fg(p.green)}⏺${RESET} `, 2, [{ text: tool.name, style: BOLD }, { text: `(${tool.arg})`, style: fg(p.muted) }], c.cols),
          ...hang(`  ${fg(p.muted)}⎿${RESET}  `, 5, emphasize(tool.result, p), c.cols),
        ];
      },
      live: () => [],
      end({ ms, interrupted, seed }) {
        const p = ctx().palette;
        if (interrupted) {
          return [`  ${fg(p.muted)}⎿  ${RESET}${fg(p.red)}Interrupted${RESET}${fg(p.muted)} · What should Claude do instead?${RESET}`];
        }
        return ["", `${fg(p.muted)}✻ ${settledVerb(seed)} for ${duration(Math.max(1000, ms))}${RESET}`];
      },
    };
  },

  working(w, c) {
    const p = c.palette;
    const star = CLAUDE_STARS[w.frame % CLAUDE_STARS.length];
    const tokens = w.tokens >= 1000 ? `${(w.tokens / 1000).toFixed(1)}k` : String(w.tokens);
    return [
      "",
      `${fg(ORANGE)}${star}${RESET} ${workingVerb(w.seed)}… ${fg(p.muted)}(${duration(w.elapsedMs)} · ↓ ${tokens} tokens · esc to interrupt)${RESET}`,
    ];
  },

  queued(text, c) {
    return [`${fg(c.palette.muted)}❯ ${truncate(text.replace(/\n/g, " "), c.cols - 3)}${RESET}`];
  },

  composer(v, c) {
    const p = c.palette;
    const edge = fg(p.faint);
    // lpm reads an ultracode session off this label, which Claude keeps on the
    // prompt's top rule for as long as the level holds.
    const top =
      c.effort === "ultracode"
        ? `${edge}${"─".repeat(c.cols - 15)} ${RESET}${fg(ORANGE)}ultracode${RESET}${edge} ───${RESET}`
        : `${edge}${"─".repeat(c.cols)}${RESET}`;
    const input = promptRows(v, `${fg(p.muted)}❯${RESET} `, "  ", c.cols - 3, v.fresh ? 'Try "how does <filepath> work?"' : "", p);
    return [top, ...input, `${edge}${"─".repeat(c.cols)}${RESET}`, statusLine(v, c)];
  },

  notice(text, c) {
    return hang(`  ${fg(c.palette.muted)}⎿${RESET}  `, 5, [{ text }], c.cols);
  },

  farewell: () => [],
};
