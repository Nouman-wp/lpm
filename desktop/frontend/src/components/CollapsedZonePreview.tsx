import type { ZoneDisplay, ZoneInfo } from "../types";
import { collapsedZoneClasses } from "./CollapsedZone";
import { ChevronDownIcon, ExpandIcon } from "./icons";

export function CollapsedZonePreview({ zone, display }: { zone: ZoneInfo; display: ZoneDisplay }) {
  const classes = collapsedZoneClasses(display);
  return (
    <div className={classes.root}>
      <span className={`${classes.label} ${classes.text}`}>
        {zone.label}
        <ChevronDownIcon />
      </span>
      <span className={`${classes.expand} ${classes.text}`}>
        <ExpandIcon />
      </span>
    </div>
  );
}
