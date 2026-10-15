#!/usr/bin/env node
// Tauri's beforeBuildCommand: the CLI sidecar, the Tailscale sidecar and the
// frontend don't depend on each other, so they build at the same time instead
// of one after another. Each output line is prefixed with the build it came
// from, and the command fails if any of them does.
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const frontendDir = join(resolve(dirname(fileURLToPath(import.meta.url)), ".."), "desktop", "frontend");

const builds = {
  cli: "npm run build:cli",
  tailnet: "npm run build:tailnet",
  frontend: "npm run build",
};

function prefixLines(stream, out, name) {
  let rest = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    const lines = (rest + chunk).split("\n");
    rest = lines.pop();
    for (const line of lines) out.write(`[${name}] ${line}\n`);
  });
  stream.on("end", () => {
    if (rest) out.write(`[${name}] ${rest}\n`);
  });
}

function run(name, command) {
  return new Promise((done) => {
    const child = spawn(command, { cwd: frontendDir, shell: true, stdio: ["ignore", "pipe", "pipe"] });
    prefixLines(child.stdout, process.stdout, name);
    prefixLines(child.stderr, process.stderr, name);
    child.on("error", (error) => {
      console.error(`[${name}] ${error.message}`);
      done(false);
    });
    child.on("close", (code) => done(code === 0));
  });
}

const names = Object.keys(builds);
const results = await Promise.all(names.map((name) => run(name, builds[name])));
const failed = names.filter((_, i) => !results[i]);
if (failed.length) {
  console.error(`build-all: ${failed.join(", ")} failed`);
  process.exit(1);
}
