import { Switch } from "../../ui/Switch";

interface JobOnOffToggleProps {
  label: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

// The job page's on/off switch, labelled with the state it's in.
export function JobOnOffToggle({ label, enabled, onToggle }: JobOnOffToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      title={enabled ? "Turn off" : "Turn on"}
      onClick={() => onToggle(!enabled)}
      className="flex shrink-0 items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
    >
      {enabled ? "On" : "Off"}
      <Switch checked={enabled} />
    </button>
  );
}
