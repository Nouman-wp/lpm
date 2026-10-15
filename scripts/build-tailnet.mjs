#!/usr/bin/env node
// Build the built-in Tailscale node (tailnet/cmd/lpm-tailnet, Go) and stage it
// where Tauri's `externalBin` expects it: src-tauri/binaries/lpm-tailnet-<triple>,
// plus `.exe` for a Windows target. The bundle ships it beside the app's own
// executable, the same way as the CLI (see build-cli.mjs).
//
// Target triple (first match wins): the first argument, $LPM_CLI_TARGET (set
// per-arch by CI), the host triple. Pure Go (CGO_ENABLED=0), so any target
// cross-builds from any host. Needs Go: https://go.dev/dl or `brew install go`.
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { stageSidecar } from "./stage-sidecar.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const moduleDir = join(repoRoot, "tailnet");
const tauriDir = join(repoRoot, "desktop", "frontend", "src-tauri");
const binDir = join(tauriDir, "binaries");
const cacheDir = join(tauriDir, "target", "sidecars");

function fail(message) {
  console.error(`build-tailnet: ${message}`);
  process.exit(1);
}

function hostTriple() {
  const out = spawnSync("rustc", ["--print", "host-tuple"], { encoding: "utf8" });
  const triple = out.status === 0 ? out.stdout.trim() : "";
  if (!triple) fail("could not read the host triple from `rustc --print host-tuple`");
  return triple;
}

function goTarget(triple) {
  const os = triple.includes("apple-darwin")
    ? "darwin"
    : triple.includes("windows")
      ? "windows"
      : triple.includes("linux")
        ? "linux"
        : null;
  const arch = triple.startsWith("x86_64")
    ? "amd64"
    : triple.startsWith("aarch64")
      ? "arm64"
      : null;
  if (!os || !arch) fail(`no Go target for ${triple}`);
  return { os, arch };
}

const target = process.argv[2] || process.env.LPM_CLI_TARGET || hostTriple();
const { os, arch } = goTarget(target);
const exeSuffix = os === "windows" ? ".exe" : "";
const name = `lpm-tailnet-${target}${exeSuffix}`;
// Go skips the link when this output is already up to date, but touches it
// either way, so it's built outside binaries/ and staged only when it changed.
// -buildvcs=false keeps the commit and dirty flag out of the binary, or every
// commit would change it and recompile the app.
const output = join(cacheDir, name);
const dest = join(binDir, name);

if (spawnSync("go", ["version"], { stdio: "ignore" }).status !== 0) {
  fail("Go is required to build lpm's built-in Tailscale — install it from https://go.dev/dl (macOS: brew install go)");
}

console.log(`build-tailnet: target=${target} (${os}/${arch})`);

const build = spawnSync(
  "go",
  ["build", "-trimpath", "-buildvcs=false", "-ldflags=-s -w", "-o", output, "./cmd/lpm-tailnet"],
  {
    cwd: moduleDir,
    env: { ...process.env, GOOS: os, GOARCH: arch, CGO_ENABLED: "0" },
    stdio: "inherit",
  },
);
if (build.error) fail(`could not run go: ${build.error.message}`);
if (build.status !== 0) process.exit(build.status ?? 1);

const staged = stageSidecar(output, dest);
console.log(`build-tailnet: ${staged ? "staged" : "unchanged"} ${dest}`);
