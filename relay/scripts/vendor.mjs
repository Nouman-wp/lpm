// Copies xterm.js into public/vendor, so the page loads every script from its own
// origin and nothing else.
import { copyFileSync, mkdirSync } from "node:fs";

const out = new URL("../public/vendor/", import.meta.url);
mkdirSync(out, { recursive: true });
for (const [from, to] of [
  ["@xterm/xterm/lib/xterm.mjs", "xterm.mjs"],
  ["@xterm/xterm/css/xterm.css", "xterm.css"],
  ["@xterm/addon-unicode11/lib/addon-unicode11.mjs", "addon-unicode11.mjs"],
]) {
  copyFileSync(new URL(`../node_modules/${from}`, import.meta.url), new URL(to, out));
}
