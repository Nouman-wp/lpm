import { CircleAlert, CircleCheck, Info, LoaderCircle, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ToastKind } from "./types";

const ICONS: Partial<Record<ToastKind, LucideIcon>> = {
  success: CircleCheck,
  info: Info,
  warning: TriangleAlert,
  error: CircleAlert,
  loading: LoaderCircle,
};

export function ToastIcon({ kind }: { kind: ToastKind }) {
  const Icon = ICONS[kind];
  if (!Icon) return null;
  return <Icon size={16} className={kind === "loading" ? "toast-icon animate-spin" : "toast-icon"} aria-hidden />;
}
