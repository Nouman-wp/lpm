import { useEffect } from "react";
import { watchAgents } from "../agentToasts";

/** Toasts for agents that need you, finish or stop while their tab is out of sight. */
export function useAgentToasts(): void {
  useEffect(() => watchAgents(), []);
}
