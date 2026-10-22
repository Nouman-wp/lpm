// How each format does, from our own numbers only (posts.json and views.jsonl).
// A post's lift on a platform is its views over the median race post's views
// at the same age there: d1 about a day after posting, d3 about three days,
// d7 a week or more. A format's score on a platform is the geometric mean of
// its posts' lifts, so one viral matchup can't carry it. A post whose matchup
// had a model out for under a week (`fresh`) measures the release, not the
// format: it is shown but left out of every score and baseline.
const fs = require("fs");
const path = require("path");
const { readJson } = require("./catalog");

const PLATFORMS = ["youtube", "tiktok"];
const SHORT = { youtube: "YT", tiktok: "TT" };
const BUCKETS = [
  { id: "d1", target: 24, lo: 16, hi: 36 },
  { id: "d3", target: 72, lo: 54, hi: 96 },
  { id: "d7", target: 168, lo: 132, hi: Infinity },
];
const BASE_MIN = 3;
const WIN = 1.25;
const FLOP = 0.6;
const ONE_POST_FLOP = 0.35;
const RETEST_MIN = 0.6;
const RECENT = 5;

function snapshots(state) {
  const by = new Map();
  const file = path.join(state, "views.jsonl");
  if (!fs.existsSync(file)) return by;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    const at = Date.parse(row.at);
    for (const v of row.videos || []) {
      if (v.views == null || !v.id) continue;
      const key = `${v.p}:${v.id}`;
      if (!by.has(key)) by.set(key, []);
      by.get(key).push({ at, views: v.views, likes: v.likes ?? 0, comments: v.comments ?? 0 });
    }
  }
  return by;
}

// Each bucket's snapshot nearest its target age. A post with no known time is
// an old one: its latest numbers stand for its first week.
function measure(post, platform, snaps) {
  const list = snaps.get(`${platform}:${post[platform]}`) || [];
  if (!list.length) return null;
  const latest = list.reduce((a, s) => (s.at > a.at ? s : a));
  const posted = post.at ? Date.parse(post.at) : NaN;
  if (Number.isNaN(posted)) return { latest, buckets: { d7: latest } };
  const buckets = {};
  for (const b of BUCKETS) {
    let best = null;
    for (const s of list) {
      const age = (s.at - posted) / 3600e3;
      if (age >= b.lo && age <= b.hi && (!best || Math.abs(age - b.target) < Math.abs(best.age - b.target))) best = { ...s, age };
    }
    if (best) buckets[b.id] = best;
  }
  return { latest, buckets, age: (latest.at - posted) / 3600e3 };
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const geomean = (xs) => Math.exp(xs.reduce((a, x) => a + Math.log(Math.max(x, 0.01)), 0) / xs.length);

// rows: one per post and platform. The lift uses the most mature age that
// has a baseline of BASE_MIN other posts; with none yet, the post's latest age
// against the most mature baseline there is, marked provisional.
function lifts(rows) {
  const at = (p, b) => rows.filter((r) => r.platform === p && !r.fresh && r.m?.buckets[b]);
  for (const r of rows) {
    if (!r.m) continue;
    const own = [...BUCKETS].reverse().filter((b) => r.m.buckets[b.id]);
    for (const b of own) {
      const others = at(r.platform, b.id).filter((o) => o.slug !== r.slug);
      if (others.length < BASE_MIN) continue;
      const base = median(others.map((o) => o.m.buckets[b.id].views));
      r.lift = r.m.buckets[b.id].views / Math.max(base, 1);
      r.bucket = b.id;
      break;
    }
    if (r.lift !== undefined || !own.length) continue;
    const fallback = [...BUCKETS].reverse().find((b) => at(r.platform, b.id).filter((o) => o.slug !== r.slug).length >= BASE_MIN);
    if (!fallback) continue;
    const base = median(at(r.platform, fallback.id).filter((o) => o.slug !== r.slug).map((o) => o.m.buckets[fallback.id].views));
    r.lift = r.m.buckets[own[0].id].views / Math.max(base, 1);
    r.bucket = own[0].id;
    r.provisional = true;
  }
}

function verdictOf(byPlatform, posts, excluded) {
  if (excluded) return { verdict: "out", why: excluded };
  if (!posts) return { verdict: "idea" };
  const seen = PLATFORMS.filter((p) => byPlatform[p].n);
  if (!seen.length) return { verdict: byPlatform.youtube.provisional + byPlatform.tiktok.provisional ? "testing" : "waiting" };
  const wins = seen.filter((p) => byPlatform[p].n >= 2 && byPlatform[p].score >= WIN);
  if (wins.length) return { verdict: "winner", on: wins };
  const flop = seen.every((p) => (byPlatform[p].n >= 2 ? byPlatform[p].score <= FLOP : byPlatform[p].score <= ONE_POST_FLOP));
  if (flop) return { verdict: "flop" };
  return { verdict: seen.some((p) => byPlatform[p].n >= 2) ? "steady" : "testing" };
}

function compute(state, cat) {
  const posts = readJson(path.join(state, "posts.json"), { posts: [] }).posts;
  const snaps = snapshots(state);
  const rows = posts.flatMap((post) =>
    PLATFORMS.filter((p) => post[p]).map((platform) => ({ slug: post.slug, format: post.format, fresh: Boolean(post.fresh), platform, m: measure(post, platform, snaps) })),
  );
  lifts(rows);
  const formats = cat.formats.map((f) => {
    const mine = rows.filter((r) => r.format === f.id);
    const byPlatform = {};
    for (const p of PLATFORMS) {
      const scored = mine.filter((r) => r.platform === p && !r.fresh && r.lift !== undefined);
      const firm = scored.filter((r) => !r.provisional);
      const use = firm.length ? firm : scored;
      byPlatform[p] = { n: firm.length, provisional: scored.length - firm.length, score: use.length ? geomean(use.map((r) => r.lift)) : null };
    }
    const latest = mine.filter((r) => r.m);
    const views = latest.reduce((a, r) => a + r.m.latest.views, 0);
    const per1k = (k) => (views ? (latest.reduce((a, r) => a + r.m.latest[k], 0) / views) * 1000 : null);
    const slugs = new Set(mine.map((r) => r.slug));
    return { id: f.id, by: f.by, tags: f.tags || [], posts: slugs.size, ...byPlatform, likes: per1k("likes"), comments: per1k("comments"), ...verdictOf(byPlatform, slugs.size, f.excluded) };
  });
  const tagNames = [...new Set(cat.formats.flatMap((f) => f.tags || []))];
  const tags = tagNames.map((tag) => {
    const ids = new Set(cat.formats.filter((f) => f.tags?.includes(tag)).map((f) => f.id));
    const out = { tag };
    for (const p of PLATFORMS) {
      const ls = rows.filter((r) => ids.has(r.format) && r.platform === p && !r.fresh && r.lift !== undefined && !r.provisional).map((r) => r.lift);
      out[p] = { n: ls.length, score: ls.length ? geomean(ls) : null };
    }
    return out;
  });
  const baselines = {};
  for (const p of PLATFORMS)
    for (const b of BUCKETS) {
      const vs = rows.filter((r) => r.platform === p && !r.fresh && r.m?.buckets[b.id]).map((r) => r.m.buckets[b.id].views);
      baselines[`${p}.${b.id}`] = { n: vs.length, median: vs.length ? median(vs) : null };
    }
  return { posts, rows, formats, tags, baselines };
}

// The platform the recent posts do worse on, by their median lift.
function lagging(result) {
  const recent = [...result.posts].filter((p) => p.at && !p.fresh).sort((a, b) => b.at.localeCompare(a.at)).slice(0, RECENT);
  const slugs = new Set(recent.map((p) => p.slug));
  const m = PLATFORMS.map((p) => {
    const ls = result.rows.filter((r) => slugs.has(r.slug) && r.platform === p && r.lift !== undefined).map((r) => r.lift);
    return { p, lift: ls.length ? median(ls) : null };
  }).filter((x) => x.lift !== null);
  return m.length === 2 ? (m[0].lift <= m[1].lift ? m[0].p : m[1].p) : null;
}

// Formats viewers asked for, by distinct comments; `other` is any prompt the
// catalog doesn't have.
function demand(state, cat) {
  const labels = readJson(path.join(state, "labels.json"), { comments: [] });
  const asked = {};
  for (const c of labels.comments || []) {
    const f = c.request?.format;
    if (f && f !== "none" && (f === "other" || cat.byId.has(f))) asked[f] = (asked[f] || 0) + 1;
  }
  return asked;
}

// Today's slot for an experimenting run, best first: a format viewers asked
// for; a control day with the best format after two experiments in a row (so
// a slow week shows as a slow week, not as a bad idea); a second matchup for
// a format that has one post; a new format.
function pick(state, cat, result) {
  const stat = new Map(result.formats.map((s) => [s.id, s]));
  const live = (id) => cat.byId.has(id) && !cat.byId.get(id).excluded && !["flop", "out"].includes(stat.get(id)?.verdict);
  const asked = demand(state, cat);
  const slots = [];
  for (const [id, n] of Object.entries(asked).sort((a, b) => b[1] - a[1]))
    if (id !== "other" && live(id)) slots.push({ slot: "request", id, why: `${n} viewer comment${n > 1 ? "s" : ""} asked for it` });

  const ordered = [...result.posts].filter((p) => p.at).sort((a, b) => b.at.localeCompare(a.at));
  const behind = lagging(result);
  const winners = result.formats.filter((s) => s.verdict === "winner" && live(s.id));
  const best = (p) => [...winners].sort((a, b) => (b[p]?.score || 0) - (a[p]?.score || 0))[0];
  const experiments = ordered.slice(0, 2).filter((p) => ["new", "retest"].includes(p.slot)).length;
  if (experiments === 2 && winners.length) {
    const p = behind || "tiktok";
    const w = best(p);
    slots.push({ slot: "control", id: w.id, why: `the last two posts were experiments; best on ${SHORT[p]}${behind ? `, which is behind` : ""} (${fmt(w[p].score)})` });
  }

  const retests = result.formats
    .filter((s) => live(s.id) && s.verdict === "testing" && s.posts === 1)
    .map((s) => ({ s, lift: Math.max(...PLATFORMS.map((p) => s[p].score ?? 0)) }))
    .filter((x) => x.lift >= RETEST_MIN || (x.s.youtube.provisional + x.s.tiktok.provisional && x.lift >= RETEST_MIN / 2))
    .sort((a, b) => b.lift - a.lift);
  for (const { s, lift } of retests) slots.push({ slot: "retest", id: s.id, why: `one post so far (best ${fmt(lift)}); a second matchup tells the format from the matchup` });

  const tried = new Map();
  for (const s of result.formats) if (s.posts) for (const t of s.tags) tried.set(t, (tried.get(t) || 0) + s.posts);
  const tagUse = (f) => (f.tags || []).reduce((a, t) => a + (tried.get(t) || 0), 0) / Math.max(f.tags?.length || 0, 1);
  const ideas = cat.formats.filter((f) => live(f.id) && !stat.get(f.id).posts).sort((a, b) => tagUse(a) - tagUse(b));
  const lastNew = ordered.find((p) => p.slot === "new");
  const invent = !ideas.length || (lastNew && cat.byId.get(lastNew.format)?.by !== "run");
  if (invent) slots.push({ slot: "new", id: null, why: ideas.length ? "the last new format came from the backlog: invent one (formats.js add)" : "the backlog is empty: invent one (formats.js add)" });
  for (const f of ideas.slice(0, 5)) slots.push({ slot: "new", id: f.id, why: `untried; tags ${(f.tags || []).join(", ")}` });
  return { slots, asked, behind };
}

const fmt = (x) => (x == null ? "–" : `${x.toFixed(x >= 10 ? 0 : 2)}×`);

module.exports = { PLATFORMS, SHORT, compute, pick, fmt };
