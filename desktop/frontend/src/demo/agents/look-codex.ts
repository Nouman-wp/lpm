import { BOLD, RESET, band, duration, fg, hang, inline, mix, pad, truncate, width } from "../ansi";
import { BRAND } from "./brand";
import { dot, promptRows, type Composer, type Look, type LookContext } from "./look";
import type { Palette } from "./theme";
import { DIFF, codexTool, splitVerb } from "./tools";

const cyan = (p: Palette) => fg(p.pick("#00c5c7", "#0e7490"));

// The weekly window the demo's usage meter shows for Codex.
const WEEKLY_LEFT = 73;

function diffTag(tag: string, p: Palette): string {
  const [, added, removed] = DIFF.exec(tag) ?? [];
  const minus = removed ? ` ${fg(p.red)}-${removed}${RESET}` : "";
  return `${fg(p.muted)}(${RESET}${fg(p.green)}+${added}${RESET}${minus}${fg(p.muted)})${RESET}`;
}

// The highlight Codex sweeps across "Working" while a turn runs.
function shimmer(text: string, frame: number, p: Palette): string {
  const bright = p.pick("#ffffff", "#000000");
  const at = (frame % (text.length + 8)) - 4;
  return [...text]
    .map((ch, i) => `${fg(mix(p.muted, bright, Math.max(0, 1 - Math.abs(i - at) / 3)))}${ch}`)
    .join("")
    .concat(RESET);
}

function statusLine(v: Composer, c: LookContext): string {
  const p = c.palette;
  if (v.exiting) return `  ${fg(p.muted)}ctrl + ${v.exiting} again to quit${RESET}`;
  const context = Math.max(41, 100 - v.work * 2);
  return [
    `  ${fg(p.pick("#f6e2b7", "#8a6d1f"))}${c.model}${c.effort ? ` ${c.effort}` : ""}${RESET}`,
    `${fg(p.pick("#f2b590", "#a4501b"))}Context ${context}% left${RESET}`,
    `${fg(p.pick("#e990a9", "#a3334f"))}weekly ${WEEKLY_LEFT}% left${RESET}`,
    `${fg(p.pick("#c8a9ee", "#6d3fb0"))}Fast off${RESET}`,
  ].join(dot(p));
}

// Codex: the welcome box, a `›` prompt, `•` section bullets, consecutive
// read-only tools folded into one Explored block, and the closing answer set
// between rules, the first one saying how long the turn took.
export const codexLook: Look = {
  banner(c) {
    const p = c.palette;
    const { version } = BRAND.codex;
    const model = `${c.model}${c.effort ? ` ${c.effort}` : ""}`;
    const cwd = truncate(c.cwd, Math.max(8, c.cols - 15));
    const rows: [string, string][] = [
      [`>_ OpenAI Codex (${version})`, `${fg(p.muted)}>_${RESET} ${BOLD}OpenAI Codex${RESET} ${fg(p.muted)}(${version})${RESET}`],
      ["", ""],
      [
        `model:     ${model}   /model to change`,
        `${fg(p.muted)}model:${RESET}     ${model}   ${cyan(p)}/model${RESET}${fg(p.muted)} to change${RESET}`,
      ],
      [`directory: ${cwd}`, `${fg(p.muted)}directory:${RESET} ${cwd}`],
    ];
    const inner = Math.min(c.cols - 4, Math.max(...rows.map(([plain]) => width(plain))));
    const edge = fg(p.faint);
    return [
      `${edge}╭${"─".repeat(inner + 2)}╮${RESET}`,
      ...rows.map(([plain, styled]) => {
        const text = width(plain) > inner ? truncate(plain, inner) : styled;
        return `${edge}│${RESET} ${pad(text, inner)} ${edge}│${RESET}`;
      }),
      `${edge}╰${"─".repeat(inner + 2)}╯${RESET}`,
      "",
      ...hang("", 0, [{ text: "Tip:", style: fg(p.muted) + BOLD }, { text: ` lpm launched ${BRAND.codex.short} in this project's root`, style: fg(p.muted) }], c.cols),
    ];
  },

  query(text, c) {
    return ["", ...hang(`${fg(c.palette.muted)}${BOLD}›${RESET} `, 2, [{ text }], c.cols)];
  },

  turn(ctx) {
    let explored: string[] = [];
    let ruled = false;

    const block = (title: string) => {
      const p = ctx().palette;
      return [
        "",
        `${fg(p.muted)}•${RESET} ${BOLD}${title}${RESET}`,
        ...explored.map((detail, i) => {
          const [verb, target] = splitVerb(detail);
          return `  ${fg(p.muted)}${i === 0 ? "└" : " "}${RESET} ${cyan(p)}${verb}${RESET} ${target}`;
        }),
      ];
    };
    const flush = () => {
      if (explored.length === 0) return [];
      const lines = block("Explored");
      explored = [];
      return lines;
    };

    return {
      reveal(step, at) {
        const c = ctx();
        const p = c.palette;
        if (step.kind === "thinking") return [];
        if (step.kind === "text") {
          if (!step.text.trim()) return [];
          const out = flush();
          if (at.closing && !ruled) {
            ruled = true;
            const label = `Worked for ${duration(at.ms)}`;
            out.push("", `${fg(p.faint)}─ ${fg(p.muted)}${label} ${fg(p.faint)}${"─".repeat(Math.max(0, c.cols - label.length - 3))}${RESET}`);
          }
          const tone = step.style === "muted" ? fg(p.muted) : "";
          out.push("", ...hang(`${fg(p.muted)}•${RESET} `, 2, inline(step.text, tone, cyan(p)), c.cols));
          return out;
        }
        const tool = codexTool(step);
        if (tool.kind === "explored") {
          explored.push(tool.detail);
          return [];
        }
        const out = flush();
        if (tool.kind === "edited") {
          const [verb, target] = splitVerb(tool.head);
          out.push("", `${fg(p.muted)}•${RESET} ${BOLD}${verb}${RESET} ${target}${tool.tag ? ` ${diffTag(tool.tag, p)}` : ""}`);
        } else {
          out.push(
            "",
            ...hang(`${fg(p.muted)}•${RESET} `, 2, [{ text: "Ran", style: BOLD }, { text: ` ${tool.head}` }], c.cols),
            ...hang(`  ${fg(p.muted)}└${RESET} `, 4, [{ text: tool.detail, style: fg(p.muted) }], c.cols),
          );
        }
        return out;
      },
      live: () => (explored.length ? block("Exploring") : []),
      end({ interrupted }) {
        const c = ctx();
        const p = c.palette;
        const out = flush();
        if (ruled) out.push("", `${fg(p.faint)}${"─".repeat(c.cols)}${RESET}`);
        if (interrupted) {
          out.push("", `${fg(p.red)}■${RESET} Conversation interrupted - tell the model what to do differently.`);
        }
        return out;
      },
    };
  },

  working(w, c) {
    const p = c.palette;
    const bullet = Math.floor(w.frame / 5) % 2 ? "◦" : "•";
    return [
      "",
      `${fg(p.muted)}${bullet}${RESET} ${BOLD}${shimmer("Working", w.frame, p)} ${fg(p.muted)}(${duration(w.elapsedMs)} • esc to interrupt)${RESET}`,
    ];
  },

  queued(text, c) {
    return [`  ${fg(c.palette.muted)}↳ ${truncate(text.replace(/\n/g, " "), c.cols - 5)}${RESET}`];
  },

  composer(v, c) {
    const p = c.palette;
    const input = promptRows(v, `${BOLD}›${RESET} `, "  ", c.cols - 3, "Ask Codex to do anything", p);
    const shaded = (line: string) => band(line, c.cols, p.shade);
    return [shaded(""), ...input.map(shaded), shaded(""), "", statusLine(v, c)];
  },

  notice(text, c) {
    return [`${fg(c.palette.muted)}•${RESET} ${text}`];
  },

  farewell(c, work) {
    const p = c.palette;
    const input = 9_412 + work * 1_873;
    const output = 1_206 + work * 317;
    const n = (v: number) => v.toLocaleString("en-US");
    return [
      "",
      `${fg(p.muted)}Token usage: total=${n(input + output)} input=${n(input)} output=${n(output)}${RESET}`,
      `${fg(p.muted)}To continue this session, run ${RESET}${cyan(p)}codex resume ${c.sessionId}${RESET}`,
    ];
  },
};
