import { create } from "zustand";

// The Run chip for a command in a terminal's output. The terminal's link
// provider finds the command under the pointer; the view that owns that
// terminal draws the chip and runs what's picked from it, since only it can
// open a tab in the right pane.

// Viewport pixels: where the command ends on its last row and starts on its
// first, the height of a row, and the right edge of the terminal.
export interface ChipAnchor {
  endLeft: number;
  endTop: number;
  startLeft: number;
  startTop: number;
  rowHeight: number;
  right: number;
}

export interface CommandChipTarget {
  key: string;
  terminalId: string;
  command: string;
  // Why it deserves a second look before it runs; null for everyday commands.
  risk: string | null;
  anchor: ChipAnchor;
  // Opened by ⌘-click on a risky command: asking to confirm right away.
  armed: boolean;
}

export interface CommandRunRequest {
  terminalId: string;
  command: string;
  nonce: number;
}

interface CommandChipState {
  chip: CommandChipTarget | null;
  request: CommandRunRequest | null;
}

export const useCommandChip = create<CommandChipState>(() => ({ chip: null, request: null }));

// Passing over output shouldn't flash a chip on every command; leaving one
// gives the pointer time to reach the chip.
const SHOW_MS = 150;
const HIDE_MS = 250;

let showTimer: ReturnType<typeof setTimeout> | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
let nonce = 0;

function clearTimers() {
  if (showTimer) clearTimeout(showTimer);
  if (hideTimer) clearTimeout(hideTimer);
  showTimer = null;
  hideTimer = null;
}

export function hoverCommand(target: CommandChipTarget): void {
  clearTimers();
  if (useCommandChip.getState().chip?.key === target.key) return;
  showTimer = setTimeout(() => {
    showTimer = null;
    useCommandChip.setState({ chip: target });
  }, SHOW_MS);
}

export function openCommandChip(target: CommandChipTarget): void {
  clearTimers();
  useCommandChip.setState({ chip: target });
}

export function keepCommandChip(): void {
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = null;
}

export function leaveCommand(): void {
  if (showTimer) clearTimeout(showTimer);
  showTimer = null;
  if (!useCommandChip.getState().chip || hideTimer) return;
  hideTimer = setTimeout(() => {
    hideTimer = null;
    useCommandChip.setState({ chip: null });
  }, HIDE_MS);
}

export function hideCommandChip(): void {
  clearTimers();
  if (useCommandChip.getState().chip) useCommandChip.setState({ chip: null });
}

export function requestCommandRun(terminalId: string, command: string): void {
  hideCommandChip();
  useCommandChip.setState({ request: { terminalId, command, nonce: ++nonce } });
}

export function takeCommandRun(nonceSeen: number): void {
  if (useCommandChip.getState().request?.nonce === nonceSeen) useCommandChip.setState({ request: null });
}
