import { useEffect, useState } from "react";
import { Tooltip } from "../ui/Tooltip";

interface ServiceCommandProps {
  cmd: string;
}

// The command a service runs, next to its name on its own pane. A click
// copies it.
export function ServiceCommand({ cmd }: ServiceCommandProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <Tooltip content={copied ? "Copied" : "Copy command"} side="bottom" align="start" triggerClassName="flex min-w-0">
      <button
        type="button"
        onClick={() => void navigator.clipboard.writeText(cmd).then(() => setCopied(true))}
        className="min-w-0 truncate rounded px-1 font-normal opacity-60 transition-[opacity,background-color] hover:bg-[var(--terminal-header-hover)] hover:opacity-100"
      >
        {cmd}
      </button>
    </Tooltip>
  );
}
