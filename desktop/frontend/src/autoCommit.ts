import { toast } from "./notifications/toast";
import { GitCommit, GitPushRebasing } from "../bridge/commands";
import { getSettings } from "./store/settings";
import { DEFAULT_PUSH_CONFIG, pushFlags } from "./gitOptions";

export async function runAutoCommit(opts: {
  projectName: string;
  projectPath: string;
  paths: string[];
  andPush: boolean;
  generate: () => Promise<string>;
}): Promise<void> {
  const { projectName, projectPath, paths, andPush, generate } = opts;
  const title = `${andPush ? "Committing and pushing" : "Committing"} ${projectName}`;
  const steps = andPush ? 3 : 2;
  const id = toast.loading(title, { description: "Writing the commit message", progress: { step: 0, steps } });
  try {
    const msg = (await generate())?.trim();
    if (!msg) throw new Error("empty commit message");
    toast.loading(title, { id, description: "Committing", progress: { step: 1, steps } });
    await GitCommit(projectPath, msg, paths);
    if (!andPush) {
      toast.success(`${projectName}: committed`, { id, description: msg.split("\n")[0] });
      return;
    }
    toast.loading(title, { id, description: "Pushing", progress: { step: 2, steps } });
    const cfg = getSettings().gitPush ?? DEFAULT_PUSH_CONFIG;
    const rebased = (await GitPushRebasing(projectPath, pushFlags(cfg))) as boolean;
    toast.success(
      rebased
        ? `${projectName}: committed, rebased onto new remote commits, and pushed`
        : `${projectName}: committed and pushed`,
      { id, description: msg.split("\n")[0] },
    );
  } catch (err) {
    toast.error(`Couldn't ${andPush ? "commit and push" : "commit"} ${projectName}: ${err}`, { id });
  }
}
