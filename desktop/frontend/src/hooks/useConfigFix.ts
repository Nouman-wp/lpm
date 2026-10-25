import { toast } from "../notifications/toast";
import { TransformText } from "../../bridge/commands";
import { stripCodeFences } from "../codeFences";
import { resolveTransformParams } from "../composerVariants";
import { isCanceledError, useAIGeneration } from "./useAIGeneration";
import { useAIPicker } from "./useAIPicker";

const instruction = (error: string) =>
  `This is an lpm config file in YAML, and lpm can't load it:\n\n${error}\n\n` +
  "Fix what that points at so the file loads. Change nothing else: keep every other key, value, " +
  "comment and blank line as it is, and return the whole file.";

// Asks the user's AI CLI to fix the problem a config file fails to load on,
// and hands back the whole file for the user to look over and save.
export function useConfigFix() {
  const ai = useAIPicker(true);
  const gen = useAIGeneration();

  const fix = async (content: string, error: string): Promise<string | null> => {
    try {
      const params = resolveTransformParams(ai);
      const out = await gen.run((genId) =>
        TransformText(null, ".", params.cli, params.model, params.effort, params.fast, instruction(error), content, genId),
      );
      const text = stripCodeFences(typeof out === "string" ? out : "");
      if (!text) {
        toast.error("AI returned an empty response");
        return null;
      }
      return `${text}\n`;
    } catch (err) {
      if (!isCanceledError(err)) toast.error(`Couldn't fix the config: ${err}`);
      return null;
    }
  };

  return { available: ai.anyAvailable, fixing: gen.generating, fix, cancel: gen.cancel };
}
