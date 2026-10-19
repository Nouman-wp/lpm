// The beat API with two Macs on screen (lesson.json "guest"): everything
// AppStage does, on one app at a time. `use("guest")` moves the calls after it
// to the second app (another person's Mac), `use("host")` back.
const { AppStage, installOverlay } = require("./appstage");

class TwoMacStage extends AppStage {
  constructor(app, capture, opts = {}) {
    super(app, capture, opts);
    this.side = "host";
    this.sides = { host: { app, origin: opts.origin, box: opts.box }, guest: opts.guest };
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
    const screenY = this.origin.y + from.y;
    Object.assign(this, { side, app: next.app, control: next.app.control, origin: next.origin, box: next.box });
    const y = Math.min(Math.max(screenY - this.origin.y, 0), this.origin.h);
    const x = rightward ? -6 : this.origin.w + 6;
    await this.control.evaluate((px, py) => {
      window.__lc.place(px, py);
      window.__lc.showCursor();
    }, x, y);
    this.pointer = { x, y };
    await this.control.call("window", { focus: true }).catch(() => {});
    this.log(`now on the ${side} window`);
  }
}

module.exports = { TwoMacStage };
