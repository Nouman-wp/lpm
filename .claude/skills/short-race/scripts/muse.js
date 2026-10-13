// Reads Muse Code's session log for a folder:
// <data home>/muse/sessions/YYYY/MM/DD/<session>/session.jsonl. Each line is a
// record with a payload_type and recorded_at in microseconds, or a transaction
// frame that holds its records as JSON strings. The session's metadata names
// its workspace_root, and every turn is a run that logs `started` with its
// prompt and `terminal` once it is over, after Muse's own double-check. A long
// session's log runs to many MB, so each file is read on from where the last
// poll stopped.
const fs = require("fs");
const os = require("os");
const path = require("path");

const SESSIONS = path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share"), "muse", "sessions");

function dayDirs() {
  const pad = (n) => String(n).padStart(2, "0");
  const days = new Set();
  for (const t of [Date.now(), Date.now() - 86400000]) {
    const d = new Date(t);
    days.add(path.join(SESSIONS, String(d.getFullYear()), pad(d.getMonth() + 1), pad(d.getDate())));
    days.add(path.join(SESSIONS, String(d.getUTCFullYear()), pad(d.getUTCMonth() + 1), pad(d.getUTCDate())));
  }
  return [...days].filter((d) => fs.existsSync(d));
}

function records(line) {
  try {
    const frame = JSON.parse(line);
    if (frame.children) return frame.children.map((c) => JSON.parse(c.record_json));
    return [frame.record_json ? JSON.parse(frame.record_json) : frame];
  } catch {
    return [];
  }
}

const logs = new Map();

function readLog(file) {
  let log = logs.get(file);
  const size = fs.statSync(file).size;
  if (!log || size < log.offset) log = { offset: 0, rest: Buffer.alloc(0), root: null, runs: [] };
  logs.set(file, log);
  if (size === log.offset) return log;
  const fd = fs.openSync(file, "r");
  const buf = Buffer.alloc(size - log.offset);
  fs.readSync(fd, buf, 0, buf.length, log.offset);
  fs.closeSync(fd);
  log.offset = size;
  const text = Buffer.concat([log.rest, buf]);
  const end = text.lastIndexOf(10);
  log.rest = text.subarray(end + 1);
  for (const line of text.subarray(0, end + 1).toString("utf8").split("\n")) {
    if (!line) continue;
    for (const r of records(line)) {
      const p = r.payload || {};
      if (r.payload_type === "runtime.session.metadata") log.root = log.root ?? p.record?.workspace_root ?? null;
      if (r.payload_type !== "runtime.session" || p.kind !== "run") continue;
      const at = Math.round(r.recorded_at / 1000);
      if (p.event?.kind === "started" && p.event.prompt != null) log.runs.push({ id: p.run_id, startedAt: at, endedAt: null });
      if (p.event?.kind === "terminal") {
        const run = log.runs.find((x) => x.id === p.run_id);
        if (run) run.endedAt = at;
      }
    }
  }
  return log;
}

const realpath = (p) => {
  try {
    return fs.realpathSync(p);
  } catch {
    return p;
  }
};

// The newest session in `root` with a prompt taken after `since`: when it took
// the first one, and when its last turn ended (null while one is running).
function museRun(root, since) {
  const want = new Set([root, realpath(root)]);
  let best = null;
  for (const day of dayDirs()) {
    for (const id of fs.readdirSync(day)) {
      const file = path.join(day, id, "session.jsonl");
      if (!fs.existsSync(file) || fs.statSync(file).mtimeMs < since - 1000) continue;
      const log = readLog(file);
      if (!want.has(log.root)) continue;
      const runs = log.runs.filter((r) => r.startedAt >= since - 1000);
      if (runs.length && (!best || runs[0].startedAt > best[0].startedAt)) best = runs;
    }
  }
  return best && { startedAt: best[0].startedAt, endedAt: best.at(-1).endedAt };
}

module.exports = { museRun };
