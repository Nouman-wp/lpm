import {
  CreateTemplate,
  DeleteTemplate,
  ListTemplates,
  ReadTemplate,
  RenameTemplate,
  SaveTemplate,
} from "../../../bridge/commands";
import type { MachineRun } from "./machineCommands";

// The config templates a machine keeps for its projects to extend (templates.rs).
// Each change emits `templates-changed`, a host's too (forwarded here).
export interface TemplateCommands {
  list: () => Promise<string[]>;
  read: (name: string) => Promise<string>;
  save: (name: string, content: string) => Promise<void>;
  create: (name: string) => Promise<void>;
  remove: (name: string) => Promise<void>;
  rename: (oldName: string, newName: string) => Promise<void>;
}

const names = (list: unknown): string[] =>
  Array.isArray(list)
    ? list.map((t: { name?: unknown }) => t?.name).filter((n): n is string => typeof n === "string")
    : [];

export const LOCAL_TEMPLATES: TemplateCommands = {
  list: () => ListTemplates().then(names),
  read: (name) => ReadTemplate(name),
  save: (name, content) => SaveTemplate(name, content),
  create: (name) => CreateTemplate(name),
  remove: (name) => DeleteTemplate(name),
  rename: (oldName, newName) => RenameTemplate(oldName, newName),
};

export function peerTemplates(run: MachineRun): TemplateCommands {
  return {
    list: () => run("list_templates").then(names),
    read: (name) => run("read_template", { name }),
    save: (name, content) => run("save_template", { name, content }),
    create: (name) => run("create_template", { name }),
    remove: (name) => run("delete_template", { name }),
    rename: (oldName, newName) => run("rename_template", { oldName, newName }),
  };
}
