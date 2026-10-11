// How each connectable destination (sendTo.ts) is linked from inside the app:
// the component that walks the user through connecting it, or through adding
// one more target (a chat, a channel) once it is.

import type { ComponentType } from "react";
import { TelegramConnectSteps } from "./components/TelegramConnectSteps";

export type ConnectIntent = "connect" | "add";

export interface ConnectorProps {
  intent: ConnectIntent;
  // Destination ids of targets that turned up while the dialog was open.
  onAdded: (ids: string[]) => void;
}

export const SEND_TO_CONNECTORS: Record<string, { Steps: ComponentType<ConnectorProps>; addTitle: string }> = {
  telegram: { Steps: TelegramConnectSteps, addTitle: "Add a Telegram chat" },
};
