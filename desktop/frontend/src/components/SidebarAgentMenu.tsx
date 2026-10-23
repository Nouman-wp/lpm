import { ArrowUpRight, Copy, GitFork, Users } from "lucide-react";
import { AGENT_STATE_LABEL } from "../agentStatus";
import { peerSlugOf } from "../peer/markers";
import type { SidebarAgentRow } from "../sidebarAgents";
import { XIcon } from "./icons";
import { ContextMenuItem } from "./ui/ContextMenuItem";
import { ContextMenuSeparator } from "./ui/ContextMenuSeparator";
import { ContextMenuShell } from "./ui/ContextMenuShell";

export type AgentTabAction = "copyAnswer" | "fork" | "share" | "close";

interface SidebarAgentMenuProps {
  x: number;
  y: number;
  projectName: string;
  agent: SidebarAgentRow;
  onOpen: () => void;
  // Absent where the tab can't take requests; the row then only opens.
  onAction?: (action: AgentTabAction) => void;
  onClose: () => void;
}

// An agent row's right-click menu: its tab's own actions, without opening the
// tab first.
export function SidebarAgentMenu({ x, y, projectName, agent, onOpen, onAction, onClose }: SidebarAgentMenuProps) {
  const close = (fn: () => void) => () => {
    fn();
    onClose();
  };
  const act = onAction && agent.terminalId ? (action: AgentTabAction) => close(() => onAction(action)) : null;

  return (
    <ContextMenuShell x={x} y={y} minWidth={190} onClose={onClose}>
      <div className="px-3 pb-1 pt-1.5 text-[10.5px] text-[var(--text-muted)]">
        {agent.provider} · {AGENT_STATE_LABEL[agent.state]}
      </div>
      <ContextMenuItem label="Open" icon={<ArrowUpRight size={12} />} onClick={close(onOpen)} />
      {act && (
        <>
          <ContextMenuItem label="Copy last answer" icon={<Copy size={12} />} onClick={act("copyAnswer")} />
          <ContextMenuItem label="Fork session" icon={<GitFork size={12} />} onClick={act("fork")} />
          {!peerSlugOf(projectName) && (
            <ContextMenuItem label="Share tab…" icon={<Users size={12} />} onClick={act("share")} />
          )}
          <ContextMenuSeparator />
          <ContextMenuItem label="Close tab" icon={<XIcon />} onClick={act("close")} />
        </>
      )}
    </ContextMenuShell>
  );
}
