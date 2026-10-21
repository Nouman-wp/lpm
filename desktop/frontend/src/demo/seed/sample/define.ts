import type { SeedGit, SeedProject } from "../types";
import { buildChanges, type ChangeSpec } from "./changes";
import { buildTree, type SampleTree } from "./generate";
import { lpmYml } from "./lpm-yml";

export interface ProjectSpec extends Omit<SeedProject, "files" | "git"> {
  git: Omit<SeedGit, "changes">;
  changes: ChangeSpec[];
  tree: SampleTree;
}

// The project's tree with its own .lpm.yml written from the services, buttons
// and profiles it declares, and the Review tab read off that same tree.
export function defineProject({ changes, tree, git, ...project }: ProjectSpec): SeedProject {
  const files = buildTree(tree.paths, tree.content);
  files[".lpm.yml"] = lpmYml(project.services, project.actions, project.profiles);
  return { ...project, files, git: { ...git, changes: buildChanges(files, changes) } };
}
