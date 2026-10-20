import { readInvite } from "./invite.js";
import { connect, ChannelClosed } from "./channel.js";
import { createTerminal } from "./terminal.js";
import { showShare, showStatus } from "./header.js";
import { greet, panel, show } from "./panel.js";
import { createAsk } from "./ask.js";

// Joining a shared tab from a browser. The host lets each person in by hand, after
// checking the four emoji shown here match the ones on their screen; once in, the
// guest sees the tab live and types in it only while the host allows it.

// Close codes the relay uses (relay/src/room.ts).
const HOST_OFFLINE = 4004;
const ROOM_ENDED = 4010;
const ROOM_FULL = 4029;
const MAX_RETRY_MS = 30_000;

const ENDED = {
  stopped: "They stopped sharing this tab.",
  removed: "They removed you from this tab.",
  closed: "The tab was closed.",
  left: "You left this tab.",
};

const $ = (id) => document.getElementById(id);
const encoder = new TextEncoder();
const invite = readInvite(location.hash);
const seatKey = invite?.room ? `lpm-seat:${invite.room}` : "";

const storage = {
  get(area, key) {
    try {
      return JSON.parse(area.getItem(key) ?? "null");
    } catch {
      return null;
    }
  },
  set(area, key, value) {
    try {
      if (value === null) area.removeItem(key);
      else area.setItem(key, JSON.stringify(value));
    } catch {}
  },
};
const seat = {
  load: () => storage.get(sessionStorage, seatKey),
  save: (value) => storage.set(sessionStorage, seatKey, value),
  clear: () => storage.set(sessionStorage, seatKey, null),
};

let channel = null;
let joining = null;
let view = null;
let finished = false;
let retries = 0;
let terminalId = "";
let canType = false;
let hostName = "";
let label = "";
let project = "";
let end = null;
let resyncing = false;
let reqId = 0;

const ask = createAsk($("locked"), () => channel?.send({ t: "shareAskType" }));

function notice(text) {
  $("notice").hidden = !text;
  $("notice").textContent = text;
}

function finish(title, text = "") {
  finished = true;
  seat.clear();
  channel?.close();
  channel = null;
  panel({ title, text, again: true });
}

function refusal(code) {
  if (code === HOST_OFFLINE) return "Their lpm isn't connected right now. Try again once it's open.";
  if (code === ROOM_FULL) return "Too many people are joining this tab right now. Try again shortly.";
  if (code === ROOM_ENDED) return "This invite has ended. Ask for a new one.";
  return "Couldn't reach the shared tab. Check your connection and try again.";
}

// --- asking to join ------------------------------------------------------------

function askName() {
  panel({
    greet: !!(invite.hostName || invite.label),
    title: "Join a shared tab",
    text: "Someone shared a terminal tab with you from lpm. Say who you are, and they'll let you in.",
    form: true,
  });
  $("name").value = storage.get(localStorage, "lpm-guest-name") ?? "";
}

async function join(name) {
  storage.set(localStorage, "lpm-guest-name", name);
  const attempt = { ch: null };
  const current = () => joining === attempt;
  joining = attempt;
  panel({ title: "Connecting…", step: 2, cancel: true });
  let admitted = null;
  const ch = await connect(invite, {
    onFrame(f) {
      if (!current()) return;
      if (f.t === "shareJoinPending") {
        panel({
          title: `Waiting for ${f.hostName || invite.hostName || "them"}`,
          text: "Your request is on their screen, next to these four.",
          step: 2,
          code: f.match === "emoji" ? ch.codes.emoji.split(" ") : [...ch.codes.digits],
          cancel: true,
        });
      } else if (f.t === "shareJoined") {
        admitted = { guestId: f.guestId, token: f.token };
      } else if (f.t === "error") {
        finish("You weren't let in", f.error);
      }
    },
    onClose() {
      if (!current()) return;
      joining = null;
      if (admitted) {
        seat.save(admitted);
        enter(admitted);
      } else if (!finished) {
        finish("You weren't let in", "The connection closed before they answered.");
      }
    },
  }).catch((e) => {
    if (current()) {
      joining = null;
      finish("Couldn't ask to join", refusal(e instanceof ChannelClosed ? e.code : 0));
    }
    return null;
  });
  if (!ch) return;
  if (!current()) return ch.close();
  attempt.ch = ch;
  panel({ title: "Asking to join…", step: 2, cancel: true });
  ch.send({ t: "shareJoin", secret: invite.secret, name });
}

// Hanging up takes the request off their screen; nothing is kept.
function cancelJoin() {
  joining?.ch?.close();
  joining = null;
  askName();
}

// --- the shared tab --------------------------------------------------------------

function ensureView() {
  if (view) return view;
  view = createTerminal($("term"), (data) => type(data));
  // The composer lines up with the terminal it types into.
  const term = $("term");
  new ResizeObserver(() => $("live").style.setProperty("--term-width", `${term.offsetWidth}px`)).observe(term);
  return view;
}

function type(data) {
  if (!canType || !channel || !data) return;
  channel.send({ t: "invoke", reqId: ++reqId, cmd: "write_terminal", args: { id: terminalId, data } });
}

// While the host keeps the tab view only, the composer stays in place, inert
// under the row that asks to type, so the terminal above doesn't move when typing
// is switched on.
function setCanType(value) {
  canType = value;
  view?.setCanType(value);
  $("keys").inert = !value;
  $("box").inert = !value;
  syncComposer();
}

function syncComposer() {
  const prompt = $("prompt");
  prompt.placeholder = `Send to ${label || "this tab"}…`;
  prompt.style.height = "auto";
  prompt.style.height = `${prompt.scrollHeight}px`;
  $("send").disabled = !canType || !prompt.value.trim();
}

// A `ready` share or a `shareInfo`. Older hosts leave out all but `canType`, and
// what's missing keeps its last value.
function applyShare(info) {
  const text = (value, fallback) => (typeof value === "string" ? value : fallback);
  label = text(info.label, label);
  project = text(info.project, project);
  const others = Array.isArray(info.others) ? info.others.filter((n) => typeof n === "string" && n) : [];
  showShare({ hostName, label, project, canType: !!info.canType, others });
  ask.update({ canType: !!info.canType, asked: !!info.asked, askType: info.askType === true, hostName });
  setCanType(!!info.canType);
  document.title = `${label || "Shared tab"} · lpm`;
}

function subscribe() {
  channel?.send({ t: "sub", id: terminalId, ...(end === null ? {} : { from: end }) });
}

function output(d, off) {
  const bytes = encoder.encode(d);
  const start = off - bytes.length;
  // Before the first seed nothing is drawn yet; the seed brings it.
  if (end === null || off <= end) return;
  if (start > end) {
    if (!resyncing) {
      resyncing = true;
      subscribe();
    }
    return;
  }
  view.term.write(start === end ? bytes : bytes.subarray(end - start));
  end = off;
}

function onLive(f) {
  switch (f.t) {
    case "ready": {
      retries = 0;
      hostName = f.hostName || "";
      terminalId = f.share?.terminalId ?? "";
      show("live");
      notice("");
      showStatus(hostName ? `Live from ${hostName}` : "Live", true);
      ensureView();
      ask.reset();
      applyShare(f.share ?? {});
      subscribe();
      break;
    }
    case "seed":
      if (f.id !== terminalId) break;
      resyncing = false;
      view.resize(f.cols, f.rows);
      if (f.reset) view.term.reset();
      view.term.write(f.d ?? "");
      end = f.off ?? null;
      break;
    case "o":
      if (f.id === terminalId) output(f.d ?? "", f.off);
      break;
    case "size":
      if (f.id === terminalId) view.resize(f.cols, f.rows);
      break;
    case "exit":
      if (f.id === terminalId) view.term.write("\r\n\x1b[90m[This tab's session ended]\x1b[0m\r\n");
      break;
    case "shareInfo":
      applyShare(f);
      break;
    case "shareEnded":
      finish(ENDED[f.reason] ?? "This shared tab ended.");
      break;
    case "result":
      if (!f.ok && typeof f.value === "string") {
        notice(f.value);
        setTimeout(() => notice(""), 3000);
      }
      break;
    case "error":
      finish("Your place in this tab has ended", "Ask to join again to see it.");
      break;
  }
}

async function enter(admitted) {
  if (finished) return;
  if ($("live").hidden) panel({ title: "Opening the tab…", step: 3 });
  const ch = await connect(invite, {
    onFrame: onLive,
    onClose(code) {
      channel = null;
      if (finished) return;
      if (code === ROOM_ENDED) return finish(ENDED.stopped);
      reconnect(admitted, code);
    },
  }).catch((e) => {
    reconnect(admitted, e instanceof ChannelClosed ? e.code : 0);
    return null;
  });
  if (!ch) return;
  channel = ch;
  ch.send({ t: "auth", deviceId: admitted.guestId, token: admitted.token });
}

function reconnect(admitted, code) {
  if (finished) return;
  if (code === ROOM_ENDED) return finish(ENDED.stopped);
  const wait = Math.min(MAX_RETRY_MS, 1000 * 2 ** retries);
  retries += 1;
  const offline = code === HOST_OFFLINE;
  if (!$("live").hidden) {
    showStatus(offline ? `Offline, waiting for ${hostName || "their lpm"}…` : "Reconnecting…", false);
  } else if (offline) {
    panel({ title: `${hostName || "Their lpm"} is offline. Waiting for it to come back…` });
  } else {
    panel({ title: "Reconnecting…" });
  }
  setTimeout(() => enter(admitted), wait);
}

// --- wiring ------------------------------------------------------------------------

$("join-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("name").value.trim();
  if (name) join(name);
});

$("cancel").addEventListener("click", cancelJoin);

$("again").addEventListener("click", () => {
  finished = false;
  askName();
});

$("leave").addEventListener("click", () => {
  channel?.send({ t: "forget" });
  finish(ENDED.left);
});

$("composer").addEventListener("submit", (e) => {
  e.preventDefault();
  const text = $("prompt").value;
  if (!text.trim() || !canType || !view) return;
  view.deliver(text, type);
  $("prompt").value = "";
  syncComposer();
});

$("prompt").addEventListener("input", syncComposer);

$("prompt").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    $("composer").requestSubmit();
  }
});

$("keys").addEventListener("click", (e) => {
  const key = e.target.closest("button")?.dataset.key;
  if (key && view) type(view.key(key));
});

if (!invite) {
  panel({
    title: "This link isn't complete",
    text: "Part of it is missing. Ask the person sharing the tab to send the link again, and copy all of it.",
  });
} else if (invite === "network") {
  panel({
    title: "Open this link in lpm",
    text: "This tab can only be joined from lpm on their network. Ask them to update lpm and share it again to join from a browser.",
  });
} else {
  greet(invite);
  const saved = seat.load();
  if (saved) enter(saved);
  else askName();
}
