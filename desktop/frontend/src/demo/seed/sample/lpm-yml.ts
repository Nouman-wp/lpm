import { Document, visit } from "yaml";
import type { SeedAction, SeedProfile, SeedService } from "../types";

function service(s: SeedService): unknown {
  return s.port ? { cmd: s.cmd, port: s.port } : s.cmd;
}

// lpm orders buttons by key unless they carry a position, so every action gets
// one to keep the order the project declares.
function action(a: SeedAction, index: number): Record<string, unknown> {
  return {
    label: a.label,
    ...(a.emoji ? { emoji: a.emoji } : {}),
    cmd: a.cmd,
    ...(a.type ? { type: a.type } : {}),
    ...(a.color ? { color: a.color } : {}),
    ...(a.display ? { display: a.display } : {}),
    ...(a.confirm ? { confirm: true } : {}),
    position: index + 1,
  };
}

function section(key: string, value: Record<string, unknown>): string {
  const doc = new Document({ [key]: value });
  visit(doc, {
    Seq(_, node) {
      node.flow = true;
    },
  });
  return doc.toString({ lineWidth: 0, flowCollectionPadding: false });
}

/** The repo config a project's services, buttons and profiles come from. */
export function lpmYml(
  services: readonly SeedService[],
  actions: readonly SeedAction[],
  profiles: readonly SeedProfile[],
): string {
  const parts = [section("services", Object.fromEntries(services.map((s) => [s.name, service(s)])))];
  if (actions.length) {
    parts.push(section("actions", Object.fromEntries(actions.map((a, i) => [a.name, action(a, i)]))));
  }
  if (profiles.length) {
    parts.push(section("profiles", Object.fromEntries(profiles.map((p) => [p.name, p.services]))));
  }
  return parts.join("\n");
}
