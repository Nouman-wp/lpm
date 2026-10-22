// The formats a race is made in: the prompt both models get and the copy
// around it. House formats and ideas are in formats.json next to this file,
// the games in short-game's games.js. The formats a run invents go to
// <state>/formats.json through `formats.js add`, never into the repo.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { GAMES, prompt: gamePrompt } = require("../../short-game/scripts/games");
const { GIRAFFE } = require("../../short-race/scripts/prompt");

const TIKTOK = process.env.LPM_TIKTOK_DIR || path.join(process.env.LPM_LESSONS_DIR || path.join(os.homedir(), "Movies/lpm-lessons"), "tiktok");
const DEFAULT_STATE = path.join(TIKTOK, "_daily");
const SEED = path.join(__dirname, "formats.json");
// A Claude or Codex copy gets the prompt on a launch line that macOS cuts off
// at 1024 bytes; this leaves room for the command around it.
const PROMPT_MAX = 850;
const ID = /^[a-z][a-z0-9-]{1,23}$/;
const TAG = /^[a-z0-9][a-z0-9-]{1,23}$/;
const KINDS = ["scene", "game", "page"];
const PACKAGING = ["test", "build"];
const LIMITS = { build: 140, details: 260, layout: 320, fill: 40, restart: 160, subject: 60, noun: 30, emoji: 8, what: 80, headline: 60, caption: 80, hypothesis: 300 };
const REQUIRED = {
  scene: ["build", "layout", "subject", "noun", "emoji", "hypothesis"],
  game: ["build", "details", "layout", "restart", "subject", "noun", "emoji", "hypothesis"],
  page: ["build", "details", "layout", "subject", "noun", "emoji", "hypothesis"],
};
const RUN_FIELDS = new Set(["id", "kind", "packaging", "tags", ...Object.keys(LIMITS)]);

const PROMPTS = {
  scene: (f) =>
    `Build ${f.build}, in index.html at the project root. One file, no libraries or images. ${f.details ? `${f.details} ` : ""}` +
    "It's shown in a panel a bit wider than tall, of any size. " +
    `Lay the scene out on a 900x700 stage: ${f.layout}. ` +
    `Scale the whole stage to fit the panel, centered, never cropped; ${f.fill || "the background"} fills the rest. No scrolling. ` +
    "Animate forever. Don't open it. Don't run or test it. No questions, just write it.",
  game: (f) => gamePrompt({ build: f.build, play: f.details, layout: f.layout, restart: f.restart }),
  page: (f) =>
    `Build ${f.build}, in index.html at the project root. One file, no libraries, no external images or fonts: draw any art with CSS or inline SVG. ${f.details} ` +
    "It's shown in a panel a bit wider than tall, of any size. " +
    `Lay its first screen out on a 900x700 stage: ${f.layout}. ` +
    "Scale the whole stage to fit the panel, centered, never cropped; the background fills the rest. No scrolling. " +
    "Give it gentle motion that never stops. Don't open it. Don't run or test it. No questions, just write it.",
};

const readJson = (file, fallback) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : fallback);
function writeAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 1) + "\n");
  fs.renameSync(tmp, file);
}

const sentence = (s) => (s && !/[.!?]$/.test(s) ? `${s}.` : s);
const bare = (s) => s?.replace(/[.!]+$/, "");
function tidy(e) {
  const t = { ...e };
  for (const k of Object.keys(LIMITS)) if (typeof t[k] === "string") t[k] = t[k].trim().replace(/\s+/g, " ");
  for (const k of ["build", "layout", "fill", "subject", "noun", "what"]) t[k] = bare(t[k]);
  t.details = sentence(t.details);
  t.restart = sentence(t.restart);
  return t;
}

// A format as the scripts use it: its prompt and every line of copy filled in.
function expand(e, by) {
  if (e.house === "giraffe") return { packaging: "test", by: "house", ...e, prompt: GIRAFFE };
  if (e.game) {
    const g = GAMES[e.game];
    const emoji = g.headline.split(" ").at(-1);
    return { kind: "game", packaging: "build", by: "house", subject: g.subject, noun: g.noun, emoji, headline: g.headline, caption: g.caption, what: g.what, ...e, prompt: gamePrompt(g) };
  }
  const f = tidy(e);
  const packaging = f.packaging || (f.kind === "scene" ? "test" : "build");
  return {
    by,
    ...f,
    packaging,
    headline: f.headline || `build ${f.noun} ${f.emoji}`,
    caption: f.caption || `making ${f.noun} with AI`,
    what: f.what || f.build,
    prompt: PROMPTS[f.kind]?.(f),
  };
}

// What's wrong with a format a run wrote; empty when it can go in.
function check(e, taken) {
  const problems = [];
  if (typeof e !== "object" || !e || Array.isArray(e)) return ["a format is one JSON object"];
  for (const k of Object.keys(e)) if (!RUN_FIELDS.has(k)) problems.push(`unknown field ${k}`);
  if (!ID.test(e.id || "")) problems.push("id: lowercase letters, digits and hyphens, 2–24 long, starting with a letter");
  else if (taken.has(e.id)) problems.push(`id ${e.id} is taken`);
  if (!KINDS.includes(e.kind)) return [...problems, `kind: one of ${KINDS.join(", ")}`];
  if (e.packaging !== undefined && !PACKAGING.includes(e.packaging)) problems.push(`packaging: one of ${PACKAGING.join(", ")}`);
  for (const k of REQUIRED[e.kind]) if (typeof e[k] !== "string" || !e[k].trim()) problems.push(`${k} is required`);
  for (const [k, max] of Object.entries(LIMITS)) {
    if (e[k] === undefined) continue;
    if (typeof e[k] !== "string") problems.push(`${k} is text`);
    else if (e[k].length > max) problems.push(`${k} is ${e[k].length} characters, at most ${max}`);
    else if (/[\u0000-\u001f\u007f`$\\]/.test(e[k])) problems.push(`${k} has a control character, backtick, $ or backslash`);
  }
  if (typeof e.emoji === "string" && /[A-Za-z0-9]/.test(e.emoji)) problems.push("emoji: emoji only");
  if (!Array.isArray(e.tags) || !e.tags.length || e.tags.length > 5 || !e.tags.every((t) => TAG.test(t))) problems.push("tags: 1–5 ids such as animal, game, benchmark");
  if (problems.length) return problems;
  const { prompt } = expand(e, "run");
  if (prompt.length > PROMPT_MAX) problems.push(`the prompt is ${prompt.length} characters, at most ${PROMPT_MAX}: shorten build, details or layout`);
  return problems;
}

function load(state = DEFAULT_STATE) {
  const seed = readJson(SEED).formats;
  const own = readJson(path.join(state, "formats.json"), { formats: [], out: {} });
  const listed = new Set(seed.map((e) => e.game).filter(Boolean));
  const games = Object.keys(GAMES)
    .filter((k) => !listed.has(k))
    .map((k) => ({ id: k, game: k, tags: ["game"], hypothesis: "A game from short-game's catalog." }));
  const formats = [...seed.map((e) => expand(e, "seed")), ...games.map((e) => expand(e, "house")), ...own.formats.map((e) => expand(e, "run"))];
  for (const f of formats) if (own.out?.[f.id]) f.excluded = own.out[f.id].reason;
  return { formats, byId: new Map(formats.map((f) => [f.id, f])), own, file: path.join(state, "formats.json") };
}

// The format a lesson folder was made in, for lessons written before the
// catalog stamped it into compare.json.
function formatOf(compare, cat) {
  if (compare.format && cat.byId.has(compare.format)) return compare.format;
  const exact = cat.formats.find((f) => f.prompt === compare.prompt);
  if (exact) return exact.id;
  if (compare.game && cat.byId.has(compare.game)) return compare.game;
  // Older layouts changed the stage, not the opening: "Build a 3D endless runner…".
  const text = compare.prompt || "";
  const game = Object.keys(GAMES).find((k) => text.startsWith(`Build ${GAMES[k].build}`) && cat.byId.has(k));
  if (game) return game;
  const own = cat.formats.find((f) => f.build && text.startsWith(`Build ${f.build}`));
  if (own) return own.id;
  if (/giraffe/i.test(text)) return "giraffe";
  if (/website|landing page/i.test(text)) return "website";
  return null;
}

module.exports = { TIKTOK, DEFAULT_STATE, PROMPT_MAX, load, check, expand, formatOf, readJson, writeAtomic };
