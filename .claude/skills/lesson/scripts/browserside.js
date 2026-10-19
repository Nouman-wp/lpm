// A browser standing in for someone without lpm (lesson.json "guest": { "browser":
// true }): Chromium on a throwaway profile, in the second Mac's place beside the
// lesson app. It answers the calls the second app does (`control.evaluate`,
// `control.call("window" | "bounds")`, `proc.pid`), so the two-Mac stage, the
// capture and the picture take it as they are. The stage's coordinates are the
// page's, `contentOffset()` below the window's top-left; clicks and keys go into
// the page as Playwright's input events (`input`), since the real pointer's
// window check knows only lpm's windows.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { chromium, CHROME } = require("./browser");
const { installOverlay } = require("./appstage");

// lpm.cx/join hands Chrome its lpm:// link by itself; as Safari it waits for a
// click, so a take never opens the person's own lpm.
const SAFARI = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15";

// The browser process itself (it owns the windows), not one of its helpers.
function browserPid(profile) {
  const out = execFileSync("ps", ["-axo", "pid=,command="], { encoding: "utf8" });
  for (const line of out.split("\n")) {
    if (line.includes(`--user-data-dir=${profile}`) && !line.includes("--type=")) return Number(line.trim().split(/\s+/)[0]);
  }
  return null;
}

function bringToFront(pid) {
  try {
    execFileSync("osascript", ["-e", `tell application "System Events" to set frontmost of (first application process whose unix id is ${pid}) to true`]);
  } catch {
    // focus is a nicety here: input goes to the page whatever is in front
  }
}

const KEY_NAMES = { cmd: "Meta", shift: "Shift", alt: "Alt", ctrl: "Control", return: "Enter", enter: "Enter", esc: "Escape", escape: "Escape", tab: "Tab", space: "Space", delete: "Backspace", down: "ArrowDown", up: "ArrowUp" };

async function launchBrowser({ url = "about:blank", log = () => {} } = {}) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "lpm-lesson-browser-"));
  const context = await chromium.launchPersistentContext(profile, {
    executablePath: CHROME,
    headless: false,
    viewport: null,
    userAgent: SAFARI,
    // The relay page allows no eval, and the drawn cursor is built with one.
    bypassCSP: true,
    ignoreDefaultArgs: ["--enable-automation"],
    args: ["--no-first-run", "--no-default-browser-check", "--disable-features=Translate,DownloadBubble"],
  });
  const page = context.pages()[0] || (await context.newPage());
  const pid = browserPid(profile);
  if (!pid) throw new Error("the lesson browser started, but its process wasn't found");
  const cdp = await context.newCDPSession(page);
  const { windowId } = await cdp.send("Browser.getWindowForTarget");
  const scale = await page.evaluate(() => window.devicePixelRatio);
  log(`browser ${pid} at ${CHROME.split("/").slice(-1)[0]}`);

  // The drawn cursor lives in the page, so a new page gets it again where the
  // stage last had it.
  let last = null;
  const control = {
    evaluate: (fn, ...args) => page.evaluate(`(${fn.toString()})(...${JSON.stringify(args)})`),
    async call(op, params = {}) {
      if (op === "window") {
        const bounds = {};
        if (params.w != null) Object.assign(bounds, { width: Math.round(params.w), height: Math.round(params.h) });
        if (params.x != null) Object.assign(bounds, { left: Math.round(params.x), top: Math.round(params.y) });
        if (Object.keys(bounds).length) await cdp.send("Browser.setWindowBounds", { windowId, bounds: { windowState: "normal", ...bounds } });
        if (params.focus) {
          await page.bringToFront();
          bringToFront(pid);
        }
        return control.call("bounds");
      }
      if (op === "bounds") {
        const { bounds: b } = await cdp.send("Browser.getWindowBounds", { windowId });
        return { x: b.left * scale, y: b.top * scale, w: b.width * scale, h: b.height * scale, scale };
      }
      throw new Error(`the lesson browser has no "${op}"`);
    },
  };
  page.on("domcontentloaded", async () => {
    try {
      await installOverlay(control, scale);
      if (last) await control.evaluate((x, y) => window.__lc.place(x, y), last.x, last.y);
    } catch (e) {
      log(`browser overlay: ${e.message}`);
    }
  });
  const input = {
    async move(x, y) {
      last = { x, y };
      await page.mouse.move(x, y);
    },
    async click(x, y) {
      last = { x, y };
      await page.mouse.click(x, y);
    },
    type: (text) => page.keyboard.type(text),
    press: (key) => page.keyboard.press(key),
    keys: (combo) => page.keyboard.press(combo.split("+").map((k) => KEY_NAMES[k.toLowerCase()] || k.toUpperCase()).join("+")),
  };
  if (url !== "about:blank") await page.goto(url);

  let closing = null;
  return {
    proc: { pid },
    control,
    input,
    page,
    ui: "browser",
    // Where the page starts inside the window: below the tab strip and toolbar.
    async contentOffset() {
      const o = await page.evaluate(() => ({ x: (window.outerWidth - window.innerWidth) / 2, y: window.outerHeight - window.innerHeight }));
      return { x: Math.round(o.x), y: Math.round(o.y) };
    },
    close() {
      closing =
        closing ||
        (async () => {
          await context.close().catch(() => {});
          fs.rmSync(profile, { recursive: true, force: true });
        })();
      return closing;
    },
  };
}

module.exports = { launchBrowser };
