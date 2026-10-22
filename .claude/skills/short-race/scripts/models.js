#!/usr/bin/env node
// node models.js "opus 5.5 max" "gpt 6 astra ultra" "grok 4.7 xhigh" [--effort xhigh]
// Turns loose model specs into exact launch commands, checked against what
// the installed CLIs accept: Claude Code's own model table (read from its
// binary), Codex's models cache (with each model's reasoning levels), Muse
// Code's model catalog (with each model's effort tiers) and Cursor CLI's model
// list (`agent --list-models`, most levels as their own slug; Cursor itself
// checks a level it lists no slug for).
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");
const cliDefault = require("./cli-default");

const EFFORT_ALIASES = {
  utra: "ultra",
  ultr: "ultra",
  "x-high": "xhigh",
  "extra-high": "xhigh",
  extrahigh: "xhigh",
  med: "medium",
  mid: "medium",
  maximum: "max",
};
const SPOKEN_EFFORT = { xhigh: "extra high" };

function which(bin) {
  try {
    return fs.realpathSync(execFileSync("which", [bin], { encoding: "utf8" }).trim());
  } catch {
    return null;
  }
}

let claudeCache;
function claudeTable() {
  if (claudeCache) return claudeCache;
  const bin = which("claude");
  if (!bin) throw new Error("claude is not on PATH");
  const text = fs.readFileSync(bin).toString("latin1");
  const re = /\{id:"(claude-[a-z0-9-]+)",family:"([a-z]+)",display_name:"([^"]+)"[^}]*?provider_ids:\{first_party:"([^"]+)"/g;
  const models = new Map();
  for (const m of text.matchAll(re)) models.set(m[1], { family: m[2], name: m[3], id: m[4] });
  let efforts = ["low", "medium", "high", "xhigh", "max"];
  try {
    const help = execFileSync(bin, ["--help"], { encoding: "utf8" });
    const list = /--effort <level>[\s\S]*?\(([^)]+)\)/.exec(help)?.[1];
    if (list) efforts = list.split(",").map((e) => e.trim());
  } catch {}
  claudeCache = { models: [...models.values()], efforts };
  return claudeCache;
}

const CODEX_CACHE = path.join(os.homedir(), ".codex", "models_cache.json");

let codexCache;
function codexTable() {
  if (codexCache) return codexCache;
  if (!fs.existsSync(CODEX_CACHE)) throw new Error(`no Codex models cache at ${CODEX_CACHE}: run codex once`);
  const data = JSON.parse(fs.readFileSync(CODEX_CACHE, "utf8"));
  codexCache = (data.models || data).map((m) => ({
    slug: m.slug,
    hidden: m.visibility === "hide",
    efforts: (m.supported_reasoning_levels || []).map((l) => (typeof l === "string" ? l : l.effort)),
  }));
  return codexCache;
}

const MUSE_CATALOG = path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share"), "muse", "model-catalog");

// The `-contributor` variants are discounted for letting Meta use the session's
// content, so a race never runs on one.
let museCache;
function museTable() {
  if (museCache) return museCache;
  if (!which("muse")) throw new Error("Muse Code (muse) is not on PATH: brew install --cask muse-code, then muse login");
  const files = fs.existsSync(MUSE_CATALOG) ? fs.readdirSync(MUSE_CATALOG).filter((n) => n.endsWith(".json")) : [];
  if (files.length === 0) throw new Error(`no Muse Code model catalog in ${MUSE_CATALOG}: run muse once after muse login`);
  museCache = files
    .flatMap((n) => JSON.parse(fs.readFileSync(path.join(MUSE_CATALOG, n), "utf8")).rows || [])
    .filter((m) => m.visibility === "visible" && m.reasoning_effort_variants && !m.model_id.endsWith("-contributor"))
    .map((m) => ({ id: m.model_id, released: m.release_date || "", efforts: m.reasoning_effort_variants.map((v) => v.tier) }));
  return museCache;
}

const CURSOR_EFFORTS = ["minimal", "low", "medium", "high", "xhigh", "max"];

let cursorCache;
function cursorTable() {
  if (cursorCache) return cursorCache;
  if (!which("agent")) throw new Error("Cursor CLI (agent) is not on PATH: curl https://cursor.com/install -fsS | bash");
  const out = execFileSync("agent", ["--list-models"], { encoding: "utf8" });
  cursorCache = [...out.matchAll(/^(\S+) - (.+)$/gm)].map((m) => ({
    slug: m[1],
    display: m[2].replace(/[​-‍﻿]/g, "").replace(/\s*\(.*\)$/, "").trim(),
  }));
  return cursorCache;
}

// Whether Cursor CLI takes `model`, such as a parameterized
// `gemini-3.6-flash[effort=low]` that --list-models leaves out. A print run
// with no prompt checks the model and stops before sending anything, but saves
// the model as the user's default, which is put back.
function cursorAccepts(model) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cursor-model-"));
  const backup = path.join(dir, "cli-config.backup.json");
  cliDefault.save(backup, "cursor");
  try {
    const run = spawnSync("agent", ["-p", "--trust", "--model", model], { cwd: dir, encoding: "utf8", input: "", timeout: 60000 });
    const out = `${run.stdout}${run.stderr}`;
    if (out.includes("Cannot use this model")) return false;
    if (out.includes("No prompt provided")) return true;
    throw new Error(`Cursor CLI didn't say whether it takes ${model}: ${out.trim().slice(0, 200) || run.error?.message}`);
  } finally {
    cliDefault.restore(backup, "cursor");
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const versionOf = (name) => Number((/(\d+(?:\.\d+)?)\s*$/.exec(name) || [])[1] || 0);
const title = (w) => w.charAt(0).toUpperCase() + w.slice(1);

function codexName(slug) {
  const m = /^gpt-([\d.]+)(?:-(.+))?$/.exec(slug);
  if (!m) return slug.split("-").map(title).join(" ");
  return `GPT-${m[1]}${m[2] ? " " + m[2].split("-").map(title).join(" ") : ""}`;
}

function splitEffort(words) {
  if (words.length > 2 && ["extra", "x"].includes(words.at(-2)) && words.at(-1) === "high") {
    return { words: words.slice(0, -2), effort: "xhigh" };
  }
  const last = words.at(-1);
  const effort = EFFORT_ALIASES[last] || last;
  const known = new Set(["minimal", "low", "medium", "high", "xhigh", "max", "ultra", "none"]);
  return known.has(effort) ? { words: words.slice(0, -1), effort } : { words, effort: null };
}

function resolveClaude(words, effort, spec) {
  const { models, efforts } = claudeTable();
  const family = words[0];
  const version = words.slice(1).join(".").replace(/-/g, ".").replace(/\.+/g, ".");
  const inFamily = models.filter((m) => m.family === family);
  if (inFamily.length === 0) throw new Error(`"${spec}": Claude Code knows no "${family}" models`);
  const newest = inFamily.slice().sort((a, b) => versionOf(b.name) - versionOf(a.name))[0];
  const pick = version ? inFamily.find((m) => m.name.toLowerCase() === `${family} ${version}`) : newest;
  if (!pick) {
    const names = inFamily.map((m) => m.name).join(", ");
    throw new Error(`"${spec}": no ${title(family)} ${version} in Claude Code ${names ? `(it has ${names})` : ""}`);
  }
  if (effort && !efforts.includes(effort)) {
    throw new Error(`"${spec}": Claude Code effort is one of ${efforts.join(", ")}, not ${effort}`);
  }
  // lpm's per-run model picker offers each family by its bare name, which
  // Claude Code resolves to the family's newest model.
  return { cli: "claude", model: pick.id, name: pick.name, effort, pickerModel: pick === newest ? title(family) : null };
}

function resolveCodex(words, effort, spec) {
  const models = codexTable();
  const joined = words.join(" ").replace(/^gpt[\s-]*/, "gpt-").replace(/\s+/g, "-");
  let hits = models.filter((m) => m.slug === joined);
  if (hits.length === 0) hits = models.filter((m) => m.slug.endsWith(`-${joined}`) || m.slug.startsWith(`${joined}-`));
  if (hits.length > 1) hits = hits.filter((m) => !m.hidden);
  if (hits.length !== 1) {
    const list = (hits.length ? hits : models.filter((m) => !m.hidden)).map((m) => m.slug).join(", ");
    throw new Error(`"${spec}": ${hits.length ? "ambiguous" : "unknown"} Codex model; pick one of ${list}`);
  }
  const m = hits[0];
  if (effort && !m.efforts.includes(effort)) {
    throw new Error(`"${spec}": ${m.slug} supports ${m.efforts.join(", ")}, not ${effort} (an unsupported level fails mid-run)`);
  }
  return { cli: "codex", model: m.slug, name: codexName(m.slug), effort, pickerModel: codexName(m.slug) };
}

// Muse Code runs Meta's models by catalog id (`muse-wonder-1.0`); a bare line
// ("muse spark") picks its newest release. A first release goes by its bare
// name, as Meta calls it ("Muse Wonder").
function resolveMuse(words, effort, spec) {
  const models = museTable();
  const joined = words.join("-");
  const hits = models.filter((m) => m.id === joined || m.id.startsWith(`${joined}-`)).sort((a, b) => b.released.localeCompare(a.released));
  if (hits.length === 0) throw new Error(`"${spec}": unknown Muse Code model; pick one of ${models.map((m) => m.id).join(", ")}`);
  const m = hits.find((h) => h.id === joined) || hits[0];
  if (effort && !m.efforts.includes(effort)) throw new Error(`"${spec}": ${m.id} supports ${m.efforts.join(", ")}, not ${effort}`);
  const [, line, version] = /^(.*?)(?:-([\d.]+))?$/.exec(m.id);
  const name = [...line.split("-").map(title), version !== "1.0" && version].filter(Boolean).join(" ");
  return { cli: "muse", model: m.id, name, effort, pickerModel: null };
}

// Cursor lists most levels as their own slug (`grok-4.7-xhigh`, some with a
// `cursor-` prefix) and takes any level it has as `<model>[effort=<level>]`;
// a model with no Effort setting (`gemini-3.1-pro`) runs at one fixed level.
// An effort is never swapped for another. The `-fast` variants are left out,
// and so are the Claude, GPT and Muse models it lists, which run in their own
// CLIs.
function resolveCursor(words, effort, spec, probe = true) {
  const models = cursorTable().filter((m) => !/^(claude|gpt|muse)-/.test(m.slug));
  const joined = words.join("-");
  const base = (slug) => slug.replace(/^cursor-/, "");
  const levels = models.filter((m) => new RegExp(`^${joined.replace(/\./g, "\\.")}-(${CURSOR_EFFORTS.join("|")})$`).test(base(m.slug)));
  const bare = models.find((m) => base(m.slug) === joined);
  const known = bare || levels[0];
  if (!known) {
    const list = [
      ...new Set(models.map((m) => base(m.slug).replace(/-fast$/, "").replace(new RegExp(`-(${CURSOR_EFFORTS.join("|")})$`), ""))),
    ];
    throw new Error(`"${spec}": unknown Cursor model; pick one of ${list.join(", ")}`);
  }
  const efforts = levels.map((m) => base(m.slug).slice(joined.length + 1));
  let model = effort ? levels.find((m) => base(m.slug) === `${joined}-${effort}`)?.slug : bare?.slug;
  if (!model && effort && probe) {
    const prefix = known.slug.startsWith("cursor-") ? "cursor-" : "";
    model = [...new Set([`${prefix}${joined}`, joined])].map((id) => `${id}[effort=${effort}]`).find(cursorAccepts);
  }
  if (!model) {
    if (effort && efforts.length) throw new Error(`"${spec}": Cursor has ${joined} at ${efforts.join(", ")}, not ${effort}`);
    if (effort) throw new Error(`"${spec}": Cursor runs ${joined} at one fixed level, with no effort to set; leave ${effort} off`);
    throw new Error(`"${spec}": Cursor has no bare ${joined}; add a level (${efforts.join(", ")})`);
  }
  const name = known.display
    .replace(/\b(Extra High|Minimal|Low|Medium|High|Max|Fast)\b/g, "")
    .replace(/\b\d+[KM]\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return { cli: "cursor", model, name, effort, pickerModel: null };
}

// The word viewers search for ("claude vs grok"), not the CLI running it: a
// Cursor model goes by its own name, except Cursor's own Composer.
function brandOf(r) {
  if (r.cli === "claude") return "Claude";
  if (r.cli === "codex") return "ChatGPT";
  const first = r.name.split(" ")[0];
  return first.toLowerCase() === "composer" ? "Cursor" : first;
}

// A GPT model, or a word naming one of Codex's models ("astra").
const isCodexModel = (word) =>
  word.startsWith("gpt") || (fs.existsSync(CODEX_CACHE) && codexTable().some((m) => !m.hidden && m.slug.split("-").includes(word)));

// "ultracode" in a Claude spec ("opus 5.5 medium ultracode"): Claude Code's
// standing dynamic-workflow orchestration on top of the effort, offered on the
// models that orchestrate (not Haiku).
const ULTRACODE = /\bult?ra[\s-]?code\b/;
const ULTRACODE_FAMILIES = new Set(["fable", "opus", "sonnet"]);

// `effort` is the race's own, for a side that names none. `probe: false` never
// asks Cursor CLI about a level it doesn't list (that launches it and touches
// the user's Cursor config); such a level is then unknown.
function resolve(spec, effort = null, { probe = true } = {}) {
  const lower = spec.toLowerCase();
  const ultracode = ULTRACODE.test(lower);
  const raw = lower
    .replace(ULTRACODE, " ")
    .replace(/\b(claude code|claude|codex|openai|anthropic|cursor|in)\b/g, " ")
    .replace(/[·,]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (raw.length === 0) throw new Error(`"${spec}": no model named`);
  const split = splitEffort(raw);
  const words = split.words;
  const wanted = split.effort || (effort && (EFFORT_ALIASES[effort.toLowerCase().replace(/\s+/g, "-")] || effort.toLowerCase()));
  // Claude models run in Claude Code, GPT models in Codex and Meta's Muse
  // models in Muse Code, even though Cursor lists them; every other model runs
  // in Cursor CLI.
  const claude = new Set(claudeTable().models.map((m) => m.family));
  const r = claude.has(words[0])
    ? resolveClaude(words, wanted, spec)
    : words[0] === "muse"
      ? resolveMuse(words, wanted, spec)
      : isCodexModel(words[0])
        ? resolveCodex(words, wanted, spec)
        : resolveCursor(words, wanted, spec, probe);
  if (ultracode && !(r.cli === "claude" && ULTRACODE_FAMILIES.has(words[0]))) {
    throw new Error(`"${spec}": ultracode is Claude Code's, on Fable, Opus and Sonnet only`);
  }
  const level = [r.effort, ultracode && "ultracode"].filter(Boolean);
  const label = [r.name, ...level].join(" · ");
  // Cursor gets the prompt as its launch argument (beats.js), which it
  // submits once it is up; --trust skips the new folder's trust prompt, and
  // --force lets its shell calls run, as Codex's sandbox does, rather than
  // stop the race on an approval. Ultracode's Workflow tool waits on a review
  // under acceptEdits, so it is allowed up front. Bash is denied outright: a
  // shell call waits on an approval nobody gives, and ultracode's reviewers
  // make one to check their arithmetic (both before --permission-mode: these
  // flags take the words after them as more tools). Muse Code gets its prompt
  // the way Cursor does; its contributor mode, on by default, swaps the model
  // for the catalog's discounted contributor one and lets Meta use the
  // session's content. --trust-workspace skips the copy's trust prompt without
  // saving trust, and its shell is off for the reason Claude's Bash is.
  const cmd = {
    claude: [
      "claude",
      "--model",
      r.model,
      r.effort && `--effort ${r.effort}`,
      ultracode && "--allowedTools Workflow",
      "--disallowedTools Bash",
      "--permission-mode acceptEdits",
    ],
    codex: ["codex", "-m", r.model, r.effort && `-c model_reasoning_effort=${r.effort}`, "-c check_for_update_on_startup=false"],
    cursor: ["agent", "--model", r.model.includes("[") ? `'${r.model}'` : r.model, "--trust", "--force"],
    muse: ["muse", "--model", r.model, r.effort && `--effort ${r.effort}`, "--contributor-mode off", "--trust-workspace", "--disable-shell"],
  }[r.cli];
  return {
    ...r,
    ultracode,
    label,
    brand: brandOf(r),
    headline: [r.name, ...level].join(" "),
    spokenEffort: level.map((l) => SPOKEN_EFFORT[l] || l).join(" ") || null,
    pickerEffort: r.effort ? (r.effort === "xhigh" ? "Extra High" : title(r.effort)) : null,
    dir: [r.name, ...level].join(" ").toLowerCase().replace(/[^a-z0-9.]+/g, "-"),
    emoji: { claude: "✻", codex: "◆", cursor: "⬢", muse: "∞" }[r.cli],
    cmd: cmd.filter(Boolean).join(" "),
  };
}

// Every model a race can run right now, one row per model, from the same
// tables `resolve` reads; a CLI that isn't installed is left out.
function catalog() {
  const rows = [];
  const add = (cli, table, toRows) => {
    try {
      rows.push(...toRows(table()).map((r) => ({ cli, ...r })));
    } catch {}
  };
  add("claude", claudeTable, (t) => t.models.map((m) => ({ id: m.id, name: m.name })));
  add("codex", codexTable, (t) => t.filter((m) => !m.hidden).map((m) => ({ id: m.slug, name: codexName(m.slug) })));
  add("muse", museTable, (t) => t.map((m) => ({ id: m.id, name: m.id })));
  add("cursor", cursorTable, (t) => t.filter((m) => !/^(claude|gpt|muse)-/.test(m.slug)).map((m) => ({ id: m.slug, name: m.display })));
  return rows;
}

module.exports = { resolve, catalog };

if (require.main === module) {
  const args = process.argv.slice(2);
  const at = args.indexOf("--effort");
  const effort = at >= 0 ? args[at + 1] : null;
  const specs = at >= 0 ? args.filter((a, i) => i !== at && i !== at + 1) : args;
  if (specs.length === 0 || (at >= 0 && !effort)) {
    console.error('usage: node models.js "opus 5.5 max" "gpt 6 astra ultra" [--effort <level for sides that name none>]');
    process.exit(1);
  }
  try {
    console.log(JSON.stringify(specs.map((spec) => resolve(spec, effort)), null, 2));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
