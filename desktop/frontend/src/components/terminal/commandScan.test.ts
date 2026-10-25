// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { Terminal } from "@xterm/xterm";
import { scanCommands } from "./commandScan";

async function terminal(text: string, cols = 110): Promise<Terminal> {
  const term = new Terminal({ cols, rows: 30, allowProposedApi: true });
  await new Promise<void>((resolve) => term.write(text, resolve));
  return term;
}

function at(term: Terminal, row: number) {
  return scanCommands(term.buffer.active, row, term.cols).map((m) => ({
    command: m.command,
    from: [m.range.start.x, m.range.start.y],
    to: [m.range.end.x, m.range.end.y],
  }));
}

// Claude Code 2.1.310's reply, as it drew it: inline code in bright blue
// (SGR 94), a code block as plain indented lines with a highlighted keyword.
const CLAUDE = [
  "\x1b[97m⏺\x1b[39m To finish, run:",
  "",
  "  npm install",
  "  npm \x1b[36mtest\x1b[39m -- signup",
  "",
  "  If the tests fail, clear the cache with \x1b[94mrm -rf node_modules/.cache\x1b[39m, then restart with \x1b[94mnpm run dev\x1b[39m.",
  "",
  "  A $ line:",
  "",
  "  $ git status",
].join("\r\n");

describe("scanCommands on Claude Code's output", () => {
  it("reads each code block line as one command", async () => {
    const term = await terminal(CLAUDE);
    expect(at(term, 3)).toEqual([{ command: "npm install", from: [3, 3], to: [13, 3] }]);
    expect(at(term, 4)).toEqual([{ command: "npm test -- signup", from: [3, 4], to: [20, 4] }]);
  });

  it("reads inline code in a sentence", async () => {
    const term = await terminal(CLAUDE);
    expect(at(term, 6)).toEqual([
      { command: "rm -rf node_modules/.cache", from: [43, 6], to: [68, 6] },
      { command: "npm run dev", from: [89, 6], to: [99, 6] },
    ]);
  });

  it("drops a shell prompt in front of a command", async () => {
    const term = await terminal(CLAUDE);
    expect(at(term, 10)).toEqual([{ command: "git status", from: [5, 10], to: [14, 10] }]);
  });

  it("ends a code block line's command before its comment", async () => {
    const term = await terminal("\x1b[97m⏺\x1b[39m npm \x1b[36mtest\x1b[39m       \x1b[32m# runs node --test\x1b[39m");
    expect(at(term, 1)).toEqual([{ command: "npm test", from: [3, 1], to: [10, 1] }]);
  });

  it("leaves prose and labels alone", async () => {
    const term = await terminal(CLAUDE);
    expect(at(term, 1)).toEqual([]);
    expect(at(term, 8)).toEqual([]);
  });
});

describe("scanCommands across rows", () => {
  it("follows inline code an agent wrapped onto the next row", async () => {
    // Codex 0.163 broke the span at a blank and indented the rest.
    const green = "\x1b[38;2;166;227;161m";
    const term = await terminal(
      `If the tests fail, clear the cache with ${green}rm -rf\x1b[39m\r\n  ${green}node_modules/.cache\x1b[39m, then restart`,
    );
    const both = [{ command: "rm -rf node_modules/.cache", from: [41, 1], to: [21, 2] }];
    expect(at(term, 1)).toEqual(both);
    expect(at(term, 2)).toEqual(both);
  });

  it("reads a command the terminal wrapped as one", async () => {
    const term = await terminal("\r\n  npm run build -- --filter=web --concurrency=4", 30);
    const whole = [{ command: "npm run build -- --filter=web --concurrency=4", from: [3, 2], to: [17, 3] }];
    expect(at(term, 2)).toEqual(whole);
    expect(at(term, 3)).toEqual(whole);
  });

  it("joins a command continued with backslashes and offers it on its first row", async () => {
    const term = await terminal("Run:\r\n  docker run \\\r\n    -p 3000:3000 \\\r\n    my-image\r\n");
    expect(at(term, 2).map((m) => m.command)).toEqual(["docker run -p 3000:3000 my-image"]);
    expect(at(term, 3)).toEqual([]);
    expect(at(term, 4)).toEqual([]);
  });

  it("doesn't read a wrapped sentence's next row as a command", async () => {
    const term = await terminal("  We changed the parser so the\r\n  make build works again");
    expect(at(term, 2)).toEqual([]);
  });
});

describe("scanCommands on plain output", () => {
  it("reads a command in backticks", async () => {
    const term = await terminal("Run `npm audit fix` to fix them, or `npm audit` for details.");
    expect(at(term, 1).map((m) => m.command)).toEqual(["npm audit fix", "npm audit"]);
    expect(at(term, 1)[0]).toMatchObject({ from: [6, 1], to: [18, 1] });
  });

  it("ignores colored output that isn't a command", async () => {
    const term = await terminal("\x1b[34mnode_modules\x1b[39m  \x1b[32mpackage.json\x1b[39m  \x1b[31mgit\x1b[39m");
    expect(at(term, 1)).toEqual([]);
  });
});
