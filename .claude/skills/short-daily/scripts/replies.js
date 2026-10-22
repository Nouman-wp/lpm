#!/usr/bin/env node
// node replies.js draft <labels.json> --template requestDone|alreadyMade --key <request key> --a <A headline> --b <B headline> [--format giraffe|website|game] [--youtube <shorts url>] [--max 3] [--out <file>]
// node replies.js answer <labels.json> --topic <topic> [--max 3] [--out <file>]
// node replies.js fill <approved replies.json> --youtube <shorts url> [--out <file>]
// node replies.js snippet <replies.json> <ref> [--check]
// Replies are rendered from templates.json: the matchup names are models.js
// headlines, the link is our own Short, the language is the classifier's enum.
// No comment text or handle is read here or written into a reply. A YouTube
// reply drafted before its Short exists keeps a {link} slot: `fill` puts the
// link into the approved drafts and changes nothing else. `snippet` prints a
// fixed JavaScript expression for the Chrome tool: it finds the comment by
// its id, checks the account, posts the reply and returns only {ok, identity,
// step}, so the agent never reads a comment thread.
const fs = require("fs");
const path = require("path");

const TEMPLATES = JSON.parse(fs.readFileSync(path.join(__dirname, "templates.json"), "utf8"));
const REF = /^(yt|tt):([A-Za-z0-9_-]{11}|\d{15,25}):([A-Za-z0-9_-]{20,40}(\.[A-Za-z0-9_-]{10,40})?|\d{15,25})$/;
const NAME = /^[A-Za-z0-9][A-Za-z0-9 .·-]{0,39}$/;
const SHORTS = /^https:\/\/www\.youtube\.com\/shorts\/[A-Za-z0-9_-]{11}$/;
const ICONS = { giraffe: "🦒", website: "🌐", game: "🎮" };
const ME = { youtube: "@lpmcx", tiktok: "lpm06557" };
const TOPICS = Object.keys(TEMPLATES.answer);

function fail(problem) {
  console.error(`replies.js: ${problem}`);
  process.exit(2);
}

const [cmd, file, ...rest] = process.argv.slice(2);
const opt = (name) => {
  const i = rest.indexOf(name);
  return i < 0 ? null : (rest[i + 1] ?? fail(`${name} needs a value`));
};
const platformOf = (ref) => (ref.startsWith("yt:") ? "youtube" : "tiktok");
const max = () => Math.max(0, Math.min(3, Number.parseInt(opt("--max") ?? "3", 10) || 0));
const link = () => {
  const l = opt("--youtube");
  if (l && !SHORTS.test(l)) fail("--youtube takes https://www.youtube.com/shorts/<id>");
  return l;
};

function pick(labels, keep) {
  const out = [];
  for (const platform of ["youtube", "tiktok"]) {
    out.push(
      ...labels.comments
        .filter((c) => platformOf(c.ref) === platform && c.replyable && c.handleOk && REF.test(c.ref) && keep(c))
        .sort((a, b) => b.likes - a.likes)
        .slice(0, max()),
    );
  }
  return out;
}

function render(table, platform, language, slots) {
  const byLang = table[platform] || table;
  const fallback = !byLang[language];
  const text = (byLang[language] || byLang.en).replace(/\{(A|B|icon|link)\}/g, (all, k) => slots[k] ?? all);
  if (/\{(?!link\})[A-Za-z]+\}/.test(text)) fail("a template slot was left empty");
  return { text, language: fallback ? "en" : language, fallback, needsLink: text.includes("{link}") };
}

function row(c, template, rendered) {
  const [, , videoId, commentId] = REF.exec(c.ref);
  return { ref: c.ref, platform: platformOf(c.ref), videoId, commentId, link: c.link, template, ...rendered };
}

function write(rows) {
  const text = JSON.stringify(rows, null, 1);
  if (opt("--out")) fs.writeFileSync(opt("--out"), text);
  console.log(text);
}

function draft(labels) {
  const template = opt("--template");
  if (!["requestDone", "alreadyMade"].includes(template)) fail("--template is requestDone or alreadyMade");
  const key = opt("--key") || fail("--key is required");
  const A = opt("--a");
  const B = opt("--b");
  if (!NAME.test(A || "") || !NAME.test(B || "")) fail('--a and --b take a models.js headline such as "Opus 5.5 high"');
  const format = opt("--format") || "giraffe";
  if (!ICONS[format]) fail("--format is giraffe, website or game");
  const slots = { A, B, icon: ICONS[format], link: link() || undefined };
  return pick(labels, (c) => c.request?.key === key).map((c) => row(c, template, render(TEMPLATES[template], platformOf(c.ref), c.language, slots)));
}

function answer(labels) {
  const topic = opt("--topic");
  if (!TOPICS.includes(topic)) fail(`--topic is one of ${TOPICS.join(", ")}`);
  return pick(labels, (c) => c.kind === "question" && c.topic === topic).map((c) =>
    row(c, `answer.${topic}`, render(TEMPLATES.answer[topic], null, c.language, {})),
  );
}

function fill(rows) {
  const l = link() || fail("--youtube is required");
  return rows.map((r) => (r.needsLink && r.platform === "youtube" ? { ...r, text: r.text.replace("{link}", l), needsLink: false } : r));
}

const COMMON = `
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (fn, ms = 15000) => {
    for (const end = Date.now() + ms; Date.now() < end; await sleep(250)) {
      const v = fn();
      if (v) return v;
    }
    return null;
  };
  const done = (ok, identity, step) => ({ ok, identity: /^@?[A-Za-z0-9._-]{2,40}$/.test(identity || "") ? identity : null, step });
  // Typed after whatever the box already holds (YouTube starts a reply to a
  // reply with the author's @handle), with the caret at the end.
  const type = (el, text) => {
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    const lead = el.textContent.trim() ? " " : "";
    document.execCommand("insertText", false, lead + text);
    el.dispatchEvent(new InputEvent("input", { bubbles: true }));
  };`;

function youtubeSnippet(r, check) {
  return `(async () => {
  const VIDEO = ${JSON.stringify(r.videoId)}, CID = ${JSON.stringify(r.commentId)}, TEXT = ${JSON.stringify(r.text)}, ME = ${JSON.stringify(ME.youtube)}, CHECK = ${check};
${COMMON}
  if (new URLSearchParams(location.search).get("v") !== VIDEO) return done(false, null, "wrong-page");
  document.querySelector("button#avatar-btn")?.click();
  const handle = await until(() => document.querySelector("ytd-active-account-header-renderer #channel-handle")?.textContent.trim(), 8000);
  document.querySelector("button#avatar-btn")?.click();
  if (!handle) return done(false, null, "identity-unknown");
  if (handle !== ME) return done(false, handle, "wrong-identity");
  const section = await until(() => document.querySelector("ytd-comments#comments"), 10000);
  section?.scrollIntoView({ block: "start" });
  const link = await until(() =>
    [...document.querySelectorAll("ytd-comment-view-model a[href*='lc='], ytd-comment-renderer a[href*='lc=']")].find(
      (a) => new URL(a.href, location.href).searchParams.get("lc") === CID,
    ),
  20000);
  if (!link) return done(false, handle, "comment-not-found");
  const comment = link.closest("ytd-comment-view-model, ytd-comment-renderer");
  if (CHECK) return done(true, handle, "found");
  const scope = comment.closest("ytd-comment-thread-renderer") || comment.parentElement;
  const mine = () => [...scope.querySelectorAll("ytd-comment-view-model, ytd-comment-renderer")].filter(
    (n) => n !== comment && n.querySelector("#author-text")?.textContent.trim() === ME,
  );
  const before = new Set(mine());
  comment.querySelector("#reply-button-end button")?.click();
  const box = await until(() => comment.parentElement.querySelector("ytd-commentbox #contenteditable-root") || scope.querySelector("ytd-commentbox #contenteditable-root"));
  if (!box) return done(false, handle, "reply-box-missing");
  type(box, TEXT);
  const submit = await until(() => {
    const b = box.closest("ytd-commentbox")?.querySelector("#submit-button button");
    return b && !b.disabled && b.getAttribute("aria-disabled") !== "true" && b;
  });
  if (!submit) return done(false, handle, "submit-disabled");
  submit.click();
  const posted = await until(() => mine().some((n) => !before.has(n) && n.querySelector("#content-text")?.textContent.includes(TEXT)), 20000);
  return done(Boolean(posted), handle, posted ? "posted" : "not-confirmed");
})()`;
}

function tiktokSnippet(r, check) {
  return `(async () => {
  const VIDEO = ${JSON.stringify(r.videoId)}, CID = ${JSON.stringify(r.commentId)}, TEXT = ${JSON.stringify(r.text)}, ME = ${JSON.stringify(ME.tiktok)}, CHECK = ${check};
${COMMON}
  if (!location.pathname.endsWith("/video/" + VIDEO)) return done(false, null, "wrong-page");
  let handle = null;
  try {
    const data = JSON.parse(document.getElementById("__UNIVERSAL_DATA_FOR_REHYDRATION__").textContent);
    handle = data.__DEFAULT_SCOPE__["webapp.app-context"].user.uniqueId || null;
  } catch {}
  if (!handle) return done(false, null, "identity-unknown");
  if (handle !== ME) return done(false, handle, "wrong-identity");
  const fiber = (el) => el[Object.keys(el).find((k) => k.startsWith("__reactFiber$"))];
  const propsOf = (el) => {
    for (let f = fiber(el), i = 0; f && i < 20; f = f.return, i++) {
      const p = f.memoizedProps || {};
      const c = p.comment || p.commentItem || p.commentInfo || p.item || p.data || {};
      if (c.cid || c.comment_id) return c;
    }
    return {};
  };
  const cidOf = (el) => String(propsOf(el).cid || propsOf(el).comment_id || "");
  if (!document.querySelector("[data-e2e='comment-level-1']")) document.querySelector("[data-e2e='comment-icon']")?.click();
  const nodes = () => [...document.querySelectorAll("[data-e2e='comment-level-1'], [data-e2e='comment-level-2']")];
  let target = null;
  for (let tries = 0; tries < 30 && !target; tries++) {
    target = nodes().find((n) => cidOf(n) === CID);
    if (!target) {
      nodes().at(-1)?.scrollIntoView({ block: "end" });
      await sleep(700);
    }
  }
  if (!target) return done(false, handle, "comment-not-found");
  if (CHECK) return done(true, handle, "found");
  const inputs = () => [...document.querySelectorAll("[data-e2e='comment-input'] [contenteditable='true']")];
  const boxesBefore = new Set(inputs());
  let reply = null;
  for (let el = target; el && !reply; el = el.parentElement) {
    reply = [...el.querySelectorAll("[data-e2e='comment-reply-1'], [data-e2e='comment-reply-2']")].find(
      (b) => target.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING,
    );
  }
  if (!reply) return done(false, handle, "reply-button-missing");
  reply.click();
  const box = await until(() => inputs().find((b) => !boxesBefore.has(b)) || (document.activeElement?.isContentEditable && document.activeElement));
  if (!box) return done(false, handle, "reply-box-missing");
  type(box, TEXT);
  const submit = await until(() => {
    const b = box.closest("[data-e2e='comment-input']")?.parentElement?.querySelector("[data-e2e='comment-post']") || document.querySelector("[data-e2e='comment-post']");
    return b && b.getAttribute("aria-disabled") !== "true" && b;
  });
  if (!submit) return done(false, handle, "submit-disabled");
  const before = new Set(nodes().map(cidOf));
  submit.click();
  const posted = await until(() => nodes().find((n) => !before.has(cidOf(n)) && n.matches("[data-e2e='comment-level-2']")), 20000);
  if (!posted) return done(false, handle, "not-confirmed");
  const p = propsOf(posted);
  const under = [p.reply_id, p.reply_to_reply_id, p.replyId].map(String).includes(CID);
  return done(under, handle, under ? "posted" : "posted-elsewhere");
})()`;
}

if (cmd === "draft" || cmd === "answer") {
  const labels = JSON.parse(fs.readFileSync(file || fail("no labels file"), "utf8"));
  write(cmd === "draft" ? draft(labels) : answer(labels));
} else if (cmd === "fill") {
  write(fill(JSON.parse(fs.readFileSync(file || fail("no replies file"), "utf8"))));
} else if (cmd === "snippet") {
  const ref = rest.find((a) => !a.startsWith("--"));
  if (!REF.test(ref || "")) fail("snippet takes a ref such as yt:<videoId>:<commentId>");
  const r = JSON.parse(fs.readFileSync(file || fail("no replies file"), "utf8")).find((x) => x.ref === ref) || fail(`no drafted reply for ${ref}`);
  if (r.needsLink) fail(`${ref} still has no link: run fill first`);
  console.log((r.platform === "youtube" ? youtubeSnippet : tiktokSnippet)(r, rest.includes("--check")));
} else fail("usage: replies.js draft|answer|fill|snippet …");
