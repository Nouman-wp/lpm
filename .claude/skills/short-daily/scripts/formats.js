#!/usr/bin/env node
// node formats.js <command> [--state <dir>]
//   list                        every format with its verdict, kind and tags
//   show <id>                   one format, its whole prompt included
//   add <format.json>           add a format you wrote to <state>/formats.json, once it passes the checks
//   retire <id> --reason "…"    leave a format out of picks (--undo puts it back)
//   new <id> "<A>" "<B>" [--effort e] [--slot s] [--fresh] [--slug s] [--force]
//                               write the lesson through short-race or short-game, stamped with its format
//   posted <slug> [--youtube <url>] [--tiktok <url>] [--at <iso>] [--slot s] [--fresh]
//                               log a post in <state>/posts.json; the links come from state.json for today's slug
//   report [--json]             each format's score per platform, the tags, the baselines and the last posts
//   pick                        today's slot for a run that experiments
//   backfill [--fresh <video id>]...
//                               log the races posted before posts.json existed (safe to rerun)
// Everything it reads is our own: catalog, ledgers, numbers. No viewer text.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { TIKTOK, DEFAULT_STATE, load, check, formatOf, readJson, writeAtomic } = require("./catalog");
const { PLATFORMS, SHORT, compute, pick, fmt } = require("./scores");

const SKILLS = path.resolve(__dirname, "..", "..");
const RACE_NEW = path.join(SKILLS, "short-race/scripts/new.js");
const GAME_NEW = path.join(SKILLS, "short-game/scripts/new.js");
const FRESH_DAYS = 7;
const SLOTS = ["new", "retest", "control", "request", "legacy"];

const [command, ...args] = process.argv.slice(2);
const VALUE_FLAGS = ["--state", "--effort", "--slot", "--slug", "--youtube", "--tiktok", "--at", "--reason", "--fresh"];
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const all = (name) => args.flatMap((a, i) => (a === name && args[i + 1] && !args[i + 1].startsWith("--") ? [args[i + 1]] : []));
const has = (name) => args.includes(name);
// --fresh is a switch for new and posted, and takes a video id in backfill.
const positional = args.filter((a, i) => !a.startsWith("--") && !(VALUE_FLAGS.includes(args[i - 1]) && (args[i - 1] !== "--fresh" || command === "backfill")));
function fail(message) {
  console.error(`formats.js${command ? ` ${command}` : ""}: ${message}`);
  process.exit(1);
}

const STATE = path.resolve(opt("--state") || DEFAULT_STATE);
const POSTS = path.join(STATE, "posts.json");
const cat = load(STATE);
const today = new Date().toLocaleDateString("sv-SE");
const ytId = (url) => /(?:shorts\/|[?&]v=)([\w-]{11})/.exec(url || "")?.[1] || null;
const ttId = (url) => /\/video\/(\d+)/.exec(url || "")?.[1] || null;
const getFormat = (id) => cat.byId.get(id) || fail(`no format "${id}"; formats.js list shows them`);

function slotFor(id) {
  const s = compute(STATE, cat).formats.find((f) => f.id === id);
  return { idea: "new", winner: "control", steady: "control" }[s.verdict] || "retest";
}

// A side is fresh when its model first showed up in research.js's list less
// than a week before `day`; the models seen on its first run are the baseline.
function freshSide(compare, day) {
  const seen = readJson(path.join(STATE, "models-seen.json"), {});
  const since = new Date(Date.parse(day) - FRESH_DAYS * 864e5).toLocaleDateString("sv-SE");
  return [compare.a, compare.b].some((s) => {
    const m = String(s?.model || "").replace(/-(minimal|low|medium|high|xhigh|max)$/, "");
    const r = seen[`${s?.cli}:${s?.model}`] || seen[`${s?.cli}:${m}`];
    return Boolean(r && !r.baseline && r.firstSeen >= since);
  });
}

function upsert(entry) {
  const ledger = readJson(POSTS, { posts: [] });
  const i = ledger.posts.findIndex((p) => p.slug === entry.slug);
  const merged = i >= 0 ? { ...ledger.posts[i], ...Object.fromEntries(Object.entries(entry).filter(([, v]) => v != null)) } : entry;
  if (i >= 0) ledger.posts[i] = merged;
  else ledger.posts.push(merged);
  writeAtomic(POSTS, ledger);
  return merged;
}

const commands = {
  list() {
    const stats = new Map(compute(STATE, cat).formats.map((s) => [s.id, s]));
    for (const f of cat.formats) {
      const s = stats.get(f.id);
      console.log(`${f.id.padEnd(12)} ${s.verdict.padEnd(8)} ${`${f.kind}/${f.packaging}`.padEnd(12)} ${f.by.padEnd(5)} ${f.subject}  [${(f.tags || []).join(", ")}]${f.excluded ? `  (out: ${f.excluded})` : ""}`);
    }
  },

  show() {
    const f = getFormat(positional[0]);
    console.log(JSON.stringify({ ...f, promptLength: f.prompt.length }, null, 2));
  },

  add() {
    const file = positional[0] || fail("usage: formats.js add <format.json>");
    let entry;
    try {
      entry = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (e) {
      fail(`${file}: ${e.message}`);
    }
    const problems = check(entry, new Set(cat.byId.keys()));
    if (problems.length) fail(`${file} can't go in:\n  ${problems.join("\n  ")}`);
    cat.own.formats.push({ ...entry, added: today });
    writeAtomic(cat.file, cat.own);
    const f = load(STATE).byId.get(entry.id);
    console.log(`added ${f.id} (${f.kind}/${f.packaging}, ${f.prompt.length}-character prompt) to ${cat.file}\n  prompt: ${f.prompt}`);
  },

  retire() {
    const f = getFormat(positional[0]);
    cat.own.out = cat.own.out || {};
    if (has("--undo")) delete cat.own.out[f.id];
    else cat.own.out[f.id] = { reason: opt("--reason") || fail('give the --reason "…"'), at: today };
    writeAtomic(cat.file, cat.own);
    console.log(has("--undo") ? `${f.id} is back in the picks` : `${f.id} is left out of picks: ${cat.own.out[f.id].reason}`);
  },

  new() {
    const [id, A, B] = positional;
    if (!B) fail('usage: formats.js new <format> "<model A>" "<model B>" [--effort e] [--slot s] [--fresh] [--slug s] [--force]');
    const f = getFormat(id);
    if (f.excluded) console.log(`note: ${f.id} is left out of picks (${f.excluded})`);
    const slot = opt("--slot") || slotFor(f.id);
    if (!SLOTS.includes(slot)) fail(`--slot is one of ${SLOTS.join(", ")}`);
    const effort = opt("--effort");
    const throughGame = f.packaging === "build";
    // short-game raises a bare Claude side to high itself and takes each side's
    // effort in its spec, so a race-wide effort can't be passed on.
    if (effort && throughGame) fail(`${f.id} is made through short-game: put each side's effort in its spec ("opus 5.5 ${effort}")`);
    let argv;
    let gameFile = null;
    if (f.house === "giraffe") argv = [RACE_NEW, A, B];
    else if (!throughGame) argv = [RACE_NEW, A, B, "--prompt", f.prompt, "--subject", f.subject, "--noun", f.noun, "--emoji", f.emoji];
    else if (f.game) argv = [GAME_NEW, A, B, "--game", f.game];
    else {
      gameFile = path.join(os.tmpdir(), `lpm-format-${f.id}-${process.pid}.json`);
      const { id: key, prompt, subject, noun, headline, caption, what } = f;
      fs.writeFileSync(gameFile, JSON.stringify({ key, slug: key, prompt, subject, noun, headline, caption, what }));
      argv = [GAME_NEW, A, B, "--game-file", gameFile];
    }
    if (effort) argv.push("--effort", effort);
    if (opt("--slug")) argv.push("--slug", opt("--slug"));
    if (has("--force")) argv.push("--force");
    let out;
    try {
      out = execFileSync(process.execPath, argv, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
    } catch {
      process.exit(1);
    } finally {
      if (gameFile) fs.rmSync(gameFile, { force: true });
    }
    const slug = out.split("\n")[0].trim();
    const file = path.join(TIKTOK, slug, "compare.json");
    const compare = readJson(file);
    const fresh = has("--fresh") || freshSide(compare, today);
    fs.writeFileSync(file, JSON.stringify({ ...compare, format: f.id, slot, ...(fresh ? { fresh } : {}) }, null, 2) + "\n");
    console.log(out.trimEnd());
    console.log(`  format:   ${f.id} (${f.kind}/${f.packaging}), slot ${slot}${fresh ? ", fresh release: left out of the format's score" : ""}`);
  },

  posted() {
    const slug = positional[0] || fail("usage: formats.js posted <slug> [--youtube <url>] [--tiktok <url>]");
    const compare = readJson(path.join(TIKTOK, slug, "compare.json"), null) || fail(`no ${path.join(TIKTOK, slug, "compare.json")}`);
    const state = readJson(path.join(STATE, "state.json"), {});
    const links = state.slug === slug ? state.links || {} : {};
    const youtube = ytId(opt("--youtube") || links.youtube);
    const tiktok = ttId(opt("--tiktok") || links.tiktok);
    if (!youtube && !tiktok) fail(`no link for ${slug}: pass --youtube and/or --tiktok`);
    const format = formatOf(compare, cat) || fail(`can't tell ${slug}'s format: set "format" in its compare.json to one of formats.js list`);
    // The other platform's half can post days later: the first half's time and
    // slot stay.
    const before = readJson(POSTS, { posts: [] }).posts.find((p) => p.slug === slug);
    const at = opt("--at") || before?.at || [links.youtubeAt, links.tiktokAt].filter(Boolean).sort()[0] || new Date().toISOString();
    const fresh = has("--fresh") || compare.fresh || freshSide(compare, at.slice(0, 10)) || undefined;
    const slot = opt("--slot") || before?.slot || compare.slot || slotFor(format);
    if (!SLOTS.includes(slot)) fail(`--slot is one of ${SLOTS.join(", ")}`);
    const e = upsert({ slug, format, slot, fresh, at, a: compare.a?.label, b: compare.b?.label, youtube, tiktok });
    console.log(`logged ${e.slug}: ${e.format} (${e.slot}${e.fresh ? ", fresh" : ""}) · YT ${e.youtube || "–"} · TT ${e.tiktok || "–"} → ${POSTS}`);
  },

  backfill() {
    const fresh = new Set(all("--fresh"));
    const before = readJson(POSTS, { posts: [] }).posts;
    const known = new Set(before.flatMap((p) => PLATFORMS.map((k) => p[k] && `${k}:${p[k]}`).filter(Boolean)));
    const logged = [];
    // The two posting ledgers name each lesson folder, so their rows pair the
    // platforms and their format comes from compare.json.
    const ledger = (file, platform, idOf) => {
      const p = path.join(TIKTOK, file);
      if (!fs.existsSync(p)) return [];
      return fs.readFileSync(p, "utf8").split("\n").flatMap((l) => {
        const m = /^- (\d{4}-\d{2}-\d{2}) (\S+) (\S+)/.exec(l);
        return m && idOf(m[3]) ? [{ date: m[1], slug: m[2], platform, id: idOf(m[3]) }] : [];
      });
    };
    const bySlug = new Map();
    for (const r of [...ledger("SHORTS_POSTED.md", "youtube", ytId), ...ledger("POSTED.md", "tiktok", ttId)]) {
      const compare = readJson(path.join(TIKTOK, r.slug, "compare.json"), null);
      const format = compare && formatOf(compare, cat);
      if (!format || known.has(`${r.platform}:${r.id}`)) continue;
      const e = bySlug.get(r.slug) || { slug: r.slug, format, slot: "legacy", at: `${r.date}T12:00:00Z`, a: compare.a?.label, b: compare.b?.label };
      e[r.platform] = r.id;
      bySlug.set(r.slug, e);
    }
    for (const e of bySlug.values()) {
      for (const p of PLATFORMS) if (e[p]) known.add(`${p}:${e[p]}`);
      logged.push(e);
    }
    // Races posted without a ledger row are matched by the copy each format
    // writes: "the giraffe test" and "build <noun>" titles, "making <noun> with
    // AI" captions.
    const videos = readJson(path.join(STATE, "videos.json"), { videos: [] }).videos;
    const builds = cat.formats.filter((f) => f.packaging === "build");
    for (const v of videos) {
      if (known.has(`${v.platform}:${v.id}`)) continue;
      const text = v.platform === "youtube" ? v.title || "" : v.caption || "";
      const format =
        v.platform === "youtube"
          ? (/: the giraffe test$/.test(text) && "giraffe") || builds.find((f) => text.endsWith(` build ${f.noun}`))?.id
          : (/on the same prompt: a giraffe flying/.test(text) && "giraffe") || builds.find((f) => text.includes(`${f.caption}.`))?.id;
      if (!format) continue;
      logged.push({ slug: `legacy-${SHORT[v.platform].toLowerCase()}-${v.id}`, format, slot: "legacy", at: v.date ? `${v.date}T12:00:00Z` : null, [v.platform]: v.id });
    }
    for (const e of logged) {
      if (PLATFORMS.some((p) => fresh.has(e[p]))) e.fresh = true;
      upsert(e);
    }
    for (const id of fresh) if (!logged.some((e) => PLATFORMS.some((p) => e[p] === id))) console.log(`  --fresh ${id}: no race with that video id was logged now`);
    console.log(`logged ${logged.length} races (${logged.filter((e) => e.fresh).length} fresh) → ${POSTS}`);
    const by = {};
    for (const e of logged) by[e.format] = (by[e.format] || 0) + 1;
    console.log(`  ${Object.entries(by).map(([k, n]) => `${k} ${n}`).join(", ")}`);
  },

  report() {
    const r = compute(STATE, cat);
    if (has("--json")) return console.log(JSON.stringify({ formats: r.formats, tags: r.tags, baselines: r.baselines, posts: r.posts }, null, 1));
    const cell = (s) => (s.score == null ? "–" : `${fmt(s.score)} (${s.n || `${s.provisional}~`})`).padEnd(13);
    console.log("Formats: score = views over the median race post's at the same age (1.00× is average); (n) posts, ~ provisional; fresh-release posts left out");
    console.log(`  ${"format".padEnd(12)} ${"verdict".padEnd(18)} ${"YouTube".padEnd(13)} ${"TikTok".padEnd(13)} likes/1k  comments/1k  tags`);
    const order = { winner: 0, steady: 1, testing: 2, waiting: 3, flop: 4, idea: 5, out: 6 };
    for (const s of [...r.formats].sort((a, b) => order[a.verdict] - order[b.verdict] || b.posts - a.posts)) {
      const verdict = s.verdict === "winner" ? `winner on ${s.on.map((p) => SHORT[p]).join("+")}` : s.verdict;
      const rate = (x) => (x == null ? "–" : x.toFixed(1)).padEnd(9);
      console.log(`  ${s.id.padEnd(12)} ${verdict.padEnd(18)} ${cell(s.youtube)} ${cell(s.tiktok)} ${rate(s.likes)} ${rate(s.comments)}   ${s.tags.join(", ")}`);
    }
    const tags = r.tags.filter((t) => t.youtube.n || t.tiktok.n).sort((a, b) => b.youtube.n + b.tiktok.n - (a.youtube.n + a.tiktok.n));
    console.log(`Tags: ${tags.map((t) => `${t.tag} YT ${fmt(t.youtube.score)} TT ${fmt(t.tiktok.score)}`).join(" · ") || "none scored yet"}`);
    console.log(`Baselines (median views): ${PLATFORMS.map((p) => `${SHORT[p]} ${["d1", "d3", "d7"].map((b) => `${b} ${r.baselines[`${p}.${b}`].median ?? "–"} (${r.baselines[`${p}.${b}`].n})`).join(", ")}`).join(" | ")}`);
    console.log("Last posts:");
    const rows = (slug) => r.rows.filter((x) => x.slug === slug);
    for (const p of [...r.posts].filter((p) => p.at).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8)) {
      const per = rows(p.slug).map((x) => `${SHORT[x.platform]} ${x.m ? `${x.m.latest.views} views @ ${x.m.age == null ? "?" : `${Math.round(x.m.age)}h`}` : "no numbers yet"}${x.lift !== undefined ? ` ${fmt(x.lift)}${x.provisional ? "~" : ""}` : ""}`);
      console.log(`  ${p.at.slice(0, 10)} ${p.format.padEnd(10)} ${p.slot.padEnd(8)} ${p.fresh ? "fresh " : ""}${p.slug}: ${per.join(" · ")}`);
    }
  },

  pick() {
    const r = compute(STATE, cat);
    const { slots, asked, behind } = pick(STATE, cat, r);
    console.log(`Today's slot, best first (a viewer request that names a format still comes first; ${behind ? `${SHORT[behind]} is behind lately` : "no platform clearly behind"}):`);
    for (const s of slots) {
      const f = s.id && cat.byId.get(s.id);
      console.log(`  ${s.slot.padEnd(8)} ${(s.id || "(invent)").padEnd(12)} ${s.why}${f ? ` · ${f.subject} · ${f.hypothesis}` : ""}`);
    }
    const askedLine = Object.entries(asked).map(([k, n]) => `${k} ${n}`).join(", ");
    console.log(`Formats viewers asked for (comments): ${askedLine || "none"}`);
  },
};

if (!commands[command]) {
  console.error(fs.readFileSync(__filename, "utf8").split("\n").slice(1, 16).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
  process.exit(2);
}
commands[command]();
