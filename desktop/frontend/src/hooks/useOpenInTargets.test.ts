import { describe, expect, it } from "vitest";
import { projectOpenInTargets, type OpenInTarget } from "./useOpenInTargets";
import { prefixRoot } from "../peer/markers";

const target = (id: string, over: Partial<OpenInTarget> = {}) =>
  ({ id, label: id, icon: "", fileOnly: false, remoteCapable: false, ...over }) as OpenInTarget;

const all = [
  target("vscode", { remoteCapable: true }),
  target("finder"),
  target("preview", { fileOnly: true }),
];
const ids = (list: OpenInTarget[]) => list.map((t) => t.id);

describe("projectOpenInTargets", () => {
  it("offers every folder app for a project here", () => {
    expect(ids(projectOpenInTargets(all, "/Users/me/web", {}))).toEqual(["vscode", "finder"]);
  });

  it("offers only Remote-SSH editors for an SSH project", () => {
    expect(ids(projectOpenInTargets(all, "/srv/web", { isRemote: true }))).toEqual(["vscode"]);
  });

  it("opens a paired machine's project only over SSH", () => {
    const root = prefixRoot("abcdef12", "/Users/them/web");
    expect(ids(projectOpenInTargets(all, root, {}))).toEqual([]);
    expect(ids(projectOpenInTargets(all, root, { peerViaSsh: true }))).toEqual(["vscode"]);
  });
});
