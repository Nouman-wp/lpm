// The beat API with two Macs on screen (lesson.json "guest"): everything
// AppStage does, on one app at a time. `use("guest")` moves the calls after it
// to the second app (another person's Mac, or a browser: browserside.js),
// `use("host")` back.
const { AppStage, installOverlay } = require("./appstage");

class TwoMacStage extends AppStage {
  constructor(app, capture, opts = {}) {
    super(app, capture, opts);
    this.side = "host";
    this.sides = { host: { app, origin: opts.origin, box: opts.box }, guest: opts.guest };
    this.offset = { x: 0, y: 0 };
  }

  static async open(app, capture, opts = {}) {
    const stage = new TwoMacStage(app, capture, opts);
    await stage.install();
    return stage;
  }

  // Each app draws its own cursor; the guest's stays hidden until it is used.
  async install() {
    await super.install();
    const { app, origin } = this.sides.guest;
    await installOverlay(app.control, origin.scale);
    await app.control.evaluate(() => window.__lc.hideCursor());
  }

  // The drawn cursor leaves this window by the edge facing the other one and
  // comes in on that one's facing edge at the same height, and the window is
  // brought to the front so keys reach it.
  async use(side, { ms = 220 } = {}) {
    const next = this.sides[side];
    if (!next) throw new Error(`use("${side}"): the windows are "host" and "guest"`);
    if (side === this.side) return;
    const from = this.pointer || { x: this.origin.w / 2, y: this.origin.h / 2 };
    const rightward = next.origin.x > this.origin.x;
    await this.glideTo(rightward ? this.origin.w + 6 : -6, from.y, ms);
    await this.control.evaluate(() => window.__lc.hideCursor());
    const screenY = this.origin.y + this.offset.y + from.y;
    const offset = next.offset || { x: 0, y: 0 };
    Object.assign(this, { side, app: next.app, control: next.app.control, origin: next.origin, box: next.box, offset });
    const y = Math.min(Math.max(screenY - this.origin.y - offset.y, 0), this.origin.h - offset.y);
    const x = rightward ? -6 : this.origin.w + 6;
    await this.control.evaluate((px, py) => {
      window.__lc.place(px, py);
      window.__lc.showCursor();
    }, x, y);
    this.pointer = { x, y };
    // A browser keeps the cursor where it came in, for the page after a navigation.
    if (this.app.input) await this.app.input.move(x, y);
    await this.control.call("window", { focus: true }).catch(() => {});
    this.log(`now on the ${side} window`);
  }

  // One push-in that frames an element in each window together, as close as
  // both fit (a join request on this Mac and the code the guest sees).
  async zoomBoth(hostSel, guestSel, opts = {}) {
    const corners = async (side, sel) => {
      const { app, box, origin, offset = { x: 0, y: 0 } } = this.sides[side];
      const r = await app.control.evaluate((q) => (window.__lc.find(q) ? window.__lc.rect(q) : null), sel);
      if (!r) throw new Error(`zoomBoth: "${sel}" isn't showing in the ${side} window`);
      const out = (x, y) => ({ x: box.x + ((x + offset.x) * box.w) / origin.w, y: box.y + ((y + offset.y) * box.h) / origin.h });
      return [out(r.x, r.y), out(r.x + r.w, r.y + r.h)];
    };
    const [a, b] = await corners("host", hostSel);
    const [c, d] = await corners("guest", guestSel);
    const [x0, x1, y0, y1] = [Math.min(a.x, c.x), Math.max(b.x, d.x), Math.min(a.y, c.y), Math.max(b.y, d.y)];
    const fit = Math.min(this.out.width / (x1 - x0), this.out.height / (y1 - y0)) * (opts.margin ?? 0.88);
    const rect = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    await this.recordZoom(Math.min(opts.scale ?? 2, fit), (x0 + x1) / 2, (y0 + y1) / 2, opts, { sel: `${hostSel} + ${guestSel}`, rect });
  }
}

module.exports = { TwoMacStage };
