import { enterHint } from "../shortcutHints";
import { ZapIcon } from "./icons";

export interface BrowserService {
  name: string;
  port: number;
}

export const serviceAddress = (port: number) => `localhost:${port}`;

// A browser tab's empty state while the project serves pages: each running
// service is one click (the first also opens on Return in an empty address
// bar). Colors derive from the surrounding text, so it sits on the app surface
// and on the browser's own light or dark surface alike.
export function BrowserServiceList({
  projectLabel,
  services,
  onOpen,
}: {
  projectLabel: string;
  services: BrowserService[];
  onOpen: (address: string) => void;
}) {
  const count = services.length === 1 ? "1 service" : `${services.length} services`;
  return (
    <div className="flex w-full max-w-md flex-col gap-3.5 text-center">
      <div className="flex flex-col gap-1">
        <span className="text-[15px] font-semibold tracking-tight">Open a running service</span>
        <span className="text-xs opacity-55">
          {projectLabel} has {count} serving pages right now
        </span>
      </div>
      <div className="overflow-hidden rounded-xl border border-[color-mix(in_srgb,currentColor_12%,transparent)] text-left">
        {services.map((s, i) => (
          <button
            key={`${s.name}:${s.port}`}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpen(serviceAddress(s.port));
            }}
            className="flex w-full items-center gap-3 border-t border-[color-mix(in_srgb,currentColor_10%,transparent)] px-3.5 py-2.5 transition-colors first:border-t-0 hover:bg-[color-mix(in_srgb,currentColor_7%,transparent)]"
          >
            <span className="flex shrink-0 text-[var(--accent-green-text)] [&>svg]:h-3.5 [&>svg]:w-3.5">
              <ZapIcon />
            </span>
            <span className="font-mono text-[12.5px]">{s.name}</span>
            <span className="text-xs opacity-50">{serviceAddress(s.port)}</span>
            <span className="flex-1" />
            {i === 0 && <span className="text-[11px] opacity-45">{enterHint()}</span>}
          </button>
        ))}
      </div>
      <span className="text-[11.5px] opacity-45">or type a search or web address above</span>
    </div>
  );
}
