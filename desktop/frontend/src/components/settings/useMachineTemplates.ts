import { useCallback, useEffect, useState } from "react";
import { EventsOn } from "../../../bridge/runtime";
import type { TemplateCommands } from "./templateCommands";

// A machine's template names, read again whenever any of them change.
export function useMachineTemplates(templates: TemplateCommands): string[] {
  const [list, setList] = useState<string[]>([]);
  const reload = useCallback(() => {
    templates
      .list()
      .then(setList)
      .catch(() => {});
  }, [templates]);

  useEffect(() => {
    reload();
    return EventsOn("templates-changed", reload);
  }, [reload]);

  return list;
}
