// Stage a built sidecar where Tauri's `externalBin` expects it, leaving the
// staged copy untouched when its bytes haven't changed. tauri-build marks every
// sidecar `rerun-if-changed`, so rewriting it — even with identical bytes —
// reruns the app's build script and recompiles the whole desktop crate on every
// `tauri dev` start.
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname } from "node:path";

function sameBytes(a, b) {
  if (!existsSync(b) || statSync(a).size !== statSync(b).size) return false;
  return readFileSync(a).equals(readFileSync(b));
}

export function stageSidecar(source, dest) {
  if (sameBytes(source, dest)) return false;
  mkdirSync(dirname(dest), { recursive: true });
  // A fresh inode: macOS caches code signatures per vnode, so rewriting a binary
  // that has already run in place can get the next exec SIGKILLed.
  rmSync(dest, { force: true });
  copyFileSync(source, dest);
  if (process.platform !== "win32") chmodSync(dest, 0o755);
  return true;
}
