import {
  AudioLines,
  Bell,
  DatabaseBackup,
  FileCode2,
  Keyboard,
  LayoutTemplate,
  MonitorSmartphone,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  SquareTerminal,
  type LucideIcon,
} from "lucide-react";

export const NAV_ICONS: Record<string, LucideIcon> = {
  general: SlidersHorizontal,
  notifications: Bell,
  terminal: SquareTerminal,
  shortcuts: Keyboard,
  ai: Sparkles,
  tts: AudioLines,
  templates: LayoutTemplate,
  backup: DatabaseBackup,
  mobile: Smartphone,
  connections: MonitorSmartphone,
  "global-config": FileCode2,
};
