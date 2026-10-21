import { describe, expect, it } from "vitest";
import { buildTree } from "./changedTree";
import { flatRows, visibleRows } from "./changedTreeRows";

const files = [
  { path: "src/components/PlanCard.tsx", status: "modified" },
  { path: "src/lib/billing.ts", status: "modified" },
  { path: "README.md", status: "modified" },
  { path: "src/lib/stripe-webhook.ts", status: "added" },
] as Parameters<typeof buildTree>[0];

describe("flatRows", () => {
  it("lists every file in tree order with no folder rows", () => {
    const tree = buildTree(files);
    const rows = flatRows(tree);
    expect(rows.map((r) => r.node.path)).toEqual([
      "src/components/PlanCard.tsx",
      "src/lib/billing.ts",
      "src/lib/stripe-webhook.ts",
      "README.md",
    ]);
    expect(rows.every((r) => r.node.kind === "file" && r.depth === 0)).toBe(true);
    expect(visibleRows(tree, new Set()).some((r) => r.node.kind === "folder")).toBe(true);
  });
});
