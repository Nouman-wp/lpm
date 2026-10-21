import { openProjectPort } from "../../peer/projectPorts";
import { Tooltip } from "../ui/Tooltip";

interface ServicePortLinksProps {
  projectName: string;
  ports: number[];
  className?: string;
}

export function ServicePortLinks({ projectName, ports, className = "font-mono text-[10px]" }: ServicePortLinksProps) {
  return (
    <span className={`flex shrink-0 items-center gap-1 tabular-nums ${className}`}>
      {ports.map((port) => (
        <Tooltip key={port} content={`Open :${port} in the browser`} side="bottom">
          <span
            onClick={(e) => {
              e.stopPropagation();
              void openProjectPort(projectName, port);
            }}
            className="cursor-pointer opacity-60 underline-offset-2 transition-opacity hover:text-[var(--accent-sky-text)] hover:underline hover:opacity-100"
          >
            :{port}
          </span>
        </Tooltip>
      ))}
    </span>
  );
}
