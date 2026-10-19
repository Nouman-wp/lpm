import { MACHINE } from "../../machineWords";
import { peerNoun } from "../../peer/platform";
import type { UsageMachine } from "../../types";

export const ALL_MACHINES = "all";
export const LOCAL_MACHINE = "local";

export function machineLabel(machine: UsageMachine): string {
  return machine.local ? MACHINE.ThisMachineTitle : machine.name;
}

export function machineNames(machines: UsageMachine[]): Record<string, string> {
  return Object.fromEntries(machines.map((m) => [m.id, machineLabel(m)]));
}

// "Mac" when every computer listed is one, "computer" otherwise.
export function machinesNoun(machines: UsageMachine[]): { one: string; many: string } {
  return machines.every((m) => peerNoun(m) === "Mac")
    ? { one: "Mac", many: "Macs" }
    : { one: "computer", many: "computers" };
}

// Whether a computer's numbers are in the "All" total.
export function isCounted(machine: UsageMachine): boolean {
  return machine.connected && !machine.error;
}

export function statsSubtitle(scope: string, machines: UsageMachine[]): string {
  const picked = machines.find((m) => m.id === scope);
  if (machines.length < 2 || scope === LOCAL_MACHINE) {
    return "Local token usage across your lpm projects";
  }
  if (picked) return `Token usage on ${picked.name}`;
  const { many } = machinesNoun(machines);
  const counted = machines.filter(isCounted).length;
  return counted === machines.length
    ? `Token usage across your ${machines.length} ${many}`
    : `Token usage across ${counted} of your ${machines.length} ${many}`;
}

export function machineStatus(machine: UsageMachine): string {
  if (machine.local) return machine.name;
  if (!machine.connected) return "Offline";
  if (machine.error) return "Couldn't read its stats";
  return "Online";
}
