import { useCallback, useMemo } from "react";
import { GLOBAL_MODEL_URI } from "../monaco-setup";
import { globalLayerOf, saveLayer } from "../yamlQueue";
import type { MachineScope } from "./settings/machineCommands";
import { YamlConfigEditor } from "./YamlConfigEditor";

export function GlobalConfigEditor({ machine, onBack }: { machine: MachineScope; onBack: () => void }) {
  const layer = useMemo(() => globalLayerOf(machine.slug), [machine.slug]);
  const save = useCallback((content: string) => saveLayer(layer, content), [layer]);
  return (
    <YamlConfigEditor
      title={machine.name ? `Global config · ${machine.name}` : "Global config"}
      description={`Actions and terminals defined here are available in every project${
        machine.name ? ` on ${machine.name}` : ""
      }.`}
      modelUri={GLOBAL_MODEL_URI}
      load={layer.read}
      save={save}
      onBack={onBack}
      docsUrl="https://lpm.cx/config#global-config"
    />
  );
}
