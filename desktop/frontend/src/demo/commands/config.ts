import YAML from "yaml";
import { lpmYml } from "../seed/sample/lpm-yml";
import type { SeedAction, SeedService } from "../seed/types";
import type { Project } from "./state";

// The project's config as lpm writes it, from the same records every view reads.
export function configYaml(p: Project): string {
  return `${YAML.stringify({ name: p.name, root: p.root })}${lpmYml(p.services, p.actions, p.profiles)}`;
}

type ServiceYaml = { cmd?: string; port?: number } | string;
type ActionYaml = Partial<Pick<SeedAction, "label" | "cmd" | "emoji" | "color" | "confirm">> & {
  type?: string;
  display?: string;
};

// A config edit, applied the way lpm reloads one: services and actions keep the
// output they had when their name survives.
export function applyConfigYaml(p: Project, content: string): void {
  const doc = YAML.parse(content) as {
    label?: string;
    services?: Record<string, ServiceYaml>;
    actions?: Record<string, ActionYaml>;
    profiles?: Record<string, string[]>;
  } | null;
  if (!doc) return;
  if (doc.label !== undefined) p.label = doc.label || undefined;
  if (doc.services) {
    p.services = Object.entries(doc.services).map(([name, raw]): SeedService => {
      const spec = typeof raw === "string" ? { cmd: raw } : raw;
      const prev = p.services.find((s) => s.name === name);
      const cmd = spec.cmd ?? prev?.cmd ?? "";
      return {
        ...(prev ?? { log: [{ text: `$ ${cmd}`, color: "green", at: 0 }] }),
        name,
        cmd,
        port: spec.port,
      };
    });
  }
  if (doc.actions) {
    p.actions = Object.entries(doc.actions).map(([name, a]): SeedAction => {
      const prev = p.actions.find((x) => x.name === name);
      return {
        ...prev,
        name,
        label: a.label ?? prev?.label ?? name,
        cmd: a.cmd ?? prev?.cmd ?? "",
        emoji: a.emoji,
        color: a.color,
        confirm: a.confirm,
        display: a.display === "footer" ? "footer" : "",
        type: a.type === "terminal" ? "terminal" : "",
      };
    });
  }
  if (doc.profiles) {
    p.profiles = Object.entries(doc.profiles).map(([name, services]) => ({ name, services }));
  }
}
