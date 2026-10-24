import YAML from "yaml";
import { describe, expect, it } from "vitest";
import {
  describeLoss,
  holdsConfig,
  lineDiffStats,
  lostActionCount,
  lostEntries,
  withKeptActions,
} from "./configReview";

const CURRENT = `name: shop
root: ~/shop
services:
  web: npm run dev
  worker: npm run worker
actions:
  deploy-staging:
    cmd: ./deploy.sh staging
    confirm: true
  # Fills the dev database.
  seed: npm run seed
  test: npm test
`;

const GENERATED = `name: shop
root: ~/shop
services:
  web: npm run dev
actions:
  test: npm test
  lint: npm run lint
`;

describe("lostEntries", () => {
  it("names what the current config has and the generated one doesn't", () => {
    expect(lostEntries(CURRENT, GENERATED)).toEqual({
      actions: ["deploy-staging", "seed"],
      services: ["worker"],
      terminals: [],
    });
  });

  it("is null when either side isn't YAML", () => {
    expect(lostEntries("a: [", GENERATED)).toBeNull();
    expect(lostEntries(CURRENT, "a: [")).toBeNull();
  });

  it("reads a missing or empty section as nothing", () => {
    expect(lostEntries("", GENERATED)).toEqual({ actions: [], services: [], terminals: [] });
    expect(lostEntries("actions:\n", "")).toEqual({ actions: [], services: [], terminals: [] });
  });
});

describe("holdsConfig", () => {
  it("counts anything past the project's identity", () => {
    expect(holdsConfig(CURRENT)).toBe(true);
    expect(holdsConfig("name: shop\nroot: ~/shop\n")).toBe(false);
    expect(holdsConfig("")).toBe(false);
    expect(holdsConfig("# just a comment\n")).toBe(false);
    expect(holdsConfig("profiles:\n  dev: [web]\n")).toBe(true);
  });

  it("counts text that isn't YAML, which would be lost too", () => {
    expect(holdsConfig("actions: [")).toBe(true);
  });
});

describe("describeLoss", () => {
  it("names one kind of entry", () => {
    expect(describeLoss({ actions: ["deploy-staging", "seed"], services: [], terminals: [] })).toBe(
      "2 actions you wrote aren't in the new one (deploy-staging, seed).",
    );
    expect(describeLoss({ actions: [], services: ["worker"], terminals: [] })).toBe(
      "1 service you wrote isn't in the new one (worker).",
    );
  });

  it("lists several kinds and shortens a long list", () => {
    expect(
      describeLoss({ actions: ["a", "b", "c", "d", "e", "f"], services: ["worker"], terminals: [] }),
    ).toBe("6 actions (a, b, c, d and 2 more) and 1 service (worker) you wrote aren't in the new one.");
  });

  it("is null when nothing goes missing", () => {
    expect(describeLoss({ actions: [], services: [], terminals: [] })).toBeNull();
  });
});

describe("lostActionCount", () => {
  it("counts actions and terminals, which the UI shows as actions", () => {
    expect(lostActionCount({ actions: ["a"], services: ["s"], terminals: ["t"] })).toBe(2);
  });
});

describe("lineDiffStats", () => {
  it("counts the lines added and removed", () => {
    expect(lineDiffStats("a\nb\nc\n", "a\nx\nc\nd\n")).toEqual({ added: 2, removed: 1 });
    expect(lineDiffStats("", "a\nb\n")).toEqual({ added: 2, removed: 0 });
    expect(lineDiffStats("a\nb", "")).toEqual({ added: 0, removed: 2 });
    expect(lineDiffStats("same\n", "same\n")).toEqual({ added: 0, removed: 0 });
  });

  it("finds a moved block as one removal and one addition", () => {
    expect(lineDiffStats("a\nb\nc\nd\n", "b\nc\nd\na\n")).toEqual({ added: 1, removed: 1 });
  });
});

describe("withKeptActions", () => {
  it("puts back the actions the generated config dropped, comments and all", () => {
    const merged = withKeptActions(GENERATED, CURRENT);
    const parsed = YAML.parse(merged);
    expect(Object.keys(parsed.actions)).toEqual(["test", "lint", "deploy-staging", "seed"]);
    expect(parsed.actions["deploy-staging"]).toEqual({ cmd: "./deploy.sh staging", confirm: true });
    expect(parsed.services).toEqual({ web: "npm run dev" });
    expect(merged).toContain("# Fills the dev database.\n  seed: npm run seed");
  });

  it("makes the section when the generated config has none", () => {
    const merged = withKeptActions("name: shop\n", "terminals:\n  repl: node\n");
    expect(YAML.parse(merged)).toEqual({ name: "shop", terminals: { repl: "node" } });
  });

  it("resolves an entry that leans on an anchor left behind", () => {
    const current = "defaults: &env\n  NODE_ENV: test\nactions:\n  seed:\n    cmd: npm run seed\n    env: *env\n";
    const merged = withKeptActions("actions:\n  lint: eslint .\n", current);
    expect(YAML.parse(merged).actions.seed).toEqual({ cmd: "npm run seed", env: { NODE_ENV: "test" } });
  });
});
