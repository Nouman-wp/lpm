import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "../notifications/toast";
import { AgentLastAnswer, SetClipboardText } from "../../bridge/commands";
import type { AgentSessionRef } from "../agentSession";

const COPIED_FLASH_MS = 1500;

/** Copies the agent's last answer — read from its own session transcript, so
 *  the clipboard gets the original markdown (tables intact) rather than what a
 *  drag-selection over the rendered terminal would capture. `copied` flashes
 *  true briefly after a successful copy; `flashCopied` triggers the same flash
 *  for a copy made elsewhere (the recent-answers pick-list). */
export function useCopyLastAnswer(projectName: string, session: AgentSessionRef) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const flashCopied = useCallback(() => {
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_FLASH_MS);
  }, []);

  const copy = async () => {
    if (await copyLastAnswer(projectName, session)) flashCopied();
  };

  return { copied, copy, flashCopied };
}

export async function copyLastAnswer(projectName: string, session: AgentSessionRef | null): Promise<boolean> {
  try {
    const text = session && (await AgentLastAnswer(projectName, session.provider, session.sessionId));
    if (!text?.trim()) {
      toast.info("No answer to copy yet");
      return false;
    }
    await SetClipboardText(text);
    return true;
  } catch (err) {
    toast.error(String(err));
    return false;
  }
}
