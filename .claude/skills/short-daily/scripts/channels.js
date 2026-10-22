#!/usr/bin/env node
// node channels.js [--state <dir>] [--recent <n>] [--top <n>] [--long <n>] [--all]
// Reads the LPM YouTube channel (@lpmcx) and TikTok (@lpm06557) without
// logging in: every video with its views, likes and comment count, and the
// comments on the ones that matter (the newest --recent Shorts, the --top most
// viewed and the newest --long videos on YouTube; every TikTok whose comment
// count changed; --all reads every video). Comment text stays in
// <state>/raw/comments.json, which only this code reads: labels.js has new
// comments labelled by a tool-less model call and writes labels.json, and the
// summary printed here holds no viewer text. Writes videos.json, appends the
// day's numbers to views.jsonl. Exits 3 when a platform's video list couldn't
// be read (its rows in videos.json are then last run's, marked stale), and 4
// when comments waited for a label and none could be labelled.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const labels = require("./labels");

const YT = "https://www.youtube.com/@lpmcx";
const TT_USER = "lpm06557";
// The account's stable id. yt-dlp's profile-page list fails now and then
// ("Unable to extract secondary user ID"); the id-based one doesn't need it.
const TT_CHANNEL = "MS4wLjABAAAA7whXFjlPWIG0b3e536AdSh2KQkpCEdpreTMl94GCdE468bTVYy9cmhXUPVkUSoy5";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
const TT_PAGE = 50;
const TT_MAX_COMMENTS = 300;
const TT_MAX_REQUESTS = 120;
const TT_GAP_MS = 2500;
const TEXT_MAX = 1000;
const LIST_TIMEOUT_MS = 2 * 60_000;
const COMMENTS_TIMEOUT_MS = 6 * 60_000;
// Everything has to finish inside the caller's 10-minute Bash limit, since the
// files are written only at the end.
const DEADLINE = Date.now() + 9 * 60_000;
const timeLeft = (cap) => Math.max(10_000, Math.min(cap, DEADLINE - Date.now()));
const TIKTOK_ROOT = process.env.LPM_TIKTOK_DIR || path.join(os.homedir(), "Movies/lpm-lessons/tiktok");

function usage(problem) {
  console.error(`channels.js: ${problem}\nusage: node channels.js [--state <dir>] [--recent <n>] [--top <n>] [--long <n>] [--all]`);
  process.exit(2);
}

const args = process.argv.slice(2);
const known = new Set(["--state", "--recent", "--top", "--long", "--all"]);
for (const a of args) if (a.startsWith("--") && !known.has(a)) usage(`unknown option ${a}`);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  if (i < 0) return fallback;
  const v = args[i + 1];
  if (v === undefined || v.startsWith("--")) usage(`${name} needs a value`);
  return v;
};
const count = (name, fallback) => {
  const v = opt(name, String(fallback));
  if (!/^\d+$/.test(v)) usage(`${name} takes a whole number, not ${v}`);
  return Number(v);
};
const ALL = args.includes("--all");
const STATE = path.resolve(opt("--state", path.join(TIKTOK_ROOT, "_daily")));
const RECENT = count("--recent", 20);
const TOP = count("--top", 8);
const LONG = count("--long", 4);
const CACHE = path.join(STATE, "raw", "comments.json");
const VIDEOS = path.join(STATE, "videos.json");

const day = (d) => d.toLocaleDateString("sv-SE");
const today = day(new Date());
const iso = (secs) => (secs ? day(new Date(secs * 1000)) : null);
const errors = [];
const stale = new Set();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Viewer text is printed and stored as data: no control or direction-override
// characters that could fake a line or a marker in the summary.
const clean = (s) =>
  String(s || "")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f​-‏‪-‮⁠-⁩﻿]/g, "")
    .slice(0, TEXT_MAX);
const oneLine = (s, max = 400) => {
  const t = clean(s).replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};
const jsonLines = (text) =>
  text
    .split("\n")
    .filter((l) => l.startsWith("{"))
    .flatMap((l) => {
      try {
        return [JSON.parse(l)];
      } catch {
        return [];
      }
    });

function writeAtomic(file, text) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    console.error(`channels.js: ${file} can't be read (${e.message}); fix or move it, nothing was changed`);
    process.exit(1);
  }
}

function ytdlp(argv, label, timeout) {
  const r = spawnSync("yt-dlp", ["--no-update", "--ignore-errors", ...argv], {
    encoding: "utf8",
    maxBuffer: 512 * 1024 * 1024,
    timeout: timeLeft(timeout),
  });
  if (r.error?.code === "ENOENT") {
    console.error("channels.js: yt-dlp is not installed (brew install yt-dlp)");
    process.exit(1);
  }
  if (r.error) errors.push(`${label}: ${oneLine(r.error.message, 200)}`);
  for (const l of (r.stderr || "").split("\n")) if (l.startsWith("ERROR:")) errors.push(`${label}: ${oneLine(l, 240)}`);
  return jsonLines(r.stdout || "");
}

// Old comments stay when a read comes back without them; a comment that
// disappears is kept with the last day it was seen.
function merge(cached, fetched) {
  const comments = { ...(cached?.comments || {}) };
  for (const c of fetched) comments[c.id] = { ...c, firstSeen: comments[c.id]?.firstSeen || today, lastSeen: today };
  return comments;
}

function readYouTube(cache, previous) {
  const listing = ["--flat-playlist", "-O", "%(.{id,title,view_count})j"];
  const shorts = ytdlp([...listing, `${YT}/shorts`], "YouTube Shorts list", LIST_TIMEOUT_MS).map((v) => ({ ...v, kind: "short" }));
  const long = ytdlp([...listing, `${YT}/videos`], "YouTube videos list", LIST_TIMEOUT_MS).map((v) => ({ ...v, kind: "video" }));
  if (!shorts.length) {
    stale.add("youtube");
    errors.push("YouTube: the Shorts list came back empty; videos.json keeps last run's YouTube rows, marked stale");
    return { videos: previous.filter((v) => v.platform === "youtube").map((v) => ({ ...v, stale: true })), read: 0, picked: 0 };
  }
  const url = (v) => (v.kind === "short" ? `https://www.youtube.com/shorts/${v.id}` : `https://www.youtube.com/watch?v=${v.id}`);
  const mostViewed = [...shorts].sort((a, b) => (b.view_count || 0) - (a.view_count || 0)).slice(0, TOP);
  const pick = ALL
    ? [...shorts, ...long]
    : [...new Map([...shorts.slice(0, RECENT), ...mostViewed, ...long.slice(0, LONG)].map((v) => [v.id, v])).values()];
  const details = new Map();
  if (pick.length) {
    const rows = ytdlp(
      [
        "--skip-download",
        "--ignore-no-formats-error",
        "--get-comments",
        "--sleep-requests",
        "1",
        "--sleep-interval",
        "2",
        "--extractor-args",
        "youtube:player_skip=webpage;max_comments=200,all,all,all",
        "-O",
        "%(.{id,title,upload_date,timestamp,view_count,like_count,comment_count,duration,comments})j",
        ...pick.map(url),
      ],
      "YouTube comments",
      COMMENTS_TIMEOUT_MS,
    );
    for (const d of rows) details.set(d.id, d);
  }
  const before = new Map(previous.filter((v) => v.platform === "youtube").map((v) => [v.id, v]));
  const videos = [...shorts, ...long].map((v) => {
    const d = details.get(v.id);
    const old = before.get(v.id);
    const video = {
      platform: "youtube",
      kind: v.kind,
      id: v.id,
      url: url(v),
      title: d?.title || v.title,
      date: d ? iso(d.timestamp) : old?.date || null,
      views: d?.view_count ?? v.view_count ?? old?.views ?? null,
      likes: d?.like_count ?? old?.likes ?? null,
      comments: d?.comment_count ?? old?.comments ?? null,
    };
    if (!d) return video;
    if (d.comment_count > 0 && !Array.isArray(d.comments)) {
      errors.push(`YouTube comments ${v.id}: none came back though it has ${d.comment_count}; kept the cached ones`);
      return video;
    }
    const fetched = (d.comments || []).map((c) => ({
      id: c.id,
      parent: c.parent && c.parent !== "root" ? c.parent : null,
      author: clean(c.author),
      text: clean(c.text),
      likes: c.like_count ?? 0,
      at: iso(c.timestamp),
      ours: Boolean(c.author_is_uploader),
    }));
    cache.youtube[v.id] = { count: d.comment_count ?? fetched.length, comments: merge(cache.youtube[v.id], fetched) };
    return video;
  });
  return { videos, read: details.size, picked: pick.length };
}

let ttRequests = 0;
let ttRefusals = 0;

async function ttGet(endpoint, params, videoId) {
  if (ttRequests >= TT_MAX_REQUESTS) throw new Error(`stopped at ${TT_MAX_REQUESTS} requests for this run`);
  ttRequests++;
  const q = new URLSearchParams({ aid: "1988", count: String(TT_PAGE), ...params });
  const res = await fetch(`https://www.tiktok.com/api/comment/list/${endpoint}?${q}`, {
    headers: { "User-Agent": UA, Referer: `https://www.tiktok.com/@${TT_USER}/video/${videoId}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  if (body.status_code && body.status_code !== 0) throw new Error(`status_code ${body.status_code} ${body.status_msg || ""}`.trim());
  return body;
}

async function ttPages(endpoint, params, videoId, max) {
  const out = [];
  let cursor = 0;
  for (;;) {
    const body = await ttGet(endpoint, { ...params, cursor: String(cursor) }, videoId);
    out.push(...(body.comments || []));
    if (!body.has_more || out.length >= max || body.cursor === undefined || body.cursor === cursor) return out;
    cursor = body.cursor;
    await sleep(TT_GAP_MS);
  }
}

const ttComment = (c, parent) => ({
  id: c.cid,
  parent,
  replyTo: c.reply_to_reply_id && c.reply_to_reply_id !== "0" ? c.reply_to_reply_id : null,
  author: c.user?.unique_id ? `@${clean(c.user.unique_id)}` : null,
  text: clean(c.text),
  likes: c.digg_count ?? 0,
  at: iso(c.create_time),
  ours: c.user?.unique_id === TT_USER,
});

async function readTikTok(cache, previous) {
  const listing = ["--flat-playlist", "-O", "%(.{id,title,description,view_count,like_count,comment_count,timestamp})j"];
  let list = ytdlp([...listing, `tiktokuser:${TT_CHANNEL}`], "TikTok list", LIST_TIMEOUT_MS);
  if (!list.length) list = ytdlp([...listing, `https://www.tiktok.com/@${TT_USER}`], "TikTok list by profile", LIST_TIMEOUT_MS);
  if (!list.length) {
    stale.add("tiktok");
    errors.push("TikTok: the video list came back empty; videos.json keeps last run's TikTok rows, marked stale");
    return { videos: previous.filter((v) => v.platform === "tiktok").map((v) => ({ ...v, stale: true })), read: 0 };
  }
  let read = 0;
  for (const v of list) {
    const known = cache.tiktok[v.id];
    if (!v.comment_count || (!ALL && known && known.count === v.comment_count)) continue;
    if (ttRefusals >= 2) {
      errors.push("TikTok: two refusals in a row, the rest are read next run");
      break;
    }
    if (ttRequests >= TT_MAX_REQUESTS - 10 || DEADLINE - Date.now() < 3 * 60_000) {
      errors.push(`TikTok: stopped after ${ttRequests} requests to stay within this run's limits, the rest are read next run`);
      break;
    }
    try {
      const roots = await ttPages("", { aweme_id: v.id }, v.id, TT_MAX_COMMENTS);
      if (!roots.length) throw new Error(`no comments came back though it has ${v.comment_count}`);
      const fetched = [];
      for (const c of roots) {
        fetched.push(ttComment(c, null));
        if (!c.reply_comment_total) continue;
        await sleep(TT_GAP_MS);
        const replies = await ttPages("reply/", { item_id: v.id, comment_id: c.cid }, v.id, TT_MAX_COMMENTS);
        fetched.push(...replies.map((r) => ttComment(r, c.cid)));
      }
      cache.tiktok[v.id] = { count: v.comment_count, comments: merge(known, fetched) };
      ttRefusals = 0;
      read++;
    } catch (e) {
      ttRefusals++;
      errors.push(`TikTok comments ${v.id}: ${oneLine(e.message, 200)}; kept the cached ones`);
    }
    await sleep(TT_GAP_MS);
  }
  const videos = list.map((v) => ({
    platform: "tiktok",
    kind: "short",
    id: v.id,
    url: `https://www.tiktok.com/@${TT_USER}/video/${v.id}`,
    title: v.title,
    caption: v.description || null,
    date: iso(v.timestamp),
    views: v.view_count ?? null,
    likes: v.like_count ?? null,
    comments: v.comment_count ?? null,
  }));
  return { videos, read };
}

function table(videos, n) {
  return videos
    .filter((v) => v.views !== null && v.date)
    .slice(0, n)
    .map((v) => `  ${v.date}  ${String(v.views).padStart(6)} / ${String(v.likes ?? "?").padStart(4)} / ${String(v.comments ?? "?").padStart(3)}  ${oneLine(v.title, 90)}`)
    .join("\n");
}

(async () => {
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  const cache = readJson(CACHE, { lastRun: null, youtube: {}, tiktok: {} });
  const previous = readJson(VIDEOS, { videos: [] }).videos || [];
  const yt = readYouTube(cache, previous);
  const tt = await readTikTok(cache, previous);
  const videos = [...yt.videos, ...tt.videos];
  cache.lastRun = today;
  writeAtomic(CACHE, JSON.stringify(cache, null, 1));
  writeAtomic(VIDEOS, JSON.stringify({ at: today, stale: [...stale], videos }, null, 1));
  const snapshot = videos.filter((v) => !v.stale).map((v) => ({ p: v.platform, id: v.id, date: v.date, views: v.views, likes: v.likes, comments: v.comments }));
  fs.appendFileSync(path.join(STATE, "views.jsonl"), `${JSON.stringify({ at: new Date().toISOString(), videos: snapshot })}\n`);
  const summary = labels.update({ state: STATE, cache, videos, deadline: DEADLINE, writeAtomic });

  const shorts = yt.videos.filter((v) => v.kind === "short");
  console.log(`YouTube @lpmcx: ${shorts.length} Shorts and ${yt.videos.length - shorts.length} videos listed, details and comments read on ${yt.read} of ${yt.picked}${stale.has("youtube") ? " (STALE: list not read)" : ""}`);
  console.log(`TikTok @${TT_USER}: ${tt.videos.length} videos listed, comments re-read on ${tt.read} whose count changed${stale.has("tiktok") ? " (STALE: list not read)" : ""}`);
  for (const e of errors) console.log(`  error: ${e}`);
  console.log("");
  for (const l of summary.lines) console.log(l);
  console.log("");
  console.log("Newest YouTube Shorts (date, views / likes / comments):");
  console.log(table(shorts, 12));
  console.log("Newest TikToks (date, views / likes / comments):");
  console.log(table(tt.videos, 12));
  if (stale.size) process.exit(3);
  if (summary.failed) process.exit(4);
})().catch((e) => {
  console.error(`channels.js: ${e.message}`);
  process.exit(1);
});
