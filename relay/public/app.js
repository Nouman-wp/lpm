import { readInvite } from "./invite.js";
import { connect, ChannelClosed } from "./channel.js";
import { createTerminal } from "./terminal.js";

// Joining a shared tab from a browser. The host lets each person in by hand, after
// checking the four digits shown here match the ones on their screen; once in, the
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
let view = null;
let finished = false;
let retries = 0;
let terminalId = "";
let canType = false;
let hostName = "";
let end = null;
let resyncing = false;
let reqId = 0;

function show(id) {
  $("panel").hidden = id !== "panel";
  $("live").hidden = id !== "live";
}

function panel({ title, text = "", code = "", form = false, again = false }) {
  show("panel");
  $("panel-title").textContent = title;
  $("panel-text").textContent = text;
  $("code").hidden = !code;
  $("code").textContent = code;
  $("join-form").hidden = !form;
  $("again").hidden = !again;
  $("leave").hidden = true;
  if (form) $("name").focus();
}

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
    title: "Join a shared tab",
    text: "Someone shared a terminal tab with you from lpm. Say who you are, and they'll let you in.",
    form: true,
  });
  $("name").value = storage.get(localStorage, "lpm-guest-name") ?? "";
}

async function join(name) {
  storage.set(localStorage, "lpm-guest-name", name);
  panel({ title: "Connecting…" });
  let admitted = null;
  const ch = await connect(invite, {
    onFrame(f) {
      if (f.t === "shareJoinPending") {
        panel({
          title: `Waiting for ${f.hostName || "them"} to let you in`,
          text: "They'll see these four digits too. If the ones on their screen are different, don't continue.",
          code: ch.code,
        });
      } else if (f.t === "shareJoined") {
        admitted = { guestId: f.guestId, token: f.token };
      } else if (f.t === "error") {
        finish("You weren't let in", f.error);
      }
    },
    onClose() {
      if (admitted) {
        seat.save(admitted);
        enter(admitted);
      } else if (!finished) {
        finish("You weren't let in", "The connection closed before they answered.");
      }
    },
  }).catch((e) => {
    finish("Couldn't ask to join", refusal(e instanceof ChannelClosed ? e.code : 0));
    return null;
  });
  if (!ch) return;
  panel({ title: "Asking to join…", code: ch.code });
  ch.send({ t: "shareJoin", secret: invite.secret, name });
}

// --- the shared tab --------------------------------------------------------------

function ensureView() {
  if (view) return view;
  view = createTerminal($("term"), (data) => type(data));
  return view;
}

function type(data) {
  if (!canType || !channel || !data) return;
  channel.send({ t: "invoke", reqId: ++reqId, cmd: "write_terminal", args: { id: terminalId, data } });
}

function setCanType(value) {
  canType = value;
  view?.setCanType(value);
  $("prompt").disabled = !value;
  $("send").disabled = !value;
  for (const b of $("keys").querySelectorAll("button")) b.disabled = !value;
  $("prompt").placeholder = value ? "Message" : `${hostName || "The host"} hasn't let you type`;
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
      $("title").textContent = [f.share?.label, hostName && `from ${hostName}`].filter(Boolean).join(" ");
      document.title = `${f.share?.label || "Shared tab"} · lpm`;
      show("live");
      $("leave").hidden = false;
      notice("");
      ensureView();
      setCanType(!!f.share?.canType);
      subscribe();
      break;
    }
    case "seed":
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
      setCanType(!!f.canType);
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
  if (!view) panel({ title: "Opening the tab…" });
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
  const text =
    code === HOST_OFFLINE
      ? `${hostName || "Their lpm"} is offline. Waiting for it to come back…`
      : "Reconnecting…";
  if (view) notice(text);
  else panel({ title: text });
  setTimeout(() => enter(admitted), wait);
}

// --- wiring ------------------------------------------------------------------------

$("join-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("name").value.trim();
  if (name) join(name);
});

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
});

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
  const saved = seat.load();
  if (saved) enter(saved);
  else askName();
}
