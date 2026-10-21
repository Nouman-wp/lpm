import { BOLD, RESET, band, duration, fg, inline, mix, truncate, wrap } from "../ansi";
import { BRAND, claudeModelName } from "./brand";
import { promptRows, type Look, type LookContext } from "./look";
import type { Palette } from "./theme";
import { opencodeTool } from "./tools";

const LOGO_OPEN = ["█▀▀█ █▀▀█ █▀▀ █▀▀▄", "█░░█ █░░█ █▀▀ █░░█", "▀▀▀▀ █▀▀▀ ▀▀▀ ▀  ▀"];
const LOGO_CODE = ["█▀▀ █▀▀█ █▀▀▄ █▀▀", "█░░ █░░█ █░░█ █▀▀", "▀▀▀ ▀▀▀▀ ▀▀▀  ▀▀▀"];
const CELLS = 8;

const accent = (p: Palette) => p.pick("#fab283", "#c2410c");

// "anthropic/fable-5" as OpenCode shows it: the model's name, then whose it is.
function modelParts(model: string): [string, string] {
  const [provider, name = provider] = model.split("/");
  const shown = claudeModelName(name) ?? name;
  return [shown, provider === name ? "" : provider.charAt(0).toUpperCase() + provider.slice(1)];
}

// The bar OpenCode sweeps back and forth while it works, a lit square with a
// fading trail behind it.
function sweep(frame: number, p: Palette): string {
  const span = CELLS * 2 - 2;
  const pos = frame % span;
  const head = pos < CELLS ? pos : span - pos;
  const dir = pos < CELLS ? 1 : -1;
  const cells = Array.from({ length: CELLS }, (_, i) => {
    const behind = (head - i) * dir;
    const color = behind === 0 ? accent(p) : behind === 1 || behind === 2 ? mix(accent(p), p.faint, behind * 0.35) : p.faint;
    return `${fg(color)}■`;
  });
  return cells.join("") + RESET;
}

const bar = (c: LookContext) => `${fg(accent(c.palette))}┃${RESET}`;

// OpenCode: the block wordmark, prompts on a shaded panel behind the agent's
// colored bar, one compact line per tool (→ read, ← write, ✱ search, $ shell)
// and a `▣` line closing each turn with the agent, model and time.
export const opencodeLook: Look = {
  banner(c) {
    const p = c.palette;
    const logo =
      c.cols >= 42
        ? LOGO_OPEN.map((open, i) => `  ${fg(p.muted)}${open}${RESET} ${BOLD}${LOGO_CODE[i]}${RESET}`)
        : [`  ${fg(p.muted)}open${RESET}${BOLD}code${RESET}`];
    return [...logo, "", `  ${fg(p.muted)}${truncate(`${BRAND.opencode.version} · ${c.cwd}`, c.cols - 3)}${RESET}`];
  },

  query(text, c) {
    const p = c.palette;
    const rows = wrap([{ text }], c.cols - 4).map((line) => `${bar(c)} ${line}`);
    return ["", ...[bar(c), ...rows, bar(c)].map((row) => band(row, c.cols, p.shade))];
  },

  turn(ctx) {
    let last: "tool" | "text" | null = null;
    return {
      reveal(step) {
        const c = ctx();
        const p = c.palette;
        if (step.kind === "thinking") return [];
        if (step.kind === "text") {
          if (!step.text.trim()) return [];
          last = "text";
          const tone = step.style === "muted" ? fg(p.muted) : "";
          return ["", ...wrap(inline(step.text, tone, fg(accent(p))), c.cols - 4).map((line) => `  ${line}`)];
        }
        const tool = opencodeTool(step);
        const out = last === "tool" ? [] : [""];
        last = "tool";
        const shell = tool.mark === "$";
        const name = tool.name ? `${tool.name} ` : "";
        const note = !shell && tool.note ? ` ${fg(p.muted)}${tool.note}${RESET}` : "";
        const room = Math.max(8, c.cols - 6 - name.length - (shell ? 0 : tool.note.length + 1));
        out.push(`  ${fg(p.muted)}${tool.mark}${RESET} ${name}${shell ? "" : fg(p.muted)}${truncate(tool.arg, room)}${RESET}${note}`);
        if (shell && tool.note) out.push(`    ${fg(p.muted)}${truncate(tool.note, c.cols - 5)}${RESET}`);
        return out;
      },
      live: () => [],
      end({ ms, interrupted }) {
        const c = ctx();
        const p = c.palette;
        const took = interrupted ? "interrupted" : ms < 60_000 ? `${(ms / 1000).toFixed(1)}s` : duration(ms);
        return ["", `  ${fg(accent(p))}▣${RESET} ${fg(p.muted)}Build · ${modelParts(c.model)[0]} · ${took}${RESET}`];
      },
    };
  },

  working(w, c) {
    return ["", `  ${sweep(w.frame, c.palette)}  ${fg(c.palette.muted)}esc interrupt${RESET}`];
  },

  queued(text, c) {
    return [`${bar(c)} ${fg(c.palette.muted)}${truncate(text.replace(/\n/g, " "), c.cols - 3)} (queued)${RESET}`];
  },

  composer(v, c) {
    const p = c.palette;
    const [model, provider] = modelParts(c.model);
    const input = promptRows(v, `${bar(c)} `, `${bar(c)} `, c.cols - 4, 'Ask anything... "Fix a TODO in the codebase"', p);
    const agent = `${bar(c)} ${fg(accent(p))}${BOLD}Build${RESET}  ${model} ${fg(p.muted)}${provider}${RESET}`;
    const hints = v.exiting
      ? `  ${fg(p.muted)}Press ctrl+${v.exiting} again to exit${RESET}`
      : `  ${BOLD}tab${RESET} ${fg(p.muted)}agents${RESET}  ${BOLD}ctrl+p${RESET} ${fg(p.muted)}commands${RESET}`;
    return [...input, agent].map((row) => band(row, c.cols, p.shade)).concat("", hints);
  },

  notice(text, c) {
    return [`  ${fg(c.palette.muted)}${text}${RESET}`];
  },

  farewell: () => [],
};
