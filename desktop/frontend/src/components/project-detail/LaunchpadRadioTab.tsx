import type { ButtonHTMLAttributes } from "react";
import { LAUNCHPAD_TAB, LAUNCHPAD_TAB_HOVER, launchpadTabTone } from "./launchpadTabStyle";

// One tab in the launchpad's row, picking where the prompt goes.
export function LaunchpadRadioTab({
  checked,
  children,
  ...rest
}: { checked: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      className={`${LAUNCHPAD_TAB} gap-1.5 px-2.5 ${launchpadTabTone(checked)} ${checked ? "" : LAUNCHPAD_TAB_HOVER}`}
      {...rest}
    >
      {children}
    </button>
  );
}
