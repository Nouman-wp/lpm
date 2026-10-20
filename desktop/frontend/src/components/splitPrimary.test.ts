import { describe, expect, it } from "vitest";
import {
  childKey,
  eligibleChildren,
  inGroupColor,
  isSplitButton,
  noteChildRun,
  primaryStorageKey,
  resolvePrimaryChild,
  PRIMARY_LAST_USED,
} from "./splitPrimary";
import type { ActionInfo } from "../types";

function action(partial: Partial<ActionInfo> & { name: string }): ActionInfo {
  return {
    label: partial.name,
    cmd: "",
    confirm: false,
    display: "",
    ...partial,
  };
}

function parent(primary: string | undefined, children: ActionInfo[]): ActionInfo {
  return action({ name: "Deploy", primary, children });
}

const staging = action({ name: "Deploy:Staging", cmd: "./deploy.sh staging" });
const prod = action({ name: "Deploy:Prod", cmd: "./deploy.sh prod" });

describe("childKey", () => {
  it("extracts the last colon segment", () => {
    expect(childKey(staging)).toBe("Staging");
    expect(childKey(action({ name: "Deploy:iOS:Release" }))).toBe("Release");
  });

  it("returns the whole name when there is no colon", () => {
    expect(childKey(action({ name: "Deploy" }))).toBe("Deploy");
  });
});

describe("eligibleChildren", () => {
  it("keeps children with a cmd or without their own children", () => {
    const submenu = action({ name: "Deploy:More", cmd: "", children: [prod] });
    const leaf = action({ name: "Deploy:Note", cmd: "" });
    const result = eligibleChildren(parent(PRIMARY_LAST_USED, [staging, submenu, leaf]));
    expect(result.map(childKey)).toEqual(["Staging", "Note"]);
  });

  it("is empty when the action has no children", () => {
    expect(eligibleChildren(action({ name: "Deploy" }))).toEqual([]);
  });
});

describe("resolvePrimaryChild", () => {
  it("returns null when primary is empty", () => {
    expect(resolvePrimaryChild(parent(undefined, [staging, prod]), null)).toBeNull();
    expect(resolvePrimaryChild(parent("", [staging, prod]), "Prod")).toBeNull();
  });

  it("pins a named child", () => {
    expect(resolvePrimaryChild(parent("Prod", [staging, prod]), null)).toBe(prod);
  });

  it("falls back to first eligible child when the named child is gone", () => {
    expect(resolvePrimaryChild(parent("Gone", [staging, prod]), null)).toBe(staging);
  });

  it("uses the remembered child for last-used", () => {
    expect(resolvePrimaryChild(parent(PRIMARY_LAST_USED, [staging, prod]), "Prod")).toBe(prod);
  });

  it("falls back to first eligible child for a stale remembered value", () => {
    expect(resolvePrimaryChild(parent(PRIMARY_LAST_USED, [staging, prod]), "Removed")).toBe(staging);
  });

  it("falls back to first eligible child when nothing is remembered", () => {
    expect(resolvePrimaryChild(parent(PRIMARY_LAST_USED, [staging, prod]), null)).toBe(staging);
  });

  it("skips non-runnable children when falling back", () => {
    const submenu = action({ name: "Deploy:More", cmd: "", children: [prod] });
    expect(resolvePrimaryChild(parent(PRIMARY_LAST_USED, [submenu, prod]), null)).toBe(prod);
  });
});

describe("primaryStorageKey", () => {
  it("namespaces by scope and action", () => {
    expect(primaryStorageKey("myproj", "Deploy")).toBe("lpm.action-primary.myproj.Deploy");
  });
});

describe("isSplitButton", () => {
  it("is a split with an item to run or a command of its own", () => {
    expect(isSplitButton(parent(undefined, [staging]), staging)).toBe(true);
    expect(isSplitButton(action({ name: "Deploy", cmd: "./deploy.sh", children: [staging] }), null)).toBe(true);
  });

  it("is a menu otherwise", () => {
    expect(isSplitButton(parent(undefined, [staging]), null)).toBe(false);
  });
});

describe("noteChildRun", () => {
  it("leads a last-used split with a direct item run from its menu", () => {
    expect(noteChildRun("web", parent(PRIMARY_LAST_USED, [staging, prod]), prod)).toBe("Prod");
  });

  it("keeps the lead for nested items, other groups and fixed primaries", () => {
    const nested = action({ name: "Deploy:iOS:Release" });
    expect(noteChildRun("web", parent(PRIMARY_LAST_USED, [staging]), nested)).toBeNull();
    expect(noteChildRun("web", parent(PRIMARY_LAST_USED, [staging]), action({ name: "Other:Prod" }))).toBeNull();
    expect(noteChildRun("web", parent("Staging", [staging, prod]), prod)).toBeNull();
  });
});

describe("inGroupColor", () => {
  it("gives an uncolored item the group's color and keeps an item's own", () => {
    const group = action({ name: "Deploy", color: "cyan" });
    expect(inGroupColor(group, staging).color).toBe("cyan");
    expect(inGroupColor(group, { ...prod, color: "red" }).color).toBe("red");
    expect(inGroupColor(parent(undefined, []), staging)).toBe(staging);
  });
});
