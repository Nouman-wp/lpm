import { useState } from "react";
import { ChevronDown, LoaderCircle, Share } from "lucide-react";
import { BTN_SECONDARY } from "../ui/buttons";
import type { RecapTheme } from "./recapCardTheme";
import { RecapCopyButton } from "./RecapCopyButton";
import { RecapShareMenu } from "./RecapShareMenu";
import type { RecapView } from "./weeklyRecapModel";

/** Copy, the one most people want, and a menu for everywhere else. */
export function RecapShareBar({ view, theme }: { view: RecapView; theme: RecapTheme }) {
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [busy, setBusy] = useState(false);

  const run = (work: () => Promise<unknown>) => {
    setBusy(true);
    void work().finally(() => setBusy(false));
  };

  return (
    <div className="flex items-center gap-2">
      <RecapCopyButton view={view} theme={theme} />
      <button
        type="button"
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={menu !== null}
        // The menu's outside-click would otherwise close it and this click reopen it.
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => setMenu(menu ? null : e.currentTarget)}
        className={`${BTN_SECONDARY} inline-flex items-center gap-1.5`}
      >
        {busy ? <LoaderCircle size={13} className="animate-spin" /> : <Share size={13} />}
        Share
        <ChevronDown size={12} className="text-[var(--text-muted)]" />
      </button>
      {menu && (
        <RecapShareMenu
          anchor={menu}
          view={view}
          theme={theme}
          onClose={() => setMenu(null)}
          run={run}
        />
      )}
    </div>
  );
}
