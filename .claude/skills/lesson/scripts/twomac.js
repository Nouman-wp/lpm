// The picture of a lesson with two Macs in it (lesson.json "guest"): the
// lesson app on the left and a second lpm, on its own data directory, on the
// right, standing in for someone else's Mac. Both windows are recorded in one
// capture; the mux crops each out of it and frames them side by side on the
// cards' canvas, with a label over each. On a card the window beside the title
// is the left one, at the size a lone window has there (compose.js
// crossfadeSpans), since the pair's windows are smaller than that.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// `app` is the left window's size on screen (points; the right one's is the
// lesson's `guest.window`, by default the same), `gap` the points between them
// there; `window` is the left one's box on the canvas (output = ZOOM times
// these; the right one is drawn at the same scale, top-aligned), `between` the
// canvas points between the two boxes and `label` the row above them. `cover`
// is the left window's box beside a card: as tall as a lone window's, at the
// pair's aspect.
const TWO_MAC = {
  app: { w: 840, h: 640 },
  gap: 24,
  window: { w: 592, h: 451 },
  between: 32,
  label: { size: 24, gap: 14 },
  cover: { w: 814, h: 620 },
};
const SERIF = `"Iowan Old Style", "Palatino", Georgia, serif`;

// Output pixels: `host` and `guest` are the two windows' boxes, `labels` the
// centre of each label's baseline row. `guestApp` is the right window's size
// on screen.
function twoMacLayout(out, zoom, guestApp = TWO_MAC.app, L = TWO_MAC) {
  const cw = out.width / zoom;
  const ch = out.height / zoom;
  const k = L.window.w / L.app.w;
  const gw = Math.round(guestApp.w * k);
  const gh = Math.round(guestApp.h * k);
  const total = L.window.w + L.between + gw;
  const x0 = Math.round((cw - total) / 2);
  const labelRow = L.label.size + L.label.gap;
  const y0 = Math.round((ch - Math.max(L.window.h, gh) + labelRow) / 2);
  const box = (x, y, w, h) => ({ x: x * zoom, y: y * zoom, w: w * zoom, h: h * zoom });
  const host = box(x0, y0, L.window.w, L.window.h);
  const guest = box(x0 + L.window.w + L.between, y0, gw, gh);
  const labelY = (y0 - L.label.gap - L.label.size / 2) * zoom;
  return { host, guest, labels: [host, guest].map((b) => ({ x: b.x + b.w / 2, y: labelY })) };
}

// The two labels on transparency, drawn once by Chromium and kept in `dir`
// under a name that carries the words and the look.
async function labelsAsset(dir, { out, layout, zoom, labels }) {
  fs.mkdirSync(dir, { recursive: true });
  const look = crypto.createHash("sha1").update(JSON.stringify([out, layout, labels, TWO_MAC.label, SERIF])).digest("hex").slice(0, 10);
  const file = path.join(dir, `twomac-labels-${look}.png`);
  if (fs.existsSync(file)) return file;
  const { chromium, CHROME } = require("./browser");
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage({ viewport: out, deviceScaleFactor: 1 });
  const tags = layout.labels
    .map((at, i) => (labels[i] ? `<div class="l" style="left:${at.x}px;top:${at.y}px">${labels[i].replace(/&/g, "&amp;").replace(/</g, "&lt;")}</div>` : ""))
    .join("");
  await page.setContent(`<!doctype html><style>
html, body { margin: 0; background: transparent; width: ${out.width}px; height: ${out.height}px; overflow: hidden; }
.l { position: absolute; transform: translate(-50%, -50%); white-space: nowrap; font-family: ${SERIF}; font-weight: 600;
  font-size: ${TWO_MAC.label.size * zoom}px; letter-spacing: -0.01em; color: rgba(20,20,20,.78); }
</style>${tags}`);
  await page.screenshot({ path: file, omitBackground: true });
  await browser.close();
  return file;
}

// The right-hand window on top of the picture labelled `from`, out as `to`:
// its shadow and both labels, then the window cropped out of the take (input
// 0) and rounded by `assets.mask`. `home` hides it while a card has the
// picture; `base` is the index its first input will get.
function guestLayer({ from, to, base, region, box, assets, home = "", captureIn, fps }) {
  const still = (file) => ["-framerate", String(fps), "-loop", "1", "-i", file];
  const inputs = [...still(assets.shadow), ...still(assets.labels), ...still(assets.mask)];
  const parts = [
    `[${base}:v]format=rgba[gs]`,
    `[${base + 1}:v]format=rgba[gl]`,
    `[${from}][gs]overlay=x=0:y=0${home}[gb0]`,
    `[gb0][gl]overlay=x=0:y=0${home}[gb]`,
    `[0:v]crop=${region.w}:${region.h}:${region.x}:${region.y},scale=${box.w}:${box.h}:${captureIn},format=rgba[gw0]`,
    `[${base + 2}:v]format=gray[gm]`,
    `[gw0][gm]alphamerge[gw]`,
    `[gb][gw]overlay=x=${box.x}:y=${box.y}:eof_action=repeat${home}[${to}]`,
  ];
  return { inputs, parts };
}

module.exports = { TWO_MAC, twoMacLayout, labelsAsset, guestLayer };
