import { describe, expect, it } from "vitest";
import { HANDLERS } from "./backend";
import { DEFAULTS } from "./defaults";

const sources = import.meta.glob(["../../bridge/*.js", "../**/*.{ts,tsx}", "!../**/*.test.*", "!./**"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const commands = new Set(
  Object.values(sources).flatMap((src) =>
    [...src.matchAll(/\binvoke\(\s*"([a-z0-9_]+)"/g)].map((m) => m[1]),
  ),
);

describe("demo backend", () => {
  it("reads the app's commands", () => {
    expect(commands.size).toBeGreaterThan(300);
  });

  it("answers every command the app invokes", () => {
    const missing = [...commands].filter((cmd) => !(cmd in HANDLERS) && !(cmd in DEFAULTS));
    expect(
      missing,
      "Handle these in a src/demo module, or list them in src/demo/defaults.ts with the empty value of their return type",
    ).toEqual([]);
  });

  it("lists no command it also handles", () => {
    expect(Object.keys(DEFAULTS).filter((cmd) => cmd in HANDLERS)).toEqual([]);
  });

  it("lists no command the app no longer has", () => {
    expect(Object.keys(DEFAULTS).filter((cmd) => !commands.has(cmd))).toEqual([]);
  });
});
